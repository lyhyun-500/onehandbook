import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import {
  WITHDRAWAL_LIST_LIMIT_DEFAULT,
  WITHDRAWAL_LIST_LIMIT_MAX,
  type AdminWithdrawalItem,
  type AdminWithdrawalReasonStat,
  type AdminWithdrawalSummary,
  type LoginProvider,
  type WithdrawalRange,
} from "./types";

// account_withdrawals 는 RLS + service_role only 정책 (migration 20260409195700).
// 호출부 (requireAdmin / getAdminForApi) 가 admin role 을 검증한 뒤 service_role 로 우회.
// users 테이블도 RLS 가 자기 행만 보여주므로 동일하게 service_role 사용.
// 첫 인자는 시그니처 호환용이며 실제로는 사용하지 않는다.

export type ListAdminWithdrawalsInput = {
  range?: WithdrawalRange;
  page?: number;
  limit?: number;
};

export type ListAdminWithdrawalsResult = {
  withdrawals: AdminWithdrawalItem[];
  total: number;
  page: number;
  limit: number;
};

function rangeToSinceIso(range: WithdrawalRange): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function diffDays(fromIso: string | null, toIso: string): number | null {
  if (!fromIso) return null;
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (b < a) return 0;
  return Math.floor((b - a) / 86_400_000);
}

export async function listAdminWithdrawals(
  _sessionClient: SupabaseClient,
  input: ListAdminWithdrawalsInput
): Promise<ListAdminWithdrawalsResult> {
  const supabase = createSupabaseServiceRole();
  const range: WithdrawalRange = input.range ?? "all";
  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = Math.min(
    Math.max(1, input.limit ?? WITHDRAWAL_LIST_LIMIT_DEFAULT),
    WITHDRAWAL_LIST_LIMIT_MAX
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let q = supabase
    .from("account_withdrawals")
    .select("id, user_id, reason, reason_detail, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const sinceIso = rangeToSinceIso(range);
  if (sinceIso) q = q.gte("created_at", sinceIso);

  const { data: rows, error, count } = await q;
  if (error) throw error;

  const records = rows ?? [];
  const userIds = Array.from(
    new Set(records.map((r) => r.user_id as number))
  );

  // 탈퇴 후에도 users 행은 잔존 (deleted_at + 익명화) 이라 login_provider / created_at 은 살아 있음.
  const userInfoById = new Map<
    number,
    { loginProvider: LoginProvider | null; signupAt: string | null }
  >();
  if (userIds.length > 0) {
    const { data: userRows, error: uErr } = await supabase
      .from("users")
      .select("id, login_provider, created_at")
      .in("id", userIds);
    if (uErr) throw uErr;
    for (const u of userRows ?? []) {
      const lp = u.login_provider as string | null;
      userInfoById.set(u.id as number, {
        loginProvider:
          lp === "google" || lp === "naver" ? (lp as LoginProvider) : null,
        signupAt: (u.created_at as string | null) ?? null,
      });
    }
  }

  const withdrawals: AdminWithdrawalItem[] = records.map((r) => {
    const userId = r.user_id as number;
    const info = userInfoById.get(userId) ?? {
      loginProvider: null as LoginProvider | null,
      signupAt: null as string | null,
    };
    const withdrawnAt = r.created_at as string;
    const reasonDetailRaw = r.reason_detail as string | null;
    return {
      id: String(r.id),
      userId,
      loginProvider: info.loginProvider,
      signupAt: info.signupAt,
      withdrawnAt,
      durationDays: diffDays(info.signupAt, withdrawnAt),
      reason: (r.reason as string | null) ?? "",
      reasonDetail:
        typeof reasonDetailRaw === "string" && reasonDetailRaw.trim().length > 0
          ? reasonDetailRaw
          : null,
    };
  });

  return {
    withdrawals,
    total: count ?? withdrawals.length,
    page,
    limit,
  };
}

// 상단 요약 카드용 통계.
// 필터(range) 와 무관하게 항상 같은 값을 보여주도록 페이지 단위로 1회 계산.
export async function getWithdrawalSummary(): Promise<AdminWithdrawalSummary> {
  const supabase = createSupabaseServiceRole();
  const now = Date.now();
  const since7 = new Date(now - 7 * 86_400_000).toISOString();
  const since30 = new Date(now - 30 * 86_400_000).toISOString();

  const [r7, r30, rAll] = await Promise.all([
    supabase
      .from("account_withdrawals")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since7),
    supabase
      .from("account_withdrawals")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since30),
    supabase
      .from("account_withdrawals")
      .select("*", { count: "exact", head: true }),
  ]);

  if (r7.error) throw r7.error;
  if (r30.error) throw r30.error;
  if (rAll.error) throw rAll.error;

  return {
    last7d: r7.count ?? 0,
    last30d: r30.count ?? 0,
    total: rAll.count ?? 0,
  };
}

// 사유별 분포 — Supabase JS SDK 가 GROUP BY 를 직접 지원하지 않아
// reason 컬럼만 끌어와서 JS 집계. 베타 규모 (수십~수백 건) 기준 충분.
// 규모 확장 시 RPC (CREATE FUNCTION) 로 DB 레벨 GROUP BY 로 교체 권장.
// 정렬: count DESC, 동률은 reason 오름차순(locale-aware) — 매번 같은 결과 보장.
export async function getWithdrawalReasonStats(): Promise<
  AdminWithdrawalReasonStat[]
> {
  const supabase = createSupabaseServiceRole();
  // 베타 규모 안전 캡 (10k 초과 시 부분 집계가 되므로 후속 RPC 교체 트리거).
  const { data: rows, error } = await supabase
    .from("account_withdrawals")
    .select("reason")
    .range(0, 9_999);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const reason = (r.reason as string | null) ?? "";
    if (!reason) continue;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  let total = 0;
  for (const c of counts.values()) total += c;
  if (total === 0) return [];

  const stats: AdminWithdrawalReasonStat[] = [];
  for (const [reason, count] of counts) {
    stats.push({
      reason,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    });
  }
  stats.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.reason.localeCompare(b.reason, "ko");
  });
  return stats;
}

export function parseWithdrawalsQueryFromSearchParams(
  sp: URLSearchParams | { get(key: string): string | null }
): Required<Omit<ListAdminWithdrawalsInput, "limit">> & { limit: number } {
  const get = (k: string) => sp.get(k);
  const rangeRaw = get("range");
  const range: WithdrawalRange =
    rangeRaw === "7d" || rangeRaw === "30d" || rangeRaw === "90d"
      ? rangeRaw
      : "all";
  const pageRaw = parseInt(get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limitRaw = parseInt(
    get("limit") ?? String(WITHDRAWAL_LIST_LIMIT_DEFAULT),
    10
  );
  const limit = Math.min(
    Math.max(
      1,
      Number.isFinite(limitRaw) ? limitRaw : WITHDRAWAL_LIST_LIMIT_DEFAULT
    ),
    WITHDRAWAL_LIST_LIMIT_MAX
  );
  return { range, page, limit };
}
