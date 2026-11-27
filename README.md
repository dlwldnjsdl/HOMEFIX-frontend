# 고쳐야집 — React + TypeScript + Vite

> 사진으로 시작하는 우리 집 홈케어. 혼자서도 뚝딱, 고쳐야ZIP!

## 현재 코드의 성격

본 폴더는 기존 Vanilla JavaScript/React 호환형 프로젝트와 **별개로 작성된 React TSX 소스 프로젝트**입니다. `src/legacy/`, `LegacyMarkup.tsx`, 직접 HTML 문자열을 주입하는 이전 화면 렌더러에 의존하지 않습니다. React 컴포넌트가 화면·입력·상태·이벤트를 관리합니다.

**주의:** 화면을 React로 재작성했다는 뜻이지, FR 91개 및 AC 63개의 모든 조건이나 API 80개 실서버 전수검증을 완료했다는 뜻이 아닙니다. 테스트 및 제한 사항은 `docs/VERIFICATION.md`를 확인하세요. 실제 운영·과제 최종 제출 전에는 테스트 계정·기사 계정·자료가 준비된 환경에서 각 업무 흐름을 검증해야 합니다.

## 실행 (Windows / VSCode)

Node.js 20.19+ 또는 22.12+ 사용을 권장합니다. Node.js 24도 가능합니다.

```powershell
npm install
npm run dev
```

브라우저에서 `http://localhost:5173/`으로 접속합니다.

Vite는 기본적으로 `https://torysv.kro.kr/fixmyhome/api/v1`에 연결합니다. 로컬 백엔드가 `8000`번 포트의 `/v1`에서 실행 중이라면 프로젝트 루트의 `.env`에 아래 값을 설정하세요.

```dotenv
API_PROXY_TARGET=http://127.0.0.1:8000
API_PROXY_PATH=/v1
```

`API_PROXY_TARGET`에 백엔드 주소를, `API_PROXY_PATH`에 API 경로 접두사를 입력하세요. `API_PROXY_PATH`를 비우면 `/api/v1`이 사용됩니다. 저장한 뒤 개발 서버를 재시작하면 적용됩니다.

배포 빌드:

```powershell
npm run typecheck
npm run build
npm run preview
```

현재 코드에는 `py serve.py`가 필요하지 않습니다. `npm run dev`는 Vite 개발 서버입니다.

## Docker 배포

### 환경 파일 준비

개발 저장소에서 `uv run scripts/sync_env.py`를 실행하면 `.env.example` 양식으로 `.env`를 준비합니다. 기존 파일이 있으면 키 순서, 구역 주석과 빈 줄을 템플릿에 맞추고, 설정 값과 따옴표, 여러 줄 값, 인라인 주석은 그대로 보존합니다. 새 키에는 예시 값을 채우고, 템플릿에 없는 키와 주석은 파일 끝 `추가 설정`에 모읍니다. 중복 키나 선언 형식 오류가 있으면 값이 표시되지 않고 원본이 유지됩니다. 변경 파일은 권한 `0600`으로 원자적으로 교체하며, 같은 상태에서 다시 실행하면 파일을 그대로 둡니다.

| 설정 | 용도 |
|---|---|
| `API_PROXY_TARGET`, `API_PROXY_PATH` | `npm run dev`에서 사용할 API 주소와 경로입니다. |
| `NGINX_ENDPOINT` | Docker에서 FE를 제공할 경로입니다. 기본 `/test`이며 `/`도 사용할 수 있습니다. |
| `FE_PORT` | 호스트의 루프백 포트입니다. 기본 `8080`입니다. |
| `DOCKER_API_UPSTREAM` | 선택 항목입니다. 컨테이너에서 접속 가능한 백엔드 URL에 API 경로까지 적습니다. 비우면 기본 원격 백엔드를 사용합니다. 호스트의 로컬 백엔드 예시는 `http://host.docker.internal:8000/v1`입니다. |
| `PUBLIC_ORIGIN` | 운영에서는 호스트 Nginx의 공개 주소를 경로 없이 지정합니다. 로컬에서는 비워 두면 `http://127.0.0.1`과 `FE_PORT`를 사용합니다. |
| `IMAGE_TAG` | 운영에서는 Docker Hub에 올린 태그를 지정합니다. 기본 태그는 `latest`입니다. |

### 로컬 빌드 및 재시작

```bash
./scripts/build-start.sh
```

이 스크립트는 `docker compose up -d --build`로 호스트 아키텍처용 이미지를 빌드합니다. 컨테이너가 정상 기동하면 마지막 줄에 `접속 주소 http://127.0.0.1:8080/test/`처럼 표시합니다.

### ARM64 이미지 게시

Docker Buildx, `curl`, `jq`가 설치된 x86 빌드 호스트에서 Docker Hub에 `docker login`을 한 뒤 실행합니다.

```bash
./scripts/build-push.sh
```

`eagleindesert/homefix-frontend`의 태그를 확인하고 푸시할 태그를 입력합니다. 비공개 저장소의 태그 조회에는 셸 환경의 `DOCKER_HUB_TOKEN`에 Hub API Bearer 토큰을 설정할 수 있습니다. Buildx는 `BUILDPLATFORM`에서 Vite를 실행하고 `linux/arm64` Nginx 이미지에 빌드 결과만 복사합니다. FE JavaScript와 CSS는 최소화하며 소스맵은 생성하지 않습니다. 임시 빌더는 자동 재시작을 끄고, 스크립트를 종료할 때 제거합니다. 성공하면 마지막 줄에 `이전 버전 1.0.0 · 현재 푸시 버전 1.0.1`처럼 표시합니다.

### Ubuntu 24.04 ARM64 VM에서 실행

