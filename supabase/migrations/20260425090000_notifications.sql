-- 통합 알림 테이블 (ADR-0008 §2-1).
-- analysis_jobs.read_at 은 그대로 유지하고 (Phase 1) 신규 알림(예: 1:1 문의 답변)
-- 만 이 테이블을 사용한다. Phase 2 (별도 ADR) 에서 analysis 도 이쪽으로 이전 예정.

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        text NOT NULL,                -- 'inquiry_reply' 등 (자유 텍스트, ADR-0008 §7 Q3)
  ref_id      text NOT NULL,                -- 원본 row id (uuid 또는 bigint 를 text 로 통일)
  title       text NOT NULL,
  body        text,
  link_url    text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 조회 가능. INSERT/UPDATE 는 service_role 만 (어드민/시스템 발송).
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO service_role;

COMMENT ON TABLE public.notifications IS
  '통합 알림 테이블. 1:1 문의 답변 등 신규 알림 채널이 사용. analysis 알림은 Phase 2 까지 analysis_jobs.read_at 유지.';
COMMENT ON COLUMN public.notifications.type IS
  '알림 종류 식별자. ''inquiry_reply'' 등. ADR-0008 §7 Q3 — 자유 텍스트, 코드 레벨에서 일관 관리.';
COMMENT ON COLUMN public.notifications.ref_id IS
  '원본 객체 id. inquiry_reply 의 경우 inquiries.id (uuid). text 로 통일해 다양한 ref 타입 수용.';
