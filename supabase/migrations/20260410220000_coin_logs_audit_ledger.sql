-- =============================================================================
-- 회계 감사 수준 코인 원장: coin_logs + users.coin_balance (기존 nat_balance·nat_ledger 대체)
-- =============================================================================

-- ----- 1) Enum & 테이블 -----
DO $$ BEGIN
  CREATE TYPE public.coin_log_type AS ENUM ('EARN', 'USE', 'EXPIRE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.coin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  amount integer NOT NULL,
  type public.coin_log_type NOT NULL,
  reason text NOT NULL,
  ref_type text,
  ref_id bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coin_logs_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT coin_logs_amount_sign CHECK (
    (type = 'EARN' AND amount > 0)
    OR (type IN ('USE', 'EXPIRE') AND amount < 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_coin_logs_user_created
  ON public.coin_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_logs_created
  ON public.coin_logs (created_at DESC);

COMMENT ON TABLE public.coin_logs IS '코인(NAT) 원장 — 잔액 변경은 반드시 본 테이블과 동시 기록';

-- ----- 2) users: nat_balance → coin_balance -----
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'nat_balance'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN nat_balance TO coin_balance;
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS coin_balance integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.users.coin_balance IS '코인(NAT) 잔액 — coin_logs 합계와 정합';

-- ----- 3) nat_ledger → coin_logs 백필 (테이블 있을 때만) -----
DO $$
BEGIN
  IF to_regclass('public.nat_ledger') IS NOT NULL THEN
    INSERT INTO public.coin_logs (user_id, amount, type, reason, ref_type, ref_id, metadata, created_at)
    SELECT
      nl.user_id,
      nl.delta,
      CASE WHEN nl.delta > 0 THEN 'EARN'::public.coin_log_type ELSE 'USE'::public.coin_log_type END,
      CASE nl.reason
        WHEN 'analysis' THEN 'ANALYSIS_RUN'
        WHEN 'purchase_credit' THEN 'PURCHASE_CREDIT'
        WHEN 'refund' THEN 'REFUND'
        WHEN 'bonus' THEN 'BONUS'
        WHEN 'admin_adjust' THEN CASE WHEN nl.delta >= 0 THEN 'ADMIN_CREDIT' ELSE 'ADMIN_DEBIT' END
        WHEN 'manual_adjust' THEN CASE WHEN nl.delta >= 0 THEN 'MANUAL_CREDIT' ELSE 'MANUAL_DEBIT' END
        ELSE 'OTHER'
      END,
      nl.ref_type,
      nl.ref_id,
      nl.metadata,
      nl.created_at
    FROM public.nat_ledger nl;
  END IF;
END $$;

-- ----- 4) 잔액 vs 원장 차이 보정(초기 기본 지급·직접 수정 등), 멱등 1회 -----
INSERT INTO public.coin_logs (user_id, amount, type, reason, metadata)
SELECT
  u.id,
  (u.coin_balance - COALESCE(t.sum_amt, 0))::integer,
  CASE
    WHEN (u.coin_balance - COALESCE(t.sum_amt, 0)) > 0 THEN 'EARN'::public.coin_log_type
    WHEN (u.coin_balance - COALESCE(t.sum_amt, 0)) < 0 THEN 'USE'::public.coin_log_type
  END,
  'MIGRATION_BALANCE_RECONCILE',
  jsonb_build_object('note', 'one-time align sum(coin_logs) with coin_balance')
FROM public.users u
LEFT JOIN (
  SELECT user_id, SUM(amount)::bigint AS sum_amt
  FROM public.coin_logs
  GROUP BY user_id
) t ON t.user_id = u.id
WHERE u.deleted_at IS NULL
  AND (u.coin_balance - COALESCE(t.sum_amt, 0)) <> 0
  AND NOT EXISTS (
    SELECT 1 FROM public.coin_logs c0
    WHERE c0.user_id = u.id AND c0.reason = 'MIGRATION_BALANCE_RECONCILE'
  );

-- ----- 5) nat_ledger 제거(원장은 coin_logs만) -----
DROP TABLE IF EXISTS public.nat_ledger CASCADE;

