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
