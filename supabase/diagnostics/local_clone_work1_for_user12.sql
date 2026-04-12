-- 로컬 테스트: user 1 의 work id=1 을 건드리지 않고, 동일 내용의 새 작품을 user 12 에 복제합니다.
-- 회차(원고)까지 복사합니다. 분석(analysis_runs 등)은 복사하지 않습니다 — 새로 돌리면 됩니다.
-- user 12 에 코인 +100 (테스트용)
--
-- Supabase SQL Editor · postgres / service role 권장

BEGIN;

WITH src AS (
  SELECT *
  FROM public.works
  WHERE id = 1
),
ins_work AS (
  INSERT INTO public.works (
    title,
    genre,
    author_id,
    status,
    total_episodes,
    tags,
    world_setting,
    character_settings
  )
  SELECT
    src.title || ' [로컬복제]',
    src.genre,
    12,
    src.status,
    src.total_episodes,
    COALESCE(src.tags, '{}'::text[]),
    COALESCE(src.world_setting, '{}'::jsonb),
    COALESCE(src.character_settings, '[]'::jsonb)
  FROM src
  RETURNING id
)
INSERT INTO public.episodes (
  work_id,
  episode_number,
  title,
  content,
  content_hash
)
SELECT
  ins_work.id,
  e.episode_number,
  e.title,
  e.content,
  e.content_hash
FROM public.episodes e
CROSS JOIN ins_work
WHERE e.work_id = 1
ORDER BY e.episode_number;

-- episodes 에 content_hash 컬럼이 없으면 위 INSERT 에서 content_hash 줄을 빼고 실행하세요.

UPDATE public.users
SET coin_balance = COALESCE(coin_balance, 0) + 100
WHERE id = 12;

COMMIT;

-- 확인
-- SELECT id, title, author_id FROM public.works WHERE author_id = 12 ORDER BY id DESC LIMIT 3;
-- SELECT w.id, w.title, COUNT(e.id) AS ep_count FROM public.works w LEFT JOIN public.episodes e ON e.work_id = w.id WHERE w.author_id = 12 GROUP BY w.id, w.title;
