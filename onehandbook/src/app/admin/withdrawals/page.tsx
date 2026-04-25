import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import {
  getWithdrawalSummary,
  listAdminWithdrawals,
  parseWithdrawalsQueryFromSearchParams,
} from "@/lib/admin/withdrawalQueries";
import { WithdrawalsListView } from "@/components/admin/WithdrawalsListView";
import type { AdminWithdrawalSummary } from "@/lib/admin/types";

type SearchParamsShape = Record<string, string | string[] | undefined>;

function toURLSearchParams(sp: SearchParamsShape): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") out.set(key, value);
    else if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "string"
    ) {
      out.set(key, value[0]);
    }
  }
  return out;
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-admin-border bg-admin-bg-page px-5 py-4">
      <div className="text-xs text-admin-text-secondary">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-admin-text-primary">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const raw = await searchParams;
  const input = parseWithdrawalsQueryFromSearchParams(toURLSearchParams(raw));

  let listResult;
  let summary: AdminWithdrawalSummary = { last7d: 0, last30d: 0, total: 0 };
  let errorMsg: string | null = null;
  try {
    const [list, summaryRes] = await Promise.all([
      listAdminWithdrawals(supabase, { ...input, page: 1 }),
      getWithdrawalSummary(),
    ]);
    listResult = list;
    summary = summaryRes;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
    listResult = {
      withdrawals: [],
      total: 0,
      page: 1,
      limit: input.limit,
    };
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-admin-text-primary">
          탈퇴 로그
        </h1>
        <p className="mt-1 text-sm text-admin-text-secondary">
          탈퇴 사유 패턴 확인 (단순 조회).
        </p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <SummaryCard label="최근 7일 탈퇴" value={summary.last7d} />
        <SummaryCard label="최근 30일 탈퇴" value={summary.last30d} />
        <SummaryCard label="누적 탈퇴" value={summary.total} />
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          목록 로드 실패: {errorMsg}
        </div>
      )}

      <WithdrawalsListView
        key={input.range}
        initialWithdrawals={listResult.withdrawals}
        initialTotal={listResult.total}
        initialPage={1}
        query={{ range: input.range, limit: input.limit }}
      />
    </div>
  );
}
