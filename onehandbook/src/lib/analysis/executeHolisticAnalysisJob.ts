import { createSupabaseWithAccessToken } from "@/lib/supabase/authedClient";
import { syncAppUser } from "@/lib/supabase/appUser";
import { notifySlackAnalysisComplete } from "@/lib/slack/notifyAnalysisComplete";
import { AnalysisProviderExhaustedError } from "@/lib/analysis/analysisErrors";
import { runHolisticBatchPipeline } from "@/lib/analysis/holisticBatchWorker";
import type { NatAnalysisOptions } from "@/lib/nat";
import {
  orderedEpisodeIdsFromJobPayload,
  parseJobPayloadRecord,
} from "@/lib/analysis/holisticJobPayload";
import { isStaleJobFailureMessage } from "@/lib/analysis/recoverStaleAnalysisJob";
import { parseDbInt } from "@/lib/supabase/parseDbInt";

export type HolisticAnalysisJobPayload = {
  workId: number;
  orderedEpisodeIds: number[];
  requestedVersion: string;
  includeLore: boolean;
  includePlatformOptimization: boolean;
  estimatedSeconds?: number;
  /** 잡이 잘못 episode 경로로 들어갈 때 원고 미변경 검사 건너뜀 */
  force?: boolean;
};

async function markHolisticJobFailed(
  jobId: string,
  errorMessage: string,
  accessToken: string
) {
  const supabase = createSupabaseWithAccessToken(accessToken);
  const { error } = await supabase
    .from("analysis_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      progress_phase: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) {
    console.error("[holistic-job] mark failed update error", {
      jobId,
      message: error.message,
      code: (error as { code?: string } | undefined)?.code,
      details: (error as { details?: string } | undefined)?.details,
      hint: (error as { hint?: string } | undefined)?.hint,
    });
  }
}

function holisticJobHeartbeatIntervalMs(): number {
  const sec = parseInt(
    process.env.HOLISTIC_JOB_HEARTBEAT_SEC ?? process.env.ANALYZE_JOB_HEARTBEAT_SEC ?? "60",
    10
  );
  const n = Number.isFinite(sec) && sec > 0 ? sec : 60;
  return Math.max(15, Math.min(180, n)) * 1000;
}

function holisticProcessingStaleThresholdMs(): number {
  const sec = parseInt(
    process.env.ANALYZE_PROCESS_MAX_DURATION_SEC ?? "600",
    10
  );
  const effective =
    Number.isFinite(sec) && sec > 0 ? Math.min(sec, 800) : 600;
  return effective * 1000 + 120_000;
}

/**
 * 통합 분석 비동기 작업 (pending → processing → completed|failed).
 */
export async function executeHolisticAnalysisJob(
  jobId: string,
  accessToken: string
): Promise<
  | { ok: true; skipped: true }
  | { ok: true; skipped?: false }
  | { ok: false; error: string; code?: string }
