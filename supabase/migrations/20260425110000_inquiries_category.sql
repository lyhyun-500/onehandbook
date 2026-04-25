-- 1:1 문의 카테고리 분류 (ADR-0008 후속).
-- 운영 분석 + 답변 우선순위 결정용. enum 은 코드(src/lib/inquiry/categories.ts) 가 권위 있는 소스.
-- 기존 행은 'general' 로 백필.

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

COMMENT ON COLUMN public.inquiries.category IS
  '문의 카테고리: usage / error / payment / account / quality / general. 코드 단에서 enum 관리.';
