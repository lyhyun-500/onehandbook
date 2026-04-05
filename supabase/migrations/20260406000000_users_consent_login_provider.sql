-- 약관·마케팅 동의 및 소셜 로그인 제공자
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_agreed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_provider text;

COMMENT ON COLUMN public.users.terms_agreed_at IS '이용약관 동의 시각';
COMMENT ON COLUMN public.users.privacy_agreed_at IS '개인정보 수집·이용 동의 시각';
COMMENT ON COLUMN public.users.marketing_agreed IS '마케팅 수신 동의 여부';
COMMENT ON COLUMN public.users.login_provider IS '소셜 로그인: google | naver 등';

-- 기존 행: 마이그레이션 시점에 동의한 것으로 간주(약관 모달 미노출)
UPDATE public.users
SET
  terms_agreed_at = COALESCE(terms_agreed_at, now()),
  privacy_agreed_at = COALESCE(privacy_agreed_at, now())
WHERE terms_agreed_at IS NULL;
