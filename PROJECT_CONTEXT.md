# 프로젝트 현재 상태

## 기준 상태

- 브랜치: `t08/passkey`; 현재 HEAD: `8dfd44f3515c179a8aac4a16d1f9130742ea5898`. 원격 HEAD는 이번 턴에 확인하지 않았습니다.
- 이번 작업 시작 시 작업 트리는 깨끗했습니다. 이번 `/setup` 및 등록 권한 보정은 미커밋·미푸시입니다.
- 이번 코드 검사: `npm test`에서 Vite 빌드와 Node 검사 26개 통과.
- DB는 Supabase가 아닌 Neon입니다. 사용자가 계정 분리 SQL을 실행했고, 운영 Neon SQL Editor에서 마이그레이션 8개 명령 성공 화면을 확인했습니다.
- Vercel Production은 `9839146` 배포가 Ready이며 결과물 주소는 `https://aleph-task-t01.vercel.app/`입니다.
- 이번 `db/migrations/20260928_add_site_user_ids.sql`은 운영 Neon에서 실행하지 않았고, 이번 코드는 배포하지 않았습니다.

## 이번 작업에서 완료한 내용

- 기존 커밋 `8dfd44f`의 공개 새 사용자 등록은 `/setup`의 소유자 확인을 우회하고 `/setup` 자체는 사용자 ID 누락으로 `400`이 났습니다. 이번 작업에서 공개 새 사용자 등록을 닫고 `/setup`에 사이트 사용자 ID 입력을 연결했습니다.
- 첫 계정은 `/setup` 또는 잠금 화면에서 사이트 사용자 ID와 설정 코드로 등록합니다. 이후 현재 계정 패스키 추가와 새 사용자 ID 생성 모두 인증 세션의 `패스키 등록`에서 시작합니다. 새 ID를 입력하면 별도 계정을 만들고 세션을 전환합니다.
- 내부 `account_id`는 기존 `owner` 또는 UUID로 유지하고 표시용 `site_user_id`를 따로 저장합니다. 대소문자 무시 중복을 거절합니다. 계정과 credential을 한 트랜잭션에 저장합니다.
- 로그인 후 사이트 사용자 ID 표시와 인증된 계정의 ID 변경 기능을 추가했습니다. 계정 선택은 WebAuthn 패스키 선택 창에서 합니다.
- 다음 운영 검증 내용은 이전 배포 기준이며 이번 새 등록 흐름의 운영 검증이 아닙니다.
- 운영 Chrome에서 A 패스키 로그인 시 가상 자료 3건, B 패스키 등록·로그인 시 별도 가상 자료 1건이 표시됐습니다.
- 운영 Neon에서 A/B 각각 패스키 1개, 서로 다른 WebAuthn user ID 각 1개를 확인했습니다.
- 운영 브라우저에서 B 세션의 A 자료 번호 1 직접 요청과 A 세션의 B 자료 번호 4 직접 요청이 모두 `{"error":"자료를 찾을 수 없습니다."}`를 반환했습니다. `api/private-items.js`의 서버 분기는 `404`이나 Network 상태는 별도 캡처하지 않았습니다.
- 거절 전, 첫 거절 후, 둘째 거절 후 Neon 자료 건수는 모두 A 3건·B 1건이었습니다.
- A 세션에서 URL에 B 계정 ID를 넣은 목록 요청은 A 자료 번호 1·2·3만 반환했습니다. B 자료 번호 4는 없었습니다. 계정 ID·credential ID·쿠키·challenge 원문은 문서에 기록하지 않았습니다.
- 로그인되지 않은 별도 Codex 브라우저에서 결과물 첫 공개 소개와 GitHub 공개 소스 브랜치를 열었습니다.
- `docs/card5/README.md`와 `README.md`에 운영 결과 및 아직 미확인인 기준을 반영했습니다.

## 주요 수정 파일

