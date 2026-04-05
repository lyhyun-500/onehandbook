-- analysis_jobs 테이블을 Supabase Realtime publication에 넣습니다.
-- (클라이언트에서 postgres_changes 구독 시 필요)
-- SQL Editor에서 단독 실행하거나, supabase db push 시 supabase/migrations/ 동일 내용이 적용됩니다.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'analysis_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_jobs;
  END IF;
END $$;
