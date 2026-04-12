-- 동일 번호가 다른 계정에 이미 인증된 경우에도 본인증은 허용하고,
-- 가입 축하 코인(가입 보상)만 지급하지 않음. profiles.phone_number 전역 UNIQUE 해제.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_number_key;

COMMENT ON TABLE public.profiles IS '본인 인증 완료 시 전화번호(계정당 1행; 번호는 전역 유일 아님 — 가입 코인은 번호당 1회)';

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
  v_skip_phone_bonus boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.blacklisted_phones WHERE phone_e164 = p_phone_e164) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_blacklisted');
  END IF;

  -- 다른(삭제되지 않은) 계정에서 이 번호로 이미 인증된 적이 있으면: 인증은 진행, 가입 코인만 생략
  v_skip_phone_bonus := EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.phone_e164 = p_phone_e164
      AND u.phone_verified_at IS NOT NULL
      AND u.deleted_at IS NULL
      AND u.id <> p_user_id
  );

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
    AND p_bonus_amount >= 1
    AND NOT v_skip_phone_bonus;

  IF COALESCE(p_grant_bonus, false) AND (p_bonus_amount IS NULL OR p_bonus_amount < 1) THEN
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
    'granted', CASE WHEN v_do_grant THEN p_bonus_amount ELSE 0 END,
    'bonus_skipped', v_skip_phone_bonus AND COALESCE(p_grant_bonus, false) AND NOT v_rewarded
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_phone_verification_success(bigint, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_phone_verification_success(bigint, text, boolean, integer) TO service_role;
