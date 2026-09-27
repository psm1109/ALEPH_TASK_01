-- 기존 public.private_items는 다른 계정 자료가 있는 공유 테이블이므로 수정하지 않습니다.
-- 패스키로 보호되는 단일 소유자 공간은 전용 테이블을 사용합니다.
CREATE TABLE IF NOT EXISTS passkey_private_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO passkey_private_items (category, title, body, sort_order)
SELECT seed.category, seed.title, seed.body, seed.sort_order
FROM (VALUES
  ('프로젝트', '준비 중인 프로젝트 메모', 'Neon 콘솔에서 이 문장을 실제 메모로 교체하세요.', 1),
  ('지원', '지원하려는 곳 목록', 'Neon 콘솔에서 이 문장을 실제 목록으로 교체하세요.', 2),
  ('회고', '스스로 쓰는 회고', 'Neon 콘솔에서 이 문장을 실제 회고로 교체하세요.', 3)
) AS seed(category, title, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM passkey_private_items);
