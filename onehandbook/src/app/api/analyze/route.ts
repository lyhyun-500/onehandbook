import { createClient } from "@/lib/supabase/server";
import { getProfileConfig } from "@/lib/ai/profileLookup";
import { isProviderConfigured } from "@/lib/ai/availability";
import {
  buildNatBreakdown,
  computeNatCost,
  countManuscriptChars,
  resolveAnalysisAgentVersion,
  type NatAnalysisOptions,
} from "@/lib/nat";
import {
  MANUSCRIPT_TOO_SHORT_MESSAGE,
  MIN_ANALYSIS_CHARS,
} from "@/lib/manuscriptEligibility";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import {
  parseAnalysisFeedback,
  type PreviousAnalysisResultPayload,
} from "@/lib/analysisResultCache";
import { md5Hex } from "@/lib/contentHash";
import { findCachedAnalysisRun } from "@/lib/analysisCache";
import {
  computeWorkAnalysisContextHash,
  workContextAllowsContentUnchanged,
} from "@/lib/analysis/workAnalysisContextHash";
import { fetchLatestAnalysisResultForContentGuard } from "@/lib/analysis/analysisResultsWorkContextSupport";
import { checkAnalyzeRateLimit } from "@/lib/rateLimit/analyzeRateLimit";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";
import { runAnalysisProcessAfterResponse } from "@/lib/analysis/scheduleAnalysisProcess";
import { conflictingEpisodeIdsForActiveJobs } from "@/lib/analysis/activeAnalysisJobConflict";

