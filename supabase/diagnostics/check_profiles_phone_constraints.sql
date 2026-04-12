-- Supabase 대시보드 → SQL Editor: profiles 에 남은 phone_number 단일 컬럼 유일성을 확인합니다.
-- 1) UNIQUE 제약 (ALTER TABLE ... UNIQUE) — 아래 결과가 비어 있으면 "제약"으로는 없음
-- 2) UNIQUE 인덱스 — CREATE UNIQUE INDEX 만 있으면 1번 쿼리에는 안 나옴 → 2번 필수

-- 1) public.profiles 의 모든 UNIQUE 제약
SELECT
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'profiles'
  AND c.contype = 'u';

-- 2) public.profiles 에 붙은 UNIQUE 인덱스(전화번호 컬럼 포함 가능성)
SELECT
  i.relname AS index_name,
  ix.indisunique,
  pg_get_indexdef(i.oid) AS index_def
FROM pg_class i
JOIN pg_index ix ON i.oid = ix.indexrelid
JOIN pg_class t ON ix.indrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'profiles'
  AND ix.indisunique
  AND NOT ix.indisprimary;