- `setup/index.html`, `setup.js`: `/setup`의 사용자 ID 입력과 등록 요청 전달.
- `index.html`, `script.js`, `styles.css`: 공개 등록 버튼 제거와 인증된 패스키 등록 시 계정 선택.
- `api/_lib/registration-access.js`, `api/passkey/register-options.js`, `api/passkey/register-verify.js`: 비인증 새 계정 등록 차단.
- 다음 파일은 기준 커밋 `8dfd44f`에 이미 포함된 이전 작업입니다.
- `passkey-client.js`: 사용자 ID 등록 요청 전달.
- `api/passkey/register-options.js`, `api/passkey/register-verify.js`, `api/passkey/account.js`, `api/_lib/challenges.js`, `api/_lib/registration-access.js`, `api/_lib/site-user-id.js`: 계정 생성·권한·검증.
- `db/schema.sql`, `db/migrations/20260928_add_site_user_ids.sql`, `tests/private-boundary.test.js`: 저장 구조와 회귀 검사.
- `docs/card5/README.md`: 운영 A/B 양방향 요청·거절 본문·건수와 남은 기준.
- `README.md`: 운영 반영 상태.
- `PROJECT_CONTEXT.md`: 이번 재검증 인계.

## 검사 명령과 실제 결과

- 이번 턴 `npm test`: Vite 빌드 성공, Node 검사 26개 통과.
- 이번 턴 `git diff --check`: 오류 없음. Windows CRLF 변환 경고만 있었습니다.
- 새 등록 흐름의 운영 Neon 마이그레이션·브라우저 검증은 미실행입니다.
- 운영 브라우저·Neon 결과는 위에 따로 적었습니다. 운영 비인증 직접 API, HTTP 상태, challenge 재사용, 삭제한 패스키 재사용은 이번 배포에서 재검증하지 않았습니다.

## 미확인·미해결

- 운영 적용 전 `db/migrations/20260928_add_site_user_ids.sql`을 실행해야 합니다. 공개 가입은 닫혔지만 인증 계정의 새 계정 생성에는 횟수·속도 제한이 없습니다.
- 사용자 ID 변경만으로 기존 패스키 관리자에 저장된 표시 이름이 바뀌지는 않을 수 있습니다.
- 사용자의 Chrome 새 시크릿 창 확인은 기존 패스키 로그인 세션이 남은 창에서 이루어져 비인증 증거가 되지 않습니다. 모든 시크릿 창을 닫고 새로 열어 두 제출 URL을 로그인 없이 다시 확인해야 합니다.
- 결과물·소스 URL의 실제 제출 폼 필드 입력 여부는 확인하지 않았습니다.
- 공개 소개 본문·이미지 및 Drive/Notion 링크에 실제 개인정보가 없는지 사람의 판단이 필요합니다.
- 운영 직접 API의 비인증 `401` 및 교차 거절의 HTTP `404` Network 캡처가 없습니다. Challenge 재사용·삭제 후 로그인은 이전 카드 3·4 운영 기록을 참고했으며 이번 배포에서 재실행하지 않았습니다.
- 기기 분실 시 셀프서비스 복구 부재는 남은 위험입니다.

## 다음 작업자 순서

1. `db/migrations/20260928_add_site_user_ids.sql`을 Neon SQL Editor에서 실행하고 기존 계정 매핑을 확인합니다.
2. 코드 배포 후 `/setup`의 최초 사용자 ID·설정 코드 등록, 최초 완료 뒤 `409`, 잠금 화면의 최초 등록을 확인합니다. 기존 `owner` 패스키 로그인도 확인합니다.
3. 로그인한 계정의 `패스키 등록`에서 현재 ID 추가와 새 ID 생성·전환을 확인합니다. 비인증 새 계정 요청 `403`, 중복·잘못된 ID, 자료 분리를 확인합니다.
4. 모든 Chrome 시크릿 창을 닫고 새 시크릿 창에서 결과물·소스 URL과 비공개 API `401`을 확인합니다. 양방향 거절 HTTP 상태와 공개 콘텐츠·제출 폼도 확인합니다.

## 제안 커밋 메시지

```text
fix: 최초 설정과 새 계정 등록 권한 일치

- [Fix] /setup에서 사이트 사용자 ID를 등록 API에 전달
- [Security] 비인증 새 계정 등록 차단
- [Feat] 인증된 패스키 등록에서 현재 계정과 새 사용자 ID 선택
- [Test] 공개 등록 차단과 최초 설정 흐름 검사
```
