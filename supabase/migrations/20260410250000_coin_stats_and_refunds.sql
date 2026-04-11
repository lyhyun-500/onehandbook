-- =============================================================================
-- coin_logs 통계 테이블(일/월) + 환불 시스템(refund_requests)
-- =============================================================================

-- ----- 1) 집계 테이블: 일별/월별 (배치 적재용) -----
CREATE TABLE IF NOT EXISTS public.coin_stats_daily (
  bucket date PRIMARY KEY,
  earn_sum bigint NOT NULL DEFAULT 0,
  use_sum bigint NOT NULL DEFAULT 0,
  expire_sum bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_stats_monthly (
  bucket date PRIMARY KEY, -- month start (UTC)
  earn_sum bigint NOT NULL DEFAULT 0,
  use_sum bigint NOT NULL DEFAULT 0,
  expire_sum bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_stats_daily_bucket ON public.coin_stats_daily (bucket DESC);
CREATE INDEX IF NOT EXISTS idx_coin_stats_monthly_bucket ON public.coin_stats_monthly (bucket DESC);

-- ----- 2) 배치 적재 RPC: coin_logs → stats upsert (멱등) -----
CREATE OR REPLACE FUNCTION public.refresh_coin_stats(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := p_from;
  v_to date := p_to;
BEGIN
  IF v_from IS NULL OR v_to IS NULL OR v_from > v_to THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_range');
  END IF;

  -- 일별 upsert
  INSERT INTO public.coin_stats_daily (bucket, earn_sum, use_sum, expire_sum, updated_at)
  SELECT
    (cl.created_at AT TIME ZONE 'UTC')::date AS bucket,
    COALESCE(SUM(CASE WHEN cl.type = 'EARN' THEN cl.amount ELSE 0 END), 0)::bigint AS earn_sum,
    COALESCE(SUM(CASE WHEN cl.type = 'USE' THEN -cl.amount ELSE 0 END), 0)::bigint AS use_sum,
    COALESCE(SUM(CASE WHEN cl.type = 'EXPIRE' THEN -cl.amount ELSE 0 END), 0)::bigint AS expire_sum,
    now()
  FROM public.coin_logs cl
  WHERE (cl.created_at AT TIME ZONE 'UTC')::date >= v_from
    AND (cl.created_at AT TIME ZONE 'UTC')::date <= v_to
  GROUP BY (cl.created_at AT TIME ZONE 'UTC')::date
  ON CONFLICT (bucket) DO UPDATE SET
    earn_sum = EXCLUDED.earn_sum,
    use_sum = EXCLUDED.use_sum,
    expire_sum = EXCLUDED.expire_sum,
    updated_at = now();

  -- 월별 upsert (범위 내 월 전부 재집계)
  INSERT INTO public.coin_stats_monthly (bucket, earn_sum, use_sum, expire_sum, updated_at)
  SELECT
    date_trunc('month', (cl.created_at AT TIME ZONE 'UTC')::date)::date AS bucket,
    COALESCE(SUM(CASE WHEN cl.type = 'EARN' THEN cl.amount ELSE 0 END), 0)::bigint AS earn_sum,
    COALESCE(SUM(CASE WHEN cl.type = 'USE' THEN -cl.amount ELSE 0 END), 0)::bigint AS use_sum,
    COALESCE(SUM(CASE WHEN cl.type = 'EXPIRE' THEN -cl.amount ELSE 0 END), 0)::bigint AS expire_sum,
    now()
  FROM public.coin_logs cl
  WHERE (cl.created_at AT TIME ZONE 'UTC')::date >= date_trunc('month', v_from)::date
    AND (cl.created_at AT TIME ZONE 'UTC')::date <= (v_to + INTERVAL '1 day')::date
  GROUP BY date_trunc('month', (cl.created_at AT TIME ZONE 'UTC')::date)
  ON CONFLICT (bucket) DO UPDATE SET
    earn_sum = EXCLUDED.earn_sum,
    use_sum = EXCLUDED.use_sum,
    expire_sum = EXCLUDED.expire_sum,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_coin_stats(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_coin_stats(date, date) TO service_role;

-- ----- 3) 환불 요청 테이블 -----
DO $$ BEGIN
  CREATE TYPE public.refund_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount >= 1),
  reason text NOT NULL,
  status public.refund_status NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by bigint REFERENCES public.users (id) ON DELETE SET NULL,
  admin_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_user_time
  ON public.refund_requests (user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_refund_requests_status_time
  ON public.refund_requests (status, requested_at DESC);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refund_requests_select_own" ON public.refund_requests;
CREATE POLICY "refund_requests_select_own" ON public.refund_requests FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL));

DROP POLICY IF EXISTS "refund_requests_insert_own" ON public.refund_requests;
CREATE POLICY "refund_requests_insert_own" ON public.refund_requests FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL)
    AND status = 'PENDING'
  );

GRANT SELECT, INSERT ON public.refund_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.refund_requests TO service_role;

-- ----- 4) 환불 승인 RPC: users.coin_balance + coin_logs(EARN: REFUND) + refund_requests 업데이트 -----
CREATE OR REPLACE FUNCTION public.approve_refund_request(
  p_refund_id uuid,
  p_decided_by bigint,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_user_id bigint;
  v_amt integer;
  v_status public.refund_status;
  v_new int;
BEGIN
  SELECT user_id, amount, status
    INTO v_user_id, v_amt, v_status
  FROM public.refund_requests
  WHERE id = p_refund_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_status <> 'PENDING' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  UPDATE public.users
  SET coin_balance = coin_balance + v_amt
  WHERE id = v_user_id AND deleted_at IS NULL
  RETURNING coin_balance INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_missing_or_deleted');
  END IF;

  INSERT INTO public.coin_logs (user_id, amount, type, reason, metadata)
  VALUES (
    v_user_id,
    v_amt,
    'EARN'::public.coin_log_type,
    'REFUND',
    jsonb_build_object('refund_id', p_refund_id, 'admin_note', p_admin_note)
  );

  UPDATE public.refund_requests
  SET status = 'APPROVED',
      decided_at = v_now,
      decided_by = p_decided_by,
      admin_note = p_admin_note
  WHERE id = p_refund_id;

  RETURN jsonb_build_object('ok', true, 'coin_balance', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_refund_request(uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_refund_request(uuid, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reject_refund_request(
  p_refund_id uuid,
  p_decided_by bigint,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_status public.refund_status;
BEGIN
  SELECT status INTO v_status
  FROM public.refund_requests
  WHERE id = p_refund_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_status <> 'PENDING' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  UPDATE public.refund_requests
  SET status = 'REJECTED',
      decided_at = v_now,
      decided_by = p_decided_by,
      admin_note = p_admin_note
  WHERE id = p_refund_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_refund_request(uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_refund_request(uuid, bigint, text) TO service_role;

