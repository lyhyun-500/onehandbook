"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type {
  AdminUserListItem,
  LoginProvider,
  UserSortKey,
  UserStatusFilter,
} from "@/lib/admin/types";

type Query = {
  search: string;
  provider: LoginProvider | "all";
  status: UserStatusFilter;
  sort: UserSortKey;
  limit: number;
};

type Props = {
  initialUsers: AdminUserListItem[];
  initialTotal: number;
  initialPage: number;
  query: Query;
};

function buildSearchString(q: Query): string {
  const p = new URLSearchParams();
  if (q.search) p.set("search", q.search);
  if (q.provider !== "all") p.set("provider", q.provider);
  if (q.status !== "active") p.set("status", q.status);
  if (q.sort !== "created_desc") p.set("sort", q.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function StatusBadge({ deletedAt }: { deletedAt: string | null }) {
  if (deletedAt) {
    return (
      <span
        className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
        style={{ color: "var(--color-admin-danger)" }}
      >
        탈퇴
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-xs font-medium"
      style={{ color: "var(--color-admin-success)" }}
    >
      활성
    </span>
  );
}

export function UsersListView(props: Props) {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(props.query.search);
  const [provider, setProvider] = useState<LoginProvider | "all">(
    props.query.provider
  );
  const [status, setStatus] = useState<UserStatusFilter>(props.query.status);
  const [sort, setSort] = useState<UserSortKey>(props.query.sort);

  const [rows, setRows] = useState<AdminUserListItem[]>(props.initialUsers);
  const [total, setTotal] = useState(props.initialTotal);
  const [page, setPage] = useState(props.initialPage);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasMore = useMemo(
    () => rows.length < total,
    [rows.length, total]
  );

  const submitSearch = useCallback(
    (overrides?: Partial<Query>) => {
      const q: Query = {
        search: searchInput.trim(),
        provider,
        status,
        sort,
        limit: props.query.limit,
        ...overrides,
      };
      router.push(`/admin/users${buildSearchString(q)}`);
    },
    [searchInput, provider, status, sort, props.query.limit, router]
  );

  const reset = useCallback(() => {
    setSearchInput("");
    setProvider("all");
    setStatus("active");
    setSort("created_desc");
    router.push("/admin/users");
  }, [router]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const sp = new URLSearchParams();
      if (props.query.search) sp.set("search", props.query.search);
      if (props.query.provider !== "all")
        sp.set("provider", props.query.provider);
      if (props.query.status !== "active")
        sp.set("status", props.query.status);
      if (props.query.sort !== "created_desc")
        sp.set("sort", props.query.sort);
      sp.set("page", String(page + 1));
      sp.set("limit", String(props.query.limit));

      const res = await fetch(`/api/admin/users?${sp.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        ok: boolean;
        users: AdminUserListItem[];
        total: number;
      };
      if (!body.ok) throw new Error("응답 실패");
      setRows((prev) => [...prev, ...body.users]);
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
          <div className="flex-1 min-w-[260px]">
            <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
              검색 (이메일 / 닉네임)
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
                  // IME 조합 중 엔터는 무시 (한국어 타이핑 중 오작동 방지)
                  if (
                    e.nativeEvent.isComposing ||
                    // Safari 구버전 호환
                    (e as unknown as { keyCode?: number }).keyCode === 229
                  ) {
                    return;
                  }
                  e.preventDefault();
                  submitSearch();
                }}
                placeholder="이메일 또는 닉네임"
                className="w-full rounded border border-admin-border-strong bg-admin-bg-page py-2 pl-9 pr-3 text-sm text-admin-text-primary placeholder:text-admin-text-muted focus:border-admin-accent focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
              가입 경로
            </label>
            <select
              value={provider}
              onChange={(e) =>
                setProvider(e.target.value as LoginProvider | "all")
              }
              className="h-9 rounded border border-admin-border-strong bg-admin-bg-page px-3 text-sm text-admin-text-primary focus:border-admin-accent focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="google">Google</option>
              <option value="naver">Naver</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
              상태
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatusFilter)}
              className="h-9 rounded border border-admin-border-strong bg-admin-bg-page px-3 text-sm text-admin-text-primary focus:border-admin-accent focus:outline-none"
            >
              <option value="active">활성</option>
              <option value="withdrawn">탈퇴</option>
              <option value="all">전체</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
              정렬
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as UserSortKey)}
              className="h-9 rounded border border-admin-border-strong bg-admin-bg-page px-3 text-sm text-admin-text-primary focus:border-admin-accent focus:outline-none"
            >
              <option value="created_desc">가입일 (최신순)</option>
              <option value="created_asc">가입일 (오래된순)</option>
              <option value="coin_desc">NAT 잔량 (많은순)</option>
              <option value="coin_asc">NAT 잔량 (적은순)</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => submitSearch()}
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
          총 <span className="font-semibold text-admin-text-primary">{total}</span>명
          {rows.length < total
            ? ` (현재 ${rows.length}명 표시)`
            : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-admin-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-admin-bg-surface text-admin-text-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium">닉네임</th>
              <th className="px-4 py-3 text-left font-medium">이메일</th>
              <th className="px-4 py-3 text-left font-medium">가입일</th>
              <th className="px-4 py-3 text-left font-medium">로그인</th>
              <th className="px-4 py-3 text-right font-medium">NAT 잔량</th>
              <th className="px-4 py-3 text-right font-medium">작품</th>
              <th className="px-4 py-3 text-right font-medium">분석</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border bg-admin-bg-page">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-admin-text-muted"
                >
                  검색 결과가 없습니다
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr
                key={u.id}
                className="transition-colors hover:bg-admin-bg-surface"
              >
                <td className="px-4 py-3 text-admin-text-primary">
                  {u.nickname ?? (
                    <span className="text-admin-text-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-admin-text-secondary">
                  {u.email}
                </td>
                <td className="px-4 py-3 text-admin-text-secondary">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <ProviderBadge provider={u.loginProvider} />
                </td>
                <td className="px-4 py-3 text-right font-medium text-admin-text-primary tabular-nums">
                  {u.coinBalance.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-admin-text-secondary tabular-nums">
                  {u.worksCount}
                </td>
                <td className="px-4 py-3 text-right text-admin-text-secondary tabular-nums">
                  {u.analysesCount}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge deletedAt={u.deletedAt} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="inline-flex items-center rounded border border-admin-border-strong px-2.5 py-1 text-xs text-admin-accent hover:bg-admin-bg-hover"
                  >
                    상세
                  </Link>
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
