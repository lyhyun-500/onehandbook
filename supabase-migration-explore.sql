-- ============================================
-- 공개 탐색(/explore)용 RLS
-- Supabase SQL Editor에서 실행
-- ============================================

-- 작품·회차: 비로그인 포함 누구나 열람
DROP POLICY IF EXISTS "works_public_select" ON works;
CREATE POLICY "works_public_select" ON works FOR SELECT USING (true);

DROP POLICY IF EXISTS "episodes_public_select" ON episodes;
CREATE POLICY "episodes_public_select" ON episodes FOR SELECT USING (true);

-- reader_actions: Agent Score 레거시 집계를 위해 공개 조회
DROP POLICY IF EXISTS "reader_actions_public_select" ON reader_actions;
CREATE POLICY "reader_actions_public_select" ON reader_actions FOR SELECT USING (true);

-- 로그인 독자만 읽기 행동 기록
DROP POLICY IF EXISTS "reader_actions_insert_reader" ON reader_actions;
CREATE POLICY "reader_actions_insert_reader" ON reader_actions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
