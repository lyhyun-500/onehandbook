-- =============================================================================
-- Novel Agent (OHB) — Supabase 마이그레이션 통합 (실행 순서 고정)
-- Dashboard → SQL Editor → New query → 아래 전체 붙여넣기 → Run
--
-- 전제: public.users, public.works, public.reader_actions 테이블이 이미 있음
-- (없으면 먼저 schema-supabase.sql 등으로 기본 스키마 생성)
--
-- 이미 일부만 적용된 경우: 에러 나는 구간(예: 테이블 이미 있음)은 건너뛰고
-- 개별 파일(supabase-migration-*.sql)로 나눠 실행해도 됩니다.
-- =============================================================================

-- ----- 1) 대시보드 · auth_id · RLS (supabase-migration-dashboard.sql) -----
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.works TO anon, authenticated;
GRANT ALL ON public.reader_actions TO anon, authenticated;

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE reader_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth_id = auth.uid());
DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth_id = auth.uid());
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth_id = auth.uid());

DROP POLICY IF EXISTS "works_select_own" ON works;
CREATE POLICY "works_select_own" ON works FOR SELECT
  USING (author_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
DROP POLICY IF EXISTS "works_insert_own" ON works;
CREATE POLICY "works_insert_own" ON works FOR INSERT
  WITH CHECK (author_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
DROP POLICY IF EXISTS "works_update_own" ON works;
CREATE POLICY "works_update_own" ON works FOR UPDATE
  USING (author_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
DROP POLICY IF EXISTS "works_delete_own" ON works;
CREATE POLICY "works_delete_own" ON works FOR DELETE
  USING (author_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "reader_actions_select_for_author" ON reader_actions;
CREATE POLICY "reader_actions_select_for_author" ON reader_actions FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ----- 2) 회차 테이블 (supabase-migration-episodes.sql) — 이미 있으면 이 블록 스킵 -----
CREATE TABLE IF NOT EXISTS episodes (
    id BIGSERIAL PRIMARY KEY,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    episode_number INT NOT NULL CHECK (episode_number > 0),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) <= 10000),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(work_id, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episodes_work ON episodes(work_id);
CREATE INDEX IF NOT EXISTS idx_episodes_work_number ON episodes(work_id, episode_number);

GRANT ALL ON public.episodes TO anon, authenticated;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "episodes_select_for_author" ON episodes;
CREATE POLICY "episodes_select_for_author" ON episodes FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM works w JOIN users u ON w.author_id = u.id WHERE u.auth_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "episodes_insert_for_author" ON episodes;
CREATE POLICY "episodes_insert_for_author" ON episodes FOR INSERT
  WITH CHECK (
    work_id IN (
      SELECT w.id FROM works w JOIN users u ON w.author_id = u.id WHERE u.auth_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "episodes_update_for_author" ON episodes;
CREATE POLICY "episodes_update_for_author" ON episodes FOR UPDATE
  USING (
    work_id IN (
      SELECT w.id FROM works w JOIN users u ON w.author_id = u.id WHERE u.auth_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "episodes_delete_for_author" ON episodes;
CREATE POLICY "episodes_delete_for_author" ON episodes FOR DELETE
  USING (
    work_id IN (
      SELECT w.id FROM works w JOIN users u ON w.author_id = u.id WHERE u.auth_id = auth.uid()
    )
  );

-- ----- 3) 회차 본문 제약 (supabase-migration-episode-content-limit.sql) -----
ALTER TABLE episodes DROP CONSTRAINT IF EXISTS episodes_content_max_chars;
ALTER TABLE episodes
  ADD CONSTRAINT episodes_content_max_chars
  CHECK (char_length(content) <= 10000);

-- ----- 4) 세계관·인물 JSON (supabase-migration-works-lore.sql) -----
ALTER TABLE works ADD COLUMN IF NOT EXISTS world_setting jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE works ADD COLUMN IF NOT EXISTS character_settings jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ----- 5) 공개 탐색 RLS (supabase-migration-explore.sql) -----
DROP POLICY IF EXISTS "works_public_select" ON works;
CREATE POLICY "works_public_select" ON works FOR SELECT USING (true);
DROP POLICY IF EXISTS "episodes_public_select" ON episodes;
CREATE POLICY "episodes_public_select" ON episodes FOR SELECT USING (true);
DROP POLICY IF EXISTS "reader_actions_public_select" ON reader_actions;
CREATE POLICY "reader_actions_public_select" ON reader_actions FOR SELECT USING (true);
DROP POLICY IF EXISTS "reader_actions_insert_reader" ON reader_actions;
CREATE POLICY "reader_actions_insert_reader" ON reader_actions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----- 6) AI 분석 결과 (supabase-migration-analysis.sql) — 이미 있으면 스킵 -----
CREATE TABLE IF NOT EXISTS analysis_runs (
    id BIGSERIAL PRIMARY KEY,
    episode_id BIGINT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    agent_version TEXT NOT NULL,
    result_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_episode ON analysis_runs(episode_id, created_at DESC);
GRANT ALL ON public.analysis_runs TO anon, authenticated;
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analysis_runs_select_author" ON analysis_runs;
CREATE POLICY "analysis_runs_select_author" ON analysis_runs FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM works w JOIN users u ON w.author_id = u.id WHERE u.auth_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "analysis_runs_insert_author" ON analysis_runs;
CREATE POLICY "analysis_runs_insert_author" ON analysis_runs FOR INSERT
  WITH CHECK (
    work_id IN (
      SELECT w.id FROM works w JOIN users u ON w.author_id = u.id WHERE u.auth_id = auth.uid()
    )
  );

-- ----- 7) 탐색용 analysis_runs 공개 조회 (supabase-migration-analysis-public.sql) -----
DROP POLICY IF EXISTS "analysis_runs_public_select" ON public.analysis_runs;
CREATE POLICY "analysis_runs_public_select" ON public.analysis_runs
  FOR SELECT USING (true);

-- ----- 8) NAT · consume_nat RPC (supabase-migration-nat.sql) -----
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nat_balance integer NOT NULL DEFAULT 10;
COMMENT ON COLUMN public.users.nat_balance IS 'Novel Agent Token 잔액';

ALTER TABLE public.analysis_runs ADD COLUMN IF NOT EXISTS nat_cost integer;
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS options_json jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS "analysis_runs_delete_author" ON public.analysis_runs;
CREATE POLICY "analysis_runs_delete_author" ON public.analysis_runs FOR DELETE
  USING (
    work_id IN (
      SELECT w.id FROM works w JOIN users u ON w.author_id = u.id WHERE u.auth_id = auth.uid()
    )
  );

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

-- ----- 9) 분석 결과 캐시 analysis_results (supabase-migration-analysis-results.sql) -----
CREATE TABLE IF NOT EXISTS analysis_results (
    id BIGSERIAL PRIMARY KEY,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    episode_id BIGINT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    analysis_run_id BIGINT NOT NULL UNIQUE REFERENCES analysis_runs(id) ON DELETE CASCADE,
    score INT NOT NULL CHECK (score >= 0 AND score <= 100),
    feedback TEXT NOT NULL,
    nat_consumed INT NOT NULL CHECK (nat_consumed >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_episode_created
  ON analysis_results(episode_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_work ON analysis_results(work_id);

GRANT ALL ON public.analysis_results TO anon, authenticated;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analysis_results_select_author" ON analysis_results;
CREATE POLICY "analysis_results_select_author" ON analysis_results FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "analysis_results_insert_author" ON analysis_results;
CREATE POLICY "analysis_results_insert_author" ON analysis_results FOR INSERT
  WITH CHECK (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ----- 10) 휴대폰 인증 + SMS OTP (supabase-migration-phone-auth.sql) -----
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verification_bonus_granted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_one_verified_phone
  ON public.users (phone_e164)
  WHERE phone_verified_at IS NOT NULL AND phone_e164 IS NOT NULL;

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

GRANT ALL ON public.sms_otp_challenges TO anon, authenticated;
ALTER TABLE public.sms_otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_otp_own" ON public.sms_otp_challenges;
CREATE POLICY "sms_otp_own" ON public.sms_otp_challenges FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- ----- 11) 결제 주문 + NAT 원장 (supabase-migration-payments-nat-ledger.sql) -----
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
    p_reason,
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

-- ----- 12) 회차 content_hash / 분석 결과 content_hash (supabase-migration-content-hash.sql) -----
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS content_hash TEXT;
COMMENT ON COLUMN public.episodes.content_hash IS '원고 본문 MD5(hex)';

ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE public.episodes SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE public.episodes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.episodes ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.episodes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_episodes_updated_at ON public.episodes;
CREATE TRIGGER trg_episodes_updated_at
  BEFORE UPDATE ON public.episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.episodes_set_updated_at();

ALTER TABLE public.analysis_results ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;
ALTER TABLE public.analysis_results ADD COLUMN IF NOT EXISTS content_hash TEXT;

UPDATE public.analysis_results SET analyzed_at = created_at WHERE analyzed_at IS NULL;
ALTER TABLE public.analysis_results ALTER COLUMN analyzed_at SET DEFAULT now();
ALTER TABLE public.analysis_results ALTER COLUMN analyzed_at SET NOT NULL;

COMMENT ON COLUMN public.analysis_results.analyzed_at IS '분석 완료 시각(서버 기준)';
COMMENT ON COLUMN public.analysis_results.content_hash IS '분석 시점 원고 MD5(hex)';

-- ----- 13) 비동기 이 화 분석 큐 analysis_jobs (supabase-migration-analysis-jobs.sql) -----
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  episode_id bigint NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  analysis_run_id bigint REFERENCES public.analysis_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_created
  ON public.analysis_jobs(app_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status
  ON public.analysis_jobs(status);

ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.analysis_jobs TO anon, authenticated;

DROP POLICY IF EXISTS "analysis_jobs_select_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_select_own" ON public.analysis_jobs FOR SELECT
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "analysis_jobs_insert_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_insert_own" ON public.analysis_jobs FOR INSERT
  WITH CHECK (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "analysis_jobs_update_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_update_own" ON public.analysis_jobs FOR UPDATE
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

COMMENT ON TABLE public.analysis_jobs IS '이 화 분석 비동기 작업(큐); 완료 시 analysis_run_id 연결';

-- =============================================================================
-- 끝. 앱에서 NAT·분석 차감이 동작하는지 확인하세요.
-- analysis_results 마이그레이션 후 POST /api/analyze 가 캐시 행을 씁니다.
-- 휴대폰 인증: CoolSMS + SMS_OTP_SECRET + /api/auth/sms/*
-- 결제·원장: payments / nat_ledger, consume_nat 확장 → supabase-migration-payments-nat-ledger.sql
-- 원고 해시: episodes.content_hash / analysis_results.content_hash → supabase-migration-content-hash.sql
-- =============================================================================
