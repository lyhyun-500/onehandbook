-- 트렌드 리포트 원문(Supabase) + RAG(Chroma) 이중 인제스트용
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  body text NOT NULL,
  genre text NOT NULL DEFAULT '전체',
  report_date date NOT NULL,
  citation_source text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_report_date
  ON public.reports (report_date DESC);

CREATE INDEX IF NOT EXISTS idx_reports_genre_date
  ON public.reports (genre, report_date DESC);

COMMENT ON TABLE public.reports IS '수집 트렌드 리포트 메타·본문; 임베딩은 Chroma(webnovel-trends)와 report_id로 연동';

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자 조회(앱에서 목록 표시 시)
DROP POLICY IF EXISTS "reports_select_authenticated" ON public.reports;
CREATE POLICY "reports_select_authenticated" ON public.reports
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
