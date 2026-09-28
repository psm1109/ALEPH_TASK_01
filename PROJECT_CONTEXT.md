# 프로젝트 현재 상태

## 기준 상태

- 현재 브랜치: `t08/passkey`
- 기준 커밋(현재 HEAD): `12abdf2f81a48e99c1171ad0a239a2ceca2d3051`
- 커밋 상태: 이번 로그인 검증 보완은 아직 커밋하지 않음
- 작업 트리: T08-C35를 위해 두 일회용 설정 코드 입력을 `text`로 바꾸고 인증 회귀 검사를 추가한 상태

## 이번 작업에서 완료한 내용

- 운영 Chrome에서 Google 비밀번호 관리자 패스키 인증에 성공하고 비공개 자료 반환을 확인했습니다.
- 운영 패스키 목록에서 3개 credential과 저장 위치를 확인했습니다. 2개는 `휴대폰 또는 동기화된 패스키 관리자`, 1개는 `이 기기의 Windows Hello 또는 기기 잠금`입니다.
- 운영 Neon에서 세 credential의 77바이트 COSE 공개키를 읽기 전용으로 확인하고 `docs/card2/README.md`에 기록했습니다. credential ID·쿠키·비밀값은 기록하지 않았습니다.
- 등록 challenge를 두 번 발급한 뒤 Neon 집계에서 활성 2개·서로 다른 값 2개·5분 만료를 확인했습니다. challenge 원문과 ceremony ID는 기록하지 않았습니다.
- 운영 등록 취소 전후 패스키 수가 3개로 동일했고, 한국어 “서버에는 패스키가 저장되지 않았습니다.” 안내와 challenge 즉시 폐기를 확인했습니다.
- 패스키 등록 시 1~40자 이름을 서버에 저장하고, 기존 패스키도 관리 화면에서 이름을 변경할 수 있도록 로컬 구현했습니다.
- 기존 credential에 이름을 채우는 `db/migrations/20260928_add_passkey_display_name.sql`을 추가했고 운영 Neon에 적용된 상태를 확인했습니다.
- 취소·포커스 실패 시 한국어 안내를 표시하고 해당 임시 challenge를 즉시 폐기하는 API와 클라이언트 처리를 추가했습니다.
- 등록 요청·응답의 가린 구조와 T08-C19~C26 판정표를 `docs/card2`에 추가했습니다.
- 운영 인증 옵션 API를 두 번 호출해 매번 새 challenge가 발급되고 값이 서로 다름을 확인했습니다(원문 대신 해시 앞 12자리만 기록).
- 운영 Neon에서 credential 3행과 공개키 77바이트, 이름 마이그레이션 적용 및 성공 로그인에 따른 `last_used_at` 갱신을 재확인했습니다.
- T08-C27~C35 판정표와 로그인 요청 증거 요약을 `docs/card3/README.md`에 추가했습니다.
- T08-C35를 위해 `/`와 `/setup`의 일회용 설정 코드 입력을 `type="text" autocomplete="one-time-code"`로 변경했습니다.
- 운영에서 변조 assertion을 보내 `401`, 같은 ceremony ID를 재사용해 `400`을 확인했습니다. 요청의 credential·ceremony 원문은 문서에 기록하지 않았습니다.
- 로그아웃 뒤 쿠키 없는 운영 요청은 `401`이었지만, 로그아웃 전 쿠키 값을 그대로 재사용하면 현재 stateless HMAC 검증을 통과함을 로컬 재현했습니다. T08-C33은 미통과입니다.

## 주요 수정 파일

- `api/_lib/passkey-name.js`, `api/passkey/register-verify.js`, `api/passkey/credentials.js`: 패스키 이름 검증·저장·조회·변경
- `index.html`, `setup/index.html`, `script.js`, `setup.js`, `passkey-client.js`, `styles.css`: 이름 입력·변경 UI와 취소 안내
- `api/passkey/challenge-cancel.js`, `api/_lib/challenges.js`: 취소된 ceremony challenge 즉시 폐기
- `db/schema.sql`, `db/migrations/20260928_add_passkey_display_name.sql`: `display_name` 컬럼과 기존 행 이름 채움
- `tests/private-boundary.test.js`: 이름·취소 보완 회귀 검사
- `docs/card2/README.md`, `docs/card2/registration-request-shape.json`: 패스키 등록 검증 결과와 등록 본문 구조
- `docs/card3/README.md`: 패스키 로그인 검증 결과와 T08-C27~C35 증거
- `tests/private-boundary.test.js`: 로그인 challenge·공개키 검증·로그아웃·비밀번호 입력칸 회귀 검사 추가
- `README.md`: 이름 마이그레이션과 challenge 취소 정책

