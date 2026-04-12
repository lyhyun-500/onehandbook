-- public.users 에 남아 있으면 20260411120000 RPC 과 충돌할 수 있는 부분 유니크 인덱스.
-- 행이 나오면 20260411132000_drop_users_one_verified_phone_index.sql 을 적용하세요.

SELECT i.relname AS index_name, pg_get_indexdef(i.oid) AS index_def
FROM pg_class i
JOIN pg_index ix ON i.oid = ix.indexrelid
JOIN pg_class t ON ix.indrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'users'
  AND i.relname = 'users_one_verified_phone';