-- ----- 6) consume_nat: coin_balance + coin_logs(USE) -----
CREATE OR REPLACE FUNCTION public.consume_nat(
  p_amount integer,
  p_ref_type text DEFAULT NULL,
  p_ref_id bigint DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
  v_uid bigint;
  v_bal int;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT id, coin_balance INTO v_uid, v_bal
  FROM public.users
  WHERE auth_id = auth.uid() AND deleted_at IS NULL;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  IF COALESCE(v_bal, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_nat',
      'balance', COALESCE(v_bal, 0),
      'required', p_amount
    );
  END IF;

  UPDATE public.users
  SET coin_balance = coin_balance - p_amount
  WHERE id = v_uid AND coin_balance >= p_amount AND deleted_at IS NULL
  RETURNING coin_balance INTO v_new;

  IF v_new IS NULL THEN
    SELECT coin_balance INTO v_bal FROM public.users WHERE id = v_uid;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_nat',
      'balance', COALESCE(v_bal, 0),
      'required', p_amount
    );
  END IF;

  INSERT INTO public.coin_logs (
    user_id, amount, type, reason, ref_type, ref_id, metadata
  ) VALUES (
    v_uid,
    -p_amount,
    'USE',
    'ANALYSIS_RUN',
    p_ref_type,
    p_ref_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_nat(integer, text, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_nat(integer, text, bigint, jsonb) TO authenticated;

-- ----- 7) credit_nat: coin_balance + coin_logs(EARN) -----
CREATE OR REPLACE FUNCTION public.credit_nat(
  p_user_id bigint,
  p_amount integer,
  p_reason text,
  p_ref_type text DEFAULT NULL,
  p_ref_id bigint DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
  v_reason text;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN (
    'purchase_credit', 'refund', 'bonus', 'admin_adjust', 'manual_adjust', 'other'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  v_reason := CASE p_reason
    WHEN 'purchase_credit' THEN 'PURCHASE_CREDIT'
    WHEN 'refund' THEN 'REFUND'
    WHEN 'bonus' THEN 'BONUS'
    WHEN 'admin_adjust' THEN 'ADMIN_CREDIT'
    WHEN 'manual_adjust' THEN 'MANUAL_ADJUST'
    ELSE 'OTHER'
  END;

  UPDATE public.users
  SET coin_balance = coin_balance + p_amount
  WHERE id = p_user_id AND deleted_at IS NULL
  RETURNING coin_balance INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  INSERT INTO public.coin_logs (
    user_id, amount, type, reason, ref_type, ref_id, metadata
  ) VALUES (
    p_user_id,
    p_amount,
    'EARN',
    v_reason,
    p_ref_type,
    p_ref_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_nat(
  bigint, integer, text, text, bigint, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_nat(
  bigint, integer, text, text, bigint, jsonb
) TO service_role;

-- ----- 8) 탈퇴 시 잔액 소멸: EXPIRE / USER_WITHDRAWAL -----
CREATE OR REPLACE FUNCTION public.expire_coins_on_user_withdrawal(p_user_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal int;
  v_new int;
BEGIN
  SELECT coin_balance INTO v_bal
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_bal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  IF v_bal <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'expired', 0, 'balance', v_bal);
  END IF;

  UPDATE public.users
  SET coin_balance = 0
  WHERE id = p_user_id
  RETURNING coin_balance INTO v_new;

  INSERT INTO public.coin_logs (user_id, amount, type, reason, metadata)
  VALUES (
    p_user_id,
    -v_bal,
    'EXPIRE',
    'USER_WITHDRAWAL',
    jsonb_build_object('note', 'account withdrawal')
  );

  RETURN jsonb_build_object('ok', true, 'expired', v_bal, 'balance', COALESCE(v_new, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.expire_coins_on_user_withdrawal(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_coins_on_user_withdrawal(bigint) TO service_role;

-- ----- 9) 휴대폰 인증 완료 + 보너스(원장 동시 기록) — 서비스 롤 전용 -----
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND phone_verified_at IS NULL AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_verified_or_missing');
  END IF;

  IF p_grant_bonus AND (p_bonus_amount IS NULL OR p_bonus_amount < 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_bonus');
  END IF;

  UPDATE public.users SET
    phone_e164 = p_phone_e164,
    phone_verified_at = v_now,
    phone_verification_bonus_granted_at = CASE
      WHEN p_grant_bonus THEN v_now
      ELSE phone_verification_bonus_granted_at
    END,
    coin_balance = CASE
      WHEN p_grant_bonus THEN coin_balance + p_bonus_amount
      ELSE coin_balance
    END
  WHERE id = p_user_id AND phone_verified_at IS NULL AND deleted_at IS NULL
  RETURNING coin_balance INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'update_failed');
  END IF;

  IF p_grant_bonus THEN
    INSERT INTO public.coin_logs (user_id, amount, type, reason, metadata)
    VALUES (
      p_user_id,
      p_bonus_amount,
      'EARN',
      'PHONE_VERIFICATION_REWARD',
      jsonb_build_object('source', 'sms_otp')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'coin_balance', v_new,
    'granted', CASE WHEN p_grant_bonus THEN p_bonus_amount ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_phone_verification_success(bigint, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_phone_verification_success(bigint, text, boolean, integer) TO service_role;

-- ----- 10) 통계 RPC (서비스 롤·관리용) -----
CREATE OR REPLACE FUNCTION public.coin_logs_daily_totals(p_from date, p_to date)
RETURNS TABLE (
  bucket date,
  earn_sum bigint,
  use_sum bigint,
  expire_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (cl.created_at AT TIME ZONE 'UTC')::date AS bucket,
    COALESCE(SUM(CASE WHEN cl.type = 'EARN' THEN cl.amount ELSE 0 END), 0)::bigint AS earn_sum,
    COALESCE(SUM(CASE WHEN cl.type = 'USE' THEN -cl.amount ELSE 0 END), 0)::bigint AS use_sum,
    COALESCE(SUM(CASE WHEN cl.type = 'EXPIRE' THEN -cl.amount ELSE 0 END), 0)::bigint AS expire_sum
  FROM public.coin_logs cl
  WHERE (cl.created_at AT TIME ZONE 'UTC')::date >= p_from
    AND (cl.created_at AT TIME ZONE 'UTC')::date <= p_to
  GROUP BY (cl.created_at AT TIME ZONE 'UTC')::date
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.coin_logs_monthly_totals(p_from date, p_to date)
RETURNS TABLE (
  bucket date,
  earn_sum bigint,
  use_sum bigint,
  expire_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', (cl.created_at AT TIME ZONE 'UTC')::date)::date AS bucket,
    COALESCE(SUM(CASE WHEN cl.type = 'EARN' THEN cl.amount ELSE 0 END), 0)::bigint AS earn_sum,
    COALESCE(SUM(CASE WHEN cl.type = 'USE' THEN -cl.amount ELSE 0 END), 0)::bigint AS use_sum,
    COALESCE(SUM(CASE WHEN cl.type = 'EXPIRE' THEN -cl.amount ELSE 0 END), 0)::bigint AS expire_sum
  FROM public.coin_logs cl
  WHERE (cl.created_at AT TIME ZONE 'UTC')::date >= p_from
    AND (cl.created_at AT TIME ZONE 'UTC')::date <= p_to
  GROUP BY date_trunc('month', (cl.created_at AT TIME ZONE 'UTC')::date)
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION public.coin_logs_daily_totals(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coin_logs_monthly_totals(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coin_logs_daily_totals(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.coin_logs_monthly_totals(date, date) TO service_role;

-- ----- 10b) 정합 불일치 행 (관리 스크립트용) -----
CREATE OR REPLACE FUNCTION public.admin_coin_balance_mismatches()
RETURNS TABLE (user_id bigint, coin_balance integer, ledger_sum bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    u.coin_balance,
    COALESCE(SUM(cl.amount), 0)::bigint AS ledger_sum
  FROM public.users u
  LEFT JOIN public.coin_logs cl ON cl.user_id = u.id
  WHERE u.deleted_at IS NULL
  GROUP BY u.id, u.coin_balance
  HAVING u.coin_balance <> COALESCE(SUM(cl.amount), 0);
$$;

REVOKE ALL ON FUNCTION public.admin_coin_balance_mismatches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_coin_balance_mismatches() TO service_role;

-- ----- 11) RLS: 본인 조회만 -----
ALTER TABLE public.coin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coin_logs_select_own" ON public.coin_logs;
CREATE POLICY "coin_logs_select_own" ON public.coin_logs FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

GRANT SELECT ON public.coin_logs TO authenticated;

-- ----- 12) service_role 테이블 권한 (원장은 append-only, DELETE 불가) -----
GRANT SELECT, INSERT ON public.coin_logs TO service_role;
