-- profiles(전화 UNIQUE), 가입 보상 플래그, 탈퇴 번호 블랙리스트
-- 가입 축하 코인은 본인인증 성공 시에만(기본 잔액 0, is_rewarded 로 1회 지급)

-- ----- 1) users: 신규 가입 기본 코인 0, 가입 보상 여부 -----
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_rewarded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_rewarded IS '가입(본인인증) 축하 코인 1회 지급 여부';

ALTER TABLE public.users
  ALTER COLUMN coin_balance SET DEFAULT 0;

UPDATE public.users
SET is_rewarded = true
WHERE phone_verification_bonus_granted_at IS NOT NULL AND is_rewarded = false;

-- ----- 2) profiles: 인증된 번호 전역 UNIQUE -----
CREATE TABLE IF NOT EXISTS public.profiles (
  id bigint PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_phone_number_key UNIQUE (phone_number)
);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone_number);

COMMENT ON TABLE public.profiles IS '본인인증 완료 시 전화번호(전역 중복 불가)';

-- ----- 3) 탈퇴 번호 재가입 방지 -----
CREATE TABLE IF NOT EXISTS public.blacklisted_phones (
  phone_e164 text PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.blacklisted_phones IS '탈퇴 등으로 차단된 번호 — 인증·보상 불가';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  USING (id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

GRANT SELECT ON public.profiles TO authenticated;

-- ----- 4) apply_phone_verification_success 재정의 -----
CREATE OR REPLACE FUNCTION public.apply_phone_verification_success(
  p_user_id bigint,
  p_phone_e164 text,
  p_grant_bonus boolean,
  p_bonus_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_new int;
  v_rewarded boolean;
  v_do_grant boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.blacklisted_phones WHERE phone_e164 = p_phone_e164) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_blacklisted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone_number = p_phone_e164 AND id <> p_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_already_registered');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND phone_verified_at IS NULL AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_verified_or_missing');
  END IF;

  SELECT COALESCE(is_rewarded, false) INTO v_rewarded
  FROM public.users WHERE id = p_user_id;

  v_do_grant := COALESCE(p_grant_bonus, false)
    AND NOT v_rewarded
    AND p_bonus_amount IS NOT NULL
    AND p_bonus_amount >= 1;

  IF COALESCE(p_grant_bonus, false) AND NOT v_rewarded AND NOT v_do_grant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_bonus');
  END IF;

  UPDATE public.users SET
    phone_e164 = p_phone_e164,
    phone_verified_at = v_now,
    phone_verification_bonus_granted_at = CASE
      WHEN v_do_grant THEN v_now
      ELSE phone_verification_bonus_granted_at
    END,
    is_rewarded = CASE WHEN v_do_grant THEN true ELSE is_rewarded END,
    coin_balance = CASE
      WHEN v_do_grant THEN coin_balance + p_bonus_amount
      ELSE coin_balance
    END
  WHERE id = p_user_id AND phone_verified_at IS NULL AND deleted_at IS NULL
  RETURNING coin_balance INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'update_failed');
  END IF;

  INSERT INTO public.profiles (id, phone_number)
  VALUES (p_user_id, p_phone_e164)
  ON CONFLICT (id) DO UPDATE SET phone_number = EXCLUDED.phone_number;

  IF v_do_grant THEN
    INSERT INTO public.coin_logs (user_id, amount, type, reason, metadata)
    VALUES (
      p_user_id,
      p_bonus_amount,
      'EARN',
      'PHONE_SIGNUP_REWARD',
      jsonb_build_object('source', 'sms_otp', 'kind', 'signup_bonus')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'coin_balance', v_new,
    'granted', CASE WHEN v_do_grant THEN p_bonus_amount ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_phone_verification_success(bigint, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_phone_verification_success(bigint, text, boolean, integer) TO service_role;

-- service_role: 블랙리스트·profiles 관리
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT ON public.blacklisted_phones TO service_role;
