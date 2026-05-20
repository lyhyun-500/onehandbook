-- 20260520120000_users_onboarding_seen_at.sql
-- 목적: 신규 작가 온보딩 (05A 풀스크린) 1회 노출 여부 추적.
--       작품 0건 + onboarding_seen_at IS NULL 시 /onboarding 진입.
--       닫기 트리거 4종 (「내 작품으로 시작하기」/「둘러보고 결정할게요」/
--       「건너뛰기」/「시작하기 1/1」 close) 모두 now() UPDATE.
-- NULL default: 기존 사용자 모두 NULL.
--       기존 작가가 작품 0건이면 다음 접속 시 05A 1회 노출됨 (의도된 정합).
-- RLS: users 테이블 기존 update policy (본인 row) 자동 적용.
--       컬럼 단위 정책 부재 — 신규 RLS 정책 신설 불필요.
-- 멱등성: ADD COLUMN IF NOT EXISTS → e2e 재동기화 무해.
-- 적용: LEE Studio Run (단계 4 검증 통과 후).
-- Rollback: ALTER TABLE public.users DROP COLUMN IF EXISTS onboarding_seen_at;
--          단 의존 코드(/onboarding 가드, studio 분기, OnboardingFullscreen 갱신) 먼저 제거.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_seen_at timestamptz;
