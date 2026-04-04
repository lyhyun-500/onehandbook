-- ============================================
-- 작품 세계관·인물 설정 (AI 분석 컨텍스트용)
-- Supabase SQL Editor에서 실행
-- ============================================

ALTER TABLE works ADD COLUMN IF NOT EXISTS world_setting jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE works ADD COLUMN IF NOT EXISTS character_settings jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN works.world_setting IS '배경·시대·세계관 규칙 등 JSON { background, era, rules }';

COMMENT ON COLUMN works.character_settings IS '인물 배열 JSON [{ name, role, personality, abilities, goals, relationships }]';
