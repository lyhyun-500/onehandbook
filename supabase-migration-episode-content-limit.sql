-- ============================================
-- 회차 본문 1만자 제한 (episodes.content)
-- Supabase SQL Editor에서 실행
-- 기존 행 중 char_length(content) > 10000 인 데이터가 있으면 제약 추가 전에 본문을 줄이거나 삭제해야 합니다.
-- ============================================

ALTER TABLE episodes DROP CONSTRAINT IF EXISTS episodes_content_max_chars;

ALTER TABLE episodes
  ADD CONSTRAINT episodes_content_max_chars
  CHECK (char_length(content) <= 10000);
