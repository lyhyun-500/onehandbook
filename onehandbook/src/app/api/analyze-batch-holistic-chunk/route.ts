import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { runHolisticChunkAnalysis } from "@/lib/analysis/holisticChunkAnalysis";
import { isMissingHolisticChunkResultsTableError } from "@/lib/db/holisticChunkResultsTable";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";

function parseNatOptions(body: Record<string, unknown>) {
  const includeLore = body.includeLore !== false;
  const includePlatformOptimization = body.includePlatformOptimization !== false;
  return { includeLore, includePlatformOptimization };
}

function numArraysEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const chunkIndex =
    typeof body.chunkIndex === "number"
      ? body.chunkIndex
      : parseInt(String(body.chunkIndex ?? ""), 10);
  const rawEp = body.episodeIds;
  const episodeIds = Array.isArray(rawEp)
    ? rawEp
        .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
        .filter((n) => !Number.isNaN(n))
    : [];

  if (!jobId || !sessionId || Number.isNaN(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "jobId, sessionId, chunkIndex가 필요합니다." }, { status: 400 });
  }
  if (episodeIds.length === 0 || episodeIds.length > 10) {
    return NextResponse.json(
      { error: "episodeIds는 1~10개여야 합니다." },
      { status: 400 }
    );
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("analysis_jobs")
    .select("id, app_user_id, status, payload, work_id")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    if (isMissingAnalysisJobsTableError(jobErr)) {
      return NextResponse.json(
        { error: "analysis_jobs 테이블이 없습니다.", code: "MIGRATION_REQUIRED" as const },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
  }

  if (job.app_user_id !== appUser.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  if (job.status !== "processing") {
    return NextResponse.json(
      { error: "진행 중인 통합 분석 작업만 청크를 추가할 수 있습니다." },
      { status: 409 }
    );
  }

  const payload = (job.payload ?? {}) as Record<string, unknown>;
  if (payload.clientChunked !== true || payload.chunkSessionId !== sessionId) {
    return NextResponse.json(
      { error: "작업 세션 정보가 맞지 않습니다." },
      { status: 400 }
    );
  }

  const chunkPlan = payload.chunkPlan as unknown;
  if (!Array.isArray(chunkPlan) || chunkIndex >= chunkPlan.length) {
    return NextResponse.json({ error: "유효하지 않은 chunkIndex입니다." }, { status: 400 });
  }

  const expectedRaw = chunkPlan[chunkIndex] as unknown;
  if (!Array.isArray(expectedRaw)) {
    return NextResponse.json({ error: "작업의 chunkPlan이 잘못되었습니다." }, { status: 500 });
  }
  const expected = expectedRaw
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n) => !Number.isNaN(n));

  if (!numArraysEqual(expected, episodeIds)) {
    return NextResponse.json(
      { error: "episodeIds가 서버에 등록된 청크와 일치하지 않습니다." },
      { status: 400 }
    );
  }

  const requestedVersion =
    typeof payload.requestedVersion === "string" ? payload.requestedVersion : "";
  if (!requestedVersion) {
    return NextResponse.json({ error: "작업에 분석 버전 정보가 없습니다." }, { status: 500 });
  }

  const opts = parseNatOptions({
    includeLore: payload.includeLore,
    includePlatformOptimization: payload.includePlatformOptimization,
  });

  const workId =
    typeof job.work_id === "number"
      ? job.work_id
      : parseInt(String(job.work_id ?? payload.workId ?? ""), 10);
  if (Number.isNaN(workId)) {
    return NextResponse.json({ error: "workId를 확인할 수 없습니다." }, { status: 500 });
  }

  const chunkTotal =
    typeof payload.chunkTotal === "number" && !Number.isNaN(payload.chunkTotal)
      ? payload.chunkTotal
      : chunkPlan.length;

  const failJob = async (message: string) => {
    await supabase
      .from("analysis_jobs")
      .update({
        status: "failed",
        error_message: message,
        progress_phase: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "processing");
  };

  let resultJson: unknown;
  try {
    const { result } = await runHolisticChunkAnalysis(supabase, appUser, {
      workId,
      chunkEpisodeIds: episodeIds,
      requestedVersion,
      opts,
      pipelineDbLog: {
        supabase,
        appUserId: appUser.id,
        analysisJobId: jobId,
      },
    });
    resultJson = result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "청크 분석에 실패했습니다.";
    const code =
      e instanceof Error && (e as Error & { code?: string }).code === "INSUFFICIENT_NAT"
        ? "INSUFFICIENT_NAT"
        : undefined;
    await failJob(msg);
    if (code === "INSUFFICIENT_NAT") {
      return NextResponse.json(
        { error: msg, code: "INSUFFICIENT_NAT" as const },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error: insErr } = await supabase.from("holistic_chunk_results").upsert(
    {
      session_id: sessionId,
      analysis_job_id: jobId,
      chunk_index: chunkIndex,
      episode_ids: episodeIds,
      result_json: resultJson,
      app_user_id: appUser.id,
    },
    { onConflict: "session_id,chunk_index" }
  );

  if (insErr) {
    console.error(insErr);
    if (isMissingHolisticChunkResultsTableError(insErr)) {
      await failJob(
        "holistic_chunk_results 테이블이 없습니다. Supabase에 마이그레이션을 적용해 주세요."
      );
      return NextResponse.json(
        {
          error:
            "holistic_chunk_results 테이블이 없습니다. supabase-migration-holistic-chunk-results.sql을 적용해 주세요.",
          code: "MIGRATION_REQUIRED" as const,
        },
        { status: 503 }
      );
    }
    await failJob("청크 결과 저장에 실패했습니다.");
    return NextResponse.json(
      { error: "청크 결과 저장에 실패했습니다." },
      { status: 500 }
    );
  }

  const { count, error: cntErr } = await supabase
    .from("holistic_chunk_results")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (cntErr) {
    console.error(cntErr);
  }

  const done = count ?? 0;
  const progressPercent = Math.min(88, Math.round((done / Math.max(1, chunkTotal)) * 88));

  const nextPayload = {
    ...payload,
    progressPercent,
    chunkCompleted: done,
  };

  await supabase
    .from("analysis_jobs")
    .update({
      payload: nextPayload,
      progress_phase: "ai_analyzing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "processing");

  return NextResponse.json({
    ok: true,
    chunk_index: chunkIndex,
    chunks_completed: done,
    chunk_total: chunkTotal,
    progress_percent: progressPercent,
  });
}
