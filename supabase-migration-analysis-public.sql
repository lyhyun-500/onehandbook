-- ============================================
-- 공개 탐색: 작품별 AI 분석 집계(Agent Score) 노출용
-- analysis_runs 행 조회 — 탐색·정렬에 사용
-- Supabase SQL Editor에서 supabase-migration-analysis.sql 이후 실행
-- ============================================

DROP POLICY IF EXISTS "analysis_runs_public_select" ON public.analysis_runs;
CREATE POLICY "analysis_runs_public_select" ON public.analysis_runs
  FOR SELECT
  USING (true);
