import { NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { expireStaleProcessingJobIfNeeded } from "@/lib/analysis/recoverStaleAnalysisJob";

function requireAdminSecret(request: Request): string | null {
  const secret = process.env.COIN_ADMIN_SECRET?.trim();
  if (!secret) return null;

  const hdr = request.headers.get("x-coin-admin-secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return hdr === secret || bearer === secret ? secret : null;
}

type Body = {
  /** 특정 job만 만료 처리하고 싶을 때 */
  jobIds?: unknown;
  /** jobIds 미지정이면 updated_at 기준으로 이 시간보다 오래된 processing만 스캔 */
  olderThanMinutes?: unknown;
  /** 최대 처리 개수 (jobIds 없을 때만 적용) */
  limit?: unknown;
};

function clampInt(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export async function POST(request: Request) {
  if (!requireAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  let admin;
  try {
    admin = createSupabaseServiceRole();
  } catch {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY 필요" },
      { status: 500 }
    );
  }

  const jobIds = Array.isArray(body.jobIds)
    ? body.jobIds
        .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "")))
        .filter((s) => s.length > 0)
    : [];

  // 특정 job 강제 정리
  if (jobIds.length > 0) {
    const results: Array<{ jobId: string; ok: boolean }> = [];
    for (const jobId of jobIds) {
      try {
        await expireStaleProcessingJobIfNeeded(admin, jobId);
        results.push({ jobId, ok: true });
      } catch {
        results.push({ jobId, ok: false });
      }
    }
    return NextResponse.json({ ok: true, mode: "jobIds", results });
  }

  const olderThanMinutesRaw =
    typeof body.olderThanMinutes === "number"
      ? body.olderThanMinutes
      : typeof body.olderThanMinutes === "string"
        ? parseInt(body.olderThanMinutes, 10)
        : 10;
  const olderThanMinutes = clampInt(
    Number.isFinite(olderThanMinutesRaw) ? olderThanMinutesRaw : 10,
    1,
    24 * 60
  );
  const limitRaw =
    typeof body.limit === "number"
      ? body.limit
      : typeof body.limit === "string"
        ? parseInt(body.limit, 10)
        : 200;
  const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 200, 1, 500);

  const cutoffIso = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data: rows, error } = await admin
    .from("analysis_jobs")
    .select("id")
    .eq("status", "processing")
    .lt("updated_at", cutoffIso)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("admin expire-stale scan:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (rows ?? []).map((r) => String((r as { id: unknown }).id)).filter(Boolean);
  const results: Array<{ jobId: string; ok: boolean }> = [];
  for (const jobId of ids) {
    try {
      await expireStaleProcessingJobIfNeeded(admin, jobId);
      results.push({ jobId, ok: true });
    } catch {
      results.push({ jobId, ok: false });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "scan",
    olderThanMinutes,
    limit,
    scanned: ids.length,
    results,
  });
}

