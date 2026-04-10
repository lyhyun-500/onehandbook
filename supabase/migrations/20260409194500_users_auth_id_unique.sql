-- public.users.auth_id는 OAuth/세션 동기화에 사용되므로 유니크 보장 필요
-- (NULL은 허용: 탈퇴 시 auth_id를 NULL로 만듭니다)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_auth_id_not_null
  ON public.users (auth_id)
  WHERE auth_id IS NOT NULL;

