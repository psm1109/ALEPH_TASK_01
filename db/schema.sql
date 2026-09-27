CREATE TABLE IF NOT EXISTS passkey_credentials (
  credential_id text PRIMARY KEY,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  device_type text NOT NULL,
  backed_up boolean NOT NULL DEFAULT false,
  webauthn_user_id bytea NOT NULL,
  bootstrap_registration boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE passkey_credentials
  ADD COLUMN IF NOT EXISTS bootstrap_registration boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS passkey_credentials_single_bootstrap_idx
  ON passkey_credentials (bootstrap_registration)
  WHERE bootstrap_registration = true;

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  ceremony_id uuid PRIMARY KEY,
  ceremony_type text NOT NULL CHECK (ceremony_type IN ('registration', 'authentication')),
  challenge text NOT NULL,
  webauthn_user_id bytea,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webauthn_challenges_expires_at_idx
  ON webauthn_challenges (expires_at);

CREATE TABLE IF NOT EXISTS private_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 실제 개인 내용은 이 파일에 쓰지 말고, Neon 콘솔에서 아래 예시의 값을 바꿔 입력합니다.
-- 이 세 행은 비공개 공간이 비어 있지 않도록 만드는 안전한 초기 자리표시자입니다.
INSERT INTO private_items (category, title, body, sort_order)
SELECT seed.category, seed.title, seed.body, seed.sort_order
FROM (VALUES
  ('프로젝트', '준비 중인 프로젝트 메모', 'Neon 콘솔에서 이 문장을 실제 메모로 교체하세요.', 1),
  ('지원', '지원하려는 곳 목록', 'Neon 콘솔에서 이 문장을 실제 목록으로 교체하세요.', 2),
  ('회고', '스스로 쓰는 회고', 'Neon 콘솔에서 이 문장을 실제 회고로 교체하세요.', 3)
) AS seed(category, title, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM private_items);
