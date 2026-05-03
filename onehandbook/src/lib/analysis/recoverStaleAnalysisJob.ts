import type { SupabaseClient } from "@supabase/supabase-js";
import {
  episodeProcessingStaleThresholdMs,
  holisticProcessingStaleThresholdMs,
} from "@/lib/analysis/staleThresholds";

const STALE_ERROR_MESSAGE =
  "분석 처리 시간이 초과되었습니다. 다시 시도해 주세요.";

/**
 * 해당 job이 processing이고 updated_at이 오래됐으면 failed로 전환.
 * 폴링·조회 전에 호출.
 */
export async function expireStaleProcessingJobIfNeeded(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("analysis_jobs")
    .select("job_kind")
    .eq("id", jobId)
    .eq("status", "processing")
    .maybeSingle();

  if (!row) return;

  const staleMs =
    row.job_kind === "holistic_batch"
      ? holisticProcessingStaleThresholdMs()
      : episodeProcessingStaleThresholdMs();

  const cutoff = new Date(Date.now() - staleMs).toISOString();

  await supabase
    .from("analysis_jobs")
    .update({
      status: "failed",
      error_message: STALE_ERROR_MESSAGE,
      progress_phase: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "processing")
    .lt("updated_at", cutoff);
}

export function isStaleJobFailureMessage(message: string | null | undefined): boolean {
  return message === STALE_ERROR_MESSAGE;
}
