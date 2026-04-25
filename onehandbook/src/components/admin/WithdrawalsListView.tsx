"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type {
  AdminWithdrawalItem,
  LoginProvider,
  WithdrawalRange,
} from "@/lib/admin/types";

type Query = {
  range: WithdrawalRange;
  limit: number;
};

type Props = {
  initialWithdrawals: AdminWithdrawalItem[];
  initialTotal: number;
  initialPage: number;
  query: Query;
};

function buildSearchString(q: Query): string {
  const p = new URLSearchParams();
  if (q.range !== "all") p.set("range", q.range);
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

function ProviderBadge({ provider }: { provider: LoginProvider | null }) {
  if (provider === "google") {
    return (
      <span className="inline-flex items-center rounded bg-admin-bg-hover px-2 py-0.5 text-xs text-admin-text-secondary">
        Google
      </span>
    );
  }
  if (provider === "naver") {
    return (
      <span className="inline-flex items-center rounded bg-admin-bg-hover px-2 py-0.5 text-xs text-admin-text-secondary">
        Naver
      </span>
    );
  }
  return <span className="text-xs text-admin-text-muted">-</span>;
}

function formatDuration(days: number | null): string {
  if (days == null) return "-";
  if (days < 1) return "당일";
  return `${days.toLocaleString()}일`;
}

export function WithdrawalsListView(props: Props) {
  const router = useRouter();

  const [range, setRange] = useState<WithdrawalRange>(props.query.range);
  const [rows, setRows] = useState<AdminWithdrawalItem[]>(
    props.initialWithdrawals
  );
  const [total, setTotal] = useState(props.initialTotal);
  const [page, setPage] = useState(props.initialPage);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasMore = useMemo(() => rows.length < total, [rows.length, total]);

  const applyRange = useCallback(
    (next: WithdrawalRange) => {
      setRange(next);
      router.push(
        `/admin/withdrawals${buildSearchString({ ...props.query, range: next })}`
      );
    },
    [props.query, router]
  );

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const sp = new URLSearchParams();
      if (props.query.range !== "all") sp.set("range", props.query.range);
      sp.set("page", String(page + 1));
      sp.set("limit", String(props.query.limit));

      const res = await fetch(`/api/admin/withdrawals?${sp.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        ok: boolean;
        withdrawals: AdminWithdrawalItem[];
        total: number;
      };
      if (!body.ok) throw new Error("응답 실패");
      setRows((prev) => [...prev, ...body.withdrawals]);
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

  return (
    <div>
      <div className="mb-4 rounded-lg border border-admin-border bg-admin-bg-page p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
              기간
            </label>
            <select
              value={range}
              onChange={(e) => applyRange(e.target.value as WithdrawalRange)}
              className="h-9 rounded border border-admin-border-strong bg-admin-bg-page px-3 text-sm text-admin-text-primary focus:border-admin-accent focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="90d">최근 90일</option>
            </select>
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
              <th className="px-4 py-3 text-left font-medium">탈퇴일</th>
              <th className="px-4 py-3 text-left font-medium">가입 경로</th>
              <th className="px-4 py-3 text-right font-medium">이용 기간</th>
              <th className="px-4 py-3 text-left font-medium">탈퇴 이유</th>
              <th className="px-4 py-3 text-left font-medium">상세 사유</th>
              <th className="px-4 py-3 text-right font-medium">user id</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border bg-admin-bg-page">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-admin-text-muted"
                >
                  탈퇴 기록이 없습니다
                </td>
              </tr>
            )}
            {rows.map((w) => (
              <tr
                key={w.id}
                className="transition-colors hover:bg-admin-bg-surface"
              >
                <td className="whitespace-nowrap px-4 py-3 text-admin-text-secondary">
                  {formatDateTime(w.withdrawnAt)}
                </td>
                <td className="px-4 py-3">
                  <ProviderBadge provider={w.loginProvider} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-admin-text-secondary tabular-nums">
                  {formatDuration(w.durationDays)}
                </td>
                <td className="px-4 py-3 text-admin-text-primary">
                  {w.reason || (
                    <span className="text-admin-text-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-admin-text-secondary">
                  {w.reasonDetail ? (
                    <span
                      className="block max-w-[360px] truncate"
                      title={w.reasonDetail}
                    >
                      {w.reasonDetail}
                    </span>
                  ) : (
                    <span className="text-admin-text-muted">미입력</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-admin-text-muted tabular-nums">
                  #{w.userId}
                </td>
              </tr>
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
