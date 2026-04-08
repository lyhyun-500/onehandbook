import { createClient } from "@/lib/supabase/server";
import { runHolisticMergeAnalysis } from "@/lib/ai";
import { getProfileConfig } from "@/lib/ai/profileLookup";
import { isProviderConfigured } from "@/lib/ai/availability";
import {
  computeHolisticMergeNatCost,
  countManuscriptChars,
  resolveAnalysisAgentVersion,
  type NatAnalysisOptions,
} from "@/lib/nat";
import { buildHolisticDisplay } from "@/lib/holisticWeightedScore";
import type { HolisticAnalysisResult } from "@/lib/ai/types";
import type { HolisticChunkPayload } from "@/lib/ai/holisticMergePrompts";
import { NextResponse } from "next/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { md5Hex } from "@/lib/contentHash";
import { isMissingHolisticChunkResultsTableError } from "@/lib/db/holisticChunkResultsTable";
import {
  deleteHolisticSyncedAnalysisRunIds,
  syncPerEpisodeAnalysisFromHolisticRun,
} from "@/lib/analysis/syncPerEpisodeAnalysisFromHolisticRun";
import { computeWorkAnalysisContextHash } from "@/lib/analysis/workAnalysisContextHash";
import {
  holisticEpisodeScoreCoverage,
  logHolisticPipeline,
} from "@/lib/analysis/holisticPipelineLog";

type ConsumeNatRpcResult = {
  ok?: boolean;
  error?: string;
  balance?: number;
  required?: number;
};

function parseNatOptions(body: Record<string, unknown>): NatAnalysisOptions {
  const includeLore = body.includeLore !== false;
  const includePlatformOptimization = body.includePlatformOptimization !== false;
  return { includeLore, includePlatformOptimization };
}

