-- ============================================
-- 대시보드 기능을 위한 마이그레이션
-- Supabase SQL Editor에서 실행
-- ============================================

-- 0. 테이블 접근 권한 부여 (permission denied 방지)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.works TO anon, authenticated;
GRANT ALL ON public.reader_actions TO anon, authenticated;

-- 1. users 테이블에 auth_id 추가 (auth.users와 연결)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- 2. RLS 활성화 및 정책 설정
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE reader_actions ENABLE ROW LEVEL SECURITY;

-- users: 본인만 조회/수정
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth_id = auth.uid());

-- works: 본인 작품만 CRUD (author_id가 본인 users.id인 경우)
-- 서비스 역할로 조회할 수 있도록 정책 추가
DROP POLICY IF EXISTS "works_select_own" ON works;
CREATE POLICY "works_select_own" ON works FOR SELECT
  USING (author_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "works_insert_own" ON works;
CREATE POLICY "works_insert_own" ON works FOR INSERT
  WITH CHECK (author_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "works_update_own" ON works;
CREATE POLICY "works_update_own" ON works FOR UPDATE
  USING (author_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "works_delete_own" ON works;
CREATE POLICY "works_delete_own" ON works FOR DELETE
  USING (author_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- reader_actions: 해당 작품의 작가만 조회 (Agent Score 레거시 집계용)
DROP POLICY IF EXISTS "reader_actions_select_for_author" ON reader_actions;
CREATE POLICY "reader_actions_select_for_author" ON reader_actions FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );
