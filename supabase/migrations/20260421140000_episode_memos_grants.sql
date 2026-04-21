-- episode_memos 테이블 authenticated 역할 권한 부여
-- 초기 마이그레이션에서 누락된 GRANT 보완
GRANT SELECT, INSERT, UPDATE, DELETE 
  ON public.episode_memos 
  TO authenticated;

GRANT USAGE, SELECT 
  ON SEQUENCE public.episode_memos_id_seq 
  TO authenticated;
