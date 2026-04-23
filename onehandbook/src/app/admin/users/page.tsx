import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import {
  listAdminUsers,
  parseUsersQueryFromSearchParams,
} from "@/lib/admin/queries";
import { UsersListView } from "@/components/admin/UsersListView";

type SearchParamsShape = Record<string, string | string[] | undefined>;

function toURLSearchParams(sp: SearchParamsShape): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") out.set(key, value);
    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      out.set(key, value[0]);
    }
  }
  return out;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const raw = await searchParams;
  const input = parseUsersQueryFromSearchParams(toURLSearchParams(raw));

  let result;
  let errorMsg: string | null = null;
  try {
    result = await listAdminUsers(supabase, {
      ...input,
      page: 1, // 초기 진입은 항상 1페이지 (더보기는 클라이언트)
    });
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
    result = { users: [], total: 0, page: 1, limit: input.limit };
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-admin-text-primary">
          유저 관리
        </h1>
        <p className="mt-1 text-sm text-admin-text-secondary">
          유저 검색 · NAT 잔량 확인 · 상세 진입.
        </p>
      </header>

      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          목록 로드 실패: {errorMsg}
        </div>
      )}

      <UsersListView
        key={`${input.provider}-${input.status}-${input.sort}-${input.search}`}
        initialUsers={result.users}
        initialTotal={result.total}
        initialPage={1}
        query={{
          search: input.search,
          provider: input.provider,
          status: input.status,
          sort: input.sort,
          limit: input.limit,
        }}
      />
    </div>
  );
}
