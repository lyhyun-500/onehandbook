// 1:1 문의함 — 좌측 list 행 (Phase 2-D-9 commit 2).
// 시안 design_novel/novel-agent/inquiries.jsx L112-134 정합.
//
// LEE 결정 영속화: unread = 옵션 1 (SKIP) — derive 부재, 표시 X.

"use client";

import {
  InquiryCategoryChip,
  InquiryStatusBadge,
} from "@/components/inquiries/atoms";
import {
  deriveInquiryStatus,
  type InquiryStatusInput,
} from "@/lib/inquiry/status";

export interface InquiryRowBase extends InquiryStatusInput {
  id: string;
  category: string;
  title: string;
  created_at: string;
  replied_at: string | null;
}

interface InquiryListItemProps {
  q: InquiryRowBase;
  active: boolean;
  onClick: () => void;
}

function formatLastActivity(q: InquiryRowBase): string {
  const iso = q.closed_at ?? q.replied_at ?? q.created_at;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortenId(id: string): string {
  return id.slice(0, 8);
}

export function InquiryListItem({ q, active, onClick }: InquiryListItemProps) {
  const status = deriveInquiryStatus(q);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full border-b border-stone-800/40 px-4 py-3.5 text-left transition-colors ${
        active
          ? "bg-sky-400/[0.06] border-l-2 border-l-sky-400"
          : "hover:bg-stone-100/[0.02]"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <InquiryCategoryChip category={q.category} />
        <InquiryStatusBadge status={status} />
      </div>
      <div
        className={`line-clamp-2 font-serif text-[13.5px] leading-snug ${
          active ? "text-stone-100" : "text-stone-200"
        }`}
      >
        {q.title}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-stone-500">
        <span className="font-mono tabular-nums">#{shortenId(q.id)}</span>
        <span className="font-mono tabular-nums">{formatLastActivity(q)}</span>
      </div>
    </button>
  );
}
