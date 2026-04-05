-- analysis_jobs 변경을 Supabase Realtime(postgres_changes)로 수신하려면 publication에 포함해야 합니다.

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
