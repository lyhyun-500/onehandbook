-- 통합 분석 파이프라인 진단 이벤트(콘솔 로그와 동일 step·payload를 DB에 남김)

CREATE TABLE IF NOT EXISTS public.holistic_pipeline_events (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  app_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_id bigint NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  analysis_job_id uuid REFERENCES public.analysis_jobs(id) ON DELETE SET NULL,
  holistic_run_id bigint,
  step text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_holistic_pipeline_events_work_created
  ON public.holistic_pipeline_events(work_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_holistic_pipeline_events_job
  ON public.holistic_pipeline_events(analysis_job_id)
  WHERE analysis_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_holistic_pipeline_events_user_created
  ON public.holistic_pipeline_events(app_user_id, created_at DESC);

ALTER TABLE public.holistic_pipeline_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.holistic_pipeline_events TO anon, authenticated;

DROP POLICY IF EXISTS "holistic_pipeline_events_select_own" ON public.holistic_pipeline_events;
CREATE POLICY "holistic_pipeline_events_select_own" ON public.holistic_pipeline_events
  FOR SELECT
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "holistic_pipeline_events_insert_own" ON public.holistic_pipeline_events;
CREATE POLICY "holistic_pipeline_events_insert_own" ON public.holistic_pipeline_events
  FOR INSERT
  WITH CHECK (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

COMMENT ON TABLE public.holistic_pipeline_events IS '통합 분석 파이프라인 진단(회차 커버리지 등). 제보 시 work_id·analysis_job_id·시각으로 조회';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'holistic_analysis_runs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'holistic_pipeline_events_holistic_run_id_fkey'
    ) THEN
      ALTER TABLE public.holistic_pipeline_events
        ADD CONSTRAINT holistic_pipeline_events_holistic_run_id_fkey
        FOREIGN KEY (holistic_run_id) REFERENCES public.holistic_analysis_runs(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