function parseNatOptions(body: Record<string, unknown>): NatAnalysisOptions {
  const includeLore = body.includeLore !== false;
  const includePlatformOptimization = body.includePlatformOptimization !== false;
  return { includeLore, includePlatformOptimization };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const rl = await checkAnalyzeRateLimit(user.id);
  if (!rl.success) {
    return NextResponse.json(
      {
        error: "잠시 후 다시 시도해주세요.",
        code: "RATE_LIMIT_EXCEEDED" as const,
      },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const rawId = body.episodeId;
  const episodeId =
    typeof rawId === "number" ? rawId : parseInt(String(rawId ?? ""), 10);
  if (Number.isNaN(episodeId)) {
    return NextResponse.json({ error: "episodeId가 필요합니다." }, { status: 400 });
  }

  const force = body.force === true;

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

  const { data: episode, error: epErr } = await supabase
    .from("episodes")
    .select("id, content, work_id, episode_number")
    .eq("id", episodeId)
    .single();

  if (epErr || !episode) {
    return NextResponse.json({ error: "회차를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: work, error: wErr } = await supabase
    .from("works")
    .select("id, genre, title, tags, author_id, world_setting, character_settings")
    .eq("id", episode.work_id)
    .single();

  if (wErr || !work || work.author_id !== appUser.id) {
    return NextResponse.json({ error: "이 작품을 수정할 권한이 없습니다." }, { status: 403 });
  }

  const charCount = countManuscriptChars(episode.content);
  if (charCount < MIN_ANALYSIS_CHARS) {
    return NextResponse.json(
      {
        error: MANUSCRIPT_TOO_SHORT_MESSAGE,
        code: "MANUSCRIPT_TOO_SHORT" as const,
      },
      { status: 400 }
    );
  }

  const cost = computeNatCost(charCount, opts);
  const breakdown = buildNatBreakdown(charCount, opts);

  const currentHash = md5Hex(episode.content);
  const workContextHash = computeWorkAnalysisContextHash(work, opts.includeLore);

  const cachedRun = !force
    ? await findCachedAnalysisRun(
        supabase,
        episode.id,
        currentHash,
        workContextHash,
        effectiveVersion
      )
    : null;

  if (cachedRun) {
    const balanceAfter = appUser.coin_balance ?? 0;
    const { data: lastTwo } = await supabase
      .from("analysis_results")
      .select("score, feedback, nat_consumed, created_at")
      .eq("episode_id", episode.id)
      .order("created_at", { ascending: false })
      .limit(2);

    let previousForCompare: PreviousAnalysisResultPayload | null = null;
    if (lastTwo && lastTwo.length >= 2) {
      previousForCompare = {
        score: lastTwo[1].score,
        feedback: parseAnalysisFeedback(lastTwo[1].feedback ?? ""),
        nat_consumed: lastTwo[1].nat_consumed,
        created_at: lastTwo[1].created_at,
      };
    }

    const cachedOpts = cachedRun.options_json as Record<string, unknown> | null;
    return NextResponse.json({
      analysis: {
        id: cachedRun.id,
        episode_id: cachedRun.episode_id,
        work_id: cachedRun.work_id,
        agent_version: cachedRun.agent_version,
        result_json: cachedRun.result_json,
        created_at: cachedRun.created_at,
        holistic_derived: cachedOpts?.holistic_derived === true,
      },
      previousResult: previousForCompare,
      nat: { spent: 0, balance: balanceAfter },
      breakdown,
      cached: true,
    });
  }

  if (!isProviderConfigured(profile.provider)) {
    return NextResponse.json(
      {
        error: `${profile.label}에 필요한 API 키가 설정되어 있지 않습니다.`,
      },
      { status: 400 }
    );
  }

  const balance = appUser.coin_balance ?? 0;
  if (balance < cost) {
    return NextResponse.json(
      {
        error: `NAT가 부족합니다. 이번 분석에는 ${cost} NAT가 필요합니다.`,
        code: "INSUFFICIENT_NAT" as const,
        required: cost,
        balance,
        breakdown,
      },
      { status: 402 }
    );
  }

  const { row: previousRow } = await fetchLatestAnalysisResultForContentGuard(
    supabase,
    episode.id
  );

  if (
    !force &&
    previousRow?.content_hash &&
    previousRow.content_hash === currentHash &&
    workContextAllowsContentUnchanged(
      previousRow.work_context_hash,
      workContextHash
    )
  ) {
    return NextResponse.json(
      {
        error:
          "변경된 사항이 없습니다. 그래도 분석하려면 확인 후 다시 요청해 주세요.",
        code: "CONTENT_UNCHANGED" as const,
        contentHash: currentHash,
      },
      { status: 409 }
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

  const busy = await conflictingEpisodeIdsForActiveJobs(
    supabase,
    appUser.id,
    [episodeId]
  );
  if (busy.length > 0) {
    return NextResponse.json(
      {
        error:
          "이 회차는 이미 진행 중인 분석(단일 또는 통합)에 포함되어 있습니다. 완료 후 다시 시도해 주세요.",
        code: "EPISODE_ANALYSIS_IN_PROGRESS" as const,
        conflicting_episode_ids: busy,
      },
      { status: 409 }
    );
  }

  const { data: jobRow, error: jobInsErr } = await supabase
    .from("analysis_jobs")
    .insert({
      app_user_id: appUser.id,
      episode_id: episodeId,
      work_id: episode.work_id,
      job_kind: "episode",
      status: "pending",
      progress_phase: "received",
      payload: {
        requestedVersion,
        force,
        includeLore: opts.includeLore,
        includePlatformOptimization: opts.includePlatformOptimization,
        estimatedSeconds: 75,
      },
    })
    .select("id")
    .single();

  if (jobInsErr || !jobRow) {
    console.error(jobInsErr);
    if (jobInsErr && isMissingAnalysisJobsTableError(jobInsErr)) {
      return NextResponse.json(
        {
          error:
            "analysis_jobs 테이블이 아직 없습니다. Supabase SQL Editor에서 supabase-migration-analysis-jobs.sql(또는 supabase/migrations, RUN-ALL 13번)을 실행하거나 `supabase db push`로 적용해 주세요.",
          code: "MIGRATION_REQUIRED" as const,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "분석 작업을 만들 수 없습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  const jobId = jobRow.id as string;

  if (process.env.NODE_ENV !== "production") {
    // dev에서는 after()가 실행되지 않는 경우가 있어 즉시 트리거한다.
    void runAnalysisProcessAfterResponse(jobId, session.access_token);
  } else {
    after(() => {
      void runAnalysisProcessAfterResponse(jobId, session.access_token);
    });
  }

  return NextResponse.json({
    job_id: jobId,
    status: "pending" as const,
    breakdown,
    required_nat: cost,
    balance,
  });
}
