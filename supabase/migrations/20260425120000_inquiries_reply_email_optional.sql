-- 1:1 문의 답변 이메일을 선택사항으로 전환 (ADR-0008 후속).
-- 사이트 알림이 메인 답변 경로 — 이메일 백업 활용도 베타 단계 ≈ 0.
-- 사용자 마찰 감소 목적.

ALTER TABLE public.inquiries
  ALTER COLUMN reply_email DROP NOT NULL;

COMMENT ON COLUMN public.inquiries.reply_email IS
  '컨슈머 폼이 받은 답장용 이메일 (선택). 사이트 알림이 닿지 않을 때만 운영팀이 별도 연락할 때 사용. NULL 가능.';
