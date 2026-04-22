-- =============================================================================
-- users.role: 어드민 UI 접근 제어
--   Middleware 및 requireAdmin 헬퍼에서 users.role = 'admin' 검증
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN role text NOT NULL DEFAULT 'user';
  END IF;
END $$;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_allowed;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_allowed
  CHECK (role IN ('user', 'admin'));

CREATE INDEX IF NOT EXISTS idx_users_role_admin
  ON public.users(role)
  WHERE role <> 'user';

COMMENT ON COLUMN public.users.role IS
  '접근 권한 등급 — user (기본) / admin (어드민 UI 접근 허용)';

-- -----------------------------------------------------------------------------
-- LEE 본인 계정을 어드민으로 지정하려면 Supabase 콘솔 SQL 에서 아래 구문을
-- 수동 실행 (본 마이그레이션에서는 실행하지 않음):
--
--   UPDATE public.users SET role = 'admin' WHERE email = 'agent@novelagent.kr';
--
-- 적용 확인:
--   SELECT email, role FROM public.users WHERE role = 'admin';
-- -----------------------------------------------------------------------------
