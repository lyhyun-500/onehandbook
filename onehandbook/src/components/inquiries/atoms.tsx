// 1:1 문의함 — atom 컴포넌트 (Phase 2-D-9 commit 2).
// 시안 design_novel/novel-agent/inquiries.jsx L90-110 정합.

import {
  inquiryCategoryHue,
  inquiryCategoryLabel,
} from "@/lib/inquiry/categories";
import {
  INQUIRY_STATUS_META,
  type InquiryStatus,
} from "@/lib/inquiry/status";

interface InquiryCategoryChipProps {
  category: string;
}

export function InquiryCategoryChip({ category }: InquiryCategoryChipProps) {
  const hue = inquiryCategoryHue(category);
  const label = inquiryCategoryLabel(category);
  const style = {
    background: `hsl(${hue} 30% 18% / 0.6)`,
    color: `hsl(${hue} 60% 80%)`,
    border: `1px solid hsl(${hue} 40% 30% / 0.5)`,
  };
  return (
    <span className="rounded px-2 py-0.5 text-[10px]" style={style}>
      {label}
    </span>
  );
}

interface InquiryStatusBadgeProps {
  status: InquiryStatus;
}

export function InquiryStatusBadge({ status }: InquiryStatusBadgeProps) {
  const meta = INQUIRY_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] ${meta.soft} ${meta.tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
