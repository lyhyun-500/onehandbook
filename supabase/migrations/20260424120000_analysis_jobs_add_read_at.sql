-- 알림 벨 "모두 읽음" 상태를 DB 에 영속화하기 위한 컬럼.
-- 기존 구현은 클라이언트 sessionStorage 에만 저장해서 다른 브라우저/기기에서
-- 읽음 처리가 전파되지 않는 버그가 있었다.
-- (향후 비분석 알림이 생기면 별도 notifications 테이블로 승격 검토.)

ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- 읽음 안 된 (NULL) 행만 빠르게 훑기 위한 부분 인덱스.
-- outcomes 리스트는 유저별 완료/실패 최신순 조회라 app_user_id 조합.
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_unread
  ON public.analysis_jobs(app_user_id, updated_at DESC)
  WHERE read_at IS NULL;

COMMENT ON COLUMN public.analysis_jobs.read_at IS
  '헤더 알림 벨에서 "모두 읽음" 처리된 시각. NULL 이면 유저가 아직 안 읽음. completed/failed 최상위 job 대상으로만 세팅됨.';
