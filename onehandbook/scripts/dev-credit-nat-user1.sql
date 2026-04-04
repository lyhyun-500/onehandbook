-- 로컬/스테이징 테스트: app user id = 1 에 NAT 1000 충전
-- 전제: supabase-migration-payments-nat-ledger.sql 적용됨 (credit_nat + nat_ledger)
-- Supabase SQL Editor 에서 실행 (postgres 권한으로 RPC 호출 가능)

SELECT public.credit_nat(
  1::bigint,
  1000,
  'manual_adjust',
  NULL,
  NULL,
  '{"note": "manual dev credit"}'::jsonb
);

-- 기대: {"ok": true, "balance": <잔액>}
-- 오류 시: user_not_found (id 1 없음), invalid_amount (1~100000 밖)
