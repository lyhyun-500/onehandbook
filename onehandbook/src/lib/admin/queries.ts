import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import {
  USER_LIST_LIMIT_DEFAULT,
  USER_LIST_LIMIT_MAX,
  type AdminCoinLogItem,
  type AdminUserAnalysisItem,
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUserWorkItem,
  type LoginProvider,
  type UserSortKey,
  type UserStatusFilter,
} from "./types";

// 서버 컴포넌트와 API 라우트 양쪽에서 쓰는 공용 조회 함수.
// DB 컬럼은 coin_balance, UI 표기는 NAT (rebranded).

export type ListAdminUsersInput = {
  search?: string;
  provider?: LoginProvider | "all";
  status?: UserStatusFilter;
  sort?: UserSortKey;
  page?: number;
  limit?: number;
};

export type ListAdminUsersResult = {
  users: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
};

// works/analysis_jobs 집계는 다음 타협으로 MVP 진행:
//   - users 페이지 쿼리 1회 (count: exact)
//   - works count: `.in(author_id, ids).is(deleted_at, null)` 배치 조회 후 JS 집계 (활성만)
//   - analysis_jobs count: 유저별 head count 병렬 N회 (group by 부재로 배치 불가,
//     베타 규모 기준 N ≤ 100 이라 왕복 비용 허용)
// 규모 확장 시 view 또는 RPC 함수로 DB 레벨 집계로 교체 예정.
// users 테이블에 auth.uid() = auth_id RLS 가 걸려 있어 세션 클라이언트로 조회하면
// 로그인한 어드민 본인 1행만 돌아온다. 호출부(requireAdmin / getAdminForApi)에서
// 이미 admin role 을 검증하므로 여기서는 service_role 로 RLS 를 우회한다.
// 첫 인자는 기존 시그니처 유지용이며 실제로는 사용하지 않는다.
export async function listAdminUsers(
  _sessionClient: SupabaseClient,
  input: ListAdminUsersInput
): Promise<ListAdminUsersResult> {
  const supabase = createSupabaseServiceRole();
  const search = (input.search ?? "").trim();
  const provider: LoginProvider | "all" = input.provider ?? "all";
  const status: UserStatusFilter = input.status ?? "active";
  const sort: UserSortKey = input.sort ?? "created_desc";
  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = Math.min(
    Math.max(1, input.limit ?? USER_LIST_LIMIT_DEFAULT),
    USER_LIST_LIMIT_MAX
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let q = supabase
    .from("users")
    .select(
      "id, auth_id, email, nickname, login_provider, coin_balance, created_at, deleted_at",
      { count: "exact" }
    )
    .range(from, to);

  if (status === "active") q = q.is("deleted_at", null);
  else if (status === "withdrawn") q = q.not("deleted_at", "is", null);

  if (provider === "google" || provider === "naver") {
    q = q.eq("login_provider", provider);
  }

  if (search) {
    // PostgREST or() 파서는 콤마/괄호를 구분자로 사용하므로 제거
    const safe = search.replace(/[,()]/g, "");
    if (safe) {
      const like = `%${safe}%`;
      q = q.or(`email.ilike.${like},nickname.ilike.${like}`);
    }
  }

  switch (sort) {
    case "created_asc":
      q = q.order("created_at", { ascending: true });
      break;
    case "coin_desc":
      q = q.order("coin_balance", { ascending: false });
      break;
    case "coin_asc":
      q = q.order("coin_balance", { ascending: true });
      break;
    default:
      q = q.order("created_at", { ascending: false });
  }

  const { data: rows, error, count } = await q;
  if (error) throw error;

  const users = rows ?? [];
  const ids = users.map((u) => u.id as number);

  const worksById = new Map<number, number>();
  if (ids.length > 0) {
    const { data: worksRows, error: worksErr } = await supabase
      .from("works")
      .select("author_id")
      .in("author_id", ids)
      .is("deleted_at", null);
    if (worksErr) throw worksErr;
    for (const w of worksRows ?? []) {
      const key = w.author_id as number;
      worksById.set(key, (worksById.get(key) ?? 0) + 1);
    }
  }

  const analysesById = new Map<number, number>();
  if (ids.length > 0) {
    const counts = await Promise.all(
      ids.map(async (id) => {
        const { count: c } = await supabase
          .from("analysis_jobs")
          .select("*", { count: "exact", head: true })
          .eq("app_user_id", id);
        return [id, c ?? 0] as const;
      })
    );
    for (const [id, c] of counts) analysesById.set(id, c);
  }

  const mapped: AdminUserListItem[] = users.map((u) => {
    const id = u.id as number;
    const lp = u.login_provider as string | null;
    return {
      id,
      authId: u.auth_id as string,
      email: (u.email as string | null) ?? "",
      nickname: (u.nickname as string | null) ?? null,
      loginProvider:
        lp === "google" || lp === "naver" ? (lp as LoginProvider) : null,
      coinBalance: (u.coin_balance as number | null) ?? 0,
      worksCount: worksById.get(id) ?? 0,
      analysesCount: analysesById.get(id) ?? 0,
      createdAt: u.created_at as string,
      deletedAt: (u.deleted_at as string | null) ?? null,
    };
  });

  return {
    users: mapped,
    total: count ?? mapped.length,
    page,
    limit,
  };
}

export type AdminUserDetailBundle = {
  user: AdminUserDetail;
  works: AdminUserWorkItem[];
  recentAnalyses: AdminUserAnalysisItem[];
  coinLogs: AdminCoinLogItem[];
};

// 유저 상세 조회.
//   - works / analysis_jobs 는 최근 10건 + 전체/활성 count 를 별도 head 쿼리로 보정.
//   - coin_logs 는 최근 20건, metadata.adjusted_by / admin_reason 파싱.
// listAdminUsers 와 동일한 이유로 service_role 사용. 첫 인자는 시그니처 호환용.
export async function getAdminUserDetail(
  _sessionClient: SupabaseClient,
  userId: number
): Promise<AdminUserDetailBundle | null> {
  const supabase = createSupabaseServiceRole();
  const { data: userRow, error: uErr } = await supabase
    .from("users")
    .select(
      "id, auth_id, email, nickname, login_provider, coin_balance, created_at, deleted_at, terms_agreed_at, privacy_agreed_at, marketing_agreed"
    )
    .eq("id", userId)
    .maybeSingle();
  if (uErr) throw uErr;
  if (!userRow) return null;

  const [worksResult, worksActiveCountResult, jobsResult, jobsTotalResult, logsResult] =
    await Promise.all([
      supabase
        .from("works")
        .select("id, title, genre, created_at, deleted_at")
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("works")
        .select("*", { count: "exact", head: true })
        .eq("author_id", userId)
        .is("deleted_at", null),
      supabase
        .from("analysis_jobs")
        .select("id, work_id, episode_id, status, created_at, parent_job_id")
        .eq("app_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("analysis_jobs")
        .select("*", { count: "exact", head: true })
        .eq("app_user_id", userId),
      supabase
        .from("coin_logs")
        .select("id, amount, type, reason, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (worksResult.error) throw worksResult.error;
  if (jobsResult.error) throw jobsResult.error;
  if (logsResult.error) throw logsResult.error;

  const lp = userRow.login_provider as string | null;
  const loginProvider: LoginProvider | null =
    lp === "google" || lp === "naver" ? (lp as LoginProvider) : null;

  const user: AdminUserDetail = {
    id: userRow.id as number,
    authId: userRow.auth_id as string,
    email: (userRow.email as string | null) ?? "",
    nickname: (userRow.nickname as string | null) ?? null,
    loginProvider,
    coinBalance: (userRow.coin_balance as number | null) ?? 0,
    worksCount: worksActiveCountResult.count ?? 0,
    analysesCount: jobsTotalResult.count ?? 0,
    createdAt: userRow.created_at as string,
    deletedAt: (userRow.deleted_at as string | null) ?? null,
    termsAgreedAt: (userRow.terms_agreed_at as string | null) ?? null,
    privacyAgreedAt: (userRow.privacy_agreed_at as string | null) ?? null,
    marketingAgreed: (userRow.marketing_agreed as boolean | null) ?? null,
  };

  const works: AdminUserWorkItem[] = (worksResult.data ?? []).map((w) => ({
    id: w.id as number,
    title: (w.title as string | null) ?? "",
    genre: (w.genre as string | null) ?? null,
    createdAt: w.created_at as string,
    deletedAt: (w.deleted_at as string | null) ?? null,
  }));

  const jobRows = jobsResult.data ?? [];
  // 작품 제목 보강: 소프트 딜리트 포함해서 조회 (분석 기록 시점에 존재했으니까).
  // 해시드 딜리트되어 조회되지 않으면 workTitle 은 null 로 남고 UI 에서 "(삭제된 작품)" 처리.
  const workIds = Array.from(
    new Set(
      jobRows
        .map((j) => j.work_id as number | null)
        .filter((v): v is number => typeof v === "number")
    )
  );
  const titleById = new Map<number, string>();
  if (workIds.length > 0) {
    const { data: workRows, error: workErr } = await supabase
      .from("works")
      .select("id, title")
      .in("id", workIds);
    if (workErr) throw workErr;
    for (const w of workRows ?? []) {
      titleById.set(w.id as number, (w.title as string | null) ?? "");
    }
  }

  const recentAnalyses: AdminUserAnalysisItem[] = jobRows.map((j) => {
    const workId = (j.work_id as number | null) ?? null;
    const title = workId != null ? titleById.get(workId) ?? null : null;
    return {
      id: j.id as string,
      workId,
      workTitle: title && title.length > 0 ? title : null,
      episodeId: (j.episode_id as number | null) ?? null,
      status: (j.status as string | null) ?? "",
      createdAt: j.created_at as string,
      parentJobId: (j.parent_job_id as string | null) ?? null,
    };
  });

  const coinLogs: AdminCoinLogItem[] = (logsResult.data ?? []).map((l) => {
    const meta = (l.metadata as Record<string, unknown> | null) ?? {};
    const adjustedByRaw = meta["adjusted_by"];
    const adminReasonRaw = meta["admin_reason"];
    return {
      id: String(l.id),
      amount: l.amount as number,
      type: l.type as "EARN" | "USE" | "EXPIRE",
      reason: (l.reason as string | null) ?? "",
      createdAt: l.created_at as string,
      adjustedBy:
        typeof adjustedByRaw === "string" ? adjustedByRaw : null,
      adminReason:
        typeof adminReasonRaw === "string" ? adminReasonRaw : null,
    };
  });

  return { user, works, recentAnalyses, coinLogs };
}

// URL searchParams 에서 입력 파싱 (서버 컴포넌트 / 클라이언트 공통)
export function parseUsersQueryFromSearchParams(
  sp: URLSearchParams | { get(key: string): string | null }
): Required<Omit<ListAdminUsersInput, "limit">> & { limit: number } {
  const get = (k: string) => sp.get(k);
  const providerRaw = get("provider");
  const provider: LoginProvider | "all" =
    providerRaw === "google" || providerRaw === "naver"
      ? providerRaw
      : "all";
  const statusRaw = get("status");
  const status: UserStatusFilter =
    statusRaw === "withdrawn" || statusRaw === "all"
      ? statusRaw
      : "active";
  const sortRaw = get("sort");
  const sort: UserSortKey =
    sortRaw === "created_asc" ||
    sortRaw === "coin_desc" ||
    sortRaw === "coin_asc"
      ? sortRaw
      : "created_desc";
  const pageRaw = parseInt(get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limitRaw = parseInt(
    get("limit") ?? String(USER_LIST_LIMIT_DEFAULT),
    10
  );
  const limit = Math.min(
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : USER_LIST_LIMIT_DEFAULT),
    USER_LIST_LIMIT_MAX
  );
  return {
    search: (get("search") ?? "").trim(),
    provider,
    status,
    sort,
    page,
    limit,
  };
}
