import {
  ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED,
  ANALYSIS_JOB_FAILURE_USER_CANCELLED,
} from "@/lib/analysis/analysisJobFailureCodes";

export function isContentUnchangedFailure(j: {
  failure_code?: string | null;
  error_message?: string | null;
}): boolean {
  if (j.failure_code === ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED) return true;
  const msg = typeof j.error_message === "string" ? j.error_message : "";
  return (
    msg.includes("변경사항이 없습니다") ||
    msg.includes("변경된 사항이 없습니다") ||
    (msg.includes("그래도 분석하려면 확인 후 다시 요청") &&
      (msg.includes("변경된 사항이 없습니다") ||
        msg.includes("변경사항이 없습니다")))
  );
}

export function isUserCancelledFailure(j: {
  failure_code?: string | null;
  error_message?: string | null;
}): boolean {
  if (j.failure_code === ANALYSIS_JOB_FAILURE_USER_CANCELLED) return true;
  const msg = typeof j.error_message === "string" ? j.error_message : "";
  return msg === "사용자가 중단했습니다.";
}
