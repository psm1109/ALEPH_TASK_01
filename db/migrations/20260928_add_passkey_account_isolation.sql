-- 기존 패스키·세션·비공개 자료는 모두 원래 owner 계정에 보존합니다.
ALTER TABLE passkey_credentials ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT 'owner';
ALTER TABLE passkey_sessions ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT 'owner';
ALTER TABLE passkey_private_items ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT 'owner';
ALTER TABLE webauthn_challenges ADD COLUMN IF NOT EXISTS account_id text;
ALTER TABLE webauthn_challenges ADD COLUMN IF NOT EXISTS source_account_id text;

CREATE INDEX IF NOT EXISTS passkey_credentials_account_id_idx ON passkey_credentials (account_id);
CREATE INDEX IF NOT EXISTS passkey_private_items_account_id_idx ON passkey_private_items (account_id, sort_order, id);

-- 이전 버전의 등록 challenge에는 계정 정보가 없으므로 재사용하지 않습니다.
DELETE FROM webauthn_challenges WHERE ceremony_type = 'registration' AND account_id IS NULL;
