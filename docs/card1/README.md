# Card 1 — 공개/비공개 경계와 비인증 차단 증거

## 비공개 자리에 정한 항목

1. 준비 중인 프로젝트 메모
2. 지원하려는 곳 목록
3. 스스로 쓰는 회고

실제 개인 내용은 Git 파일이 아니라 Neon의 `private_items`에만 입력합니다. `db/schema.sql`은 처음 구조를 확인할 수 있는 자리표시자만 만듭니다.

## 화면 경계

공개 소개의 마지막 항목 아래에 얇은 반투명 구분선을 두고, 그 아래를 어두운 잠금 패널로 구분했습니다. 인증 전 HTML에는 잠금 안내와 패스키 버튼만 있으며, 항목 제목과 본문은 `/api/private-items`의 인증된 응답으로 받은 뒤 DOM 요소의 `textContent`로 추가합니다.

화면 증거: `public-private-boundary.png`

## 비인증 서버 응답

비인증 요청의 캡처 본문은 `unauthenticated-private-response.json`에 있습니다. `tests/private-boundary.test.js`가 동일 핸들러를 쿠키 없이 호출해 다음을 검증합니다.

- 상태 코드: `401`
- 본문: `{"error":"패스키 인증이 필요합니다."}`
- 캐시: `Cache-Control: no-store, max-age=0`
- `DATABASE_URL`이 없어도 DB 연결보다 인증 거절이 먼저 실행됨

## 페이지 소스 검사

`npm test`는 Vite 빌드 후 `dist/index.html`과 모든 번들 JavaScript를 읽어 위 세 비공개 항목 문구가 하나도 포함되지 않는지 검사합니다. 이 검사는 정적/로컬 증거이며, 실제 Vercel 응답과 Neon 데이터의 운영 검증은 배포 뒤 별도로 수행해야 합니다.
