-- analysis_results: 작품 맥락(장르·로어) 변경 시 회차별 캐시 무효화용
-- Supabase SQL Editor 또는 마이그레이션 파이프라인에서 실행

ALTER TABLE public.analysis_results
ADD COLUMN IF NOT EXISTS work_context_hash TEXT;

COMMENT ON COLUMN public.analysis_results.work_context_hash IS
  '분석 시점 작품 맥락(장르·제목·로어 옵션 반영) MD5(hex); content_hash·agent_version과 함께 캐시 키';

CREATE INDEX IF NOT EXISTS idx_analysis_results_episode_content_work_ctx
  ON public.analysis_results (episode_id, content_hash, work_context_hash);
