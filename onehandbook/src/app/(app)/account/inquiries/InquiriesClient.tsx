// 1:1 문의함 — page client wrapper (Phase 2-D-9 commit 2).
// 시안 design_novel/novel-agent/inquiries.jsx L377-508 정합.
//
// LEE 결정 영속화:
//   - 옵션 1 (unread SKIP): list 행 unread dot 미표시
//   - 옵션 P (「추가 질문」 prefill): composer initialCategory 주입
//   - 옵션 R (close API): optimistic update + 토스트

"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  InquiryListItem,
  type InquiryRowBase,
} from "@/components/inquiries/InquiryListItem";
import {
  InquiryThread,
  type InquiryRowFull,
} from "@/components/inquiries/InquiryThread";
import { InquiryComposer } from "@/components/inquiries/InquiryComposer";
import {
  deriveInquiryStatus,
  type InquiryStatus,
} from "@/lib/inquiry/status";
import {
  isInquiryCategory,
  type InquiryCategory,
} from "@/lib/inquiry/categories";

interface InquiriesClientProps {
  initialInquiries: InquiryRowFull[];
}

type FilterKey = "all" | "open" | "answered" | "closed";

type ToastState = { kind: "ok" | "err"; message: string };

function statusMatchesFilter(status: InquiryStatus, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "open") return status !== "closed";
  if (filter === "answered") return status === "answered";
  if (filter === "closed") return status === "closed";
  return true;
}

