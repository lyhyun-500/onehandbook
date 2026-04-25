"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type {
  AdminInquiryItem,
  AdminInquiryReplyResponse,
  InquiryRangeFilter,
  InquiryStatusFilter,
} from "@/lib/admin/types";

type Query = {
  status: InquiryStatusFilter;
  range: InquiryRangeFilter;
  search: string;
  limit: number;
};

type Props = {
  initialInquiries: AdminInquiryItem[];
  initialTotal: number;
  initialPage: number;
  query: Query;
};

function buildSearchString(q: Query): string {
  const p = new URLSearchParams();
  if (q.status !== "all") p.set("status", q.status);
  if (q.range !== "all") p.set("range", q.range);
  if (q.search) p.set("search", q.search);
  const s = p.toString();
  return s ? `?${s}` : "";
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

function StatusBadge({ repliedAt }: { repliedAt: string | null }) {
  if (repliedAt) {
    return (
      <span
        className="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-xs font-medium"
        style={{ color: "var(--color-admin-success)" }}
      >
        답장완료
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-xs font-medium"
      style={{ color: "var(--color-admin-danger)" }}
    >
      미답장
    </span>
  );
}

function truncate(s: string, max = 100): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function InquiryRow({
  inquiry,
  expanded,
  onToggle,
  onReplied,
}: {
  inquiry: AdminInquiryItem;
  expanded: boolean;
  onToggle: () => void;
  onReplied: (next: AdminInquiryItem) => void;
}) {
  const [replyDraft, setReplyDraft] = useState(inquiry.replyContent ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const trimmed = replyDraft.trim();
    if (!trimmed) {
      setSaveError("답변 본문을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSavedToast(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reply_content: trimmed }),
      });
      const data = (await res.json()) as AdminInquiryReplyResponse;
      if (!res.ok || !data.ok) {
        const msg = !data.ok && "error" in data ? data.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      onReplied(data.inquiry);
      setSavedToast(
        data.notificationCreated
          ? "답변 저장 + 알림 발송 완료"
          : "답변 저장 완료 (알림 발송 안 됨 — 탈퇴 유저 또는 재편집)"
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [inquiry.id, onReplied, replyDraft]);

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-admin-bg-surface"
      >
        <td className="whitespace-nowrap px-4 py-3 text-admin-text-secondary">
          {formatDateTime(inquiry.createdAt)}
        </td>
        <td className="px-4 py-3 text-admin-text-primary">
          <div className="font-medium">
            {inquiry.userNickname ?? (
              <span className="text-admin-text-muted">-</span>
            )}
          </div>
          <div className="text-xs text-admin-text-muted">
            {inquiry.replyEmail}
          </div>
        </td>
        <td className="px-4 py-3 text-admin-text-primary">
          <span
            className="block max-w-[280px] truncate"
            title={inquiry.title}
          >
            {inquiry.title}
          </span>
        </td>
        <td className="px-4 py-3 text-admin-text-secondary">
          <span className="block max-w-[360px] truncate">
            {truncate(inquiry.content, 100)}
          </span>
        </td>
        <td className="px-4 py-3">
          <StatusBadge repliedAt={inquiry.repliedAt} />
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-xs text-admin-accent">
            {expanded ? "접기 ▴" : "답변 ▾"}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-admin-bg-surface">
          <td colSpan={6} className="px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">
                  문의 본문
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-admin-text-primary">
                  {inquiry.content}
                </p>
                {inquiry.userId == null && (
                  <p
                    className="mt-3 text-xs"
                    style={{ color: "var(--color-admin-danger)" }}
                  >
                    ⚠ 작성자 계정이 탈퇴됐습니다. 답변 저장은 가능하지만
                    사이트 알림은 발송되지 않습니다.
                  </p>
                )}
              </section>
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">
                    답변 작성
                  </h3>
                  {inquiry.repliedAt && (
                    <span className="text-xs text-admin-text-muted">
                      마지막 저장: {formatDateTime(inquiry.repliedAt)}
                    </span>
                  )}
                </div>
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="답변 내용을 입력하세요. 저장 시 작성자에게 사이트 알림이 발송됩니다."
                  className="mt-2 h-40 w-full resize-y rounded border border-admin-border-strong bg-admin-bg-page p-3 text-sm text-admin-text-primary placeholder:text-admin-text-muted focus:border-admin-accent focus:outline-none"
                />
                <div className="mt-3 flex items-center justify-end gap-3">
                  {saveError && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-admin-danger)" }}
                    >
                      {saveError}
                    </span>
                  )}
                  {savedToast && !saveError && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-admin-success)" }}
                    >
                      {savedToast}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="h-9 rounded bg-admin-accent px-4 text-sm font-medium text-white transition-colors hover:bg-admin-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "저장 중…"
                      : inquiry.repliedAt
                        ? "답변 수정 저장"
                        : "답변 저장 + 알림 발송"}
                  </button>
                </div>
              </section>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function InquiriesListView(props: Props) {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(props.query.search);
  const [status, setStatus] = useState<InquiryStatusFilter>(
    props.query.status
  );
  const [range, setRange] = useState<InquiryRangeFilter>(props.query.range);

  const [rows, setRows] = useState<AdminInquiryItem[]>(props.initialInquiries);
  const [total, setTotal] = useState(props.initialTotal);
  const [page, setPage] = useState(props.initialPage);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasMore = useMemo(() => rows.length < total, [rows.length, total]);

  const submitFilters = useCallback(
    (overrides?: Partial<Query>) => {
      const q: Query = {
        search: searchInput.trim(),
        status,
        range,
        limit: props.query.limit,
        ...overrides,
      };
      router.push(`/admin/inquiries${buildSearchString(q)}`);
    },
    [searchInput, status, range, props.query.limit, router]
  );

  const reset = useCallback(() => {
    setSearchInput("");
    setStatus("all");
    setRange("all");
    router.push("/admin/inquiries");
  }, [router]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const sp = new URLSearchParams();
      if (props.query.status !== "all") sp.set("status", props.query.status);
      if (props.query.range !== "all") sp.set("range", props.query.range);
      if (props.query.search) sp.set("search", props.query.search);
      sp.set("page", String(page + 1));
      sp.set("limit", String(props.query.limit));

      const res = await fetch(`/api/admin/inquiries?${sp.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        ok: boolean;
        inquiries: AdminInquiryItem[];
        total: number;
      };
      if (!body.ok) throw new Error("응답 실패");
      setRows((prev) => [...prev, ...body.inquiries]);
      setTotal(body.total);
      setPage(page + 1);
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "더 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, props.query]);

  const onReplied = useCallback((next: AdminInquiryItem) => {
    setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }, []);

  return (
    <div>
      <div className="mb-4 rounded-lg border border-admin-border bg-admin-bg-page p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
              검색 (제목 / 작성자 닉네임 / 이메일)
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-text-muted"
                aria-hidden
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (
                    e.nativeEvent.isComposing ||
                    (e as unknown as { keyCode?: number }).keyCode === 229
                  ) {
                    return;
                  }
                  e.preventDefault();
                  submitFilters();
                }}
                placeholder="문의 제목, 답장 이메일, 닉네임"
                className="w-full rounded border border-admin-border-strong bg-admin-bg-page py-2 pl-9 pr-3 text-sm text-admin-text-primary placeholder:text-admin-text-muted focus:border-admin-accent focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
              상태
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as InquiryStatusFilter)
              }
              className="h-9 rounded border border-admin-border-strong bg-admin-bg-page px-3 text-sm text-admin-text-primary focus:border-admin-accent focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="unreplied">미답장</option>
              <option value="replied">답장완료</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
              기간
            </label>
            <select
              value={range}
              onChange={(e) =>
                setRange(e.target.value as InquiryRangeFilter)
              }
              className="h-9 rounded border border-admin-border-strong bg-admin-bg-page px-3 text-sm text-admin-text-primary focus:border-admin-accent focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="90d">최근 90일</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => submitFilters()}
              className="h-9 rounded bg-admin-accent px-4 text-sm font-medium text-white transition-colors hover:bg-admin-accent-hover"
            >
              검색
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-9 rounded border border-admin-border-strong bg-admin-bg-page px-4 text-sm text-admin-text-secondary hover:bg-admin-bg-hover"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm text-admin-text-secondary">
        <span>
          총{" "}
          <span className="font-semibold text-admin-text-primary">
            {total}
          </span>
          건
          {rows.length < total ? ` (현재 ${rows.length}건 표시)` : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-admin-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-admin-bg-surface text-admin-text-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium">작성일</th>
              <th className="px-4 py-3 text-left font-medium">작성자</th>
              <th className="px-4 py-3 text-left font-medium">제목</th>
              <th className="px-4 py-3 text-left font-medium">본문 (요약)</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border bg-admin-bg-page">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-admin-text-muted"
                >
                  문의가 없습니다
                </td>
              </tr>
            )}
            {rows.map((inq) => (
              <InquiryRow
                key={inq.id}
                inquiry={inq}
                expanded={expandedId === inq.id}
                onToggle={() =>
                  setExpandedId((cur) => (cur === inq.id ? null : inq.id))
                }
                onReplied={onReplied}
              />
            ))}
          </tbody>
        </table>
      </div>

      {errorMsg && (
        <div
          className="mt-3 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm"
          style={{ color: "var(--color-admin-danger)" }}
        >
          {errorMsg}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="h-10 rounded border border-admin-border-strong bg-admin-bg-page px-6 text-sm text-admin-text-secondary hover:bg-admin-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "불러오는 중…" : "더보기"}
          </button>
        </div>
      )}
    </div>
  );
}
