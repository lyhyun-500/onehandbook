import { executeAnalysisJob } from "@/lib/analysis/executeAnalysisJob";
import { getAnalyzeProcessBaseUrl } from "@/lib/siteBaseUrl";

/**
 * 분석 job 실행 트리거. POST /api/analyze 응답 후 `after()` 안에서 호출된다.
 *
 * 라이브(Vercel)에서는 `/api/analyze` 라우트 자체가 60s 제한이라 LLM을 직접 돌리면 타임아웃으로 끊긴다.
 * 따라서 기본은 `/api/analyze/process`로 셀프 HTTP를 날려 **별도 인보케이션**에서 실행한다.
 * (로컬/미구성 환경에서는 폴백으로 `executeAnalysisJob`을 직접 호출)
 */
export async function runAnalysisProcessAfterResponse(
  jobId: string,
  fallbackAccessToken: string
): Promise<void> {
  const secret = process.env.ANALYZE_PROCESS_SECRET?.trim();
  if (secret) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    try {
      const base = getAnalyzeProcessBaseUrl();
      const res = await fetch(`${base}/api/analyze/process`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          "X-Supabase-Access-Token": fallbackAccessToken,
        },
        body: JSON.stringify({ jobId }),
        signal: controller.signal,
      });
      console.info("[analysis/process] trigger via HTTP", {
        jobId,
        ok: res.ok,
        status: res.status,
      });
      return;
    } catch (e) {
      console.error("[analysis/process] trigger HTTP 실패, fallback direct", {
        jobId,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      clearTimeout(t);
    }
  }

  console.info("[analysis/process] trigger start (direct executeAnalysisJob)", { jobId });
  try {
    const result = await executeAnalysisJob(jobId, fallbackAccessToken);
    console.info("[analysis/process] executeAnalysisJob done", { jobId, result });
  } catch (e) {
    console.error("[analysis/process] executeAnalysisJob 실패:", e);
  }
}
