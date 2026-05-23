// 1:1 문의함 — 우측 thread detail (Phase 2-D-9 commit 2).
// 시안 design_novel/novel-agent/inquiries.jsx L136-236 정합.
//
// LEE 결정 영속화:
//   - 옵션 Q (single-turn): content -> 「내 질문」, reply_content -> 「Novel Agent 답변」
//   - 옵션 R (해결됨 / 추가 질문): answered 상태에서만 노출, closed 상태는 액션 영역 미표시

"use client";

import {
  InquiryCategoryChip,
  InquiryStatusBadge,
} from "@/components/inquiries/atoms";
import {
  deriveInquiryStatus,
  type InquiryStatusInput,
} from "@/lib/inquiry/status";

export interface InquiryRowFull extends InquiryStatusInput {
  id: string;
  category: string;
  title: string;
  content: string;
  reply_content: string | null;
  replied_at: string | null;
  closed_at: string | null;
  created_at: string;
}

interface InquiryThreadProps {
  q: InquiryRowFull;
  onBackToList: () => void;
  onClose: () => void;
  onAskAgain: () => void;
  closing: boolean;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function InquiryThread({
  q,
  onBackToList,
  onClose,
  onAskAgain,
  closing,
}: InquiryThreadProps) {
  const status = deriveInquiryStatus(q);
  const hasReply = q.reply_content != null && q.reply_content.length > 0;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
      <article className="mx-auto w-full max-w-3xl px-8 py-10">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-widest text-stone-400 hover:text-sky-200"
        >
          ← 문의 목록으로
        </button>

        <header className="mt-6 border-b border-stone-800/60 pb-6">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/75">
              1:1 문의
            </div>
            <span className="text-stone-700">·</span>
            <InquiryStatusBadge status={status} />
          </div>
          <h1 className="mt-2 font-serif text-[26px] font-medium leading-tight tracking-tight text-stone-100">
            {q.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-stone-500">
            <InquiryCategoryChip category={q.category} />
            <span className="text-stone-700">·</span>
            <span className="font-mono tabular-nums">
              접수 {formatDateTime(q.created_at)}
            </span>
            {q.replied_at && (
              <>
                <span className="text-stone-700">·</span>
                <span className="font-mono tabular-nums">
                  답변 {formatDateTime(q.replied_at)}
                </span>
              </>
            )}
          </div>
        </header>

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-stone-400">
              내 질문
            </h2>
            <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
              {formatDateTime(q.created_at)}
            </span>
          </div>
          <div
            className="mt-3 whitespace-pre-wrap font-serif text-[14.5px] leading-[1.9] text-stone-200"
            style={{ textWrap: "pretty" }}
          >
            {q.content}
          </div>
        </section>

        {hasReply ? (
          <section className="mt-10 border-t border-stone-800/60 pt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-sky-300/90">
                Novel Agent 답변
              </h2>
              {q.replied_at && (
                <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
                  {formatDateTime(q.replied_at)}
                </span>
              )}
            </div>
            <div
              className="mt-3 whitespace-pre-wrap font-serif text-[14.5px] leading-[1.9] text-stone-200"
              style={{ textWrap: "pretty" }}
            >
              {q.reply_content}
            </div>

            {status === "answered" && (
              <div className="mt-8 flex items-center justify-center gap-3 rounded-lg border border-dashed border-stone-800 bg-stone-900/20 px-5 py-3">
                <span className="font-serif text-[12.5px] text-stone-400">
                  답변이 도움이 되었나요?
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={closing}
                  className="font-serif text-[12.5px] text-emerald-300/90 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {closing ? "처리 중…" : "👍 해결됨"}
                </button>
                <span className="text-stone-700">·</span>
                <button
                  type="button"
                  onClick={onAskAgain}
                  className="font-serif text-[12.5px] text-stone-400 hover:text-sky-200"
                >
                  추가 질문
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="mt-10 rounded-lg border border-stone-800/70 bg-stone-900/40 px-6 py-8 text-center">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-sky-300/75">
              답변 대기 중
            </div>
            <p className="mt-2 font-serif text-[13px] leading-relaxed text-stone-400">
              운영팀이 확인하는 대로 답변드리겠습니다. 답변이 도착하면 알림
              메시지가 도착합니다.
            </p>
          </section>
        )}

        <footer className="mt-12 border-t border-stone-800/60 pt-6">
          <button
            type="button"
            onClick={onBackToList}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-stone-400 hover:text-sky-200"
          >
            ← 문의 목록으로
          </button>
        </footer>
      </article>
    </div>
  );
}
