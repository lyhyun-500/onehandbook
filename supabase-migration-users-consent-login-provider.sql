-- users: 약관·마케팅·login_provider (소셜 온보딩용)
-- 단독 실행 또는 supabase db push 로 supabase/migrations 동기화

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_agreed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_provider text;

UPDATE public.users
SET
  terms_agreed_at = COALESCE(terms_agreed_at, now()),
  privacy_agreed_at = COALESCE(privacy_agreed_at, now())
WHERE terms_agreed_at IS NULL;
