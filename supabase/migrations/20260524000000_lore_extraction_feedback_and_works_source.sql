-- ===================================================
-- migration: lore_extraction_feedback + works.{worldview,characters}_source
-- 의제 신규-1+2 통합 (세계관·인물 기본값 + NULL 분기 자동 추출 + 피드백)
--
-- LEE 결정 영속화 통과 (24건 누적):
-- - 결정 5 (갱신): lore_extraction_feedback + extraction_scope 추가
-- - 결정 9 (옵션 LS-2): worldview_source + characters_source 항목 분리
-- - 결정 17 (옵션 A): backfill 진행 (기 입력 = manual 영속화)
-- - 결정 18 (통과): column type JSONB 확정 (works.world_setting / character_settings 정합)
-- - 결정 19 (옵션 P-1): name 검증 정밀 사양
-- - 결정 20 (옵션 J-1): extracted_worldview / extracted_characters = JSONB
-- ===================================================

-- ---------------------------------------------------
-- §1. lore_extraction_feedback 테이블 신설
-- ---------------------------------------------------
CREATE TABLE public.lore_extraction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id BIGINT NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- 추출 결과 (NULL 가능, 추출 진행한 항목만 영속화)
  -- 결정 20 옵션 J-1: works.world_setting / character_settings JSONB 사양 정합
  extracted_worldview JSONB,
  extracted_characters JSONB,

  -- 추출 분기 영속화 (4 경우의 수 정합, 경우 4 = 모달 진입 X = 피드백 X)
  extraction_scope TEXT NOT NULL CHECK (extraction_scope IN (
    'both',                  -- 경우 1: 양쪽 추출
    'characters_only',       -- 경우 2: 인물만 추출
    'worldview_only'         -- 경우 3: 세계관만 추출
  )),

  -- 피드백 사양 (옵션 G-2 정합)
  feedback_rating TEXT NOT NULL CHECK (feedback_rating IN ('적합', '부분 적합', '부적합')),
  feedback_comment TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.lore_extraction_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON public.lore_extraction_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can view own feedback"
  ON public.lore_extraction_feedback
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

GRANT SELECT, INSERT ON public.lore_extraction_feedback TO authenticated;

-- 인덱스 (조회 사양 정합)
CREATE INDEX idx_lore_extraction_feedback_work_id
  ON public.lore_extraction_feedback(work_id);
CREATE INDEX idx_lore_extraction_feedback_user_id
  ON public.lore_extraction_feedback(user_id);
CREATE INDEX idx_lore_extraction_feedback_created_at
  ON public.lore_extraction_feedback(created_at DESC);

COMMENT ON TABLE public.lore_extraction_feedback IS
  'AI 자동 추출한 세계관/인물 결과 + 사용자 피드백 영속화 (의제 신규-1+2 정합).';
COMMENT ON COLUMN public.lore_extraction_feedback.extraction_scope IS
  '추출 분기 (4 경우의 수 정합) — both/characters_only/worldview_only. 경우 4 (양쪽 존재) = 모달 진입 X = 본 row 없음.';
COMMENT ON COLUMN public.lore_extraction_feedback.feedback_rating IS
  '사용자 피드백 (옵션 G-2 정합) — 적합/부분 적합/부적합.';

-- ---------------------------------------------------
-- §2. works 테이블 worldview_source + characters_source 컬럼 추가
-- 결정 9 옵션 LS-2: 항목별 출처 분리 (manual / auto_extracted)
-- ---------------------------------------------------
ALTER TABLE public.works
  ADD COLUMN worldview_source TEXT
  CHECK (worldview_source IN ('manual', 'auto_extracted'));

ALTER TABLE public.works
  ADD COLUMN characters_source TEXT
  CHECK (characters_source IN ('manual', 'auto_extracted'));

COMMENT ON COLUMN public.works.worldview_source IS
  '세계관 항목 출처 — manual (사용자 입력) / auto_extracted (AI 추출) / NULL (미설정).';
COMMENT ON COLUMN public.works.characters_source IS
  '인물 항목 출처 — manual (사용자 입력) / auto_extracted (AI 추출) / NULL (미설정).';

-- ---------------------------------------------------
-- §3. 기존 작품 backfill (결정 17 옵션 A + 결정 19 옵션 P-1 정합)
-- JSONB 정합 SQL (결정 18 통과 사실 영속화)
-- ---------------------------------------------------

-- worldview_source backfill (JSONB object 정합)
-- world_setting JSONB object 안 background/era/rules 중 하나라도 비어있지 않으면 manual
UPDATE public.works
SET worldview_source = 'manual'
WHERE world_setting IS NOT NULL
  AND world_setting != '{}'::jsonb
  AND (
    COALESCE(TRIM(world_setting->>'background'), '') != ''
    OR COALESCE(TRIM(world_setting->>'era'), '') != ''
    OR COALESCE(TRIM(world_setting->>'rules'), '') != ''
  );

-- characters_source backfill (JSONB array 정합, 옵션 P-1 name 검증 정밀)
-- character_settings JSONB array 안 name 비어있지 않은 캐릭터 1건 이상 존재 시 manual
UPDATE public.works
SET characters_source = 'manual'
WHERE character_settings IS NOT NULL
  AND character_settings != '[]'::jsonb
  AND jsonb_typeof(character_settings) = 'array'
  AND jsonb_array_length(character_settings) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(character_settings) AS elem
    WHERE COALESCE(TRIM(elem->>'name'), '') != ''
  );

-- ---------------------------------------------------
-- §4. Rollback (양방향, 수동 실행 사양)
--
-- DROP INDEX IF EXISTS idx_lore_extraction_feedback_created_at;
-- DROP INDEX IF EXISTS idx_lore_extraction_feedback_user_id;
-- DROP INDEX IF EXISTS idx_lore_extraction_feedback_work_id;
-- DROP POLICY IF EXISTS "Users can view own feedback" ON public.lore_extraction_feedback;
-- DROP POLICY IF EXISTS "Users can insert own feedback" ON public.lore_extraction_feedback;
-- DROP TABLE IF EXISTS public.lore_extraction_feedback;
-- ALTER TABLE public.works DROP COLUMN IF EXISTS characters_source;
-- ALTER TABLE public.works DROP COLUMN IF EXISTS worldview_source;
-- ===================================================
