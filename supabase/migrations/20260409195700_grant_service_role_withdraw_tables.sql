-- 탈퇴 플로우에서 service_role이 접근하는 테이블들 권한 보장
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.works TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reader_actions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sms_otp_challenges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.nat_ledger TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analysis_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_withdrawals TO service_role;

