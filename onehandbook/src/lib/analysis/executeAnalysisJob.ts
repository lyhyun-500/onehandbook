import { createSupabaseWithAccessToken } from "@/lib/supabase/authedClient";
import { syncAppUser } from "@/lib/supabase/appUser";
import { notifySlackAnalysisComplete } from "@/lib/slack/notifyAnalysisComplete";
import { AnalysisProviderExhaustedError } from "@/lib/analysis/analysisErrors";
import {
  runEpisodeAnalysisPipeline,
  type EpisodeAnalysisSuccess,
} from "@/lib/analysis/runEpisodeAnalysisPipeline";
import type { NatAnalysisOptions } from "@/lib/nat";

export type AnalysisJobPayload = {
  requestedVersion: string;
  force: boolean;
  includeLore: boolean;
  includePlatformOptimization: boolean;
};

async function markJobFailed(jobId: string, errorMessage: string, accessToken: string) {
  const supabase = createSupabaseWithAccessToken(accessToken);
  await supabase
    .from("analysis_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

/**
 * 비동기 분석 작업 실행 (pending → processing → completed|failed).
 * NAT는 runEpisodeAnalysisPipeline 성공 시에만 차감됩니다.
 */
export async function executeAnalysisJob(
  jobId: string,
  accessToken: string
): Promise<
  | { ok: true; result: EpisodeAnalysisSuccess; skipped?: false }
  | { ok: true; skipped: true }
  | { ok: false; error: string; code?: string }
> {
  const supabase = createSupabaseWithAccessToken(accessToken);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "로그인이 필요합니다.", code: "UNAUTHORIZED" };
  }

  const { data: job, error: jobErr } = await supabase
    .from("analysis_jobs")
    .select("id, app_user_id, status, episode_id, payload")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return { ok: false, error: "작업을 찾을 수 없습니다." };
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser || appUser.id !== job.app_user_id) {
    return { ok: false, error: "권한이 없습니다." };
  }

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

  const opts: NatAnalysisOptions = {
    includeLore: raw.includeLore !== false,
    includePlatformOptimization: raw.includePlatformOptimization !== false,
  };

  const { data: locked } = await supabase
    .from("analysis_jobs")
    .update({
      status: "processing",
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
      force: raw.force === true,
      requestedVersion: raw.requestedVersion,
      opts,
    });

    await supabase
      .from("analysis_jobs")
      .update({
        status: "completed",
        analysis_run_id: result.analysis.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

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

    await markJobFailed(jobId, message, accessToken);

    if (e instanceof Error && (e as Error & { code?: string }).code === "CONTENT_UNCHANGED") {
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
