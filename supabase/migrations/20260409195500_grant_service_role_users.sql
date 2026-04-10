-- service_role 서버 작업(탈퇴/동기화)용 권한 보장
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;

