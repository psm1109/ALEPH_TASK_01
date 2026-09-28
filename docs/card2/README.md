# Card 2 — 패스키 등록 검증 기록

검증일은 2026-09-28(Asia/Seoul)이며, 운영 주소는 `https://aleph-task-t01.vercel.app`입니다. 운영 브라우저·Neon에서 직접 확인한 사실과 아직 배포 전인 로컬 보완을 구분합니다. credential ID, 쿠키, 연결 문자열, 비밀키는 기록하지 않았습니다.

## 기준별 결과

| 기준 | 결과 | 증거 |
| --- | --- | --- |
| T08-C19 | 운영 통과 | `webauthn_challenges`에 등록 challenge 2개가 생성 시각부터 5분 만료 시각까지 보관됨을 읽기 전용 집계로 확인했습니다. 검증 코드는 `consumeChallenge()`에서 올바른 종류·미만료 challenge를 한 번만 삭제해 사용합니다. |
| T08-C20 | 운영 통과 | 2026-09-28 00:28:24 UTC와 00:29:24 UTC에 생성된 활성 등록 challenge가 2개였고 `count(DISTINCT challenge)`도 2였습니다. 원문 challenge와 ceremony ID는 기록하지 않았습니다. |
| T08-C21 | 운영 통과 | Neon `passkey_credentials` 3행 모두 `public_key`가 존재했고 각 값은 77바이트였습니다. |
| T08-C22 | 운영 통과 | 아래 Base64 값이 서버의 `public_key bytea` 컬럼에서 조회됐습니다. COSE 공개키이며 비밀번호 문자열이 아닙니다. |
| T08-C23 | 코드·프로토콜 통과, 실제 과거 본문 미캡처 | 등록 검증 본문은 `ceremonyId`, 사람이 붙인 `displayName`, 브라우저가 돌려준 `credential`만 전송합니다. `registration-request-shape.json`에 가린 구조를 기록했습니다. 개인키 필드가 없고 DB 스키마에도 개인키 컬럼이 없습니다. 과거 등록 당시 Network 원문은 저장하지 않았으므로 실제 캡처라고 표현하지 않습니다. |
| T08-C24 | 운영 미통과, 로컬 보완 완료 | 현재 운영 목록은 `패스키 1~3`으로만 표시됩니다. 로컬에서는 등록 시 1~40자 이름을 저장하고 기존 패스키 이름을 관리 화면에서 변경하도록 구현했습니다. DB 마이그레이션과 배포가 필요합니다. |
| T08-C25 | credential 미저장 확인, 운영 안내 미통과 | 등록을 취소하기 전후 패스키 목록은 모두 3개였습니다. 현재 운영 화면은 영어 WebAuthn 오류를 그대로 표시하고 challenge가 만료 전까지 남습니다. 로컬에서는 한국어 취소 안내를 표시하고 `/api/passkey/challenge-cancel`로 임시 challenge를 즉시 폐기하도록 보완했습니다. 배포 후 재검증이 필요합니다. |
| T08-C26 | 운영 통과 | 패스키 1·3은 `휴대폰 또는 동기화된 패스키 관리자`, 패스키 2는 `이 기기의 Windows Hello 또는 기기 잠금`으로 확인했습니다. 이번 로그인은 Chrome에서 Google 비밀번호 관리자의 패스키로 성공했습니다. |

## 서버에 저장된 공개키

아래 세 값은 2026-09-28 Neon SQL Editor에서 `encode(public_key, 'base64')`로 읽은 실제 값입니다. 모두 77바이트 COSE 공개키입니다.

```text
1. pQECAyYgASFYIKxTKWkVxpww7PFXF6582ttQsOu1qc3MgqcHBaBWXSlLIlgg/G9J5vVNA0rD9dl7jQgyLDm0z36d3ItR/9o2K7zw4hI=
2. pQECAyYgASFYIHz3MznypWxZWAjxwAzn0JixRPW+cXhkFxJaFg0t6prEIlgg42OxsuqwsDbbqOi+U1/1ooP7U07FBKxDLK4OcTTq9+g=
3. pQECAyYgASFYIHwhsIxcM4leeNBXiIkI9UEbRRMTBpRLyxklDd1VXNxVIlgg8OWkU0tHDgnemHwUnNtY0mGycsHT5/v0p6ETTwCDvLo=
```

이 값은 서버가 서명을 확인하는 데 사용하는 공개키입니다. 패스키 생성 때 인증기 또는 비밀번호 관리자가 만든 개인키는 Google 비밀번호 관리자·Windows Hello 같은 저장소 안에서 서명에만 사용되고 등록 요청이나 Neon으로 전송되지 않습니다. 서버 테이블은 `credential_id`, `public_key`, 서명 카운터, transport, 기기·백업 메타데이터, 사용자 핸들, 등록 시각을 저장하며 `private_key` 컬럼은 없습니다.

## 운영 조회 기록

공개키 확인에 사용한 읽기 전용 SQL:

```sql
SELECT
  row_number() OVER (ORDER BY created_at) AS passkey_number,
  encode(public_key, 'base64') AS public_key_base64,
  octet_length(public_key) AS public_key_bytes,
  transports, device_type, backed_up, bootstrap_registration, created_at, last_used_at
FROM passkey_credentials
ORDER BY created_at;
```

challenge 고유성 확인에 사용한 읽기 전용 SQL:

```sql
SELECT
  count(*) AS active_registration_challenges,
  count(DISTINCT challenge) AS distinct_challenges,
  min(created_at) AS first_created_at,
  max(created_at) AS last_created_at,
  min(expires_at) AS first_expires_at,
  max(expires_at) AS last_expires_at
FROM webauthn_challenges
WHERE ceremony_type = 'registration'
  AND expires_at > now();
```

결과는 활성 등록 challenge 2개, 서로 다른 challenge 2개였습니다. 생성 시각은 각각 00:28:24 UTC와 00:29:24 UTC, 만료 시각은 00:33:23 UTC와 00:34:23 UTC였습니다.

## 아직 남길 자료

- 운영에 이름·취소 보완을 배포한 뒤 사람이 붙인 이름이 보이는 패스키 목록 화면 캡처
- 배포 뒤 등록 취소 한국어 안내와 패스키 수가 변하지 않은 목록 화면 캡처
- 실제 신규 등록을 다시 수행할 때 DevTools Network에서 저장한 등록 요청·응답 원문(민감 값은 `[가림]` 처리)
