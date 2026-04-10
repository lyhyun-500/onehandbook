-- RAG 인제스트용 트렌드 원문(Supabase) — Chroma `webnovel-trends` 메타의 trend_id 와 대응
CREATE TABLE IF NOT EXISTS public.trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  body text NOT NULL,
  genre text NOT NULL DEFAULT '전체',
  trend_date date NOT NULL,
  citation_source text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trends_trend_date
  ON public.trends (trend_date DESC);

CREATE INDEX IF NOT EXISTS idx_trends_genre_date
  ON public.trends (genre, trend_date DESC);

COMMENT ON TABLE public.trends IS
  '트렌드 원문; 임베딩 청크는 Chroma(webnovel-trends) metadata.trend_id 로 연결';

ALTER TABLE public.trends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trends_select_authenticated" ON public.trends;
CREATE POLICY "trends_select_authenticated" ON public.trends
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.trends TO authenticated;
GRANT ALL ON public.trends TO service_role;
