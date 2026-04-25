import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import {
  INQUIRY_LIST_LIMIT_DEFAULT,
  INQUIRY_LIST_LIMIT_MAX,
  type AdminInquiryItem,
  type AdminInquirySummary,
  type InquiryRangeFilter,
  type InquiryStatusFilter,
} from "./types";

// inquiries 는 RLS + service_role only 정책 (ADR-0008 §2-2 마이그레이션).
// 호출부 (requireAdmin / getAdminForApi) 가 admin role 을 검증한 뒤 service_role 우회.
// 첫 인자는 시그니처 호환용이며 실제로는 사용하지 않는다.

export type ListAdminInquiriesInput = {
  status?: InquiryStatusFilter;
  range?: InquiryRangeFilter;
  search?: string;
  page?: number;
  limit?: number;
};

export type ListAdminInquiriesResult = {
  inquiries: AdminInquiryItem[];
  total: number;
  page: number;
  limit: number;
};

function rangeToSinceIso(range: InquiryRangeFilter): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export async function listAdminInquiries(
  _sessionClient: SupabaseClient,
  input: ListAdminInquiriesInput
): Promise<ListAdminInquiriesResult> {
  const supabase = createSupabaseServiceRole();
  const status: InquiryStatusFilter = input.status ?? "all";
  const range: InquiryRangeFilter = input.range ?? "all";
  const search = (input.search ?? "").trim();
  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = Math.min(
    Math.max(1, input.limit ?? INQUIRY_LIST_LIMIT_DEFAULT),
    INQUIRY_LIST_LIMIT_MAX
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let q = supabase
    .from("inquiries")
    .select(
      "id, user_id, user_auth_id, title, content, reply_email, reply_content, replied_at, replied_by, created_at",
      { count: "exact" }
    )
    // 미답장이 항상 위로 (replied_at NULLS FIRST), 그 안에서 최신순.
    .order("replied_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status === "unreplied") q = q.is("replied_at", null);
  else if (status === "replied") q = q.not("replied_at", "is", null);

  const sinceIso = rangeToSinceIso(range);
  if (sinceIso) q = q.gte("created_at", sinceIso);

  if (search) {
    // PostgREST or() 파서 안전을 위해 콤마/괄호 제거.
    const safe = search.replace(/[,()]/g, "");
    if (safe) {
      const like = `%${safe}%`;
      // title + reply_email 부분 일치. (작성자 닉네임/이메일 검색은
      // users 조인 후 클라이언트 필터로 보강 — 베타 규모 충분.)
      q = q.or(`title.ilike.${like},reply_email.ilike.${like}`);
    }
  }

  const { data: rows, error, count } = await q;
  if (error) throw error;

  const records = rows ?? [];
  const userIds = Array.from(
    new Set(
      records
        .map((r) => r.user_id as number | null)
        .filter((v): v is number => typeof v === "number")
    )
  );

  const userInfoById = new Map<
    number,
    { nickname: string | null; email: string | null }
  >();
  if (userIds.length > 0) {
    const { data: userRows, error: uErr } = await supabase
      .from("users")
      .select("id, nickname, email")
      .in("id", userIds);
    if (uErr) throw uErr;
    for (const u of userRows ?? []) {
      userInfoById.set(u.id as number, {
        nickname: (u.nickname as string | null) ?? null,
        email: (u.email as string | null) ?? null,
      });
    }
  }

  // 닉네임/이메일 검색은 결과 후 클라이언트 측 보강 필터 (서버 or() 로 join 까지 다루려면
  // 별도 RPC 필요. 베타 규모에선 페이지 단위 후처리로 충분.)
  const searchLower = search.toLowerCase();
  const inquiries: AdminInquiryItem[] = records
    .map((r) => {
      const userId = (r.user_id as number | null) ?? null;
      const info =
        userId != null ? userInfoById.get(userId) ?? null : null;
      const nickname = info?.nickname ?? null;
      const email = info?.email ?? null;
      return {
        id: String(r.id),
        userId,
        userAuthId: (r.user_auth_id as string | null) ?? null,
        userEmail: email,
        userNickname: nickname,
        title: (r.title as string | null) ?? "",
        content: (r.content as string | null) ?? "",
        replyEmail: (r.reply_email as string | null) ?? "",
        replyContent: (r.reply_content as string | null) ?? null,
        repliedAt: (r.replied_at as string | null) ?? null,
        repliedBy: (r.replied_by as string | null) ?? null,
        createdAt: r.created_at as string,
      };
    })
    .filter((item) => {
      if (!searchLower) return true;
      // 서버 or() 가 잡지 못한 닉네임/유저이메일 (탈퇴 후 placeholder 제외)
      // 까지 클라이언트 보강 매칭. 이미 매칭된 행은 그대로 통과.
      if (item.title.toLowerCase().includes(searchLower)) return true;
      if (item.replyEmail.toLowerCase().includes(searchLower)) return true;
      if (item.userNickname?.toLowerCase().includes(searchLower)) return true;
      if (item.userEmail?.toLowerCase().includes(searchLower)) return true;
      return false;
    });

  return {
    inquiries,
    total: count ?? inquiries.length,
    page,
    limit,
  };
}

// 상단 요약 — 기간 필터 무관, 페이지 로드 시 1회.
export async function getInquirySummary(): Promise<AdminInquirySummary> {
  const supabase = createSupabaseServiceRole();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [unreplied, unreplied7, total] = await Promise.all([
    supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .is("replied_at", null),
    supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .is("replied_at", null)
      .gte("created_at", since7),
    supabase.from("inquiries").select("*", { count: "exact", head: true }),
  ]);

  if (unreplied.error) throw unreplied.error;
  if (unreplied7.error) throw unreplied7.error;
  if (total.error) throw total.error;

  return {
    unreplied: unreplied.count ?? 0,
    unrepliedLast7d: unreplied7.count ?? 0,
    total: total.count ?? 0,
  };
}

export function parseInquiriesQueryFromSearchParams(
  sp: URLSearchParams | { get(key: string): string | null }
): Required<Omit<ListAdminInquiriesInput, "limit">> & { limit: number } {
  const get = (k: string) => sp.get(k);
  const statusRaw = get("status");
  const status: InquiryStatusFilter =
    statusRaw === "unreplied" || statusRaw === "replied" ? statusRaw : "all";
  const rangeRaw = get("range");
  const range: InquiryRangeFilter =
    rangeRaw === "7d" || rangeRaw === "30d" || rangeRaw === "90d"
      ? rangeRaw
      : "all";
  const search = (get("search") ?? "").trim();
  const pageRaw = parseInt(get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limitRaw = parseInt(
    get("limit") ?? String(INQUIRY_LIST_LIMIT_DEFAULT),
    10
  );
  const limit = Math.min(
    Math.max(
      1,
      Number.isFinite(limitRaw) ? limitRaw : INQUIRY_LIST_LIMIT_DEFAULT
    ),
    INQUIRY_LIST_LIMIT_MAX
  );
  return { status, range, search, page, limit };
}
