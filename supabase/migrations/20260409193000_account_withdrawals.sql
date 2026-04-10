-- 회원 탈퇴 사유 로그 테이블
CREATE TABLE IF NOT EXISTS public.account_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  reason text NOT NULL,
  reason_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_withdrawals_user_id
  ON public.account_withdrawals (user_id);

ALTER TABLE public.account_withdrawals ENABLE ROW LEVEL SECURITY;

-- 클라이언트 직접 접근은 막고(정책 없음), 서버(Service Role)가 기록합니다.
REVOKE ALL ON public.account_withdrawals FROM anon;
REVOKE ALL ON public.account_withdrawals FROM authenticated;
GRANT SELECT, INSERT ON public.account_withdrawals TO service_role;
