import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { parseJobPayloadRecord } from "@/lib/analysis/holisticJobPayload";
import { ANALYSIS_JOB_FAILURE_USER_CANCELLED } from "@/lib/analysis/analysisJobFailureCodes";
import { isMissingHolisticChunkResultsTableError } from "@/lib/db/holisticChunkResultsTable";

const CANCEL_MESSAGE = "사용자가 중단했습니다.";

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  const { jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("analysis_jobs")
    .select("id, app_user_id, status, payload")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
  }

  if (job.app_user_id !== appUser.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  if (job.status !== "pending" && job.status !== "processing") {
    return NextResponse.json(
      { error: "이미 끝난 작업은 중단할 수 없습니다." },
      { status: 409 }
    );
  }

  const base = parseJobPayloadRecord(job.payload) ?? {};
  const nextPayload = {
    ...base,
    failure_code: ANALYSIS_JOB_FAILURE_USER_CANCELLED,
  };

  const { data: updatedRows, error: updErr } = await supabase
    .from("analysis_jobs")
    .update({
      status: "failed",
      error_message: CANCEL_MESSAGE,
      progress_phase: null,
      payload: nextPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("app_user_id", appUser.id)
    .in("status", ["pending", "processing"])
    .select("id");

  if (updErr) {
    console.error(updErr);
    return NextResponse.json(
      { error: "작업 상태를 바꾸지 못했습니다." },
      { status: 500 }
    );
  }

  if (!updatedRows?.length) {
    return NextResponse.json(
      { error: "이미 끝난 작업은 중단할 수 없습니다." },
      { status: 409 }
    );
  }

  const { error: delErr } = await supabase
    .from("holistic_chunk_results")
    .delete()
    .eq("analysis_job_id", jobId);

  if (
    delErr &&
    !isMissingHolisticChunkResultsTableError(delErr)
  ) {
    console.warn("holistic_chunk_results 삭제(중단):", delErr.message);
  }

  return NextResponse.json({
    ok: true,
    error_message: CANCEL_MESSAGE,
    failure_code: ANALYSIS_JOB_FAILURE_USER_CANCELLED,
  });
}
