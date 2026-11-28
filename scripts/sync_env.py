"""Update the repository's .env from .env.example without expanding values."""

import os
import re
import stat
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SECTION_RULE = "# ============================================================================="
EXTRA_HEADING = (SECTION_RULE, "# 추가 설정", SECTION_RULE)
EXTRA_HEADER = "\n".join(EXTRA_HEADING) + "\n"
NEWLINE = r"\r\n|\n|\r"
EXTRA_HEADER_PATTERN = re.compile(
    r"(?:^|(?<=[\r\n]))"
    + "".join(f"{re.escape(line)}(?:{NEWLINE})" for line in EXTRA_HEADING)
)
LINE = re.compile(rf"([^\r\n]*)({NEWLINE}|$)")
KEY = re.compile(r"[ \t]*(?:export[ \t]+)?(?P<name>[\w.\[\]-]+)[ \t]*(?P<separator>[=:])?")
QUOTED = {
    quote: re.compile(rf"(?:\\.|[^{quote}\\])*{quote}", re.DOTALL)
    for quote in ("'", '"')
}


class SyncError(Exception):
    pass


@dataclass(frozen=True)
class Setting:
    leading: str
    prefix: str
    value: str | None
    comment: str
    ending: str

    def statement(self) -> str:
        return self.prefix + (self.value or "") + self.comment

    def with_existing_value(self, existing: "Setting") -> str:
        if self.value is None or existing.value is None:
            return existing.statement()

        comment = existing.comment
        if not comment and existing.value.strip() and self.comment:
            comment = " " + self.comment.lstrip()
        return self.prefix + existing.value + comment


@dataclass(frozen=True)
class EnvFile:
    settings: dict[str, Setting]
    trailing: str


def parse_value(
    text: str,
    start: int,
    line: re.Match[str],
    location: str,
) -> tuple[str, str, re.Match[str]]:
    raw = text[start:line.end(1)]
    literal = raw.lstrip(" \t")
    if not literal.startswith(("'", '"')):
        value, marker, comment = raw.partition(" #")
        return value, marker + comment, line

    opening = start + len(raw) - len(literal)
    closing = QUOTED[literal[0]].match(text, opening + 1)
    if closing is None:
        raise SyncError(f"{location} 따옴표가 닫히지 않았습니다.")

    line = LINE.match(text, closing.end())
    suffix = line[1]
    if suffix.lstrip().startswith("#"):
        return text[start:closing.end()], suffix, line
    if suffix.strip():
        raise SyncError(f"{location} 닫는 따옴표 뒤의 형식이 올바르지 않습니다.")
    return text[start:line.end(1)], "", line


def parse_env(text: str, filename: str) -> EnvFile:
    settings = {}
    pending = []
    line_number = 1
    position = 0

    if "\0" in text:
        raise SyncError(f"{filename}에 올바르지 않은 문자가 있습니다.")

    while position < len(text):
        line = LINE.match(text, position)
        if not line[1].strip() or line[1].lstrip().startswith("#"):
            pending.append(line[0])
            line_number += 1
            position = line.end()
            continue

        location = f"{filename} {line_number}행"
        key = KEY.match(text, position)
        if key is None or (key["separator"] is None and key.end() != line.end(1)):
            raise SyncError(f"{location} 환경변수 선언 형식이 올바르지 않습니다.")
        name = key["name"]
        if name in settings:
            raise SyncError(f"{location} 환경변수 키가 중복되었습니다.")

        value, comment = None, ""
        if key["separator"] is not None:
            value, comment, line = parse_value(text, key.end(), line, location)
        settings[name] = Setting("".join(pending), key[0], value, comment, line[2])
        pending.clear()
        line_number += len(re.findall(NEWLINE, text[position:line.end()]))
        position = line.end()

    return EnvFile(settings, "".join(pending))


def merge(example: EnvFile, existing: EnvFile) -> str:
    chunks = []
    for name, setting in example.settings.items():
        previous = existing.settings.get(name)
        statement = setting.statement() if previous is None else setting.with_existing_value(previous)
        chunks.extend((setting.leading, statement, setting.ending))
    chunks.append(example.trailing)

    extras = [setting for name, setting in existing.settings.items() if name not in example.settings]
    if not extras:
        return "".join(chunks)

    template = "".join(chunks)
    if template and not template.endswith(("\n", "\r")):
        template += "\n"
    if template and not template.endswith(("\n\n", "\r\n\r\n", "\r\r")):
        template += "\n"

    chunks = [template, EXTRA_HEADER]
    for setting in extras:
        # The first extra setting carries the section heading from an earlier run.
        leading = EXTRA_HEADER_PATTERN.split(setting.leading, maxsplit=1)[-1]
        chunks.extend((leading, setting.statement(), setting.ending))
    if next(reversed(existing.settings)) not in example.settings:
        chunks.append(existing.trailing)
    return "".join(chunks)


def file_status(path: Path) -> os.stat_result | None:
    try:
        status = path.lstat()
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(status.st_mode):
        raise SyncError(".env는 일반 파일이어야 합니다.")
    return status


def revision(status: os.stat_result | None) -> tuple[int, int, int] | None:
    if status is None:
        return None
    return status.st_dev, status.st_ino, status.st_ctime_ns


def replace_env(path: Path, content: bytes, original: os.stat_result | None) -> None:
    descriptor, filename = tempfile.mkstemp(dir=path.parent, prefix=".env.")
    temporary = Path(filename)
    try:
        with os.fdopen(descriptor, "wb") as staged:
            os.chmod(temporary, 0o600)
            staged.write(content)
            staged.flush()
            os.fsync(staged.fileno())

        if revision(file_status(path)) != revision(original):
            raise SyncError("동기화 중 .env가 변경되었습니다. 다시 실행해 주세요.")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> int:
    target = ROOT / ".env"
    try:
        example_bytes = (ROOT / ".env.example").read_bytes()
        example_text = example_bytes.decode("utf-8")
        example = parse_env(example_text.removeprefix("\ufeff"), ".env.example")
        original_status = file_status(target)

        if original_status is None:
            replace_env(target, example_bytes, original_status)
            print(".env를 생성했습니다.")
            return 0

        original = target.read_bytes()
        existing = parse_env(original.decode("utf-8-sig"), ".env")
        merged = merge(example, existing)
        if example_text.startswith("\ufeff"):
            merged = "\ufeff" + merged
        updated = merged.encode("utf-8")

        if updated == original and stat.S_IMODE(original_status.st_mode) == 0o600:
            print(".env가 이미 최신 양식입니다.")
            return 0

        replace_env(target, updated, original_status)
        print(".env 양식을 동기화했습니다.")
        return 0
    except SyncError as error:
        print(error, file=sys.stderr)
    except UnicodeError:
        print(".env와 .env.example의 UTF-8 인코딩을 확인해 주세요.", file=sys.stderr)
    except OSError:
        print(".env 또는 .env.example을 처리하지 못했습니다. 파일과 권한을 확인해 주세요.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
