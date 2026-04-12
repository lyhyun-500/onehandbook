-- profiles.phone_number 단일 컬럼 UNIQUE 제약을 이름과 무관하게 제거
-- (이전 마이그레이션에서 conname 이 다르거나, 수동 생성 제약이 남은 경우 대비)

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'profiles'
      AND con.contype = 'u'
      AND array_length(con.conkey, 1) = 1
      AND EXISTS (
        SELECT 1
        FROM pg_attribute a
        WHERE a.attrelid = con.conrelid
          AND a.attnum = con.conkey[1]
          AND a.attname = 'phone_number'
          AND NOT a.attisdropped
      )
  ) LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 제약이 아닌 UNIQUE 인덱스만 남은 경우(드묾)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT i.relname AS idx
    FROM pg_class i
    JOIN pg_index ix ON i.oid = ix.indexrelid
    JOIN pg_class t ON ix.indrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND ix.indisunique
      AND NOT ix.indisprimary
      AND pg_get_indexdef(i.oid) ILIKE '%(phone_number)%'
  ) LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.idx);
  END LOOP;
END $$;
