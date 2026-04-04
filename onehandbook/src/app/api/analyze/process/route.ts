import { NextResponse } from "next/server";
import { executeAnalysisJob } from "@/lib/analysis/executeAnalysisJob";

/** LLM·저장 구간 전용 — Vercel에서 별도 호출당 최대 60초 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.ANALYZE_PROCESS_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "서버 설정이 완료되지 않았습니다." },
      { status: 500 }
    );
  }

  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = request.headers.get("X-Supabase-Access-Token");
  if (!accessToken) {
    return NextResponse.json(
      { error: "X-Supabase-Access-Token이 필요합니다." },
      { status: 400 }
    );
  }

  let body: { jobId?: string };
  try {
    body = (await request.json()) as { jobId?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const jobId = body.jobId;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
  }

  const result = await executeAnalysisJob(jobId, accessToken);

  if (result.ok && result.skipped) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true });
}
