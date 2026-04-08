-- ============================================
-- Tag 테이블 + 시드 + works.tags 연동 트리거
-- Supabase SQL Editor에서 단독 실행용
-- ============================================

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

DROP POLICY IF EXISTS "tags_insert_authenticated" ON public.tags;
CREATE POLICY "tags_insert_authenticated" ON public.tags
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

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

CREATE OR REPLACE FUNCTION public.sync_tags_from_work_tags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_tags text[] := COALESCE(OLD.tags, '{}'::text[]);
  new_tags text[] := COALESCE(NEW.tags, '{}'::text[]);
  t text;
BEGIN
  FOREACH t IN ARRAY new_tags LOOP
    t := regexp_replace(trim(COALESCE(t, '')), '^#+', '');
    IF length(t) = 0 THEN
      CONTINUE;
    END IF;
    INSERT INTO public.tags(name)
    VALUES (t)
    ON CONFLICT (name_lc) DO NOTHING;
  END LOOP;

  FOREACH t IN ARRAY new_tags LOOP
    t := regexp_replace(trim(COALESCE(t, '')), '^#+', '');
    IF length(t) = 0 THEN CONTINUE; END IF;
    IF NOT (t = ANY(old_tags)) THEN
      UPDATE public.tags
      SET usage_count = usage_count + 1
      WHERE name_lc = lower(t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY old_tags LOOP
    t := regexp_replace(trim(COALESCE(t, '')), '^#+', '');
    IF length(t) = 0 THEN CONTINUE; END IF;
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

