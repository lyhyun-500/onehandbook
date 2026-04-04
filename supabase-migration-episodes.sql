-- ============================================
-- episodes 테이블 추가
-- Supabase SQL Editor에서 실행
-- ============================================

-- episodes 테이블
CREATE TABLE episodes (
    id BIGSERIAL PRIMARY KEY,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    episode_number INT NOT NULL CHECK (episode_number > 0),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) <= 10000),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(work_id, episode_number)
);

CREATE INDEX idx_episodes_work ON episodes(work_id);
CREATE INDEX idx_episodes_work_number ON episodes(work_id, episode_number);

-- 권한 부여
GRANT ALL ON public.episodes TO anon, authenticated;

-- RLS
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

-- 정책: 해당 작품의 작가만 CRUD
DROP POLICY IF EXISTS "episodes_select_for_author" ON episodes;
CREATE POLICY "episodes_select_for_author" ON episodes FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "episodes_insert_for_author" ON episodes;
CREATE POLICY "episodes_insert_for_author" ON episodes FOR INSERT
  WITH CHECK (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "episodes_update_for_author" ON episodes;
CREATE POLICY "episodes_update_for_author" ON episodes FOR UPDATE
  USING (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "episodes_delete_for_author" ON episodes;
CREATE POLICY "episodes_delete_for_author" ON episodes FOR DELETE
  USING (
    work_id IN (
      SELECT w.id FROM works w
      JOIN users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );
