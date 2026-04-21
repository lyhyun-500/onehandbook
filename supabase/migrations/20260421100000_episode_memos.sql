-- 회차별 메모 테이블
CREATE TABLE IF NOT EXISTS public.episode_memos (
  id bigserial PRIMARY KEY,
  episode_id bigint NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.episode_memos IS '회차별 메모 (회차당 1개)';
COMMENT ON COLUMN public.episode_memos.episode_id IS '회차 FK';
COMMENT ON COLUMN public.episode_memos.content IS '메모 자유 텍스트';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_episode_memos_episode_id
  ON public.episode_memos (episode_id);

ALTER TABLE public.episode_memos ENABLE ROW LEVEL SECURITY;

-- SELECT 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'episode_memos'
      AND policyname = 'episode_memos_select_own'
  ) THEN
    CREATE POLICY episode_memos_select_own
      ON public.episode_memos
      FOR SELECT
      USING (
        episode_id IN (
          SELECT episodes.id
          FROM public.episodes
          JOIN public.works ON public.works.id = public.episodes.work_id
          WHERE public.works.author_id IN (
            SELECT users.id FROM public.users
            WHERE users.auth_id = auth.uid()
              AND users.deleted_at IS NULL
          )
        )
      );
  END IF;
END $$;

-- INSERT 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'episode_memos'
      AND policyname = 'episode_memos_insert_own'
  ) THEN
    CREATE POLICY episode_memos_insert_own
      ON public.episode_memos
      FOR INSERT
      WITH CHECK (
        episode_id IN (
          SELECT episodes.id
          FROM public.episodes
          JOIN public.works ON public.works.id = public.episodes.work_id
          WHERE public.works.author_id IN (
            SELECT users.id FROM public.users
            WHERE users.auth_id = auth.uid()
              AND users.deleted_at IS NULL
          )
        )
      );
  END IF;
END $$;

-- UPDATE 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'episode_memos'
      AND policyname = 'episode_memos_update_own'
  ) THEN
    CREATE POLICY episode_memos_update_own
      ON public.episode_memos
      FOR UPDATE
      USING (
        episode_id IN (
          SELECT episodes.id
          FROM public.episodes
          JOIN public.works ON public.works.id = public.episodes.work_id
          WHERE public.works.author_id IN (
            SELECT users.id FROM public.users
            WHERE users.auth_id = auth.uid()
              AND users.deleted_at IS NULL
          )
        )
      )
      WITH CHECK (
        episode_id IN (
          SELECT episodes.id
          FROM public.episodes
          JOIN public.works ON public.works.id = public.episodes.work_id
          WHERE public.works.author_id IN (
            SELECT users.id FROM public.users
            WHERE users.auth_id = auth.uid()
              AND users.deleted_at IS NULL
          )
        )
      );
  END IF;
END $$;

-- DELETE 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'episode_memos'
      AND policyname = 'episode_memos_delete_own'
  ) THEN
    CREATE POLICY episode_memos_delete_own
      ON public.episode_memos
      FOR DELETE
      USING (
        episode_id IN (
          SELECT episodes.id
          FROM public.episodes
          JOIN public.works ON public.works.id = public.episodes.work_id
          WHERE public.works.author_id IN (
            SELECT users.id FROM public.users
            WHERE users.auth_id = auth.uid()
              AND users.deleted_at IS NULL
          )
        )
      );
  END IF;
END $$;
