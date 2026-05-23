-- 1:1 문의함 페이지 재정비 (Phase 2-D 단계 3, commit 1).
-- 시안 정합: category enum 재매핑 (6 값 -> 시안 6 값) + closed_at column 추가
-- (3-state derive: waiting / answered / closed) + RLS UPDATE policy.
--
-- LEE 사실: 운영 inquiries 테이블 = LEE 테스트 row 만 존재. 회귀 위험 0.
-- 본 채널 결정 영속화: 옵션 A (시안 enum 채택) + 옵션 Z (closed_at column 3-state derive) + usage -> feature 매핑.

-- 1. category 값 UPDATE (운영 row 정합)
UPDATE public.inquiries SET category = 'billing'  WHERE category = 'payment';
UPDATE public.inquiries SET category = 'analysis' WHERE category = 'quality';
UPDATE public.inquiries SET category = 'bug'      WHERE category = 'error';
UPDATE public.inquiries SET category = 'etc'      WHERE category = 'general';
UPDATE public.inquiries SET category = 'feature'  WHERE category = 'usage';
-- account -> account (no-op)

-- 2. default 갱신 ('general' -> 'etc')
ALTER TABLE public.inquiries ALTER COLUMN category SET DEFAULT 'etc';

-- 3. CHECK constraint 갱신 (코드 enum 정합 — src/lib/inquiry/categories.ts)
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_category_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_category_check
  CHECK (category IN ('billing', 'analysis', 'bug', 'account', 'feature', 'etc'));

-- 4. closed_at column 추가 (3-state derive 의 종료 시점)
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.inquiries.closed_at IS
  '사용자 "해결됨" 액션으로 종료한 시점. NULL=미종료. status derive: waiting(reply_content NULL) / answered(reply_content NOT NULL AND closed_at NULL) / closed(closed_at NOT NULL).';

-- 5. RLS UPDATE policy — 사용자 본인 inquiry 만 close 가능
--    row 단위 owner 검증 (auth.uid() -> users.auth_id -> users.id = inquiries.user_id).
CREATE POLICY "Users can close own inquiries"
  ON public.inquiries FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- 6. column-level GRANT — authenticated 가 closed_at 컬럼만 UPDATE 가능.
--    다른 컬럼 UPDATE 시도 = postgres 권한 오류 (보안 사실).
GRANT UPDATE (closed_at) ON public.inquiries TO authenticated;

-- ----------------------------------------------------------------------------
-- Rollback (양방향) — 본 migration 만 되돌릴 때 사용 (수동 실행, 자동 적용 아님):
--
-- REVOKE UPDATE (closed_at) ON public.inquiries FROM authenticated;
-- DROP POLICY IF EXISTS "Users can close own inquiries" ON public.inquiries;
-- ALTER TABLE public.inquiries DROP COLUMN IF EXISTS closed_at;
-- ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_category_check;
-- ALTER TABLE public.inquiries ALTER COLUMN category SET DEFAULT 'general';
-- UPDATE public.inquiries SET category = 'usage'   WHERE category = 'feature';
-- UPDATE public.inquiries SET category = 'general' WHERE category = 'etc';
-- UPDATE public.inquiries SET category = 'error'   WHERE category = 'bug';
-- UPDATE public.inquiries SET category = 'quality' WHERE category = 'analysis';
-- UPDATE public.inquiries SET category = 'payment' WHERE category = 'billing';
