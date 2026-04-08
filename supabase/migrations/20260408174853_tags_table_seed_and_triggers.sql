-- ============================================
-- Tag 테이블 + 시드 + works.tags 연동 트리거
-- ============================================

-- 1) tags 테이블
CREATE TABLE IF NOT EXISTS public.tags (
  id BIGSERIAL PRIMARY KEY,
  name text NOT NULL,
  name_lc text GENERATED ALWAYS AS (lower(name)) STORED,
  usage_count int NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_name_lc_uniq ON public.tags(name_lc);
CREATE INDEX IF NOT EXISTS tags_usage_count_idx ON public.tags(usage_count DESC);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tags TO anon, authenticated;

DROP POLICY IF EXISTS "tags_select_authenticated" ON public.tags;
CREATE POLICY "tags_select_authenticated" ON public.tags
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 신규 태그 생성은 authenticated만 허용 (설정 화면에서 새 태그 추가 가능)
DROP POLICY IF EXISTS "tags_insert_authenticated" ON public.tags;
CREATE POLICY "tags_insert_authenticated" ON public.tags
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.tags IS '태그 사전(자동완성/추천/집계)';
COMMENT ON COLUMN public.tags.name IS '표시용 태그명 (예: 회귀, 법정물)';
COMMENT ON COLUMN public.tags.usage_count IS 'works.tags에 포함된 빈도(트리거로 대략 집계)';

-- 2) 시드 데이터 (중복은 무시)
INSERT INTO public.tags (name)
VALUES
  ('회귀'),
  ('빙의'),
  ('환생'),
  ('먼치킨'),
  ('전문가'),
  ('복수'),
  ('헌터'),
  ('던전'),
  ('아카데미'),
  ('성장'),
  ('시스템'),
  ('랭커'),
  ('서바이벌'),
  ('정치'),
  ('전쟁'),
  ('법정물'),
  ('의학물'),
  ('경영물'),
  ('연예계'),
  ('스포츠'),
  ('추리'),
  ('미스터리'),
  ('로맨스'),
  ('로판'),
  ('현대판타지'),
  ('정통판타지'),
  ('무협'),
  ('게임'),
  ('아포칼립스'),
  ('좀비')
ON CONFLICT (name_lc) DO NOTHING;

-- 3) works.tags -> tags upsert + usage_count 집계 트리거
--    - NEW.tags에 들어온 태그를 tags 테이블에 upsert
--    - 변경분(add/remove)만 usage_count 증감
CREATE OR REPLACE FUNCTION public.sync_tags_from_work_tags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_tags text[] := COALESCE(OLD.tags, '{}'::text[]);
  new_tags text[] := COALESCE(NEW.tags, '{}'::text[]);
  t text;
BEGIN
  -- tags 컬럼이 없으면 아무것도 하지 않음 (환경 차이 대비)
  IF to_regclass('public.works') IS NULL OR to_regclass('public.tags') IS NULL THEN
    RETURN NEW;
  END IF;

  -- NEW.tags의 태그를 tags 테이블에 upsert
  FOREACH t IN ARRAY new_tags LOOP
    t := regexp_replace(trim(COALESCE(t, '')), '^#+', '');
    IF length(t) = 0 THEN
      CONTINUE;
    END IF;
    INSERT INTO public.tags(name)
    VALUES (t)
    ON CONFLICT (name_lc) DO NOTHING;
  END LOOP;

  -- 추가된 태그 usage_count +1
  FOREACH t IN ARRAY new_tags LOOP
    t := regexp_replace(trim(COALESCE(t, '')), '^#+', '');
    IF length(t) = 0 THEN
      CONTINUE;
    END IF;
    IF NOT (t = ANY(old_tags)) THEN
      UPDATE public.tags
      SET usage_count = usage_count + 1
      WHERE name_lc = lower(t);
    END IF;
  END LOOP;

  -- 제거된 태그 usage_count -1 (0 아래로 내려가지 않음)
  FOREACH t IN ARRAY old_tags LOOP
    t := regexp_replace(trim(COALESCE(t, '')), '^#+', '');
    IF length(t) = 0 THEN
      CONTINUE;
    END IF;
    IF NOT (t = ANY(new_tags)) THEN
      UPDATE public.tags
      SET usage_count = GREATEST(0, usage_count - 1)
      WHERE name_lc = lower(t);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tags_from_work_tags ON public.works;
CREATE TRIGGER trg_sync_tags_from_work_tags
AFTER INSERT OR UPDATE OF tags ON public.works
FOR EACH ROW
EXECUTE FUNCTION public.sync_tags_from_work_tags();

