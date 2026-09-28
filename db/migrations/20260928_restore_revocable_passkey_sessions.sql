-- 기존 legacy passkey_sessions 제거 마이그레이션 이후 실행되어야 합니다.
-- 새 테이블은 원문 토큰이 아니라 무작위 세션 ID의 SHA-256 해시만 저장합니다.
CREATE TABLE IF NOT EXISTS passkey_sessions (
  session_id_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passkey_sessions_expires_at_idx
  ON passkey_sessions (expires_at);
