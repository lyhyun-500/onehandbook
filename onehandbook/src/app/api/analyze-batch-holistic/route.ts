import { createClient } from "@/lib/supabase/server";
import { getProfileConfig } from "@/lib/ai/profileLookup";
import { isProviderConfigured } from "@/lib/ai/availability";
import {
  buildHolisticNatBreakdown,
  countManuscriptChars,
  estimateHolisticBatchTotalNat,
  resolveAnalysisAgentVersion,
  type NatAnalysisOptions,
} from "@/lib/nat";
import {
  MANUSCRIPT_TOO_SHORT_MESSAGE,
  MIN_ANALYSIS_CHARS,
} from "@/lib/manuscriptEligibility";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";
import { runAnalysisProcessAfterResponse } from "@/lib/analysis/scheduleAnalysisProcess";
import { conflictingEpisodeIdsForActiveJobs } from "@/lib/analysis/activeAnalysisJobConflict";
import {
  HOLISTIC_CLIENT_CHUNK_SIZE,
  splitEpisodeIdsIntoChunks,
} from "@/lib/analysis/holisticEpisodeChunks";

function parseNatOptions(body: Record<string, unknown>): NatAnalysisOptions {
  const includeLore = body.includeLore !== false;
  const includePlatformOptimization = body.includePlatformOptimization !== false;
  return { includeLore, includePlatformOptimization };
}

function estimateHolisticJobSeconds(episodeCount: number, chunkCount: number): number {
  return (
    35 +
    episodeCount * 18 +
    (chunkCount > 1 ? 45 + chunkCount * 25 : 0)
  );
}

