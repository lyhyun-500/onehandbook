-- trends RAG 고도화: platform, target_date, dedup_id(유니크) 추가 + 필수화

ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS dedup_id text;

COMMENT ON COLUMN public.trends.platform IS '수집/분석 대상 플랫폼 (예: 문피아, 카카오)';
COMMENT ON COLUMN public.trends.target_date IS '분석 기준일(타겟 날짜); dedup_id 구성 요소';
COMMENT ON COLUMN public.trends.dedup_id IS 'title+platform+target_date 기반 dedup 지문(sha256)';

-- 기존 데이터가 있다면 최소한 비어있지 않게 채움(운영 환경에 맞춰 추후 정교화 가능)
UPDATE public.trends
SET
  platform = COALESCE(NULLIF(platform, ''), 'unknown'),
  target_date = COALESCE(target_date, trend_date),
  dedup_id = COALESCE(
    NULLIF(dedup_id, ''),
    encode(
      digest(
        -- 주의: Postgres text에는 null byte(chr(0))를 넣을 수 없습니다.
        -- JS/TS에서는 \0 구분자를 쓰되, SQL에서는 일반 구분자(|)로 동일하게 결합합니다.
        COALESCE(title, '') || '|' || COALESCE(NULLIF(platform, ''), 'unknown') || '|' || COALESCE(target_date, trend_date)::text,
        'sha256'
      ),
      'hex'
    )
  )
WHERE platform IS NULL OR target_date IS NULL OR dedup_id IS NULL OR dedup_id = '';

ALTER TABLE public.trends
  ALTER COLUMN platform SET NOT NULL,
  ALTER COLUMN target_date SET NOT NULL,
  ALTER COLUMN dedup_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_trends_dedup_id
  ON public.trends (dedup_id);

