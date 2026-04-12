-- apply_phone_verification_success(20260411120000) 은 동일 번호가 다른 계정에 이미 인증된 경우에도
-- 본인증은 진행하고 가입 코인만 생략하도록 설계됨.
-- 그러나 public.users 에 남아 있던 부분 유니크 인덱스 users_one_verified_phone 이 있으면
-- 두 번째 계정에 같은 phone_e164 + phone_verified_at 을 쓸 수 없어 23505 가 난다.
DROP INDEX IF EXISTS public.users_one_verified_phone;
