-- 작품 단위 통합(일괄) 분석 결과 — Supabase SQL Editor에서 실행
CREATE TABLE IF NOT EXISTS public.holistic_analysis_runs (
  id BIGSERIAL PRIMARY KEY,
  work_id BIGINT NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  episode_ids BIGINT[] NOT NULL,
  agent_version TEXT NOT NULL,
  result_json JSONB NOT NULL,
  nat_cost INT NOT NULL CHECK (nat_cost >= 0),
  options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holistic_analysis_work
  ON public.holistic_analysis_runs(work_id, created_at DESC);

ALTER TABLE public.holistic_analysis_runs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.holistic_analysis_runs TO anon, authenticated;

DROP POLICY IF EXISTS "holistic_analysis_select_author" ON public.holistic_analysis_runs;
CREATE POLICY "holistic_analysis_select_author" ON public.holistic_analysis_runs
  FOR SELECT USING (
    work_id IN (
      SELECT w.id FROM public.works w
      JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "holistic_analysis_insert_author" ON public.holistic_analysis_runs;
CREATE POLICY "holistic_analysis_insert_author" ON public.holistic_analysis_runs
  FOR INSERT WITH CHECK (
    work_id IN (
      SELECT w.id FROM public.works w
      JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "holistic_analysis_delete_author" ON public.holistic_analysis_runs;
CREATE POLICY "holistic_analysis_delete_author" ON public.holistic_analysis_runs
  FOR DELETE USING (
    work_id IN (
      SELECT w.id FROM public.works w
      JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

COMMENT ON TABLE public.holistic_analysis_runs IS '선택 회차 원고를 통합한 작품 흐름 분석(1회 호출)';