type ChunkBody = {
  episodeIds: number[];
  result: HolisticAnalysisResult;
};

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

  const workIdRaw = body.workId;
  const workId =
    typeof workIdRaw === "number"
      ? workIdRaw
      : parseInt(String(workIdRaw ?? ""), 10);
  if (Number.isNaN(workId)) {
    return NextResponse.json({ error: "workId가 필요합니다." }, { status: 400 });
  }

  const orderedRaw = body.orderedEpisodeIds;
  if (!Array.isArray(orderedRaw) || orderedRaw.length === 0) {
    return NextResponse.json(
      { error: "orderedEpisodeIds 배열이 필요합니다." },
      { status: 400 }
    );
  }

  const orderedEpisodeIds = orderedRaw
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n) => !Number.isNaN(n));

  const useDbSession =
    body.source === "db_session" &&
    typeof body.sessionId === "string" &&
    typeof body.jobId === "string";

  const chunksRaw = body.chunks;

  if (!useDbSession) {
    if (!Array.isArray(chunksRaw) || chunksRaw.length === 0) {
      return NextResponse.json(
        { error: "chunks 배열이 필요합니다." },
        { status: 400 }
      );
    }
  }

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

  const { data: work, error: wErr } = await supabase
    .from("works")
    .select("id, genre, title, tags, author_id, world_setting, character_settings")
    .eq("id", workId)
    .single();

  if (wErr || !work || work.author_id !== appUser.id) {
    return NextResponse.json({ error: "이 작품을 수정할 권한이 없습니다." }, { status: 403 });
  }

  const orderedSet = new Set(orderedEpisodeIds);
  const seenInChunks = new Set<number>();
  const parsedChunks: ChunkBody[] = [];

  let sessionIdForCleanup: string | null = null;
  let jobIdForUpdate: string | null = null;
  let jobPayloadBase: Record<string, unknown> | null = null;

  if (useDbSession) {
    const sessionId = body.sessionId as string;
    const jobId = body.jobId as string;
    sessionIdForCleanup = sessionId;
    jobIdForUpdate = jobId;

    const { data: job, error: jErr } = await supabase
      .from("analysis_jobs")
      .select("id, app_user_id, status, payload")
      .eq("id", jobId)
      .single();

    if (jErr || !job) {
      return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
    }
    if (job.app_user_id !== appUser.id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    if (job.status !== "processing") {
      return NextResponse.json(
        { error: "병합할 수 있는 진행 중 작업이 아닙니다." },
        { status: 409 }
      );
    }

    const jp = (job.payload ?? {}) as Record<string, unknown>;
    if (jp.clientChunked !== true || jp.chunkSessionId !== sessionId) {
      return NextResponse.json({ error: "작업 세션 정보가 맞지 않습니다." }, { status: 400 });
    }

    const pv = jp.requestedVersion;
    if (typeof pv === "string" && pv !== requestedVersion) {
      return NextResponse.json(
        { error: "agentVersion이 원래 작업과 일치하지 않습니다." },
        { status: 400 }
      );
    }
    if (jp.includeLore !== opts.includeLore) {
      return NextResponse.json(
        { error: "includeLore 옵션이 원래 작업과 일치하지 않습니다." },
        { status: 400 }
      );
    }
    if (jp.includePlatformOptimization !== opts.includePlatformOptimization) {
      return NextResponse.json(
        { error: "includePlatformOptimization 옵션이 원래 작업과 일치하지 않습니다." },
        { status: 400 }
      );
    }

    const plan = jp.chunkPlan as unknown;
    const chunkTotal =
      typeof jp.chunkTotal === "number" && !Number.isNaN(jp.chunkTotal)
        ? jp.chunkTotal
        : Array.isArray(plan)
          ? plan.length
          : 0;

    if (chunkTotal < 2) {
      return NextResponse.json(
        { error: "DB 세션 병합은 2개 이상의 청크가 필요합니다." },
        { status: 400 }
      );
    }

    const { data: rows, error: rErr } = await supabase
      .from("holistic_chunk_results")
      .select("chunk_index, episode_ids, result_json")
      .eq("session_id", sessionId)
      .order("chunk_index", { ascending: true });

    if (rErr) {
      if (isMissingHolisticChunkResultsTableError(rErr)) {
        return NextResponse.json(
          {
            error:
              "holistic_chunk_results 테이블이 없습니다. 마이그레이션을 적용해 주세요.",
            code: "MIGRATION_REQUIRED" as const,
          },
          { status: 503 }
        );
      }
      console.error(rErr);
      return NextResponse.json(
        { error: "청크 결과를 불러오지 못했습니다." },
        { status: 500 }
      );
    }

    if (!rows || rows.length !== chunkTotal) {
      return NextResponse.json(
        {
          error: `저장된 청크가 부족합니다. (${rows?.length ?? 0}/${chunkTotal})`,
        },
        { status: 400 }
      );
    }

    jobPayloadBase = jp;

    for (const row of rows) {
      const ids = Array.isArray(row.episode_ids)
        ? row.episode_ids.map((x) => Number(x)).filter((n) => !Number.isNaN(n))
        : [];
      const res = row.result_json;
      if (ids.length === 0 || !res || typeof res !== "object") {
        return NextResponse.json(
          { error: "청크 결과 형식이 잘못되었습니다." },
          { status: 500 }
        );
      }
      if (ids.length > 10) {
        return NextResponse.json(
          { error: "저장된 청크의 회차 수가 올바르지 않습니다." },
          { status: 500 }
        );
      }
      for (const id of ids) {
        if (!orderedSet.has(id)) {
          return NextResponse.json(
            { error: "청크 회차가 orderedEpisodeIds와 맞지 않습니다." },
            { status: 400 }
          );
        }
        if (seenInChunks.has(id)) {
          return NextResponse.json(
            { error: "회차가 청크 간 중복되었습니다." },
            { status: 400 }
          );
        }
        seenInChunks.add(id);
      }
      parsedChunks.push({
        episodeIds: ids,
        result: res as HolisticAnalysisResult,
      });
    }
  } else {
    for (const c of chunksRaw as unknown[]) {
      if (!c || typeof c !== "object") continue;
      const o = c as Record<string, unknown>;
      const ids = o.episodeIds;
      const res = o.result;
      if (!Array.isArray(ids) || !res || typeof res !== "object") continue;
      const episodeIds = ids
        .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
        .filter((n) => !Number.isNaN(n));
      if (episodeIds.length === 0 || episodeIds.length > 10) {
        return NextResponse.json(
          { error: "각 chunk의 episodeIds는 1~10개여야 합니다." },
          { status: 400 }
        );
      }
      for (const id of episodeIds) {
        if (!orderedSet.has(id)) {
          return NextResponse.json(
            { error: "chunk episodeIds가 orderedEpisodeIds와 맞지 않습니다." },
            { status: 400 }
          );
        }
        if (seenInChunks.has(id)) {
          return NextResponse.json(
            { error: "회차가 chunk 간 중복되었습니다." },
            { status: 400 }
          );
        }
        seenInChunks.add(id);
      }
      parsedChunks.push({
        episodeIds,
        result: res as HolisticAnalysisResult,
      });
    }
  }

  if (parsedChunks.length < 2) {
    return NextResponse.json(
      {
        error:
          "병합은 10화를 초과하는 선택(배치 2회 이상)일 때만 사용합니다. 10화 이하는 통합 분석 한 번으로 처리하세요.",
      },
      { status: 400 }
    );
  }

  if (seenInChunks.size !== orderedEpisodeIds.length) {
    return NextResponse.json(
      { error: "chunks가 orderedEpisodeIds 전체를 덮지 않습니다." },
      { status: 400 }
    );
  }

  const { data: epRows } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content")
    .eq("work_id", work.id)
    .in("id", orderedEpisodeIds);

  if (!epRows || epRows.length !== orderedEpisodeIds.length) {
    return NextResponse.json(
      { error: "회차 데이터를 불러오지 못했습니다." },
      { status: 400 }
    );
  }

  const byId = new Map(
    epRows.map((e) => {
      const id = Number(e.id);
      return [id, { ...e, id } as (typeof epRows)[number] & { id: number }];
    })
  );
  const orderedEps: (typeof epRows)[number][] = [];
  for (const id of orderedEpisodeIds) {
    const row = byId.get(Number(id));
    if (!row) {
      return NextResponse.json(
        { error: "회차 데이터를 불러오지 못했습니다." },
        { status: 400 }
      );
    }
    orderedEps.push(row);
  }

  parsedChunks.sort((a, b) => {
    const amin = Math.min(
      ...a.episodeIds.map((id) => byId.get(Number(id))!.episode_number)
    );
    const bmin = Math.min(
      ...b.episodeIds.map((id) => byId.get(Number(id))!.episode_number)
    );
    return amin - bmin;
  });

  const mergeCost = computeHolisticMergeNatCost();
  const balance = appUser.nat_balance ?? 0;
  if (balance < mergeCost) {
    return NextResponse.json(
      {
        error: `NAT가 부족합니다. 병합에는 ${mergeCost} NAT가 필요합니다.`,
        code: "INSUFFICIENT_NAT" as const,
        required: mergeCost,
        balance,
      },
      { status: 402 }
    );
  }

  if (!isProviderConfigured(profile.provider)) {
    return NextResponse.json(
      {
        error: `${profile.label}에 필요한 API 키가 설정되어 있지 않습니다.`,
      },
      { status: 400 }
    );
  }

  if (useDbSession && jobIdForUpdate && jobPayloadBase) {
    await supabase
      .from("analysis_jobs")
      .update({
        progress_phase: "report_writing",
        payload: { ...jobPayloadBase, progressPercent: 90 },
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobIdForUpdate);
  }

  const mergePayloads: HolisticChunkPayload[] = parsedChunks.map((ch, i) => {
    const nums = ch.episodeIds
      .map((id) => byId.get(Number(id))?.episode_number)
      .filter((n): n is number => typeof n === "number");
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    const rangeLabel = lo === hi ? `${lo}화` : `${lo}~${hi}화`;
    return {
      chunkIndex: i,
      rangeLabel,
      result: ch.result,
    };
  });

  const episodeWeights = orderedEps.map((e) => ({
    episode_number: e.episode_number,
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  try {
    const { result: rawMerged, version } = await runHolisticMergeAnalysis(
      work.genre ?? "",
      mergePayloads,
      episodeWeights,
      effectiveVersion,
      work.title ?? "",
      Array.isArray(work.tags) ? work.tags : undefined
    );

    logHolisticPipeline(
      "merge_route_model_result",
      {
        workId: work.id,
        analysisJobId: jobIdForUpdate ?? null,
        orderedEpisodeIds,
        parsedChunkCount: parsedChunks.length,
        ...holisticEpisodeScoreCoverage(
          orderedEps.map((e) => e.episode_number),
          rawMerged
        ),
      },
      {
        supabase,
        appUserId: appUser.id,
        workId: work.id,
        analysisJobId: jobIdForUpdate,
        holisticRunId: null,
      }
    );

    const orderedForWeight = orderedEps.map((e) => ({
      episode_number: e.episode_number,
      title: e.title ?? "",
      charCount: countManuscriptChars(e.content ?? ""),
    }));

    const { weightedOverall } = buildHolisticDisplay(rawMerged, orderedForWeight);

    const result: HolisticAnalysisResult = {
      ...rawMerged,
      overall_score: weightedOverall,
    };

    const contents = orderedEps.map((e) => e.content ?? "");
    const contentHash = md5Hex(
      `${orderedEpisodeIds.join("|")}|merge|${effectiveVersion}|${opts.includeLore}|${opts.includePlatformOptimization}|${contents.join("||")}`
    );

    const optionsRecord = {
      includeLore: opts.includeLore,
      includePlatformOptimization: opts.includePlatformOptimization,
      requested_agent: requestedVersion,
      effective_agent: effectiveVersion,
      merged_from_chunks: parsedChunks.length,
      episode_ids: orderedEpisodeIds,
    };

    const { data: row, error: insErr } = await supabase
      .from("holistic_analysis_runs")
      .insert({
        work_id: work.id,
        episode_ids: orderedEpisodeIds,
        agent_version: version.id,
        result_json: result,
        nat_cost: mergeCost,
        options_json: optionsRecord,
        content_hash: contentHash,
      })
      .select(
        "id, work_id, episode_ids, agent_version, result_json, nat_cost, created_at"
      )
      .single();

    if (insErr) {
      console.error(insErr);
      return NextResponse.json(
        { error: insErr.message ?? "저장에 실패했습니다." },
        { status: 500 }
      );
    }

    const markMergeJobFailed = async (message: string) => {
      if (useDbSession && jobIdForUpdate) {
        await supabase
          .from("analysis_jobs")
          .update({
            status: "failed",
            error_message: message.slice(0, 500),
            progress_phase: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobIdForUpdate)
          .eq("status", "processing");
      }
    };

    let syncedRunIds: number[] = [];
    try {
      syncedRunIds = await syncPerEpisodeAnalysisFromHolisticRun(supabase, {
        workId: work.id,
        holisticRunId: row.id,
        agentVersion: version.id,
        holisticResult: result,
        episodes: orderedEps,
        optionsJson: optionsRecord,
        workContextHash: computeWorkAnalysisContextHash(work, opts.includeLore),
        pipelineDbLog: {
          supabase,
          appUserId: appUser.id,
          analysisJobId: jobIdForUpdate,
        },
      });
    } catch (syncErr) {
      console.error("holistic merge route: 회차 동기화 실패", syncErr);
      await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
      const msg =
        syncErr instanceof Error
          ? syncErr.message
          : "통합 분석 회차 반영에 실패했습니다.";
      await markMergeJobFailed(msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_nat", {
      p_amount: mergeCost,
      p_ref_type: "holistic_analysis_run",
      p_ref_id: row.id,
      p_metadata: {
        work_id: work.id,
        merged: true,
        episode_ids: orderedEpisodeIds,
      },
    });

    if (rpcErr) {
      console.error(rpcErr);
      await deleteHolisticSyncedAnalysisRunIds(supabase, syncedRunIds);
      await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
      await markMergeJobFailed("NAT 차감에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      return NextResponse.json(
        { error: "NAT 차감에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 }
      );
    }

    const rpc = rpcData as ConsumeNatRpcResult;
    if (!rpc?.ok) {
      await deleteHolisticSyncedAnalysisRunIds(supabase, syncedRunIds);
      await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
      await markMergeJobFailed(
        `NAT가 부족합니다. 병합에는 ${mergeCost} NAT가 필요합니다.`
      );
      return NextResponse.json(
        {
          error: `NAT가 부족합니다. 병합에는 ${mergeCost} NAT가 필요합니다.`,
          code: "INSUFFICIENT_NAT" as const,
          required: mergeCost,
          balance: rpc?.balance ?? balance,
        },
        { status: 402 }
      );
    }

    if (
      useDbSession &&
      sessionIdForCleanup &&
      jobIdForUpdate &&
      jobPayloadBase
    ) {
      await supabase
        .from("holistic_chunk_results")
        .delete()
        .eq("session_id", sessionIdForCleanup);

      const jobDonePatch = {
        status: "completed" as const,
        holistic_run_id: row.id,
        progress_phase: null,
        error_message: null as string | null,
        payload: {
          ...jobPayloadBase,
          progressPercent: 100,
        },
        updated_at: new Date().toISOString(),
      };

      const { data: jobUp } = await supabase
        .from("analysis_jobs")
        .update(jobDonePatch)
        .eq("id", jobIdForUpdate)
        .eq("status", "processing")
        .select("id");

      if (!jobUp?.length) {
        const { data: jobUp2 } = await supabase
          .from("analysis_jobs")
          .update(jobDonePatch)
          .eq("id", jobIdForUpdate)
          .in("status", ["pending", "processing"])
          .select("id");
        if (!jobUp2?.length) {
          const { data: jobUp3 } = await supabase
            .from("analysis_jobs")
            .update(jobDonePatch)
            .eq("id", jobIdForUpdate)
            .eq("status", "completed")
            .is("holistic_run_id", null)
            .select("id");
          if (!jobUp3?.length) {
            console.warn(
              "[holistic-merge] analysis_jobs 완료 갱신이 한 번도 매칭되지 않음",
              { jobId: jobIdForUpdate, holisticRunId: row.id }
            );
          }
        }
      }
    }

    return NextResponse.json({
      holistic: row,
      nat: { spent: mergeCost, balance: rpc.balance },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "병합 분석에 실패했습니다.";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
