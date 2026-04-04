import type { SupabaseClient } from "@supabase/supabase-js";

/** processing 상태가 이 시간을 넘기면 실패 처리 (updated_at 기준) */
export const ANALYSIS_JOB_PROCESSING_STALE_MS = 10 * 60 * 1000;

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
  const cutoff = new Date(
    Date.now() - ANALYSIS_JOB_PROCESSING_STALE_MS
  ).toISOString();

  await supabase
    .from("analysis_jobs")
    .update({
      status: "failed",
      error_message: STALE_ERROR_MESSAGE,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "processing")
    .lt("updated_at", cutoff);
}

export function isStaleJobFailureMessage(message: string | null | undefined): boolean {
  return message === STALE_ERROR_MESSAGE;
}
