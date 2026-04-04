-- ============================================
-- NAT (Novel Agent Token) — 크레딧 차감
-- Supabase SQL Editor에서 실행
-- ============================================

-- 1. 잔액 컬럼 (신규 가입·기존 행 기본 10 NAT)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nat_balance integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.users.nat_balance IS 'Novel Agent Token 잔액';

-- 2. 분석 기록에 소모량·옵션 (감사용)
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS nat_cost integer;

ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS options_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. 차감 실패 시 롤백용 DELETE 정책
DROP POLICY IF EXISTS "analysis_runs_delete_author" ON public.analysis_runs;
CREATE POLICY "analysis_runs_delete_author" ON public.analysis_runs FOR DELETE
  USING (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- 4. RPC: 본인 계정에서만 NAT 차감 (RLS 우회·amount 검증)
CREATE OR REPLACE FUNCTION public.consume_nat(p_amount integer)
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

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_nat(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_nat(integer) TO authenticated;

-- 원장·결제 테이블 및 consume_nat(참조 인자) 버전은
-- supabase-migration-payments-nat-ledger.sql 을 추가 실행하세요.
