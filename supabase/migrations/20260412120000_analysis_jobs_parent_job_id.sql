-- 일괄(holistic_batch) 작업 산하 이 화 분석 자식 job 연결

ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.analysis_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_parent_job_id
  ON public.analysis_jobs(parent_job_id)
  WHERE parent_job_id IS NOT NULL;

COMMENT ON COLUMN public.analysis_jobs.parent_job_id IS
  'holistic_batch 부모 job id. 일괄 실행 시 회차별 episode job이 이 값으로 묶임.';
