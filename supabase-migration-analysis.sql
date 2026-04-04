-- ============================================
-- AI 분석 결과 저장 (analysis_runs)
-- Supabase SQL Editor에서 실행
-- ============================================

CREATE TABLE analysis_runs (
    id BIGSERIAL PRIMARY KEY,
    episode_id BIGINT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    agent_version TEXT NOT NULL,
    result_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analysis_runs_episode ON analysis_runs(episode_id, created_at DESC);

GRANT ALL ON public.analysis_runs TO anon, authenticated;

ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

-- 본인 작품의 회차에 대해서만 조회·삽입
DROP POLICY IF EXISTS "analysis_runs_select_author" ON analysis_runs;
CREATE POLICY "analysis_runs_select_author" ON analysis_runs FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "analysis_runs_insert_author" ON analysis_runs;
CREATE POLICY "analysis_runs_insert_author" ON analysis_runs FOR INSERT
  WITH CHECK (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );
