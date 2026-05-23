-- 20260520120000_users_onboarding_seen_at.sql
-- 목적: 신규 작가 온보딩 (05A 풀스크린) 1회 노출 여부 추적.
--       작품 0건 + onboarding_seen_at IS NULL 시 /onboarding 진입.
--       닫기 트리거 4종 (「내 작품으로 시작하기」/「둘러보고 결정할게요」/
--       「건너뛰기」/「시작하기 1/1」 close) 모두 now() UPDATE.
-- 컬럼: NULL default — 신규 가입자만 NULL 로 시작.
-- 기존 가입자 backfill: ALTER 직후 NULL 인 모든 row 를 now() 로 마킹 (UPDATE).
--       사유: 기존 가입자(migration 적용 시점 이전)는 작품 0건이어도 05A 노출 안 됨.
--       신규 가입자만 NULL 시작 → /onboarding redirect → 시뮬 4.5초 + 본문 (정식 path).
-- RLS: users 테이블 기존 update policy (본인 row) 자동 적용.
--       backfill UPDATE 는 service_role 권한으로 migration 시점에 실행 — RLS 우회 정합.
--       컬럼 단위 정책 부재 — 신규 RLS 정책 신설 불필요.
-- 멱등성: ADD COLUMN IF NOT EXISTS + UPDATE WHERE IS NULL → 재실행 안전 (e2e 재동기화 무해).
-- 적용: LEE Studio Run (단계 4 검증 통과 후).
-- Rollback: 의존 코드(/onboarding 가드, studio 분기, OnboardingFullscreen 갱신) 먼저 제거 →
--          ALTER TABLE public.users DROP COLUMN IF EXISTS onboarding_seen_at;
-- ⚠️ LEE D-B 검증 시 신규 사용자 시나리오 (시나리오 C: 시뮬 4.5초 + 05A) 검증하려면
--    LEE 본인 row 를 NULL 로 되돌려야 함:
--    UPDATE public.users SET onboarding_seen_at = NULL WHERE auth_id = '<LEE user uuid>';
--    또는 새 테스트 계정으로 검증.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_seen_at timestamptz;

-- 기존 가입자 backfill: 이미 작업실 사용 중인 사용자는 05A 노출 대상 아님.
-- 신규 가입자만 NULL 로 시작 (이후 /studio 진입 시 정식 온보딩 path).
UPDATE public.users
  SET onboarding_seen_at = now()
  WHERE onboarding_seen_at IS NULL;
