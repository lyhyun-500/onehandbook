-- Paddle Billing (Phase 3a): RLS 정책 + updated_at 트리거 + users.id 타입 사후 검증
-- 기존 20260428160000 마이그레이션이 "테이블/인덱스/seed"만 만든 상태에서,
-- 운영 DB에 이미 적용된 누락분을 보강하기 위한 후속 마이그레이션.

-- 0) users.id 타입 사후 검증 (bigint 전제)
DO $$
DECLARE
  _t text;
BEGIN
  SELECT data_type
    INTO _t
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'users'
     AND column_name = 'id';

  IF _t IS NULL THEN
    RAISE EXCEPTION 'public.users.id 컬럼을 찾지 못했습니다.';
  END IF;

  IF _t <> 'bigint' THEN
    RAISE EXCEPTION 'public.users.id 타입이 bigint가 아닙니다 (현재=%). paddle_transactions.user_id FK 와 불일치.', _t;
  END IF;
END $$;

-- 1) paddle_webhooks RLS 정책 (service_role only)
ALTER TABLE public.paddle_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_paddle_webhooks" ON public.paddle_webhooks;
CREATE POLICY "service_role_all_paddle_webhooks"
  ON public.paddle_webhooks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddle_webhooks TO service_role;

-- 2) paddle_price_nat_mapping RLS 정책 (service_role only)
ALTER TABLE public.paddle_price_nat_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_paddle_price_nat_mapping" ON public.paddle_price_nat_mapping;
CREATE POLICY "service_role_all_paddle_price_nat_mapping"
  ON public.paddle_price_nat_mapping
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddle_price_nat_mapping TO service_role;

-- 3) paddle_transactions RLS 정책 (service_role all + authenticated select own)
ALTER TABLE public.paddle_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_paddle_transactions" ON public.paddle_transactions;
CREATE POLICY "service_role_all_paddle_transactions"
  ON public.paddle_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_own_paddle_transactions" ON public.paddle_transactions;
CREATE POLICY "authenticated_select_own_paddle_transactions"
  ON public.paddle_transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.users
      WHERE auth_id = auth.uid()
        AND (deleted_at IS NULL)
    )
  );

GRANT SELECT ON public.paddle_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddle_transactions TO service_role;

-- 4) updated_at 자동 갱신 트리거 (price NAT 매핑)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paddle_price_updated ON public.paddle_price_nat_mapping;
CREATE TRIGGER trg_paddle_price_updated
  BEFORE UPDATE ON public.paddle_price_nat_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

