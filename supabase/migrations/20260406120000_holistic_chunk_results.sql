-- 통합 분석 클라이언트 청크: 구간별 AI 결과 임시 저장 후 병합 API에서 소비

CREATE TABLE IF NOT EXISTS public.holistic_chunk_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  analysis_job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  episode_ids bigint[] NOT NULL,
  result_json jsonb NOT NULL,
  app_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_holistic_chunk_results_session
  ON public.holistic_chunk_results(session_id);

CREATE INDEX IF NOT EXISTS idx_holistic_chunk_results_job
  ON public.holistic_chunk_results(analysis_job_id);

ALTER TABLE public.holistic_chunk_results ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.holistic_chunk_results TO anon, authenticated;

DROP POLICY IF EXISTS "holistic_chunk_results_select_own" ON public.holistic_chunk_results;
CREATE POLICY "holistic_chunk_results_select_own" ON public.holistic_chunk_results
  FOR SELECT
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "holistic_chunk_results_insert_own" ON public.holistic_chunk_results;
CREATE POLICY "holistic_chunk_results_insert_own" ON public.holistic_chunk_results
  FOR INSERT
  WITH CHECK (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "holistic_chunk_results_update_own" ON public.holistic_chunk_results;
CREATE POLICY "holistic_chunk_results_update_own" ON public.holistic_chunk_results
  FOR UPDATE
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "holistic_chunk_results_delete_own" ON public.holistic_chunk_results;
CREATE POLICY "holistic_chunk_results_delete_own" ON public.holistic_chunk_results
  FOR DELETE
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

COMMENT ON TABLE public.holistic_chunk_results IS '통합 분석 클라이언트 청크 구간별 결과(병합 전 임시)';
