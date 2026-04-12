/** analysis_jobs.payload.failure_code 및 폴링 API code와 동일 */
export const ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED = "CONTENT_UNCHANGED" as const;

export const ANALYSIS_JOB_FAILURE_USER_CANCELLED = "USER_CANCELLED" as const;

/** 같은 회차 강제 재분석으로 이전 단일 job 행을 종료할 때 */
export const ANALYSIS_JOB_FAILURE_SUPERSEDED_BY_FORCE =
  "SUPERSEDED_BY_FORCE" as const;
