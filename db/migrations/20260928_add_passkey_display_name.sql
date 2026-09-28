ALTER TABLE passkey_credentials
  ADD COLUMN IF NOT EXISTS display_name text;

WITH unnamed_credentials AS (
  SELECT credential_id, row_number() OVER (ORDER BY created_at ASC) AS ordinal
  FROM passkey_credentials
  WHERE display_name IS NULL OR btrim(display_name) = ''
)
UPDATE passkey_credentials AS credential
SET display_name = '기존 패스키 ' || unnamed.ordinal
FROM unnamed_credentials AS unnamed
WHERE credential.credential_id = unnamed.credential_id;

ALTER TABLE passkey_credentials
  ALTER COLUMN display_name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'passkey_credentials_display_name_length'
  ) THEN
    ALTER TABLE passkey_credentials
      ADD CONSTRAINT passkey_credentials_display_name_length
      CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 40);
  END IF;
END $$;
