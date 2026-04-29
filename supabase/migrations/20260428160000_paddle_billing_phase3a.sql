-- Paddle Billing (Phase 3a / Sandbox): webhook 멱등성 + price_id→NAT 매핑 + 결제 거래 로그.
-- ADR-0010 기반.

-- Guard: 기존 스키마에서 public.users.id 타입이 bigint 인지 확인.
-- (프로젝트 전반 FK/policy가 users.id(bigint) 전제: app_user_id bigint 등)
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
    RAISE EXCEPTION 'public.users.id 컬럼을 찾지 못했습니다. 스키마/마이그레이션 순서를 확인하세요.';
  END IF;

  IF _t <> 'bigint' THEN
    RAISE EXCEPTION 'public.users.id 타입이 bigint가 아닙니다 (현재=%). paddle_transactions.user_id FK/policy를 users.id 타입에 맞게 수정해야 합니다.', _t;
  END IF;
END $$;

-- 1) Webhook 멱등성 + 추적 (processed_at IS NULL = 미처리)
CREATE TABLE IF NOT EXISTS public.paddle_webhooks (
  id           text PRIMARY KEY,
  event_type   text NOT NULL,
  environment  text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  payload      jsonb NOT NULL,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paddle_webhooks_event_type
  ON public.paddle_webhooks(event_type);

CREATE INDEX IF NOT EXISTS idx_paddle_webhooks_unprocessed
  ON public.paddle_webhooks(created_at DESC)
  WHERE processed_at IS NULL;

ALTER TABLE public.paddle_webhooks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddle_webhooks TO service_role;

DROP POLICY IF EXISTS "service_role_all_paddle_webhooks" ON public.paddle_webhooks;
CREATE POLICY "service_role_all_paddle_webhooks"
  ON public.paddle_webhooks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) price_id → NAT 매핑 (Single Source of Truth)
CREATE TABLE IF NOT EXISTS public.paddle_price_nat_mapping (
  paddle_price_id text PRIMARY KEY,
  product_type    text NOT NULL CHECK (product_type IN ('subscription', 'one_time')),
  nat_amount      integer NOT NULL CHECK (nat_amount >= 0),
  description     text,
  active          boolean NOT NULL DEFAULT true,
  environment     text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paddle_price_active_env
  ON public.paddle_price_nat_mapping(active, environment);

ALTER TABLE public.paddle_price_nat_mapping ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddle_price_nat_mapping TO service_role;

DROP POLICY IF EXISTS "service_role_all_paddle_price_nat_mapping" ON public.paddle_price_nat_mapping;
CREATE POLICY "service_role_all_paddle_price_nat_mapping"
  ON public.paddle_price_nat_mapping
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at 자동 갱신
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

-- Sandbox 초기 seed (ADR-0010)
INSERT INTO public.paddle_price_nat_mapping (
  paddle_price_id,
  product_type,
  nat_amount,
  description,
  active,
  environment,
  created_at,
  updated_at
)
VALUES (
  'pri_01kq4a0q6a25n4fsd8frdjva2e',
  'subscription',
  100,
  'Standard Monthly (9,900 KRW / month)',
  true,
  'sandbox',
  now(),
  now()
)
ON CONFLICT (paddle_price_id) DO NOTHING;

-- 3) 결제 거래 내역 (추적/CS/어드민용)
CREATE TABLE IF NOT EXISTS public.paddle_transactions (
  id                     text PRIMARY KEY,
  user_id                bigint REFERENCES public.users(id) ON DELETE SET NULL,
  paddle_customer_id     text,
  paddle_subscription_id text,
  paddle_price_id        text REFERENCES public.paddle_price_nat_mapping(paddle_price_id),
  amount                 integer NOT NULL CHECK (amount >= 0),
  currency               text NOT NULL DEFAULT 'KRW',
  status                 text NOT NULL CHECK (status IN ('completed', 'failed', 'refunded', 'unmapped')),
  payment_method         text,
  nat_credited           integer,
  paddle_payload         jsonb,
  environment            text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paddle_tx_user_recent
  ON public.paddle_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_paddle_tx_status
  ON public.paddle_transactions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_paddle_tx_subscription
  ON public.paddle_transactions(paddle_subscription_id, created_at DESC);

ALTER TABLE public.paddle_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddle_transactions TO service_role;
GRANT SELECT ON public.paddle_transactions TO authenticated;

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

-- 4) users 확장: Paddle customer id
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS paddle_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_paddle_customer_id
  ON public.users(paddle_customer_id)
  WHERE paddle_customer_id IS NOT NULL;

GRANT SELECT, UPDATE ON public.users TO service_role;

