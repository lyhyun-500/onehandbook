-- ============================================
-- 결제 주문(payments) + NAT 원장(nat_ledger)
-- Supabase SQL Editor에서 실행 (NAT·consume_nat 마이그레이션 이후)
-- ============================================

-- ----- 1) 결제·충전 주문 (PG 연동 시 external_id·metadata 활용) -----
CREATE TABLE IF NOT EXISTS public.payments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled'
    )),
  amount_krw INTEGER NOT NULL DEFAULT 0 CHECK (amount_krw >= 0),
  nat_amount INTEGER CHECK (nat_amount IS NULL OR nat_amount >= 0),
  idempotency_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_external
  ON public.payments (provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON public.payments (user_id, created_at DESC);

COMMENT ON TABLE public.payments IS '결제·충전 주문 (환불·대조용)';
COMMENT ON COLUMN public.payments.external_id IS '토스/Stripe 등 결제 건 id';
COMMENT ON COLUMN public.payments.nat_amount IS '충전 확정 시 적립할 NAT 수';

-- ----- 2) NAT 잔액 변동 원장 (append-only) -----
CREATE TABLE IF NOT EXISTS public.nat_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'analysis',
    'purchase_credit',
    'refund',
    'bonus',
    'admin_adjust',
    'manual_adjust',
    'other'
  )),
  ref_type TEXT,
  ref_id BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nat_ledger_user_created
  ON public.nat_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nat_ledger_ref
  ON public.nat_ledger (ref_type, ref_id);

COMMENT ON TABLE public.nat_ledger IS 'NAT 입출금 원장 (차감은 음수 delta)';
COMMENT ON COLUMN public.nat_ledger.ref_type IS '예: analysis_run, payment';

GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.nat_ledger TO authenticated;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nat_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "nat_ledger_select_own" ON public.nat_ledger;
CREATE POLICY "nat_ledger_select_own" ON public.nat_ledger FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- ----- 3) consume_nat: 차감 + 원장 1행 (동일 트랜잭션) -----
DROP FUNCTION IF EXISTS public.consume_nat(integer);

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

  SELECT id, nat_balance INTO v_uid, v_bal
  FROM public.users
  WHERE auth_id = auth.uid();

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
  SET nat_balance = nat_balance - p_amount
  WHERE id = v_uid AND nat_balance >= p_amount
  RETURNING nat_balance INTO v_new;

  IF v_new IS NULL THEN
    SELECT nat_balance INTO v_bal FROM public.users WHERE id = v_uid;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_nat',
      'balance', COALESCE(v_bal, 0),
      'required', p_amount
    );
  END IF;

  INSERT INTO public.nat_ledger (
    user_id, delta, balance_after, reason, ref_type, ref_id, metadata
  ) VALUES (
    v_uid,
    -p_amount,
    v_new,
    'analysis',
    p_ref_type,
    p_ref_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_nat(integer, text, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_nat(integer, text, bigint, jsonb) TO authenticated;

-- ----- 4) 충전·환불·보너스 (서비스 롤·서버에서만 호출) -----
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
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN (
    'purchase_credit', 'refund', 'bonus', 'admin_adjust', 'manual_adjust', 'other'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  UPDATE public.users
  SET nat_balance = nat_balance + p_amount
  WHERE id = p_user_id
  RETURNING nat_balance INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  INSERT INTO public.nat_ledger (
    user_id, delta, balance_after, reason, ref_type, ref_id, metadata
  ) VALUES (
    p_user_id,
    p_amount,
    v_new,
    p_reason::text,
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
