-- 현재 애플리케이션은 아래 레거시 계정 기반 테이블을 사용하지 않습니다.
-- CASCADE를 사용하지 않아 예상하지 못한 외부 의존성이 있으면 삭제가 실패하도록 합니다.
BEGIN;

DROP TABLE IF EXISTS private_items;
DROP TABLE IF EXISTS passkeys;
DROP TABLE IF EXISTS passkey_challenges;
DROP TABLE IF EXISTS passkey_sessions;
DROP TABLE IF EXISTS passkey_accounts;

COMMIT;
