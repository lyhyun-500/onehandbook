-- 비동기 이 화 분석 작업 (POST /api/analyze → job_id → 폴링)
-- Supabase SQL Editor에서 analysis_runs·users 이후 적용 권장

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

-- Realtime(postgres_changes) 사용 시: 같은 폴더의 supabase-migration-analysis-jobs-realtime.sql 실행
-- 또는 supabase/migrations/20260405000000_analysis_jobs_realtime.sql (supabase db push)
