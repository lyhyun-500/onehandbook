-- ============================================
-- 회차(episodes) content_hash / updated_at
-- 분석 결과(analysis_results) analyzed_at / content_hash
-- 제품 용어 chapter = 회차 → 테이블명은 episodes
-- Supabase SQL Editor에서 실행
-- ============================================

-- ----- episodes -----
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS content_hash TEXT;
COMMENT ON COLUMN public.episodes.content_hash IS '원고 본문 MD5(hex)';

ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE public.episodes SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE public.episodes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.episodes ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.episodes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_episodes_updated_at ON public.episodes;
CREATE TRIGGER trg_episodes_updated_at
  BEFORE UPDATE ON public.episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.episodes_set_updated_at();

-- ----- analysis_results -----
ALTER TABLE public.analysis_results ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;
ALTER TABLE public.analysis_results ADD COLUMN IF NOT EXISTS content_hash TEXT;

UPDATE public.analysis_results SET analyzed_at = created_at WHERE analyzed_at IS NULL;
ALTER TABLE public.analysis_results ALTER COLUMN analyzed_at SET DEFAULT now();
ALTER TABLE public.analysis_results ALTER COLUMN analyzed_at SET NOT NULL;

COMMENT ON COLUMN public.analysis_results.analyzed_at IS '분석 완료 시각(서버 기준)';
COMMENT ON COLUMN public.analysis_results.content_hash IS '분석 시점 원고 MD5(hex)';
