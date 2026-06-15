-- ============================================================================
-- 프롤로그 도입 schema — ADR-0031 정합.
--
-- 변경:
--   1. episodes.episode_type TEXT — 'episode' 단독 vs 'prologue' 분기 사양
--      DEFAULT 'episode' 안 기존 row 자동 backfill 정합.
--   2. episode_number CHECK > 0 → >= 0 완화 (프롤로그 = 0 사양).
--   3. partial unique index — 작품당 프롤로그 1개 제약 사양 (race 안전망).
--
-- 운영 적용 = LEE Studio SQL Editor 수동 path (CLAUDE.md DB 권한 사실 정합).
-- ============================================================================

-- ─── 1. episode_type 컬럼 ────────────────────────────────
ALTER TABLE public.episodes
  ADD COLUMN episode_type TEXT NOT NULL DEFAULT 'episode'
  CHECK (episode_type IN ('episode', 'prologue'));

-- ─── 2. episode_number CHECK 완화 ────────────────────────
ALTER TABLE public.episodes
  DROP CONSTRAINT episodes_episode_number_check;

ALTER TABLE public.episodes
  ADD CONSTRAINT episodes_episode_number_check CHECK (episode_number >= 0);

-- ─── 3. partial unique index — 작품당 프롤로그 1개 ───────
CREATE UNIQUE INDEX one_prologue_per_work
  ON public.episodes(work_id)
  WHERE episode_type = 'prologue';

COMMENT ON COLUMN public.episodes.episode_type IS
  'episode = 본편 / prologue = 프롤로그. 프롤로그 = episode_number 0 단독, 작품당 1개 제약 사양.';
