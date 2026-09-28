# 프로젝트 현재 상태

## 기준 상태

- 브랜치: `t08/passkey`; 현재 HEAD와 `origin/t08/passkey`: `983914626276b6083175cb8ad7a02544d87eb000`.
- 이번 작업 시작 전 `PROJECT_CONTEXT.md`, `README.md`, `docs/card5/README.md`에 이전 작업의 미커밋 변경이 있었습니다. 이번 사용자 ID 변경도 미커밋·미푸시입니다.
- 이번 코드 검사: `npm test`에서 Vite 빌드와 Node 검사 26개 통과.
- DB는 Supabase가 아닌 Neon입니다. 사용자가 계정 분리 SQL을 실행했고, 운영 Neon SQL Editor에서 마이그레이션 8개 명령 성공 화면을 확인했습니다.
- Vercel Production은 `9839146` 배포가 Ready이며 결과물 주소는 `https://aleph-task-t01.vercel.app/`입니다.
- 이번 `db/migrations/20260928_add_site_user_ids.sql`은 운영 Neon에서 실행하지 않았고, 이번 코드는 배포하지 않았습니다.

## 이번 작업에서 완료한 내용

- 잠긴 화면에서 `testA`·`testB` 같은 사이트 사용자 ID를 입력해 새 패스키 계정을 등록하도록 변경했습니다. 첫 등록에만 기존 설정 코드를 요구합니다.
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

- `index.html`, `script.js`, `styles.css`, `passkey-client.js`: 잠긴 화면 등록과 사용자 ID 입력·표시·변경.
- `api/passkey/register-options.js`, `api/passkey/register-verify.js`, `api/passkey/account.js`, `api/_lib/challenges.js`, `api/_lib/registration-access.js`, `api/_lib/site-user-id.js`: 계정 생성·권한·검증.
- `db/schema.sql`, `db/migrations/20260928_add_site_user_ids.sql`, `tests/private-boundary.test.js`: 저장 구조와 회귀 검사.
- `docs/card5/README.md`: 운영 A/B 양방향 요청·거절 본문·건수와 남은 기준.
- `README.md`: 운영 반영 상태.
- `PROJECT_CONTEXT.md`: 이번 재검증 인계.

## 검사 명령과 실제 결과

- 이번 턴 `npm test`: Vite 빌드 성공, Node 검사 26개 통과. 기본 샌드박스에서는 Windows 자식 프로세스 `EPERM`으로 실행되지 않아 승인된 환경에서 재실행했습니다.
- 이번 턴 `git diff --check`: 오류 없음. Windows CRLF 변환 경고만 있었습니다.
- 새 등록 흐름의 운영 Neon 마이그레이션·브라우저 검증은 미실행입니다.
- 운영 브라우저·Neon 결과는 위에 따로 적었습니다. 운영 비인증 직접 API, HTTP 상태, challenge 재사용, 삭제한 패스키 재사용은 이번 배포에서 재검증하지 않았습니다.

## 미확인·미해결

- 운영 적용 전 `db/migrations/20260928_add_site_user_ids.sql`을 실행해야 합니다. 공개 새 사용자 등록의 횟수·속도 제한은 없어 대량 계정·challenge 생성 가능성이 있습니다.
- 사용자 ID 변경만으로 기존 패스키 관리자에 저장된 표시 이름이 바뀌지는 않을 수 있습니다.
- 사용자의 Chrome 새 시크릿 창 확인은 기존 패스키 로그인 세션이 남은 창에서 이루어져 비인증 증거가 되지 않습니다. 모든 시크릿 창을 닫고 새로 열어 두 제출 URL을 로그인 없이 다시 확인해야 합니다.
- 결과물·소스 URL의 실제 제출 폼 필드 입력 여부는 확인하지 않았습니다.
- 공개 소개 본문·이미지 및 Drive/Notion 링크에 실제 개인정보가 없는지 사람의 판단이 필요합니다.
- 운영 직접 API의 비인증 `401` 및 교차 거절의 HTTP `404` Network 캡처가 없습니다. Challenge 재사용·삭제 후 로그인은 이전 카드 3·4 운영 기록을 참고했으며 이번 배포에서 재실행하지 않았습니다.
- 기기 분실 시 셀프서비스 복구 부재는 남은 위험입니다.

## 다음 작업자 순서

1. `db/migrations/20260928_add_site_user_ids.sql`을 Neon SQL Editor에서 실행하고 기존 계정 매핑을 확인합니다.
2. 코드 배포 후 잠긴 화면에서 서로 다른 사용자 ID를 등록하고 양쪽 패스키 로그인·자료 분리·기존 owner 로그인을 확인합니다.
3. 중복·잘못된 ID, 비인증 기존 계정 패스키 추가 거절, 사용자 ID 변경 범위와 공개 가입 제한 정책을 검토합니다.
4. 모든 Chrome 시크릿 창을 닫고 새 시크릿 창에서 결과물·소스 URL과 비공개 API `401`을 확인합니다. 양방향 거절 HTTP 상태와 공개 콘텐츠·제출 폼도 확인합니다.

## 제안 커밋 메시지

```text
feat: 패스키 등록에서 사이트 사용자 ID 생성 지원

- [Feat] 잠긴 화면에서 새 사용자 ID로 패스키 등록
- [Feat] 로그인 계정의 사용자 ID 표시 및 변경
- [DB] 기존 계정을 보존하는 사용자 ID 매핑 추가
- [Test] 사용자 ID 형식과 새 계정 등록 권한 검사
```
