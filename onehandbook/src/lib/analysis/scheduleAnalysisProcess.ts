import { createClient } from "@/lib/supabase/server";
import { executeAnalysisJob } from "@/lib/analysis/executeAnalysisJob";
import { getInternalSiteBaseUrl } from "@/lib/siteBaseUrl";

type ProcessBody = {
  ok?: boolean;
  code?: string;
  error?: string;
  skipped?: boolean;
};

/**
 * after() 안에서 호출. 세션 쿠키로 토큰을 다시 읽고(getUser로 갱신),
 * process 실패 시 refreshSession 후 한 번 더 시도.
 */
export async function runAnalysisProcessAfterResponse(
  jobId: string,
  fallbackAccessToken: string
): Promise<void> {
  const secret = process.env.ANALYZE_PROCESS_SECRET;
  if (!secret) {
    console.error("ANALYZE_PROCESS_SECRET 미설정");
    return;
  }

  const base = getInternalSiteBaseUrl();

  const doFetch = (accessToken: string) =>
    fetch(`${base}/api/analyze/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "X-Supabase-Access-Token": accessToken,
      },
      body: JSON.stringify({ jobId }),
    });

  const parseBody = async (res: Response): Promise<ProcessBody> => {
    try {
      return (await res.json()) as ProcessBody;
    } catch {
      return {};
    }
  };

  try {
    const supabase = await createClient();
    await supabase.auth.getUser();
    const { data: sess0 } = await supabase.auth.getSession();
    let accessToken = sess0.session?.access_token ?? fallbackAccessToken;

    let res = await doFetch(accessToken);
    let body = await parseBody(res);

    const looksUnauthorized =
      res.status === 401 ||
      body?.code === "UNAUTHORIZED" ||
      (body?.ok === false &&
        (body?.code === "UNAUTHORIZED" ||
          (typeof body?.error === "string" && body.error.includes("로그인"))));

    if (looksUnauthorized) {
      const { data: ref, error } = await supabase.auth.refreshSession();
      if (!error && ref.session?.access_token) {
        accessToken = ref.session.access_token;
        res = await doFetch(accessToken);
        body = await parseBody(res);
      }
    }

    if (!res.ok) {
      console.warn("analyze/process HTTP", res.status, body);
      await executeAnalysisJob(jobId, accessToken);
      return;
    }

    if (body?.ok === false) {
      await executeAnalysisJob(jobId, accessToken);
    }
  } catch (e) {
    console.warn("analyze/process fetch 실패, executeAnalysisJob으로 재시도", e);
    await executeAnalysisJob(jobId, fallbackAccessToken);
  }
}
