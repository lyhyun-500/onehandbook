-- analysis_jobs 확장: 통합 분석(holistic_batch) + 진행 단계(알림 UI)
-- (migrations/20260406120000_analysis_jobs_holistic_and_phases.sql 과 동일)

ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS job_kind text NOT NULL DEFAULT 'episode';

ALTER TABLE public.analysis_jobs
  DROP CONSTRAINT IF EXISTS analysis_jobs_job_kind_check;

ALTER TABLE public.analysis_jobs
  ADD CONSTRAINT analysis_jobs_job_kind_check
  CHECK (job_kind IN ('episode', 'holistic_batch'));

ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS work_id bigint REFERENCES public.works(id) ON DELETE CASCADE;

ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS progress_phase text;

ALTER TABLE public.analysis_jobs
  DROP CONSTRAINT IF EXISTS analysis_jobs_progress_phase_check;

ALTER TABLE public.analysis_jobs
  ADD CONSTRAINT analysis_jobs_progress_phase_check
  CHECK (
    progress_phase IS NULL
    OR progress_phase IN ('received', 'ai_analyzing', 'report_writing')
  );

ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS holistic_run_id bigint;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'holistic_analysis_runs'
  ) THEN
    ALTER TABLE public.analysis_jobs
      DROP CONSTRAINT IF EXISTS analysis_jobs_holistic_run_id_fkey;
    ALTER TABLE public.analysis_jobs
      ADD CONSTRAINT analysis_jobs_holistic_run_id_fkey
      FOREIGN KEY (holistic_run_id) REFERENCES public.holistic_analysis_runs(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.analysis_jobs.job_kind IS 'episode: 이 화 분석, holistic_batch: 선택 회차 통합';
COMMENT ON COLUMN public.analysis_jobs.progress_phase IS 'processing 중 세부 단계(알림 패널)';
COMMENT ON COLUMN public.analysis_jobs.holistic_run_id IS '통합 분석 완료 시 holistic_analysis_runs.id';
