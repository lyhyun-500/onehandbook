-- ============================================
-- 분석 결과 캐시 (analysis_results)
-- works → episodes(회차=챕터) → analysis_results
-- Supabase SQL Editor에서 실행 (analysis_runs 이후 권장)
-- ============================================

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

COMMENT ON TABLE analysis_results IS '회차(episodes)별 분석 스냅샷 캐시; 제품 용어상 chapter=episode';
COMMENT ON COLUMN analysis_results.feedback IS 'JSON 문자열: improvement_points, comparable_note 등';

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