Docker Compose가 설치된 VM의 단일 디렉토리에 `docker-compose-deployment.yaml`, `.env`, `start.sh`를 복사합니다. `.env`의 `PUBLIC_ORIGIN`은 호스트 Nginx의 공개 주소로, `IMAGE_TAG`는 배포할 태그로 설정합니다.

```bash
./start.sh
./start.sh 1.0.1
```

기본 실행은 `docker compose -f docker-compose-deployment.yaml up -d`와 같은 `.env` 및 Compose 설정을 사용합니다. 인수로 지정한 태그는 해당 실행에서 먼저 Pull합니다. 이후에도 그 버전을 기본으로 사용하려면 `.env`의 `IMAGE_TAG`를 갱신하세요. 시작 스크립트의 마지막 줄에 접속 주소가 표시됩니다.

호스트 Nginx는 요청 경로를 보존해 Compose 포트로 전달합니다. 아래는 기존 `server` 블록에 추가할 `/test` 경로의 예시입니다. `proxy_pass` 끝에 `/`를 붙이지 마세요.

```nginx
location = /test {
    return 308 /test/$is_args$args;
}

location ^~ /test/ {
    client_max_body_size 64m;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

공유 도메인에서는 `location`을 `NGINX_ENDPOINT`에 맞춥니다. FE 전용 도메인에서는 `location /`에서 같은 방식으로 전달하면 컨테이너가 `NGINX_ENDPOINT`에 따라 라우팅합니다. Docker의 포트 공개는 로컬과 운영 모두 `127.0.0.1`로 제한됩니다. 기본 경로에서 브라우저가 요청하는 `/test/api/v1/…`는 컨테이너 Nginx를 거쳐 `DOCKER_API_UPSTREAM`으로 전달됩니다.

## 기술 스택

- React 19: 선언형 TSX 컴포넌트/상태 관리
- TypeScript 5.9: API DTO 및 UI 상태 정적 타입 검사
- Vite 7: 개발 서버·빌드·API 로컬 프록시
- CSS: `src/styles/base.css`, `src/styles/react.css` — 디자인 토큰, 배치, 인터랙션
- 브라우저 `fetch` + 세션 쿠키: 고쳐야집 REST API v1.1
- 공식 무광 클레이 앱 아이콘과 자체 일러스트: `public/assets/`

React를 써도 HTML·CSS·JavaScript가 사라지는 것은 아닙니다. `index.html`은 진입점, CSS는 스타일, React TSX/TypeScript는 빌드 시 JavaScript로 변환됩니다.

## 폴더 아키텍처

```text
src/
  main.tsx                 React 마운트
  App.tsx                  화면 선택 및 앱 구성
  context/AppContext.tsx   로그인 세션·화면 이력·작업 상태
  components/              재사용 UI·헤더·앱 셸·카드·상태바
  pages/                   홈·접수·AI·해결 가이드·기사·상담·견적·예약·기록·보고서·기사업무
  hooks/useRemote.ts       비동기 조회 상태
  services/api.ts          REST·쿠키·업로드·멱등성 공통 API 클라이언트
  lib/format.ts            표현·검증 유틸리티
  types/models.ts          화면 DTO·도메인 타입
  styles/                  CSS
contracts/                 기획서·기능요구사항·API 1.1·FE/BE 원문
public/assets/             앱 아이콘·3D 카테고리 등 이미지
```

```text
브라우저(사용자·기사)
       │
       ▼
React + TypeScript UI
  ├─ Components + Pages
  ├─ AppContext / Hooks
  └─ services/api.ts
       │ fetch /api/v1, credentials: include
       ▼
Vite 개발 프록시 또는 배포 프록시
       │ HTTPS
       ▼
https://torysv.kro.kr/fixmyhome/api/v1
       │
       ├─ 인증·요청·사진·AI·솔루션
       ├─ 기사·상담·견적·예약·작업 상태
       └─ 경과·인계·PDF·삭제·DB
```

## 주요 화면

`AuthPage`, `HomePage`, `NewRequestPage`, `RequestsPage`, `DetailPage`, `AIPage`, `SolutionsPage`, `ExpertsPage`, `CandidatesPage`, `ConsultationsPage`, `QuotesPage`, `BookingsPage`, `RecordsPage`, `ReportPage`, `ProfilePage`, `TechnicianPages`가 모두 TSX입니다. UI 라우팅은 자체 경량 hash 라우터이며, 추후 팀원과 함께 React Router 도입 여부를 결정할 수 있습니다. 이름에 `legacy`가 붙은 실행 소스는 없습니다.

## 주의·보안

- 인증 세션은 쿠키를 사용하며 비밀번호·토큰을 `localStorage`에 보관하지 않습니다.
- 민감한 사진은 인증된 `/media/{mediaId}` API에서 읽습니다.
- 기사 역할은 서버에서 `TECHNICIAN` 권한이 있는 계정만 전환 가능합니다.
- 공개 기사 0명이 반환되면 예시 기사를 실제 기사처럼 보여주지 않습니다.
- AI 결과와 셀프 수리·공식 AS 정보는 서버의 검증된 데이터에 따라 표시해야 합니다.
- 예약·개인정보 삭제·외부 공유는 실서버 조건과 권한이 있어야 수행합니다.

## 검증과 미완료

검사 내용: `docs/VERIFICATION.md` · API 코드 참조 현황: `docs/API_PATH_AUDIT.md` · 이후 작업: `docs/REMAINING_WORK.md`.

실서버 80개를 실제로 테스트한 것과 코드의 API 참조 개수는 다릅니다. `API_PATH_AUDIT.md`의 경로 탐지는 구현 완료 판정이 아닙니다.
