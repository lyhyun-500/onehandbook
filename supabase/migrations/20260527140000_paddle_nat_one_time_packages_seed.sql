-- ADR-0028 후속: NAT 낱개 충전 패키지 seed (sandbox, 6 row)
-- 본 작업 정합 사실:
--   1 NAT = 200 KRW (기본 단가)
--   보너스: 5,000원 0% / 10,000원 5% / 20,000원 10% / 30,000원 15% / 40,000원 20% / 50,000원 25%
--   짝수 처리: ceil 후 홀수면 +1 (50,000원 보너스 62.5 → 64 NAT)
-- 환경: sandbox 한정 (production 진입 시 별도 migration 의제)

INSERT INTO public.paddle_price_nat_mapping (
  paddle_price_id, product_type, nat_amount, description, active, environment
)
VALUES
  ('pri_01ksmh44g0636shcw5p4va893r', 'one_time', 25,  'NAT 25팩 (5,000 KRW, 보너스 없음)',     true, 'sandbox'),
  ('pri_01ksmhc8zs3r9cyxjt99q17fqn', 'one_time', 54,  'NAT 54팩 (10,000 KRW, 보너스 +4)',       true, 'sandbox'),
  ('pri_01ksmheefcc88njq29mt1mcfht', 'one_time', 110, 'NAT 110팩 (20,000 KRW, 보너스 +10)',     true, 'sandbox'),
  ('pri_01ksmhfm5ch2svrh2y1tzytbeb', 'one_time', 174, 'NAT 174팩 (30,000 KRW, 보너스 +24, 추천)', true, 'sandbox'),
  ('pri_01ksmhgs0tbpgk9rj0ka073chf', 'one_time', 240, 'NAT 240팩 (40,000 KRW, 보너스 +40)',     true, 'sandbox'),
  ('pri_01ksmhhqyea2ebm4v7jwendk14', 'one_time', 314, 'NAT 314팩 (50,000 KRW, 보너스 +64, MAX)', true, 'sandbox')
ON CONFLICT (paddle_price_id) DO NOTHING;