> {
  console.info("[holistic-job] start", { jobId });
  const supabase = createSupabaseWithAccessToken(accessToken);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[holistic-job] unauthorized", { jobId });
    return { ok: false, error: "로그인이 필요합니다.", code: "UNAUTHORIZED" };
  }

  const { data: job, error: jobErr } = await supabase
    .from("analysis_jobs")
    .select(
      "id, app_user_id, status, episode_id, work_id, job_kind, payload, updated_at"
    )
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.warn("[holistic-job] job not found", { jobId, jobErr });
    return { ok: false, error: "작업을 찾을 수 없습니다." };
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser || appUser.id !== job.app_user_id) {
    console.warn("[holistic-job] forbidden", { jobId });
    return { ok: false, error: "권한이 없습니다." };
  }

  const rawPayload = parseJobPayloadRecord(job.payload);
  const clientChunked =
    rawPayload != null &&
    (rawPayload as { clientChunked?: boolean }).clientChunked === true;

  console.info("[holistic-job] loaded", {
    jobId,
    status: job.status,
    job_kind: job.job_kind,
    clientChunked,
    updated_at: job.updated_at,
  });

  if (job.status === "completed") {
    return { ok: true, skipped: true };
  }

  if (job.status === "failed") {
    return {
      ok: false,
      error: "이전 요청이 실패했습니다. 다시 시도해 주세요.",
      code: "ALREADY_FAILED",
    };
  }

  if (clientChunked) {
    if (job.status === "processing") {
      console.info("[holistic-job] clientChunked + processing, server skip", {
        jobId,
      });
      return { ok: true, skipped: true };
    }
    console.warn("[holistic-job] clientChunked unexpected status", {
      jobId,
      status: job.status,
    });
    return { ok: true, skipped: true };
  }

  let workingJob = job;

  if (job.status === "processing") {
    const updatedMs = job.updated_at
      ? new Date(job.updated_at).getTime()
      : 0;
    const ageMs = updatedMs > 0 ? Date.now() - updatedMs : 0;
    const staleMs = holisticProcessingStaleThresholdMs();
    const stale = ageMs > staleMs;
    if (stale) {
      console.warn(
        "[holistic-job] processing stale — likely server timeout; reset to pending",
        { jobId, ageMs, thresholdMs: staleMs }
      );
      await supabase
        .from("analysis_jobs")
        .update({
          status: "pending",
          progress_phase: "received",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "processing");

      const { data: refetched, error: refErr } = await supabase
        .from("analysis_jobs")
        .select(
          "id, app_user_id, status, episode_id, work_id, job_kind, payload, updated_at"
        )
        .eq("id", jobId)
        .single();
      if (!refErr && refetched) {
        workingJob = refetched;
      }
    } else {
      console.info("[holistic-job] processing (assume in-flight), skip", {
        jobId,
        ageMs,
      });
      return { ok: true, skipped: true };
    }
  }

  if (workingJob.status !== "pending") {
    return { ok: false, error: "알 수 없는 작업 상태입니다." };
  }

  const orderedEpisodeIds = orderedEpisodeIdsFromJobPayload(workingJob.payload);
  const wRaw = rawPayload?.workId;
  const workId =
    typeof wRaw === "number"
      ? wRaw
      : typeof wRaw === "string"
        ? parseInt(wRaw, 10)
        : NaN;
  if (
    !rawPayload ||
    Number.isNaN(workId) ||
    workId < 1 ||
    !orderedEpisodeIds ||
    orderedEpisodeIds.length === 0 ||
    typeof rawPayload.requestedVersion !== "string"
  ) {
    await markHolisticJobFailed(jobId, "잘못된 통합 분석 작업 데이터입니다.", accessToken);
    return { ok: false, error: "잘못된 작업 데이터입니다." };
  }

  const opts: NatAnalysisOptions = {
    includeLore: rawPayload.includeLore !== false,
    includePlatformOptimization: rawPayload.includePlatformOptimization !== false,
  };

  const requestedVersion = rawPayload.requestedVersion as string;

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
    console.info("[holistic-job] lock not acquired (already running?)", { jobId });
    return { ok: true, skipped: true };
  }

  /** LLM 대기 중 updated_at 정지 → 폴링 만료 방지 */
  const heartbeat = setInterval(() => {
    void supabase
      .from("analysis_jobs")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("status", "processing");
  }, holisticJobHeartbeatIntervalMs());

  try {
    console.info("[holistic-job] pipeline start", {
      jobId,
      workId,
      episodeCount: orderedEpisodeIds.length,
      orderedEpisodeIds,
    });
    const { holisticRow } = await runHolisticBatchPipeline(supabase, appUser, {
      workId,
      orderedEpisodeIds,
      requestedVersion,
      opts,
      onPhase: async (phase) => {
        await supabase
          .from("analysis_jobs")
          .update({
            progress_phase: phase,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      },
      pipelineDbLog: {
        supabase,
        appUserId: appUser.id,
        analysisJobId: jobId,
      },
      parentAnalysisJobId: jobId,
      holisticForce: rawPayload.force === true,
    });

    const completedPatch = {
      status: "completed" as const,
      holistic_run_id: holisticRow.id,
      progress_phase: null,
      error_message: null as string | null,
      updated_at: new Date().toISOString(),
    };

    const { data: completedRows } = await supabase
      .from("analysis_jobs")
      .update(completedPatch)
      .eq("id", jobId)
      .eq("status", "processing")
      .select("id");

    if (!completedRows?.length) {
      const { data: cur } = await supabase
        .from("analysis_jobs")
        .select("status, error_message, holistic_run_id")
        .eq("id", jobId)
        .maybeSingle();

      if (
        cur?.status === "completed" &&
        parseDbInt(cur.holistic_run_id) === holisticRow.id
      ) {
        // 이미 반영됨
      } else if (
        cur?.status === "failed" &&
        isStaleJobFailureMessage(cur.error_message)
      ) {
        console.warn(
          "[holistic-job] job was failed by stale poll during LLM; completing now",
          { jobId, holisticRunId: holisticRow.id }
        );
        await supabase.from("analysis_jobs").update(completedPatch).eq("id", jobId);
      } else {
        const { data: retryProc } = await supabase
          .from("analysis_jobs")
          .update(completedPatch)
          .eq("id", jobId)
          .in("status", ["pending", "processing"])
          .select("id");
        if (!retryProc?.length) {
          const { data: repairOrphan } = await supabase
            .from("analysis_jobs")
            .update(completedPatch)
            .eq("id", jobId)
            .eq("status", "completed")
            .is("holistic_run_id", null)
            .select("id");
          if (!repairOrphan?.length) {
            console.warn(
              "[holistic-job] completed update matched 0 rows — UI와 DB를 확인하세요",
              { jobId, curStatus: cur?.status, holisticRunId: holisticRow.id }
            );
          } else {
            console.warn(
              "[holistic-job] repaired job row: completed but holistic_run_id was null",
              { jobId, holisticRunId: holisticRow.id }
            );
          }
        }
      }
    }

    console.info("[holistic-job] completed", {
      jobId,
      holisticRunId: holisticRow.id,
      workId,
      orderedEpisodeIds: holisticRow.episode_ids ?? [],
      episodeCount: (holisticRow.episode_ids ?? []).length,
    });

    void (async () => {
      const ids = holisticRow.episode_ids ?? [];
      const { data: wk } = await supabase
        .from("works")
        .select("title")
        .eq("id", holisticRow.work_id)
        .maybeSingle();
      let label = `회차 ${ids.length}개`;
      if (ids.length > 0) {
        const { data: eps } = await supabase
          .from("episodes")
          .select("episode_number, title")
          .in("id", ids)
          .order("episode_number", { ascending: true });
        if (eps && eps.length > 0) {
          label = `${eps[0]!.episode_number}화${eps.length > 1 ? ` 외 ${eps.length - 1}회차` : ""}`;
        }
      }
      await notifySlackAnalysisComplete({
        workTitle: wk?.title ?? "(제목 없음)",
        episodeLabel: `통합 분석 · ${label}`,
        workId: holisticRow.work_id,
        episodeId: ids[0] ?? job.episode_id,
      });
    })();

    return { ok: true };
  } catch (e) {
    const isProvider =
      e instanceof AnalysisProviderExhaustedError ||
      (e instanceof Error && e.name === "AnalysisProviderExhaustedError");
    const message = isProvider
      ? "NAT는 차감되지 않았습니다. 잠시 후 다시 시도해주세요."
      : e instanceof Error
        ? e.message
        : "통합 분석에 실패했습니다.";

    console.error("[holistic-job] failed", { jobId, message, e });
    await markHolisticJobFailed(jobId, message, accessToken);

    if (e instanceof Error && (e as Error & { code?: string }).code === "INSUFFICIENT_NAT") {
      return {
        ok: false,
        error: message,
        code: "INSUFFICIENT_NAT",
      };
    }

    return { ok: false, error: message };
  } finally {
    clearInterval(heartbeat);
  }
}
