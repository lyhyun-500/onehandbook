import { executeAnalysisJob } from "@/lib/analysis/executeAnalysisJob";

/**
 * 분석 job 실행 트리거. POST /api/analyze 응답 후 `after()` 안에서 호출된다.
 *
 * 과거에는 `ANALYZE_PROCESS_SECRET`이 있을 때 먼저 `/api/analyze/process`로 **셀프 HTTP**를 했는데,
 * 프로덕션에서 fetch가 지연·무응답이면 `executeAnalysisJob`까지 도달하지 못해 job이 **영구 pending**이 될 수 있다.
 * 따라서 **항상 같은 프로세스에서 `executeAnalysisJob`을 직접** 호출한다.
 * (`/api/analyze/process` 라우트는 수동·외부 호출·디버깅용으로 유지)
 */
export async function runAnalysisProcessAfterResponse(
  jobId: string,
  fallbackAccessToken: string
): Promise<void> {
  console.info("[analysis/process] trigger start (direct executeAnalysisJob)", {
    jobId,
  });
  try {
    const result = await executeAnalysisJob(jobId, fallbackAccessToken);
    console.info("[analysis/process] executeAnalysisJob done", { jobId, result });
  } catch (e) {
    console.error("[analysis/process] executeAnalysisJob 실패:", e);
  }
}
