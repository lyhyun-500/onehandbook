-- 20260517120000_works_genre_legacy_backup.sql
-- 목적: genre enum 코드측 변경(미스터리/SF/일상 제거, BL/로맨스판타지 추가) 대비
--       works.genre 원본 비가역 보존. (R1 결정 — 영향 0건이어도 무조건 백업)
-- CHECK 제약 미신설: LEE 결정 — genre 값 검증은 코드 GENRES 상수 유지
--       (베타 단계 장르체계 미확정 + 해외확장 권역별 장르 대비, 운영 민첩성 우선).
-- 적용: 2026-05-17 LEE Supabase Studio 단일 Run.
--       검증 통과 (genre_legacy_null=0 / mismatch=0 / filled=17, soft-deleted 0건).
-- 멱등성: ADD COLUMN IF NOT EXISTS + UPDATE WHERE IS NULL → 재실행 안전(e2e 재동기화 무해).

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS genre_legacy text;

UPDATE public.works
  SET genre_legacy = genre
  WHERE genre_legacy IS NULL;
