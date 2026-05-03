-- Paddle Billing (Phase 3a): paddle_subscriptions 테이블
-- ADR-0010 Step 3-4-B (subscription.activated 저장용)

CREATE TABLE IF NOT EXISTS public.paddle_subscriptions (
  id text PRIMARY KEY,
  user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  paddle_customer_id text,
  paddle_price_id text REFERENCES public.paddle_price_nat_mapping(paddle_price_id),

  status text NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'paused', 'trialing')),

  activated_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  next_billed_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,

  paddle_payload jsonb,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paddle_subs_user
  ON public.paddle_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_paddle_subs_status
  ON public.paddle_subscriptions(status, current_period_ends_at);
CREATE INDEX IF NOT EXISTS idx_paddle_subs_billing
  ON public.paddle_subscriptions(next_billed_at)
  WHERE status = 'active';

-- RLS
ALTER TABLE public.paddle_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_paddle_subscriptions" ON public.paddle_subscriptions;
CREATE POLICY "service_role_all_paddle_subscriptions"
  ON public.paddle_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_own_paddle_subscriptions" ON public.paddle_subscriptions;
CREATE POLICY "authenticated_select_own_paddle_subscriptions"
  ON public.paddle_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.users
      WHERE auth_id = auth.uid() AND deleted_at IS NULL
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paddle_subscriptions TO service_role;
GRANT SELECT ON public.paddle_subscriptions TO authenticated;

-- updated_at 트리거 (set_updated_at 함수는 20260428170000_paddle_billing_phase3a_policies.sql 에서 정의됨)
DROP TRIGGER IF EXISTS trg_paddle_subs_updated ON public.paddle_subscriptions;
CREATE TRIGGER trg_paddle_subs_updated
  BEFORE UPDATE ON public.paddle_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

