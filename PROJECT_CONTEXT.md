# 프로젝트 현재 상태

## 기준 상태

- 현재 브랜치: `t08/passkey`
- 기준 커밋(현재 HEAD): `181f8fb0c9c4f8913d75bd4e42659dbc69e0fe28`
- 커밋 상태: 이번 변경은 아직 커밋하지 않음
- 작업 트리: 패스키 비공개 공간 구현 파일이 수정·추가된 상태

## 이번 작업에서 완료한 내용

- 기존 공개 소개 페이지의 마지막 아래에 얇은 반투명 구분선과 잠금 패널을 추가했습니다.
- 구분선의 문구·배지·점선을 제거하고, 잠금 안내 왼쪽의 원형 아이콘도 제거했습니다.
- 공개 잠금 패널에서 최초 등록 코드 입력을 제거하고 `/setup` 일회성 소유자 설정 화면을 별도 Vite HTML 엔트리로 분리했습니다. 공개 `index.html` 소스에는 설정 폼도 포함되지 않습니다.
- 잠금 화면의 `패스키로 열기`를 누르면 등록된 credential 수를 먼저 확인합니다. 0개면 같은 페이지에서 일회용 소유자 확인 대화상자를 열고, 코드 확인 직후 Windows의 패스키 저장 위치 선택 창을 호출합니다. 1개 이상이면 패스키 인증을 바로 시작하며 별도 등록 버튼은 노출하지 않습니다.
- 첫 credential이 존재하면 설정 코드 등록을 옵션·검증 단계에서 모두 `409`로 차단하고, 추가 패스키는 인증된 세션에서만 등록하도록 변경했습니다.
- 패스키 저장 위치는 강제하지 않아 브라우저의 기본 선택 창에서 Windows Hello, 휴대폰·QR, 패스키 관리자 또는 보안 키를 선택할 수 있게 유지했습니다.
- 인증 전 HTML에는 비공개 항목 제목·본문을 넣지 않고, 패스키 인증 뒤 `/api/private-items`에서 받은 값만 `textContent`로 렌더링합니다.
- SimpleWebAuthn 등록·인증 옵션/검증 API, 서명된 `HttpOnly` 세션 쿠키, 로그아웃 API를 추가했습니다.
- 최초 패스키 등록은 32자 이상의 `PASSKEY_SETUP_SECRET` 또는 이미 인증된 세션이 있어야 가능합니다.
- Neon에 패스키 credential, 5분짜리 일회용 챌린지, 비공개 항목을 저장하는 `db/schema.sql`을 추가했습니다.
- 비공개 항목은 준비 중인 프로젝트 메모, 지원하려는 곳 목록, 스스로 쓰는 회고의 세 종류로 정했습니다.
- 비인증 비공개 API는 DB 접속 전에 `401`, 등록 권한이 없으면 `403`을 반환하도록 만들었습니다.
- `docs/card1`에 공개/비공개 경계 화면과 비인증 응답 본문을 남겼습니다.
- README에 설치, Neon 초기화, 환경변수, Vercel 배포 뒤 최초 등록 및 부트스트랩 비밀값 제거 순서를 기록했습니다.

## 주요 수정 파일

- `index.html`, `styles.css`, `script.js`: 공개/비공개 경계와 잠금 UI
- `setup/index.html`, `setup.js`: 공개 소개와 분리된 최초 패스키 설정 화면
- `passkey-client.js`, `scripts/build.mjs`: 공통 WebAuthn ceremony와 Vite 멀티페이지 빌드
- `api/passkey/*.js`: 등록·인증·상태 확인·로그아웃 Vercel 함수
- `api/private-items.js`: 세션 확인 뒤에만 Neon 자료를 반환하는 API
- `api/_lib/*.js`: DB, 챌린지, 설정, HTTP 응답, 세션 공통 모듈
- `db/schema.sql`: Neon 스키마와 안전한 초기 자리표시자
- `tests/private-boundary.test.js`: 401/403, 캐시 금지, 공개 빌드 누출 검사
- `docs/card1/public-private-boundary.png`: 데스크톱 잠금 화면 캡처
- `docs/card1/unauthenticated-private-response.json`: 비인증 응답 계약 캡처
- `.env.example`, `package.json`, `package-lock.json`, `vercel.json`: 실행·배포 구성
- `README.md`: 운영 설정과 검증 경계 문서