/**
 * 통합 분석은 `analysis_jobs`(holistic_batch)에 적재 후 백그라운드에서 처리합니다.
 */
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

  const rawIds = body.episodeIds;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json(
      { error: "episodeIds 배열이 필요합니다." },
      { status: 400 }
    );
  }

  const episodeIds = rawIds
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n) => !Number.isNaN(n));

  if (episodeIds.length === 0) {
    return NextResponse.json(
      { error: "유효한 episodeId가 없습니다." },
      { status: 400 }
    );
  }

  const forceUnchanged = body.force === true;

  const opts = parseNatOptions(body);
  const requestedVersion =
    typeof body.agentVersion === "string" ? body.agentVersion : "";
  if (!requestedVersion) {
    return NextResponse.json({ error: "agentVersion이 필요합니다." }, { status: 400 });
  }

  const effectiveVersion = resolveAnalysisAgentVersion(
    opts.includePlatformOptimization,
    requestedVersion
  );

  const profile = getProfileConfig(effectiveVersion);
  if (!profile) {
    return NextResponse.json({ error: "알 수 없는 분석 프로필입니다." }, { status: 400 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  if (!appUser.phone_verified) {
    return NextResponse.json(
      {
        error: "휴대폰 인증 후 이용 가능합니다.",
        code: "PHONE_NOT_VERIFIED" as const,
      },
      { status: 403 }
    );
  }

  const workIdRaw = body.workId;
  const workId =
    typeof workIdRaw === "number"
      ? workIdRaw
      : parseInt(String(workIdRaw ?? ""), 10);
  if (Number.isNaN(workId)) {
    return NextResponse.json({ error: "workId가 필요합니다." }, { status: 400 });
  }

  const { data: work, error: wErr } = await supabase
    .from("works")
    .select("id, author_id")
    .eq("id", workId)
    .single();

  if (wErr || !work || work.author_id !== appUser.id) {
    return NextResponse.json({ error: "이 작품을 수정할 권한이 없습니다." }, { status: 403 });
  }

  const { data: epRows, error: epErr } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content")
    .eq("work_id", work.id)
    .in("id", episodeIds);

  if (epErr || !epRows || epRows.length !== episodeIds.length) {
    return NextResponse.json(
      { error: "선택한 회차를 모두 찾을 수 없거나 작품과 맞지 않습니다." },
      { status: 400 }
    );
  }

  const busy = await conflictingEpisodeIdsForActiveJobs(
    supabase,
    appUser.id,
    episodeIds
  );
  if (busy.length > 0) {
    return NextResponse.json(
      {
        error:
          "선택한 회차 중 일부가 이미 진행 중인 분석에 포함되어 있습니다. 완료 후 다시 시도해 주세요.",
        code: "EPISODE_ANALYSIS_IN_PROGRESS" as const,
        conflicting_episode_ids: busy,
      },
      { status: 409 }
    );
  }

  const byId = new Map(
    epRows.map((e) => {
      const id = Number(e.id);
      return [id, { ...e, id } as (typeof epRows)[number] & { id: number }];
    })
  );
  const ordered: (typeof epRows)[number][] = [];
  for (const id of episodeIds) {
    const row = byId.get(Number(id));
    if (!row) {
      return NextResponse.json(
        {
          error: "선택한 회차를 모두 찾을 수 없거나 작품과 맞지 않습니다.",
        },
        { status: 400 }
      );
    }
    ordered.push(row);
  }

  for (const e of ordered) {
    const n = countManuscriptChars(e.content ?? "");
    if (n < MIN_ANALYSIS_CHARS) {
      return NextResponse.json(
        {
          error: MANUSCRIPT_TOO_SHORT_MESSAGE,
          code: "MANUSCRIPT_TOO_SHORT" as const,
        },
        { status: 400 }
      );
    }
  }

  const breakdown = buildHolisticNatBreakdown(ordered.length, opts);

  const episodeMeta = ordered.map((e) => ({
    id: e.id,
    charCount: countManuscriptChars(e.content ?? ""),
  }));
  const estNat = estimateHolisticBatchTotalNat(episodeMeta, episodeIds, opts);

  if (!isProviderConfigured(profile.provider)) {
    return NextResponse.json(
      {
        error: `${profile.label}에 필요한 API 키가 설정되어 있지 않습니다.`,
      },
      { status: 400 }
    );
  }

  const balance = appUser.coin_balance ?? 0;
  if (balance < estNat.total) {
    return NextResponse.json(
      {
        error: `NAT가 부족합니다. 이번 통합 분석(전체 구간)에는 ${estNat.total} NAT가 필요합니다.`,
        code: "INSUFFICIENT_NAT" as const,
        required: estNat.total,
        balance,
        breakdown: {
          lines: breakdown.lines,
          total_nat: estNat.total,
          chunk_count: estNat.chunkCount,
          merge_nat: estNat.mergeNat,
        },
      },
      { status: 402 }
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json(
      { error: "세션이 만료되었습니다. 다시 로그인해 주세요." },
      { status: 401 }
    );
  }

  const estimatedSeconds = estimateHolisticJobSeconds(
    episodeIds.length,
    estNat.chunkCount
  );

  const isClientChunked = episodeIds.length > HOLISTIC_CLIENT_CHUNK_SIZE;
  const chunkSessionId = isClientChunked ? randomUUID() : null;
  const chunkPlan = isClientChunked ? splitEpisodeIdsIntoChunks(episodeIds) : null;

  const basePayload: Record<string, unknown> = {
    workId: work.id,
    orderedEpisodeIds: episodeIds,
    requestedVersion,
    includeLore: opts.includeLore,
    includePlatformOptimization: opts.includePlatformOptimization,
    estimatedSeconds,
    ...(forceUnchanged ? { force: true } : {}),
  };
  if (isClientChunked && chunkSessionId != null && chunkPlan != null) {
    basePayload.chunkSessionId = chunkSessionId;
    basePayload.clientChunked = true;
    basePayload.chunkTotal = chunkPlan.length;
    basePayload.progressPercent = 0;
    basePayload.chunkPlan = chunkPlan;
  }

  const { data: jobRow, error: jobInsErr } = await supabase
    .from("analysis_jobs")
    .insert({
      app_user_id: appUser.id,
      episode_id: episodeIds[0]!,
      work_id: work.id,
      job_kind: "holistic_batch",
      status: isClientChunked ? "processing" : "pending",
      progress_phase: isClientChunked ? "ai_analyzing" : "received",
      payload: basePayload,
    })
    .select("id")
    .single();

  if (jobInsErr || !jobRow) {
    console.error(jobInsErr);
    if (jobInsErr && isMissingAnalysisJobsTableError(jobInsErr)) {
      return NextResponse.json(
        {
          error:
            "analysis_jobs 테이블이 아직 없습니다. Supabase에서 마이그레이션을 적용해 주세요.",
          code: "MIGRATION_REQUIRED" as const,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error:
          jobInsErr?.message?.includes("job_kind") || jobInsErr?.message?.includes("work_id")
            ? "DB 스키마가 최신이 아닙니다. supabase/migrations의 analysis_jobs 확장 마이그레이션을 적용해 주세요."
            : "통합 분석 작업을 만들 수 없습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 }
    );
  }

  const jobId = jobRow.id as string;

  if (!isClientChunked) {
    after(async () => {
      await runAnalysisProcessAfterResponse(jobId, session.access_token);
    });
  }

  if (isClientChunked && chunkSessionId != null && chunkPlan != null) {
    return NextResponse.json({
      job_id: jobId,
      client_chunked: true,
      session_id: chunkSessionId,
      chunk_plan: chunkPlan,
      status: "processing" as const,
      breakdown: {
        lines: breakdown.lines,
        total_nat: estNat.total,
        chunk_count: estNat.chunkCount,
        merge_nat: estNat.mergeNat,
      },
      estimated_seconds: estimatedSeconds,
    });
  }

  return NextResponse.json({
    job_id: jobId,
    status: "pending" as const,
    breakdown: {
      lines: breakdown.lines,
      total_nat: estNat.total,
      chunk_count: estNat.chunkCount,
      merge_nat: estNat.mergeNat,
    },
    estimated_seconds: estimatedSeconds,
  });
}
