-- ============================================
-- 휴대폰 인증 + CoolSMS(Solapi) OTP
-- Supabase SQL Editor에서 실행 (users, NAT 마이그레이션 이후)
-- ============================================

-- 1) users: 휴대폰·인증 시각·베타 NAT 1회 지급 여부
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verification_bonus_granted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.phone_e164 IS '정규화된 국내 휴대폰 (예: 01012345678)';
COMMENT ON COLUMN public.users.phone_verified_at IS '휴대폰 인증 완료 시각';
COMMENT ON COLUMN public.users.phone_verification_bonus_granted_at IS '베타 NAT 30 지급 시각 (1회)';

-- 인증된 번호는 계정 1개만 (중복 가입 차단)
CREATE UNIQUE INDEX IF NOT EXISTS users_one_verified_phone
  ON public.users (phone_e164)
  WHERE phone_verified_at IS NOT NULL AND phone_e164 IS NOT NULL;

-- 2) SMS OTP 챌린지 (서버·클라이언트 API에서 사용, RLS로 본인만)
CREATE TABLE IF NOT EXISTS public.sms_otp_challenges (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_otp_user_created
  ON public.sms_otp_challenges(user_id, created_at DESC);

COMMENT ON TABLE public.sms_otp_challenges IS 'CoolSMS 6자리 인증번호 검증용 (해시만 저장)';

GRANT ALL ON public.sms_otp_challenges TO anon, authenticated;
ALTER TABLE public.sms_otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_otp_own" ON public.sms_otp_challenges;
CREATE POLICY "sms_otp_own" ON public.sms_otp_challenges FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
