import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDbInt } from "@/lib/supabase/parseDbInt";
import { syncAppUser } from "@/lib/supabase/appUser";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";
import type { AnalysisJobListItem, JobProgressPhase } from "@/app/api/analyze/jobs/route";

export const runtime = "nodejs";

function clampInt(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 최근 완료/실패(outcomes) 알림용 페이지 API.
 * - 첫 호출은 sinceDays=7로 "최근 7일"만 빠르게
 * - 이후 infinite scroll은 cursor(ISO timestamp)로 과거를 추가 로드
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  const url = new URL(request.url);
  const cursor = (url.searchParams.get("cursor") ?? "").trim(); // updated_at 이전
  const sinceDaysRaw = url.searchParams.get("sinceDays");
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "12", 10);
  const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 12, 1, 30);

  const sinceDays =
    sinceDaysRaw != null
      ? clampInt(parseInt(sinceDaysRaw, 10) || 0, 1, 30)
      : null;
  const sinceIso =
    sinceDays != null ? new Date(Date.now() - sinceDays * 86400_000).toISOString() : null;

  let q = supabase
    .from("analysis_jobs")
    .select(
      "id, episode_id, work_id, job_kind, progress_phase, status, updated_at, created_at, payload, holistic_run_id, error_message"
    )
    .eq("app_user_id", appUser.id)
    .in("status", ["completed", "failed"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    q = q.lt("updated_at", cursor);
  }
  if (sinceIso) {
    q = q.gte("updated_at", sinceIso);
  }

  const { data: jobs, error } = await q;

  if (error) {
    if (isMissingAnalysisJobsTableError(error)) {
      return NextResponse.json({ jobs: [] as AnalysisJobListItem[] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = jobs ?? [];
  const workIds = [
    ...new Set(rows.map((r) => r.work_id).filter((id): id is number => id != null)),
  ];

  const workTitleById = new Map<number, string | null>();
  if (workIds.length > 0) {
    const { data: works } = await supabase
      .from("works")
      .select("id, title")
      .in("id", workIds);
    for (const w of works ?? []) {
      workTitleById.set(w.id, w.title ?? null);
    }
  }

  const list: AnalysisJobListItem[] = [];
  for (const r of rows) {
    const st = r.status;
    if (st !== "completed" && st !== "failed") continue;

    const episode_id =
      typeof r.episode_id === "number"
        ? r.episode_id
        : parseInt(String(r.episode_id), 10);
    if (Number.isNaN(episode_id)) continue;

    let work_id =
      typeof r.work_id === "number"
        ? r.work_id
        : r.work_id != null
          ? parseInt(String(r.work_id), 10)
          : NaN;
    if (Number.isNaN(work_id)) continue;

    const job_kind = r.job_kind === "holistic_batch" ? "holistic_batch" : "episode";
    const payload = (r.payload ?? {}) as Record<string, unknown>;
    const orderedFromPayload = payload.orderedEpisodeIds;
    const ordered_episode_ids =
      job_kind === "holistic_batch" && Array.isArray(orderedFromPayload)
        ? orderedFromPayload
            .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
            .filter((n) => !Number.isNaN(n))
        : [episode_id];

    const estRaw = payload.estimatedSeconds;
    const estimated_seconds =
      typeof estRaw === "number" && !Number.isNaN(estRaw)
        ? estRaw
        : typeof estRaw === "string"
          ? parseInt(estRaw, 10) || null
          : null;

    const fcRaw = payload.failure_code;
    const failure_code =
      typeof fcRaw === "string" && fcRaw.length > 0 ? fcRaw : null;

    const ppct = payload.progressPercent;
    const progress_percent =
      typeof ppct === "number" && !Number.isNaN(ppct)
        ? Math.min(100, Math.max(0, Math.round(ppct)))
        : null;

    const pp = r.progress_phase;
    const progress_phase: JobProgressPhase =
      pp === "received" || pp === "ai_analyzing" || pp === "report_writing"
        ? (pp as JobProgressPhase)
        : null;

    const holistic_run_id = parseDbInt(r.holistic_run_id);
    const created_at = typeof r.created_at === "string" ? r.created_at : r.updated_at;

    list.push({
      id: String(r.id),
      episode_id,
      work_id,
      work_title: workTitleById.get(work_id) ?? null,
      status: st,
      updated_at: r.updated_at,
      created_at,
      job_kind,
      progress_phase,
      holistic_run_id,
      ordered_episode_ids,
      error_message: typeof r.error_message === "string" ? r.error_message : null,
      estimated_seconds,
      failure_code,
      progress_percent,
    });
  }

  const nextCursor = list.length > 0 ? list[list.length - 1]!.updated_at : null;
  return NextResponse.json({ jobs: list, nextCursor });
}

