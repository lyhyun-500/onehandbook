import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDbInt } from "@/lib/supabase/parseDbInt";
import { syncAppUser } from "@/lib/supabase/appUser";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";
import { kickStalePendingAnalysisJobIfNeeded } from "@/lib/analysis/kickStalePendingAnalysisJob";
import { expireStaleProcessingJobIfNeeded } from "@/lib/analysis/recoverStaleAnalysisJob";

export type JobProgressPhase =
  | "received"
  | "ai_analyzing"
  | "report_writing"
  | null;

export type AnalysisJobListItem = {
  id: string;
  episode_id: number;
  work_id: number;
  work_title: string | null;
  /** 단일 회차 job 알림 제목용 — `episodes.title` */
  episode_title: string | null;
  /** 단일 회차 job 알림용 — `episodes.episode_number` */
  episode_number: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  updated_at: string;
  created_at: string;
  job_kind: "episode" | "holistic_batch";
  progress_phase: JobProgressPhase;
  holistic_run_id: number | null;
  ordered_episode_ids: number[];
  /** 일괄(holistic_batch) 부모 job — 회차별 자식 episode job */
  parent_job_id: string | null;
  error_message: string | null;
  estimated_seconds: number | null;
  /** payload.failure_code (예: 원고 미변경) */
  failure_code: string | null;
  /** 통합 분석 클라이언트 청크 진행률 (payload.progressPercent) */
  progress_percent: number | null;
};

/**
 * 로그인 사용자의 최근 분석 작업 목록 (Realtime·알림 패널용).
 */
export async function GET() {
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

  const { data: jobs, error } = await supabase
    .from("analysis_jobs")
    .select(
      "id, episode_id, work_id, job_kind, progress_phase, status, updated_at, created_at, payload, holistic_run_id, error_message, parent_job_id"
    )
    .eq("app_user_id", appUser.id)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) {
    if (isMissingAnalysisJobsTableError(error)) {
      return NextResponse.json({ jobs: [] as AnalysisJobListItem[] });
    }
    console.error("analysis_jobs list:", error.message);
    return NextResponse.json(
      { error: "작업 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const rows = jobs ?? [];

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    const now = Date.now();
    for (const r of rows) {
      if (r.status !== "pending") continue;
      const createdRaw =
        typeof r.created_at === "string" ? r.created_at : r.updated_at;
      if (typeof createdRaw !== "string") continue;
      const createdMs = new Date(createdRaw).getTime();
      if (Number.isNaN(createdMs) || now - createdMs < 12_000) continue;
      await kickStalePendingAnalysisJobIfNeeded(
        supabase,
        String(r.id),
        accessToken
      );
    }
  }

  // processing이 오래 멈춘 job을 목록 조회만으로도 failed로 정리 (ai_analyzing 등에 무한 정체 방지)
  for (const r of rows) {
    if (r.status !== "processing") continue;
    await expireStaleProcessingJobIfNeeded(supabase, String(r.id));
  }

  const workIds = [...new Set(rows.map((r) => r.work_id).filter((id): id is number => id != null))];
  const episodeIdsRaw = rows.map((r) => {
    const eid =
      typeof r.episode_id === "number"
        ? r.episode_id
        : parseInt(String(r.episode_id), 10);
    return Number.isNaN(eid) ? null : eid;
  });
  const episodeIds = [...new Set(episodeIdsRaw.filter((id): id is number => id != null))];

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

  const episodeMetaById = new Map<
    number,
    { title: string | null; episode_number: number | null }
  >();
  if (episodeIds.length > 0) {
    const { data: eps } = await supabase
      .from("episodes")
      .select("id, title, episode_number")
      .in("id", episodeIds);
    for (const e of eps ?? []) {
      const id = typeof e.id === "number" ? e.id : parseInt(String(e.id), 10);
      if (Number.isNaN(id)) continue;
      const en =
        typeof e.episode_number === "number"
          ? e.episode_number
          : e.episode_number != null
            ? parseInt(String(e.episode_number), 10)
            : null;
      episodeMetaById.set(id, {
        title: typeof e.title === "string" ? e.title : null,
        episode_number: en != null && !Number.isNaN(en) ? en : null,
      });
    }
  }

  const list: AnalysisJobListItem[] = [];
  for (const r of rows) {
    const st = r.status;
    if (
      st !== "pending" &&
      st !== "processing" &&
      st !== "completed" &&
      st !== "failed"
    ) {
      continue;
    }

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
    if (Number.isNaN(work_id)) {
      const { data: ep } = await supabase
        .from("episodes")
        .select("work_id")
        .eq("id", episode_id)
        .maybeSingle();
      if (!ep?.work_id) continue;
      work_id = ep.work_id;
    }

    const jobKind =
      r.job_kind === "holistic_batch" ? "holistic_batch" : "episode";
    const payload = (r.payload ?? {}) as Record<string, unknown>;
    const orderedFromPayload = payload.orderedEpisodeIds;
    const ordered_episode_ids =
      jobKind === "holistic_batch" && Array.isArray(orderedFromPayload)
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
        ? pp
        : null;

    const holistic_run_id = parseDbInt(r.holistic_run_id);

    const created_at =
      typeof r.created_at === "string" ? r.created_at : r.updated_at;

    const parentRaw = (r as { parent_job_id?: unknown }).parent_job_id;
    const parent_job_id =
      typeof parentRaw === "string"
        ? parentRaw
        : parentRaw != null
          ? String(parentRaw)
          : null;

    const epMeta = episodeMetaById.get(episode_id);
    list.push({
      id: String(r.id),
      episode_id,
      work_id,
      work_title: workTitleById.get(work_id) ?? null,
      episode_title:
        jobKind === "episode" ? (epMeta?.title ?? null) : null,
      episode_number:
        jobKind === "episode" ? (epMeta?.episode_number ?? null) : null,
      status: st,
      updated_at: r.updated_at,
      created_at,
      job_kind: jobKind,
      progress_phase,
      holistic_run_id,
      ordered_episode_ids,
      parent_job_id,
      error_message:
        typeof r.error_message === "string" ? r.error_message : null,
      estimated_seconds,
      failure_code,
      progress_percent,
    });
  }

  return NextResponse.json({ jobs: list });
}
