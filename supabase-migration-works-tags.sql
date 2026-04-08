-- ============================================
-- 작품 태그(string[]) 저장용
-- Supabase SQL Editor에서 단독 실행용
-- ============================================

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.works.tags IS '작품 태그 목록 (예: 회귀물, 먼치킨, 전문직)';

