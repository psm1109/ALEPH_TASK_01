# Card 3 — 패스키 로그인 검증 기록

검증일은 2026-09-28(Asia/Seoul)이며, 운영 주소는 `https://aleph-task-t01.vercel.app`입니다. 운영 브라우저·Neon에서 직접 확인한 사실과 코드·회귀 검사 결과를 구분합니다. challenge·ceremony ID·credential ID·쿠키·세션/토큰 원문은 기록하지 않았습니다.

## T08-C27~C35 로그인 검증

| 기준 | 결과 | 제출 기록(민감 값 가림) |
| --- | --- | --- |
| T08-C27 | 운영 통과 | `POST /api/passkey/authenticate-options`를 2026-09-28 02:56:44 UTC에 호출해 `200`과 새 `options.challenge`를 받았습니다. 서버는 `generateAuthenticationOptions()` 직후 `saveChallenge('authentication', options.challenge)`를 실행합니다. |
| T08-C28 | 운영 통과 | 같은 API를 연속 두 번 호출했고 질문 길이는 각각 43자였습니다. 원문 대신 SHA-256 앞 12자리만 기록합니다: `abce7622c1e4`, `e81cf60152f3`. 서로 달랐고 ceremony ID 원문은 보관하지 않았습니다. |
| T08-C29 | 코드·운영 자료 통과 | `authenticate-verify.js`가 credential ID로 `passkey_credentials.public_key`를 조회하고 `verifyAuthenticationResponse()`에 전달합니다. `verification.verified`가 참일 때만 세션 쿠키를 발급합니다. 운영 Neon의 credential 3행 모두 공개키 77바이트였습니다. |
| T08-C30 | 운영 통과 | 성공 로그인은 운영 브라우저의 비공개 자료 반환과 Neon `last_used_at` 갱신으로 확인했습니다. 2026-09-28 04:45:42 UTC에는 저장된 credential ID와 의도적으로 깨뜨린 assertion을 보내 `401 {"error":"패스키 인증에 실패했습니다."}`를 확인했습니다. 요청의 credential·ceremony 원문은 기록하지 않았습니다. |
| T08-C31 | 운영 통과 | 위 실패 검증에서 소비된 동일 ceremony ID를 2026-09-28 04:45:54 UTC에 다시 보냈고 `400 {"error":"인증 요청이 만료되었거나 올바르지 않습니다."}`로 거절됐습니다. |
| T08-C32 | 코드·운영 구조 통과 | 로그인 뒤 사람을 식별하는 값은 `__Host-private_session` HttpOnly 세션 쿠키입니다. 쿠키 payload의 주체는 `owner`이고 만료는 8시간이며, 비공개 자료 API는 이 쿠키의 HMAC을 검증합니다. 토큰 원문은 기록하지 않았습니다. |
| T08-C33 | 운영 통과 | 운영 Neon에 세션 마이그레이션이 적용되고 Vercel Production이 `c3eb8da`로 배포된 상태에서 재검증했습니다. 패스키 로그인 직후 비공개 자료가 열리고 활성 세션 해시 1개가 생성됐습니다. 로그아웃 뒤 해당 행은 0개로 삭제됐고 `GET /api/private-items`는 `401 {"error":"패스키 인증이 필요합니다."}`를 반환했습니다. 동일 쿠키 replay는 삭제된 해시와 일치하는 서버 행이 없어 거절되며 회귀 검사에서도 `false`를 확인했습니다. 쿠키 원문은 `HttpOnly` 보호를 유지해 추출·기록하지 않았습니다. |
| T08-C34 | 통과 | 이 문서와 제출 자료에는 challenge·ceremony ID·credential ID·쿠키·세션/토큰 원문을 기록하지 않았습니다. 질문은 해시 앞 12자리만 남겼습니다. |
| T08-C35 | 통과 | 일회용 소유자 코드는 비밀번호가 아니므로 `/`와 `/setup` 모두 일반 텍스트 입력과 `autocomplete="one-time-code"`로 표시합니다. 실제 HTML 입력 요소에는 비밀번호 타입이 없습니다. |

### 로그인 요청 증거 요약

- 성공: 운영 브라우저에서 Google 비밀번호 관리자 패스키 로그인 후 비공개 자료가 열렸고, Neon의 해당 credential `last_used_at`이 갱신되었습니다. 세션·credential 원문은 가렸습니다.
- 실패: 저장된 credential ID와 변조 assertion을 운영 검증 API에 보냈고 `401 패스키 인증에 실패했습니다.`를 확인했습니다. 민감한 credential·ceremony 값은 `[가림]`으로 취급해 문서에 남기지 않았습니다.
- 질문 재사용: 같은 ceremony를 다시 보내 `400 인증 요청이 만료되었거나 올바르지 않습니다.`를 확인했습니다.
- 로그아웃: 정상 브라우저 흐름에서는 쿠키 제거 뒤 `401`이지만, 이전 쿠키 원문을 다시 보내는 replay는 현재 서버에서 차단되지 않습니다.

## 운영 실패·재사용 요청 기록

```text
1. 변조 서명
POST /api/passkey/authenticate-verify
ceremonyId: [가림]
credential.id: [가림]
credential.response.clientDataJSON: [의도적으로 깨진 값]
credential.response.authenticatorData: [의도적으로 깨진 값]
credential.response.signature: [의도적으로 깨진 값]

HTTP 401
{"error":"패스키 인증에 실패했습니다."}

2. 같은 질문 재사용
POST /api/passkey/authenticate-verify
ceremonyId: [1번과 같은 값, 가림]
credential: [1번과 같은 값, 가림]

HTTP 400
{"error":"인증 요청이 만료되었거나 올바르지 않습니다."}

3. 로그아웃 뒤 비공개 API
GET /api/private-items
Cookie: 없음(브라우저가 로그아웃 응답의 Max-Age=0을 적용)

HTTP 401
{"error":"패스키 인증이 필요합니다."}

4. 로그아웃 전 쿠키 값을 보존해 재사용한 로컬 판정
beforeLogout: true
logoutHeader: __Host-private_session=[가림]; Max-Age=0
replayedSameCookieAfterLogout: true

5. 서버 측 세션 폐기 보완 뒤 로컬 판정
firstSessionBeforeLogout: true
firstSessionRevoked: true
firstSessionReplayAfterLogout: false
secondDeviceSessionStillValid: true

6. 운영 배포 뒤 재검증
productionCommit: c3eb8da
activeSessionsAfterLogin: 1
storedSessionHashLength: 64
activeSessionsAfterLogout: 0
GET /api/private-items after logout: HTTP 401
response: {"error":"패스키 인증이 필요합니다."}
cookieValue: [HttpOnly, 기록하지 않음]
```

## 아직 남길 자료

- 실제 신규 등록을 다시 수행할 때 DevTools Network에서 저장한 등록 요청·응답 원문(민감 값은 `[가림]` 처리)
