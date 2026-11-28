import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sync_env.py"


class SyncEnvTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="homefix-env-test-")
        self.addCleanup(directory.cleanup)
        self.cwd = Path(directory.name)
        self.root = self.cwd / "repo"
        self.script = self.root / "scripts" / SCRIPT.name
        self.script.parent.mkdir(parents=True)
        shutil.copyfile(SCRIPT, self.script)
        self.example = self.root / ".env.example"
        self.target = self.root / ".env"

    def sync(self):
        return subprocess.run(
            ["uv", "run", "--no-project", str(self.script)],
            cwd=self.cwd,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_creates_from_template_with_private_permissions(self):
        self.example.write_text("# 더미\nVALUE=example-only", encoding="utf-8")
        result = self.sync()

        self.assertEqual(result.returncode, 0)
        self.assertEqual(self.target.read_bytes(), self.example.read_bytes())
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode), 0o600)
        self.assertFalse((self.cwd / ".env").exists())
        self.assertNotIn("example-only", result.stdout + result.stderr)

    def test_updates_layout_without_adding_keys(self):
        self.target.write_text("# 과거 설정\nFIRST=fixture-first\nSECOND=fixture-second\n", encoding="utf-8")
        self.example.write_text("# 변경된 설정\nSECOND=sample\n\nFIRST=sample\n", encoding="utf-8")
        result = self.sync()

        self.assertEqual(result.returncode, 0)
        self.assertEqual(
            self.target.read_text(encoding="utf-8"),
            "# 변경된 설정\nSECOND=fixture-second\n\nFIRST=fixture-first\n",
        )
        self.assertNotIn("fixture-", result.stdout + result.stderr)

    def test_preserves_literals_and_extra_comments(self):
        existing = (
            'MULTILINE=\'fixture-line-one\nOTHER="fixture-line-two"\n# fixture-inside\' # 그대로\n'
            'QUOTED="a\\"b # c"  # 인라인\n'
            "LITERAL=fixture#hash\n"
            "EMPTY=\n"
            "# 사용자 추가 값\n"
            "EXTRA='fixture-extra' # 추가 주석\n"
            "# 추가 값 설명 끝\n"
        )
        self.target.write_text(existing, encoding="utf-8")
        self.example.write_text(
            "# 새 구역\n\nEMPTY=sample\nQUOTED=sample\nMULTILINE=sample\nLITERAL=sample\nADDED=sample-only\n",
            encoding="utf-8",
        )

        result = self.sync()
        self.assertEqual(result.returncode, 0)
        self.assertNotIn("fixture-", result.stdout + result.stderr)
        self.assertNotIn("sample-only", result.stdout + result.stderr)
        merged = self.target.read_text(encoding="utf-8")
        self.assertTrue(merged.startswith("# 새 구역\n\nEMPTY=\n"))
        for line in existing.splitlines()[:-3]:
            self.assertIn(line, merged)
        self.assertIn("ADDED=sample-only\n", merged)
        self.assertEqual(merged.count("# 추가 설정\n"), 1)
        self.assertTrue(merged.endswith("\n".join(existing.splitlines()[-3:]) + "\n"))

        original_status = self.target.stat()
        self.assertEqual(stat.S_IMODE(original_status.st_mode), 0o600)
        self.assertEqual(self.sync().returncode, 0)
        self.assertEqual(self.target.read_text(encoding="utf-8"), merged)
        self.assertEqual(self.target.stat().st_mtime_ns, original_status.st_mtime_ns)
        self.assertEqual(self.target.stat().st_ino, original_status.st_ino)

    def test_preserves_multiline_newlines(self):
        self.example.write_bytes(b'VALUE="sample"\n')
        self.target.write_bytes(b'VALUE="fixture\r\nline"\r\n')

        self.assertEqual(self.sync().returncode, 0)
        self.assertEqual(self.target.read_bytes(), b'VALUE="fixture\r\nline"\n')

    def test_does_not_duplicate_an_existing_section_with_crlf(self):
        self.example.write_bytes(b"VALUE=sample\r\n")
        self.target.write_bytes(b"VALUE=fixture\r\nEXTRA=fixture-extra\r\n")
        self.assertEqual(self.sync().returncode, 0)

        lines = self.target.read_text(encoding="utf-8").splitlines()
        self.target.write_bytes(("\r\n".join(lines) + "\r\n").encode("utf-8"))
        self.assertEqual(self.sync().returncode, 0)
        self.assertEqual(self.target.read_text(encoding="utf-8").splitlines(), lines)

    def test_errors_preserve_original_and_hide_values(self):
        self.example.write_text("VALUE=sample\n", encoding="utf-8")
        for invalid in (
            b"VALUE=fixture-secret\nVALUE=duplicate\n",
            b"VALUE='fixture-secret\n",
            b"INVALID LINE=fixture-secret\n",
            b'VALUE="fixture-secret" invalid\n',
        ):
            with self.subTest(invalid=invalid):
                self.target.write_bytes(invalid)
                result = self.sync()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(".env ", result.stderr)
                self.assertNotIn("fixture-secret", result.stdout + result.stderr)
                self.assertEqual(self.target.read_bytes(), invalid)

    def test_rejects_duplicate_template_keys(self):
        self.example.write_text("VALUE=fixture-example\nVALUE=duplicate\n", encoding="utf-8")
        self.target.write_text("VALUE=fixture-original\n", encoding="utf-8")

        result = self.sync()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(".env.example ", result.stderr)
        self.assertNotIn("fixture-", result.stdout + result.stderr)
        self.assertEqual(self.target.read_text(encoding="utf-8"), "VALUE=fixture-original\n")