## 실행한 검사와 실제 결과

### 통과한 정적·로컬 검사

- `npm test`
  - Vite 7.3.6 프로덕션 빌드 성공
  - 기존 학습 이미지 6장 모두 빌드 산출물에 포함됨
  - Node 테스트 18개 통과, 실패 0개
  - 기존 401/403, 캐시 금지, 공개 빌드 비공개 자료 미포함, 등록 권한, 세션 설정 검사를 포함
  - 패스키 이름 1~40자 정규화·저장 경로·목록 반환·이름 변경 경로 확인
  - 등록 취소 한국어 안내와 challenge 폐기 경로 확인
- `node --check`를 `api/**/*.js`, `script.js`, `setup.js`, `passkey-client.js`에 실행: 모두 통과
- `git diff --check`: 오류 없음(CRLF 변환 경고만 있음)
- `node --test --test-isolation=none tests/private-boundary.test.js`: 20개 통과, 실패 0개. 기본 `npm test`와 격리 기본값은 Vite/Node 하위 프로세스 `spawn EPERM`으로 실행되지 않았습니다.

### 검사 환경 제한

- 샌드박스 내부 `npm test`는 Vite의 하위 프로세스 실행에서 `spawn EPERM`으로 중단됐고, 승인된 권한 환경에서 동일 명령을 다시 실행해 통과했습니다.

### 운영에서 확인한 상태

- Chrome의 Google 비밀번호 관리자 패스키로 운영 로그인에 성공했습니다.
- `GET /api/passkey/status`: `200`, `{"registrationAvailable":false}`.
- 비인증 `GET /api/passkey/credentials`: `401`, `{"error":"패스키 인증이 필요합니다."}`.
- 인증된 패스키 목록: 3개. Google 비밀번호 관리자/휴대폰 계열 2개, Windows Hello/기기 잠금 계열 1개.
- 등록 취소 전후 credential 수: 3개로 동일. 운영 화면에서 한국어 취소 안내를 확인했습니다.
- Neon `passkey_credentials`: 3행 모두 `public_key` 77바이트. 실제 Base64 값은 `docs/card2/README.md`에 기록했습니다.
- Neon `webauthn_challenges`: 두 등록 요청 후 활성 2행, distinct challenge 2개, 각각 생성 후 약 5분 만료.

## 아직 확인하지 못한 항목

- `db/migrations/20260928_add_passkey_display_name.sql`은 운영 Neon에 적용되어 세 credential의 `display_name`이 채워져 있습니다.
- 운영 Vercel에 이름·취소 보완이 배포되었고, 운영 화면에서 사람이 붙인 패스키 이름과 한국어 취소 안내를 확인했습니다.
- 과거 실제 등록 Network 요청 본문은 저장되지 않아 `docs/card2/registration-request-shape.json`은 코드에서 도출한 가림 구조입니다. 다음 신규 등록 시 실제 Network 원문을 캡처해야 합니다.
- 인증된 패스키 목록 화면은 브라우저에서 확인했지만 저장소 이미지 파일로 저장하지 못했습니다.
- 실제 비공개 개인 내용은 여전히 자리표시자입니다.
- T08-C33은 서버 측 세션 폐기 상태가 없어 로그아웃 전 쿠키 replay를 차단하지 못합니다. 정상 브라우저 로그아웃의 쿠키 제거와 `401`만 확인됐습니다.

## 다음 작업자가 바로 실행할 순서

1. T08-C33을 통과시키려면 서버 측 세션 식별자 저장·폐기 또는 세션 버전 방식을 설계하고 로그아웃 시 해당 세션을 무효화합니다.
2. 구현 뒤 로그아웃 전에 보존한 동일 쿠키를 다시 보내 `/api/private-items`가 `401`인지 운영에서 재검증합니다.
3. 이번 변경을 배포한 뒤 `/`와 `/setup`에서 일회용 설정 코드 입력이 비밀번호 필드가 아닌지 브라우저에서 확인합니다.
4. 실제 신규 등록이 필요할 때 DevTools Network의 `/api/passkey/register-options` 및 `/api/passkey/register-verify` 요청·응답을 민감 값 `[가림]` 처리 후 저장합니다.

## 제안 커밋 메시지

```text
fix: 로그인 검증 기록과 일회용 코드 입력 정리

- [Fix] 일회용 소유자 코드 입력을 one-time-code 텍스트 필드로 통일
- [Test] challenge·공개키 검증·로그아웃 경계 회귀 검사 추가
- [Docs] 카드 3에 변조 서명과 challenge 재사용 운영 응답 기록
- [Security] 로그아웃 쿠키 replay 미차단 상태와 후속 조치 명시
```
