import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import {
  getInquirySummary,
  listAdminInquiries,
  parseInquiriesQueryFromSearchParams,
} from "@/lib/admin/inquiryQueries";
import { InquiriesListView } from "@/components/admin/InquiriesListView";
import type { AdminInquirySummary } from "@/lib/admin/types";

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
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-admin-border bg-admin-bg-page px-5 py-4">
      <div className="text-xs text-admin-text-secondary">{label}</div>
      <div
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={{
          color: emphasis && value > 0
            ? "var(--color-admin-danger)"
            : "var(--color-admin-text-primary)",
        }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const raw = await searchParams;
  const input = parseInquiriesQueryFromSearchParams(toURLSearchParams(raw));

  let listResult;
  let summary: AdminInquirySummary = {
    unreplied: 0,
    unrepliedLast7d: 0,
    total: 0,
  };
  let errorMsg: string | null = null;
  try {
    const [list, summaryRes] = await Promise.all([
      listAdminInquiries(supabase, { ...input, page: 1 }),
      getInquirySummary(),
    ]);
    listResult = list;
    summary = summaryRes;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
    listResult = {
      inquiries: [],
      total: 0,
      page: 1,
      limit: input.limit,
    };
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-admin-text-primary">
          문의 관리
        </h1>
        <p className="mt-1 text-sm text-admin-text-secondary">
          1:1 문의 답변 작성. 저장 시 알림이 자동 발송됩니다.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <SummaryCard label="미답장" value={summary.unreplied} emphasis />
        <SummaryCard
          label="최근 7일 미답장"
          value={summary.unrepliedLast7d}
          emphasis
        />
        <SummaryCard label="누적 문의" value={summary.total} />
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          목록 로드 실패: {errorMsg}
        </div>
      )}

      <InquiriesListView
        key={`${input.status}-${input.range}-${input.search}`}
        initialInquiries={listResult.inquiries}
        initialTotal={listResult.total}
        initialPage={1}
        query={{
          status: input.status,
          range: input.range,
          search: input.search,
          limit: input.limit,
        }}
      />
    </div>
  );
}
