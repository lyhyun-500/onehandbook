-- auth_id upsert(on_conflict) 안정화를 위해 "부분 인덱스"가 아니라
-- 일반 UNIQUE 인덱스로 auth_id 유니크를 보장합니다.
-- Postgres UNIQUE는 NULL을 여러 개 허용하므로(= 탈퇴 시 auth_id NULL) 문제 없습니다.

DO $$
DECLARE
  r record;
BEGIN
  -- 혹시 이미 중복 auth_id가 있으면, 한 행만 남기고 나머지는 auth_id를 NULL로 정리합니다.
  -- (어차피 현재 상태에서는 auth_id 매핑이 깨져 "회원 정보를 찾을 수 없음"이 발생합니다)
  FOR r IN
    SELECT auth_id
    FROM public.users
    WHERE auth_id IS NOT NULL
    GROUP BY auth_id
    HAVING COUNT(*) > 1
  LOOP
    UPDATE public.users u
    SET auth_id = NULL
    WHERE u.auth_id = r.auth_id
      AND u.id <> (
        SELECT MIN(id) FROM public.users WHERE auth_id = r.auth_id
      );
  END LOOP;
END $$;

-- 이제 auth_id 유니크를 강제합니다.
DROP INDEX IF EXISTS public.uniq_users_auth_id_not_null;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_auth_id
  ON public.users (auth_id);

