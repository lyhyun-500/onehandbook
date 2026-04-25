-- 1:1 문의 + 어드민 답변 추적 테이블 (ADR-0008 §2-2).
-- 기존: Resend 메일만 발송 (DB 없음) → 답장 누락 위험
-- 변경: 컨슈머 폼이 INSERT, 어드민이 reply_content + replied_at 으로 답변 작성.

CREATE TABLE IF NOT EXISTS public.inquiries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       bigint REFERENCES public.users(id) ON DELETE SET NULL,
  user_auth_id  uuid,                          -- 탈퇴/익명화 후에도 추적 가능하도록 보존
  title         text NOT NULL,
  content       text NOT NULL,
  reply_email   text NOT NULL,                 -- 컨슈머 폼이 받은 답장용 이메일 (백업)
  reply_content text,                          -- 어드민이 작성한 답변 본문 (NEW, ADR-0008)
  replied_at    timestamptz,
  replied_by    uuid,                          -- auth.users.id (어드민 본인)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 미답장 우선 정렬용 인덱스 (replied_at NULL 이 최상단)
CREATE INDEX IF NOT EXISTS idx_inquiries_replied_created
  ON public.inquiries(replied_at NULLS FIRST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiries_user_id
  ON public.inquiries(user_id);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 컨슈머 자기 문의 조회 (account/inquiries 페이지)
CREATE POLICY "Users can view own inquiries"
  ON public.inquiries FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- 클라이언트 직접 INSERT/UPDATE 는 막고, 컨슈머 폼 핸들러와 어드민 API 가 service_role 사용
GRANT SELECT ON public.inquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inquiries TO service_role;

COMMENT ON TABLE public.inquiries IS
  '1:1 문의 본문 + 어드민 답변. ADR-0008 — 메일 → 사이트 내 답변 전환.';
COMMENT ON COLUMN public.inquiries.reply_email IS
  '컨슈머가 폼에 입력한 답장 받을 이메일. 알림 시스템 신뢰 회복 기간 동안 백업/감사용.';
COMMENT ON COLUMN public.inquiries.reply_content IS
  '어드민 답변 본문. 비어있으면 미답장 상태.';
