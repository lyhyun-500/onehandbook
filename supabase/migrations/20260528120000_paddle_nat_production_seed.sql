-- ADR-0028 후속: NAT 낱개 충전 패키지 seed (production, 6 row)
-- 본 작업 정합 사실:
--   1 NAT = 200 KRW (기본 단가)
--   보너스: 5,000원 0% / 10,000원 5% / 20,000원 10% / 30,000원 15% / 40,000원 20% / 50,000원 25%
--   짝수 처리: ceil 후 홀수면 +1 (50,000원 보너스 62.5 → 64 NAT)
-- 환경: production (Paddle production dashboard price 생성 후 정합)
-- subscription row 0 (NAT 낱개 6 row 만, LEE 보류 사양)

INSERT INTO public.paddle_price_nat_mapping (
  paddle_price_id, product_type, nat_amount, description, active, environment
)
VALUES
  ('pri_01kspd7ancysqn8rrkxwq69ysm', 'one_time', 25,  'NAT 25팩 (5,000 KRW, 보너스 없음)',     true, 'production'),
  ('pri_01kspd8jd6z04g5darm0681txy', 'one_time', 54,  'NAT 54팩 (10,000 KRW, 보너스 +4)',       true, 'production'),
  ('pri_01kspd9r2z3azknv8cmgzvp8pb', 'one_time', 110, 'NAT 110팩 (20,000 KRW, 보너스 +10)',     true, 'production'),
  ('pri_01kspdaw2sv40hw5ys4k63004p', 'one_time', 174, 'NAT 174팩 (30,000 KRW, 보너스 +24, 추천)', true, 'production'),
  ('pri_01kspdcd8kg5dw224pqvfkk9vh', 'one_time', 240, 'NAT 240팩 (40,000 KRW, 보너스 +40)',     true, 'production'),
  ('pri_01kspddg9w65zm9qdt5gwptqgw', 'one_time', 314, 'NAT 314팩 (50,000 KRW, 보너스 +64, MAX)', true, 'production')
ON CONFLICT (paddle_price_id) DO NOTHING;