export function InquiriesClient({ initialInquiries }: InquiriesClientProps) {
  const [inquiries, setInquiries] = useState<InquiryRowFull[]>(initialInquiries);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [askingFromCategory, setAskingFromCategory] =
    useState<InquiryCategory | undefined>(undefined);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const counts = useMemo(() => {
    let open = 0;
    let waiting = 0;
    let answered = 0;
    for (const q of inquiries) {
      const s = deriveInquiryStatus(q);
      if (s !== "closed") open += 1;
      if (s === "waiting") waiting += 1;
      if (s === "answered") answered += 1;
    }
    return { open, waiting, answered };
  }, [inquiries]);

  const filtered = useMemo(
    () =>
      inquiries.filter((q) =>
        statusMatchesFilter(deriveInquiryStatus(q), filter),
      ),
    [inquiries, filter],
  );

  const selected = useMemo(
    () => inquiries.find((q) => q.id === selectedId) ?? null,
    [inquiries, selectedId],
  );

  const panelOpen = composing || selected != null;

  function closePanel() {
    setComposing(false);
    setSelectedId(null);
    setAskingFromCategory(undefined);
  }

  function pushToast(kind: "ok" | "err", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4200);
  }

  function openComposerFresh() {
    setComposing(true);
    setSelectedId(null);
    setAskingFromCategory(undefined);
  }

  function openComposerFromThread(q: InquiryRowFull) {
    const cat = isInquiryCategory(q.category) ? q.category : undefined;
    setComposing(true);
    setSelectedId(null);
    setAskingFromCategory(cat);
  }

  function selectInquiry(id: string) {
    setSelectedId(id);
    setComposing(false);
    setAskingFromCategory(undefined);
  }

  async function handleCloseInquiry(q: InquiryRowFull) {
    if (closing) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/account/inquiries/${q.id}/close`, {
        method: "POST",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        closed_at?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.closed_at) {
        pushToast(
          "err",
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : "종료 처리에 실패했습니다.",
        );
        return;
      }
      const closedAt = data.closed_at;
      setInquiries((prev) =>
        prev.map((row) =>
          row.id === q.id ? { ...row, closed_at: closedAt } : row,
        ),
      );
      pushToast("ok", "문의를 종료했습니다.");
    } catch {
      pushToast("err", "네트워크 오류로 처리하지 못했습니다.");
    } finally {
      setClosing(false);
    }
  }

  function handleComposerSubmitted() {
    closePanel();
    // 신규 inquiry = server fetch 통과 후 표시. 본 client 는 토스트만, 목록 갱신은
    // 새로고침/재방문 시 server fetch 가 새 row 반영. (Phase 분리 - realtime 미적용)
  }

  return (
    <div className="flex h-full flex-col">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[80] max-w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-lg ${
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-100"
              : "border-red-500/35 bg-red-950/95 text-red-100"
          }`}
        >
          {toast.message}
        </div>
      )}

      <header className="shrink-0 border-b border-stone-800/60 bg-stone-950/40">
        <div className="mx-auto max-w-6xl px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/85">
                1:1 문의
              </div>
              <h1 className="mt-2 font-serif text-[28px] font-medium leading-tight tracking-tight text-stone-100">
                내 문의 내역
              </h1>
              <p className="mt-2 font-serif text-[12.5px] leading-relaxed text-stone-400">
                작성하신 문의와 답변을 확인하실 수 있습니다. 답변이 도착하면
                알림 메시지가 도착합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={openComposerFresh}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-sky-400 px-4 py-2 font-serif text-[13px] font-medium text-stone-950 hover:bg-sky-300"
            >
              <Plus size={12} aria-hidden="true" />
              문의하기
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-stone-800/60 bg-stone-800/60">
            {[
              { k: "진행 중", v: counts.open, tone: "text-stone-100" },
              { k: "답변 대기", v: counts.waiting, tone: "text-amber-200" },
              { k: "답변 완료", v: counts.answered, tone: "text-emerald-300" },
            ].map((s) => (
              <div key={s.k} className="bg-stone-950/60 px-5 py-3.5">
                <div className="font-mono text-[10.5px] uppercase tracking-widest text-stone-500">
                  {s.k}
                </div>
                <div
                  className={`mt-1 font-serif text-[24px] font-medium leading-none tabular-nums ${s.tone}`}
                >
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: "all", label: "전체" },
                  { id: "open", label: "진행 중" },
                  { id: "answered", label: "답변 완료" },
                  { id: "closed", label: "종료" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-md px-3 py-1.5 font-serif text-[12.5px] transition-colors ${
                    filter === f.id
                      ? "bg-stone-100/[0.06] text-stone-100 ring-1 ring-inset ring-stone-700/60"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
              {filtered.length}건
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1">
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${
            panelOpen ? "border-r border-stone-800/60" : ""
          }`}
        >
          <div
            className={`mx-auto px-8 py-6 ${
              panelOpen ? "max-w-[640px]" : "max-w-6xl"
            }`}
          >
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-stone-700 bg-stone-900/30 px-6 py-14 text-center font-serif text-[13px] text-stone-500">
                {inquiries.length === 0
                  ? "위의 「문의하기」 버튼으로 첫 문의를 작성해 보세요."
                  : "해당 상태의 문의가 없습니다."}
              </div>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-stone-800/60 bg-stone-900/30">
                {filtered.map((q) => {
                  const item: InquiryRowBase = {
                    id: q.id,
                    category: q.category,
                    title: q.title,
                    created_at: q.created_at,
                    replied_at: q.replied_at,
                    reply_content: q.reply_content,
                    closed_at: q.closed_at,
                  };
                  return (
                    <li key={q.id}>
                      <InquiryListItem
                        q={item}
                        active={!composing && q.id === selectedId}
                        onClick={() => selectInquiry(q.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-6 rounded-md border border-stone-800/80 bg-stone-900/40 p-4">
              <div className="font-serif text-[13px] text-stone-200">
                자주 묻는 질문
              </div>
              <div className="mt-1 font-serif text-[11.5px] text-stone-500">
                결제·NAT, 분석 모델, 계정 관련 답변을 먼저 확인해보세요.
              </div>
              <a
                href="/guide"
                className="mt-2 inline-block font-mono text-[11px] uppercase tracking-widest text-sky-300/85 hover:text-sky-200"
              >
                FAQ 보기 →
              </a>
            </div>
          </div>
        </div>

        {panelOpen && (
          <aside className="flex min-h-0 w-[640px] shrink-0 flex-col bg-stone-950/60">
            {composing ? (
              <InquiryComposer
                initialCategory={askingFromCategory}
                onCancel={closePanel}
                onSubmitted={handleComposerSubmitted}
                onToast={pushToast}
              />
            ) : selected ? (
              <InquiryThread
                q={selected}
                onBackToList={closePanel}
                onClose={() => handleCloseInquiry(selected)}
                onAskAgain={() => openComposerFromThread(selected)}
                closing={closing}
              />
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
}
