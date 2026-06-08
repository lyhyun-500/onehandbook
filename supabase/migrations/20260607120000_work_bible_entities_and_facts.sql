-- ===================================================
-- migration: work_bible_entities_and_facts
-- 작품 바이블 (작품 RAG) v1 — fact 원장 + 엔티티 레지스트리
--
-- LEE 결정 영속화 (본 라운드):
-- - source_job_id UUID (analysis_jobs.id 타입 정합)
-- - works(id) / episodes(id) ON DELETE CASCADE (관례 정합 + 삭제 회차 = 분석 오염 차단)
-- - episode_number NOT NULL (fold 필터 의미 보장, 글로벌 fact 모델 부재)
-- - attributes JSONB NOT NULL (시드 이관 손실 0, 정적 작가 제공 특성 영속화)
-- - entity_type 5종 / fact_type 5종 CHECK (스키마 개방, v1 추출 = character + foreshadow)
-- - source 3종 CHECK (seed / manual / extracted)
-- - RLS = SELECT only authenticated (쓰기 = service_role 전용, deny by default)
-- ===================================================

-- ---------------------------------------------------
-- §1. work_entities — 엔티티 레지스트리 (정체성)
-- ---------------------------------------------------
CREATE TABLE public.work_entities (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id        BIGINT NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  entity_type    TEXT NOT NULL CHECK (entity_type IN
                   ('character','faction','location','item','foreshadow')),
  canonical_name TEXT NOT NULL,
  aliases        TEXT[] NOT NULL DEFAULT '{}',
  brief          TEXT,
  attributes     JSONB NOT NULL DEFAULT '{}'::jsonb,
  source         TEXT NOT NULL CHECK (source IN ('seed','manual','extracted')),
  first_seen_episode INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_id, entity_type, canonical_name)
);

CREATE INDEX idx_work_entities_work_id ON public.work_entities(work_id);

ALTER TABLE public.work_entities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_entities'
      AND policyname = 'work_entities_select_own'
  ) THEN
    CREATE POLICY work_entities_select_own
      ON public.work_entities
      FOR SELECT
      USING (
        work_id IN (
          SELECT w.id
          FROM public.works w
          WHERE w.author_id IN (
            SELECT u.id FROM public.users u
            WHERE u.auth_id = auth.uid()
              AND u.deleted_at IS NULL
          )
        )
      );
  END IF;
END $$;

GRANT SELECT ON public.work_entities TO authenticated;

-- ---------------------------------------------------
-- §2. work_facts — fact 원장 (시간순 append, 회차당 다수)
-- ---------------------------------------------------
CREATE TABLE public.work_facts (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id              BIGINT NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  episode_id           BIGINT NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  episode_number       INT NOT NULL,
  fact_type            TEXT NOT NULL CHECK (fact_type IN
                         ('event','state_change','relationship_change',
                          'foreshadow_planted','foreshadow_resolved')),
  entity_ids           BIGINT[] NOT NULL DEFAULT '{}',
  content              TEXT NOT NULL,
  value                JSONB,
  confidence           REAL CHECK (confidence >= 0 AND confidence <= 1),
  source_job_id        UUID REFERENCES public.analysis_jobs(id) ON DELETE SET NULL,
  episode_content_hash TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_facts_work_id ON public.work_facts(work_id);
CREATE INDEX idx_work_facts_fold ON public.work_facts(work_id, episode_number);
CREATE INDEX idx_work_facts_entity_ids ON public.work_facts USING GIN (entity_ids);

ALTER TABLE public.work_facts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_facts'
      AND policyname = 'work_facts_select_own'
  ) THEN
    CREATE POLICY work_facts_select_own
      ON public.work_facts
      FOR SELECT
      USING (
        work_id IN (
          SELECT w.id
          FROM public.works w
          WHERE w.author_id IN (
            SELECT u.id FROM public.users u
            WHERE u.auth_id = auth.uid()
              AND u.deleted_at IS NULL
          )
        )
      );
  END IF;
END $$;

GRANT SELECT ON public.work_facts TO authenticated;
