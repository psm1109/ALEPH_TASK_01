-- 기존 owner와 UUID 계정을 그대로 유지하고, 표시용 사이트 사용자 ID를 연결합니다.
CREATE TABLE IF NOT EXISTS passkey_accounts (
  account_id text PRIMARY KEY,
  site_user_id text NOT NULL CHECK (site_user_id ~ '^[A-Za-z][A-Za-z0-9_-]{2,31}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS passkey_accounts_site_user_id_idx
  ON passkey_accounts (lower(site_user_id));

INSERT INTO passkey_accounts (account_id, site_user_id)
SELECT account_id,
       CASE WHEN account_id = 'owner' THEN 'owner'
            ELSE 'user_' || substring(md5(account_id) from 1 for 16) END
FROM (SELECT DISTINCT account_id FROM passkey_credentials) AS existing
ON CONFLICT (account_id) DO NOTHING;

ALTER TABLE webauthn_challenges ADD COLUMN IF NOT EXISTS site_user_id text;

-- 이전 등록 요청에는 사이트 사용자 ID가 없으므로 새 배포 뒤 재시작하게 합니다.
DELETE FROM webauthn_challenges WHERE ceremony_type = 'registration';
