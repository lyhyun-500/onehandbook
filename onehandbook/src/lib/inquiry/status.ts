// 1:1 문의 상태 derive — Phase 2-D-9 (commit 2) 옵션 Z 정합.
//
// DB 사실: inquiries.replied_at + inquiries.reply_content + inquiries.closed_at.
// derive 규칙:
//   closed_at NOT NULL                                           → "closed"
//   replied_at NOT NULL AND reply_content NOT NULL AND closed_at NULL → "answered"
//   기타                                                          → "waiting"

export type InquiryStatus = "waiting" | "answered" | "closed";

export interface InquiryStatusInput {
  reply_content: string | null;
  closed_at: string | null;
}

export function deriveInquiryStatus(row: InquiryStatusInput): InquiryStatus {
  if (row.closed_at != null) return "closed";
  if (row.reply_content != null && row.reply_content.length > 0) {
    return "answered";
  }
  return "waiting";
}

export const INQUIRY_STATUS_META: Record<
  InquiryStatus,
  { label: string; tone: string; dot: string; soft: string }
> = {
  waiting: {
    label: "답변 대기",
    tone: "text-stone-300",
    dot: "bg-stone-400",
    soft: "bg-stone-100/[0.06]",
  },
  answered: {
    label: "답변 완료",
    tone: "text-emerald-200",
    dot: "bg-emerald-400",
    soft: "bg-emerald-400/[0.10]",
  },
  closed: {
    label: "종료",
    tone: "text-stone-500",
    dot: "bg-stone-600",
    soft: "bg-stone-100/[0.03]",
  },
};
