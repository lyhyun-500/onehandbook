import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/supabase/authedClient";
import { executeAnalysisJob } from "@/lib/analysis/executeAnalysisJob";
import { executeHolisticAnalysisJob } from "@/lib/analysis/executeHolisticAnalysisJob";
import {
  isHolisticAnalysisJobPeek,
  orderedEpisodeIdsFromJobPayload,
} from "@/lib/analysis/holisticJobPayload";

/**
 * Vercel/Next route segment: `maxDuration` 은 정적 숫자 리터럴만 허용됩니다.
 * 스테일 잡 복구 등은 `executeHolisticAnalysisJob` 의 `ANALYZE_PROCESS_MAX_DURATION_SEC` 로 조정합니다.
 */
// Pro 이상에서 분석 워커가 60s를 넘길 수 있어 상향합니다.
export const maxDuration = 300;

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

  const supabasePeek = createSupabaseWithAccessToken(accessToken);
  const { data: peekRow, error: peekErr } = await supabasePeek
    .from("analysis_jobs")
    .select("job_kind, payload")
    .eq("id", jobId)
    .maybeSingle();

  if (peekErr || !peekRow) {
    return NextResponse.json(
      { ok: false, error: "작업을 찾을 수 없습니다." },
      { status: 200 }
    );
  }

  const runHolistic = isHolisticAnalysisJobPeek(
    peekRow.job_kind,
    peekRow.payload
  );
  const idCount = orderedEpisodeIdsFromJobPayload(peekRow.payload)?.length ?? 0;
  console.info("[analyze/process] dispatch", {
    jobId,
    job_kind: peekRow.job_kind,
    runHolistic,
    orderedEpisodeIdCount: idCount,
    payloadType: peekRow.payload == null ? "null" : typeof peekRow.payload,
  });

  const result = runHolistic
    ? await executeHolisticAnalysisJob(jobId, accessToken)
    : await executeAnalysisJob(jobId, accessToken);

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
