-- 20260517120100_works_synopsis.sql
-- 목적: 작품 시놉시스 본문 보관 컬럼 신설. 작품설정 S 섹션 입력 → 작품상세 헤더 노출.
--       신규 필드(기존 시놉시스 데이터 부재 — LEE 확정 D-13). 데이터 이전 불필요.
-- CHECK 제약 미신설: D-5 정신 정합 (운영 민첩성, 길이/형식 제한은 코드측).
-- 적용: 2026-05-17 LEE Supabase Studio 단일 Run. 검증 통과
--       (information_schema: synopsis | text | YES, 기존 17건 NULL 무해).
-- 멱등성: ADD COLUMN IF NOT EXISTS → e2e 재동기화 무해.

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS synopsis text;
