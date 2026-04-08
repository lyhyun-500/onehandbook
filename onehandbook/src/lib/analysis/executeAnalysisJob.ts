import { createSupabaseWithAccessToken } from "@/lib/supabase/authedClient";
import { syncAppUser } from "@/lib/supabase/appUser";
import { notifySlackAnalysisComplete } from "@/lib/slack/notifyAnalysisComplete";
import { AnalysisProviderExhaustedError } from "@/lib/analysis/analysisErrors";
import {
  runEpisodeAnalysisPipeline,
  type EpisodeAnalysisSuccess,
} from "@/lib/analysis/runEpisodeAnalysisPipeline";
import type { NatAnalysisOptions } from "@/lib/nat";
import { executeHolisticAnalysisJob } from "@/lib/analysis/executeHolisticAnalysisJob";
import { ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED } from "@/lib/analysis/analysisJobFailureCodes";
import {
  isHolisticAnalysisJobPeek,
  parseJobPayloadRecord,
} from "@/lib/analysis/holisticJobPayload";

export type AnalysisJobPayload = {
  requestedVersion: string;
  force: boolean;
  includeLore: boolean;
  includePlatformOptimization: boolean;
};

async function markJobFailed(
  jobId: string,
  errorMessage: string,
  accessToken: string,
  options?: { failureCode?: string }
) {
  const supabase = createSupabaseWithAccessToken(accessToken);
  const patch: Record<string, unknown> = {
    status: "failed",
    error_message: errorMessage,
    progress_phase: null,
    updated_at: new Date().toISOString(),
  };
  if (options?.failureCode != null) {
    const { data: row } = await supabase
      .from("analysis_jobs")
      .select("payload")
      .eq("id", jobId)
      .maybeSingle();
    const base = (row?.payload as Record<string, unknown> | null) ?? {};
    patch.payload = { ...base, failure_code: options.failureCode };
  }
  await supabase.from("analysis_jobs").update(patch).eq("id", jobId);
}

/**
 * 비동기 분석 작업 실행 (pending → processing → completed|failed).
 * NAT는 runEpisodeAnalysisPipeline 성공 시에만 차감됩니다.
 */
export async function executeAnalysisJob(
  jobId: string,
  accessToken: string
): Promise<
  | { ok: true; result?: EpisodeAnalysisSuccess; skipped?: false }
  | { ok: true; skipped: true }
  | { ok: false; error: string; code?: string }
> {
  console.info("[executeAnalysisJob] start", { jobId });
  const supabase = createSupabaseWithAccessToken(accessToken);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[executeAnalysisJob] unauthorized", { jobId });
    return { ok: false, error: "로그인이 필요합니다.", code: "UNAUTHORIZED" };
  }

  const { data: job, error: jobErr } = await supabase
    .from("analysis_jobs")
    .select("id, app_user_id, status, episode_id, payload, job_kind")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.warn("[executeAnalysisJob] job not found", { jobId, jobErr });
    return { ok: false, error: "작업을 찾을 수 없습니다." };
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser || appUser.id !== job.app_user_id) {
    console.warn("[executeAnalysisJob] forbidden", { jobId });
    return { ok: false, error: "권한이 없습니다." };
  }

  const runHolisticRoute = isHolisticAnalysisJobPeek(job.job_kind, job.payload);

  console.info("[executeAnalysisJob] loaded", {
    jobId,
    status: job.status,
    job_kind: job.job_kind,
    runHolisticRoute,
    payloadKeys: Object.keys(
      (job.payload && typeof job.payload === "object"
        ? (job.payload as object)
        : {}) as Record<string, unknown>
    ).slice(0, 24),
  });

  if (runHolisticRoute) {
    console.info("[executeAnalysisJob] route=holistic", { jobId });
    return executeHolisticAnalysisJob(jobId, accessToken);
  }

  console.info("[executeAnalysisJob] route=episode", { jobId });

  if (job.status === "completed") {
    return { ok: true, skipped: true };
  }

  if (job.status === "processing") {
    return { ok: true, skipped: true };
  }

  if (job.status === "failed") {
    return {
      ok: false,
      error: "이전 요청이 실패했습니다. 다시 시도해 주세요.",
      code: "ALREADY_FAILED",
    };
  }

  if (job.status !== "pending") {
    return { ok: false, error: "알 수 없는 작업 상태입니다." };
  }

  const raw = job.payload as AnalysisJobPayload | null;
  if (!raw?.requestedVersion) {
    await markJobFailed(jobId, "잘못된 작업 데이터입니다.", accessToken);
    return { ok: false, error: "잘못된 작업 데이터입니다." };
  }

  const payloadRec = parseJobPayloadRecord(job.payload);
  const forceFromPayload = payloadRec?.force === true;

  const opts: NatAnalysisOptions = {
    includeLore: raw.includeLore !== false,
    includePlatformOptimization: raw.includePlatformOptimization !== false,
  };

  const { data: locked } = await supabase
    .from("analysis_jobs")
    .update({
      status: "processing",
      progress_phase: "ai_analyzing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!locked) {
    return { ok: true, skipped: true };
  }

  try {
    const result = await runEpisodeAnalysisPipeline(supabase, {
      episodeId: job.episode_id,
      appUser,
      force: raw.force === true || forceFromPayload,
      requestedVersion: raw.requestedVersion,
      opts,
      analysisJobProgress: { jobId },
    });

    await supabase
      .from("analysis_jobs")
      .update({
        status: "completed",
        analysis_run_id: result.analysis.id,
        progress_phase: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "processing");

    void (async () => {
      const { data: ep } = await supabase
        .from("episodes")
        .select("id, episode_number, title, work_id")
        .eq("id", job.episode_id)
        .maybeSingle();
      const { data: wk } = await supabase
        .from("works")
        .select("title")
        .eq("id", ep?.work_id ?? 0)
        .maybeSingle();
      if (ep && wk) {
        await notifySlackAnalysisComplete({
          workTitle: wk.title ?? "(제목 없음)",
          episodeLabel: `${ep.episode_number}화 · ${ep.title ?? ""}`,
          workId: ep.work_id,
          episodeId: ep.id,
        });
      }
    })();

    return { ok: true, result };
  } catch (e) {
    const isProvider =
      e instanceof AnalysisProviderExhaustedError ||
      (e instanceof Error && e.name === "AnalysisProviderExhaustedError");
    const message = isProvider
      ? "NAT는 차감되지 않았습니다. 잠시 후 다시 시도해주세요."
      : e instanceof Error
        ? e.message
        : "분석에 실패했습니다.";

    const isContentUnchanged =
      e instanceof Error &&
      (e as Error & { code?: string }).code === "CONTENT_UNCHANGED";
    await markJobFailed(
      jobId,
      message,
      accessToken,
      isContentUnchanged
        ? { failureCode: ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED }
        : undefined
    );

    if (isContentUnchanged) {
      return {
        ok: false,
        error: message,
        code: "CONTENT_UNCHANGED",
      };
    }
    if (e instanceof Error && (e as Error & { code?: string }).code === "INSUFFICIENT_NAT") {
      return {
        ok: false,
        error: message,
        code: "INSUFFICIENT_NAT",
      };
    }

    return { ok: false, error: message };
  }
}