## 실행한 검사와 실제 결과

### 통과한 정적·로컬 검사

- `npm test`
  - Vite 7.3.6 프로덕션 빌드 성공
  - 기존 학습 이미지 6장 모두 빌드 산출물에 포함됨
  - Node 테스트 8개 통과, 실패 0개
  - 비인증 `/api/private-items` 응답 `401` 및 본문 확인
  - 권한 없는 패스키 등록 응답 `403` 확인
  - 공개 `dist/index.html`과 번들 JS에 세 비공개 항목 문구가 없음을 확인
  - 비공개·인증 응답의 `Cache-Control: no-store` 확인
  - 공개 잠금 패널에 최초 설정 코드 입력이 없음을 확인
  - 최초 설정 코드 재사용 `409` 정책과 추가 등록의 인증 세션 요구 확인
  - credential이 없을 때 `패스키로 열기`가 같은 페이지의 등록 ceremony를 시작하는 분기 확인
- `node --check`를 `api/**/*.js` 전체에 실행: 모두 통과
- `node`로 `package.json`, `vercel.json` JSON 파싱: 통과
- `git diff --check`: 오류 없음(CRLF 변환 경고만 있음)
- 브라우저 렌더링 확인: 공개 잠금 화면과 별도 `/setup` 진입 확인, `/setup` 390×844에서 가로 넘침 없음(`scrollWidth=390`)과 단일 열 폼 확인
- `npm install` 결과: 알려진 취약점 0건

### 확인 과정의 제한

- 관리형 샌드박스에서는 Vite 개발 서버가 상위 디렉터리 열람 권한 오류로 시작되지 않았습니다. 프로덕션 빌드와 `vite preview`는 성공했고, 화면 검증은 빌드 결과의 preview 서버에서 수행했습니다.

## 아직 확인하지 못한 항목

- 실제 Neon 프로젝트에 `db/schema.sql`을 실행하지 않았습니다.
- 실제 Vercel 환경변수를 등록하거나 배포하지 않았습니다.
- 운영 도메인의 RP ID/Origin에서 Windows Hello, Touch ID 또는 보안 키로 등록·로그인하지 않았습니다.
- Windows Hello·휴대폰·패스키 관리자 선택 창과 credential 저장은 정적 preview에서 실행하지 못했습니다.
- 운영 배포의 비인증 API가 `401`을 반환하는지, 실제 HTTP 응답 소스에 Neon의 비공개 내용이 없는지 확인하지 않았습니다.
- 실제 비공개 개인 내용은 자리표시자이며 Neon에서 사용자가 입력해야 합니다.

## 다음 작업자가 바로 실행할 순서

1. Neon SQL Editor에서 `db/schema.sql`을 실행합니다.
2. Vercel에 `.env.example`의 환경변수를 실제 값으로 설정합니다. 비밀값은 로그나 문서에 남기지 않습니다.
3. Vercel에 배포한 뒤 운영 URL과 `PASSKEY_RP_ID`, `PASSKEY_ORIGIN`이 정확히 일치하는지 확인합니다.
4. 공개 화면의 `패스키로 열기`를 눌러 같은 페이지의 일회용 소유자 확인을 마친 뒤 Windows Hello 또는 휴대폰 저장 위치가 바로 열리는지 확인하고, 로그아웃 → 패스키 로그인을 검증합니다. `/setup`은 예비 경로로만 확인합니다.
5. 첫 등록 성공 뒤 `PASSKEY_SETUP_SECRET`을 Vercel에서 제거하고 재배포해 등록 부트스트랩을 닫습니다.
6. 쿠키 없는 `GET /api/private-items`가 `401` 또는 `403`인지 확인하고, 운영 HTML/JS 응답에서 실제 비공개 문구를 검색합니다.
7. 운영 증거가 확보되면 `docs/card1/unauthenticated-private-response.json`의 로컬 계약 증거와 구분해 실제 응답 캡처를 추가합니다.
