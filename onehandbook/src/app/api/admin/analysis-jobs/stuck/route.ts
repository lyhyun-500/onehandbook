import { NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import {
  ANALYSIS_JOB_HOLISTIC_PROCESSING_STALE_MS,
  ANALYSIS_JOB_PROCESSING_STALE_MS,
} from "@/lib/analysis/recoverStaleAnalysisJob";

function requireAdminSecret(request: Request): string | null {
  const secret = process.env.COIN_ADMIN_SECRET?.trim();
  if (!secret) return null;

  const hdr = request.headers.get("x-coin-admin-secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return hdr === secret || bearer === secret ? secret : null;
}

function clampInt(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 운영 모니터링용: stale 가능성이 큰 processing job 조회.
 * - status=processing 이면서 updated_at이 stale cutoff 이전인 행
 * - 기본 7일 범위 내에서만 조회(너무 과거는 제외)
 */
export async function GET(request: Request) {
  if (!requireAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const url = new URL(request.url);
  const includeAllProcessing =
    url.searchParams.get("includeAllProcessing") === "1" ||
    url.searchParams.get("all") === "1";
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 50, 1, 200);
  const sinceHoursRaw = parseInt(url.searchParams.get("sinceHours") ?? "168", 10); // 7d
  const sinceHours = clampInt(
    Number.isFinite(sinceHoursRaw) ? sinceHoursRaw : 168,
    1,
    24 * 30
  );

  const now = Date.now();
  const sinceIso = new Date(now - sinceHours * 3600_000).toISOString();
  const cutoffEpisodeIso = new Date(now - ANALYSIS_JOB_PROCESSING_STALE_MS).toISOString();
  const cutoffHolisticIso = new Date(
    now - ANALYSIS_JOB_HOLISTIC_PROCESSING_STALE_MS
  ).toISOString();

  const base = admin
    .from("analysis_jobs")
    .select(
      "id, job_kind, status, progress_phase, updated_at, created_at, work_id, episode_id, app_user_id, error_message, payload"
    )
    .eq("status", "processing")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: true })
    .limit(limit);

  // includeAllProcessing=1이면 stale 조건 없이 processing 전체를 보여준다.
  const { data, error } = includeAllProcessing
    ? await base
    : await base.or(
        `and(job_kind.eq.episode,updated_at.lt.${cutoffEpisodeIso}),and(job_kind.eq.holistic_batch,updated_at.lt.${cutoffHolisticIso})`
      );

  if (error) {
    console.error("admin analysis-jobs stuck:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sinceHours,
    limit,
    includeAllProcessing,
    stale_cutoffs: {
      episode_ms: ANALYSIS_JOB_PROCESSING_STALE_MS,
      holistic_ms: ANALYSIS_JOB_HOLISTIC_PROCESSING_STALE_MS,
    },
    rows: data ?? [],
  });
}

