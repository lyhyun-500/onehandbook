import type { SupabaseClient } from "@supabase/supabase-js";
import { runHolisticAnalysis, runHolisticMergeAnalysis } from "@/lib/ai";
import { getProfileConfig } from "@/lib/ai/profileLookup";
import type { AnalysisCharacterSetting, AnalysisWorldSetting } from "@/lib/ai/types";
import type { HolisticAnalysisResult } from "@/lib/ai/types";
import type { HolisticChunkPayload } from "@/lib/ai/holisticMergePrompts";
import { isProviderConfigured } from "@/lib/ai/availability";
import {
  computeHolisticMergeNatCost,
  computeHolisticChunkNatCost,
  computeHolisticNatCost,
  countManuscriptChars,
  resolveAnalysisAgentVersion,
  type NatAnalysisOptions,
} from "@/lib/nat";
import { buildHolisticDisplay } from "@/lib/holisticWeightedScore";
import {
  normalizeCharacterSettings,
  normalizeWorldSetting,
} from "@/lib/works/loreTypes";
import { MANUSCRIPT_TOO_SHORT_MESSAGE, MIN_ANALYSIS_CHARS } from "@/lib/manuscriptEligibility";
import { md5Hex } from "@/lib/contentHash";
import type { AppUser } from "@/lib/supabase/appUser";
import { syncAppUser } from "@/lib/supabase/appUser";
import { AnalysisProviderExhaustedError } from "@/lib/analysis/analysisErrors";
import { HOLISTIC_CLIENT_CHUNK_SIZE } from "@/lib/analysis/holisticEpisodeChunks";
import { runBundledEpisodesForHolisticSelection } from "@/lib/analysis/runEpisodeAnalysisBundledInHolistic";
import {
  holisticEpisodeScoreCoverage,
  logHolisticPipeline,
  type HolisticPipelineDbLogInput,
} from "@/lib/analysis/holisticPipelineLog";
import { insertTrainingLogPair } from "@/lib/training/trainingLogs";

function buildHolisticReportMarkdown(args: {
  workTitle: string | null;
  genre: string | null;
  orderedEpisodeIds: number[];
  result: HolisticAnalysisResult;
}): string {
  const { workTitle, genre, orderedEpisodeIds, result } = args;
  const lines: string[] = [];
  lines.push(`# 통합 분석 리포트`);
  if (workTitle) lines.push(`- 작품: ${workTitle}`);
  if (genre) lines.push(`- 장르: ${genre}`);
  lines.push(`- 대상 회차 수: ${orderedEpisodeIds.length}`);
  lines.push(`- 종합 점수: ${result.overall_score} / 100`);
  lines.push("");

  lines.push("## Executive Summary");
  lines.push(result.executive_summary?.trim() || "(요약 없음)");
  lines.push("");

  if (Array.isArray(result.episode_scores) && result.episode_scores.length > 0) {
    lines.push("## 회차별 점수");
    for (const s of result.episode_scores.slice(0, 200)) {
      const t = s.episode_title ? ` — ${s.episode_title}` : "";
      lines.push(`- ${s.episode_number}화${t}: ${s.score}`);
    }
    lines.push("");
  }

  lines.push("## 항목별 점수/코멘트");
  for (const [k, v] of Object.entries(result.dimensions ?? {})) {
    lines.push(`### ${k} (${v.score}/100)`);
    lines.push(String(v.comment ?? "").trim() || "(코멘트 없음)");
    lines.push("");
  }

  if (Array.isArray(result.strengths) && result.strengths.length > 0) {
    lines.push("## 강점");
    for (const s of result.strengths.slice(0, 200)) lines.push(`- ${s}`);
    lines.push("");
  }

  if (Array.isArray(result.improvements) && result.improvements.length > 0) {
    lines.push("## 개선 포인트");
    for (const s of result.improvements.slice(0, 200)) lines.push(`- ${s}`);
    lines.push("");
  }

  if (result.tag_trend_fit) {
    lines.push("## 트렌드 적합도/차별화");
    lines.push(`- 적합도: ${result.tag_trend_fit.alignment}`);
    lines.push(`- 차별화: ${result.tag_trend_fit.differentiation}`);
    if (Array.isArray(result.tag_trend_fit.suggested_trend_tags)) {
      lines.push(
        `- 추천 태그: ${result.tag_trend_fit.suggested_trend_tags.join(", ")}`
      );
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function holisticPipelineDbCtx(
  base: HolisticPipelineDbLogInput | undefined,
  workId: number,
  holisticRunId?: number | null
) {
  if (!base) return undefined;
  return {
    supabase: base.supabase,
    appUserId: base.appUserId,
    workId,
    analysisJobId: base.analysisJobId ?? null,
    holisticRunId: holisticRunId ?? null,
  };
}

type ConsumeNatRpcResult = {
  ok?: boolean;
  error?: string;
  balance?: number;
  required?: number;
};

function holisticContentHash(
  orderedIds: number[],
  contents: string[],
  opts: NatAnalysisOptions,
  effectiveAgent: string
): string {
  const body = orderedIds
    .map((id, i) => `${id}:${md5Hex(contents[i] ?? "")}`)
    .join("|");
  return md5Hex(
    `${body}|${effectiveAgent}|${opts.includeLore}|${opts.includePlatformOptimization}`
  );
}

type EpRow = {
  id: number;
  episode_number: number;
  title: string | null;
  content: string | null;
};

export type HolisticBatchWorkerResult = {
  holisticRow: {
    id: number;
    work_id: number;
    episode_ids: number[];
    agent_version: string;
    result_json: HolisticAnalysisResult;
    nat_cost: number;
    created_at: string;
  };
  totalNatSpent: number;
};

/**
 * 통합 분석 본 실행(10화 이하 1회 / 초과 시 청크+병합). NAT는 구간별로 차감됩니다.
 */
export async function runHolisticBatchPipeline(
  supabase: SupabaseClient,
  appUser: AppUser,
  params: {
    workId: number;
    orderedEpisodeIds: number[];
    requestedVersion: string;
    opts: NatAnalysisOptions;
    onPhase: (phase: "ai_analyzing" | "report_writing") => Promise<void>;
    /** 비동기 잡 등에서 Supabase에 진단 행 적재 */
    pipelineDbLog?: HolisticPipelineDbLogInput;
    /** 통합 분석 부모 `analysis_jobs.id` — 회차별 번들 이 화 분석·자식 job 연결 */
    parentAnalysisJobId: string;
    /** 부모 job payload.force — 원고 미변경 시에도 회차별 분석 시도 */
    holisticForce: boolean;
  }
): Promise<HolisticBatchWorkerResult> {
  const {
    workId,
    orderedEpisodeIds: rawEpisodeIds,
    requestedVersion,
    opts,
    onPhase,
    pipelineDbLog,
    parentAnalysisJobId,
    holisticForce,
  } = params;

  const orderedEpisodeIds = rawEpisodeIds.map((x) => Number(x));
  if (orderedEpisodeIds.some((n) => !Number.isFinite(n) || n < 1)) {
    throw new Error("유효하지 않은 회차 id가 포함되어 있습니다.");
  }
  if (new Set(orderedEpisodeIds).size !== orderedEpisodeIds.length) {
    throw new Error("동일 회차가 통합 분석 선택에 중복되었습니다.");
  }

  const effectiveVersion = resolveAnalysisAgentVersion(
    opts.includePlatformOptimization,
    requestedVersion
  );

  const profile = getProfileConfig(effectiveVersion);
  if (!profile) {
    throw new Error("알 수 없는 분석 프로필입니다.");
  }

  if (!isProviderConfigured(profile.provider)) {
    throw new Error(
      `${profile.label}에 필요한 API 키가 설정되어 있지 않습니다.`
    );
  }

  const { data: work, error: wErr } = await supabase
    .from("works")
    .select("id, genre, title, tags, author_id, world_setting, character_settings")
    .eq("id", workId)
    .single();

  if (wErr || !work || work.author_id !== appUser.id) {
    throw new Error("이 작품을 수정할 권한이 없습니다.");
  }

  const { data: epRows, error: epErr } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content")
    .eq("work_id", work.id)
    .in("id", orderedEpisodeIds);

  if (epErr || !epRows || epRows.length !== orderedEpisodeIds.length) {
    throw new Error("선택한 회차를 모두 찾을 수 없거나 작품과 맞지 않습니다.");
  }

  const byId = new Map(
    epRows.map((e) => {
      const id = Number(e.id);
      return [id, { ...(e as EpRow), id } as EpRow];
    })
  );
  const ordered = orderedEpisodeIds.map((id) => {
    const row = byId.get(id);
    if (!row) {
      throw new Error(`선택한 회차(id ${id})를 불러오지 못했습니다.`);
    }
    return row;
  });

  for (const e of ordered) {
    const n = countManuscriptChars(e.content ?? "");
    if (n < MIN_ANALYSIS_CHARS) {
      throw new Error(MANUSCRIPT_TOO_SHORT_MESSAGE);
    }
  }

  const totalCombinedCharsAll = ordered.reduce(
    (s, e) => s + countManuscriptChars(e.content ?? ""),
    0
  );
  const expectedNums = ordered.map((e) => e.episode_number);
  logHolisticPipeline(
    "batch_start",
    {
      workId: work.id,
      orderedEpisodeIds,
      expectedEpisodeNumbers: expectedNums,
      totalCombinedChars: totalCombinedCharsAll,
      path:
        orderedEpisodeIds.length <= HOLISTIC_CLIENT_CHUNK_SIZE
          ? "single_call"
          : "chunk_then_merge",
    },
    holisticPipelineDbCtx(pipelineDbLog, work.id)
  );

  const wLore = normalizeWorldSetting(work.world_setting);
  const world_setting: AnalysisWorldSetting | undefined =
    opts.includeLore && (wLore.background || wLore.era || wLore.rules)
      ? {
          background: wLore.background || undefined,
          era: wLore.era || undefined,
          rules: wLore.rules || undefined,
        }
      : undefined;

  const character_settings: AnalysisCharacterSetting[] = opts.includeLore
    ? normalizeCharacterSettings(work.character_settings).filter((c) =>
        c.name.trim()
      )
    : [];

  const analysisInputBase = {
    manuscript: ordered
      .map((e) => `# ${e.episode_number}화 ${e.title ?? ""}\n\n${e.content ?? ""}`)
      .join("\n\n---\n\n")
      .trim(),
    genre: work.genre ?? "",
    work_title: work.title ?? undefined,
    tags: Array.isArray(work.tags) ? work.tags : undefined,
    world_setting,
    character_settings:
      character_settings.length > 0 ? character_settings : undefined,
  };

  await onPhase("ai_analyzing");

  await runBundledEpisodesForHolisticSelection(
    supabase,
    appUser,
    ordered,
    requestedVersion,
    opts,
    parentAnalysisJobId,
    holisticForce
  );

  if (orderedEpisodeIds.length <= HOLISTIC_CLIENT_CHUNK_SIZE) {
    return finalizeSingleHolisticRun({
      supabase,
      work,
      ordered,
      orderedEpisodeIds,
      requestedVersion,
      effectiveVersion,
      opts,
      analysisInputBase,
      onPhase,
      pipelineDbLog,
    });
  }

  const chunkResults: Array<{ episodeIds: number[]; result: HolisticAnalysisResult }> =
    [];

  let serverChunkIdx = 0;
  for (let i = 0; i < orderedEpisodeIds.length; i += HOLISTIC_CLIENT_CHUNK_SIZE) {
    const chunkIds = orderedEpisodeIds.slice(i, i + HOLISTIC_CLIENT_CHUNK_SIZE);
    const chunkEps = chunkIds.map((id) => byId.get(id)!);
    let lastErr = "배치 분석에 실패했습니다.";
    let ok = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const refreshed = await syncAppUser(supabase);
        if (!refreshed) throw new Error("사용자 정보를 찾을 수 없습니다.");

        const segments = chunkEps.map((e) => ({
          episode_number: e.episode_number,
          title: e.title ?? "",
          content: e.content ?? "",
          charCount: countManuscriptChars(e.content ?? ""),
        }));

        const cost = computeHolisticChunkNatCost(
          chunkEps.length,
          serverChunkIdx,
          opts
        );
        const balance = refreshed.coin_balance ?? 0;
        if (balance < cost) {
          const err = new Error(
            `NAT가 부족합니다. 이번 배치에는 ${cost} NAT가 필요합니다.`
          );
          (err as Error & { code?: string }).code = "INSUFFICIENT_NAT";
          throw err;
        }

        const { result: rawResult, version } = await runHolisticAnalysis(
          analysisInputBase,
          segments,
          effectiveVersion
        );

        const orderedForWeight = chunkEps.map((e) => ({
          episode_number: e.episode_number,
          title: e.title ?? "",
          charCount: countManuscriptChars(e.content ?? ""),
        }));

        const { weightedOverall } = buildHolisticDisplay(rawResult, orderedForWeight);
        const result: HolisticAnalysisResult = {
          ...rawResult,
          overall_score: weightedOverall,
        };

        logHolisticPipeline(
          "chunk_model_result",
          {
            workId: work.id,
            chunkEpisodeIds: chunkIds,
            chunkEpisodeNumbers: chunkEps.map((e) => e.episode_number),
            ...holisticEpisodeScoreCoverage(
              chunkEps.map((e) => e.episode_number),
              rawResult
            ),
            overallScoreAfterWeight: weightedOverall,
          },
          holisticPipelineDbCtx(pipelineDbLog, work.id)
        );

        const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_nat", {
          p_amount: cost,
          p_ref_type: "holistic_batch_chunk",
          p_ref_id: null,
          p_metadata: {
            work_id: work.id,
            episode_ids: chunkIds,
            agent_version: version.id,
          },
        });

        if (rpcErr) {
          console.error(rpcErr);
          throw new Error("NAT 차감에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        }

        const rpc = rpcData as ConsumeNatRpcResult;
        if (!rpc?.ok) {
          const err = new Error(
            `NAT가 부족합니다. 이번 배치에는 ${cost} NAT가 필요합니다.`
          );
          (err as Error & { code?: string }).code = "INSUFFICIENT_NAT";
          throw err;
        }

        chunkResults.push({ episodeIds: chunkIds, result });
        ok = true;
        break;
      } catch (e) {
        if (e instanceof AnalysisProviderExhaustedError) throw e;
        lastErr = e instanceof Error ? e.message : "배치 분석에 실패했습니다.";
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!ok) {
      throw new Error(lastErr);
    }
    serverChunkIdx += 1;
  }

  await onPhase("report_writing");

  const refreshed = await syncAppUser(supabase);
  if (!refreshed) throw new Error("사용자 정보를 찾을 수 없습니다.");

  const mergeCost = computeHolisticMergeNatCost();
  const balance = refreshed.coin_balance ?? 0;
  if (balance < mergeCost) {
    const err = new Error(`NAT가 부족합니다. 병합에는 ${mergeCost} NAT가 필요합니다.`);
    (err as Error & { code?: string }).code = "INSUFFICIENT_NAT";
    throw err;
  }

  parsedChunksSort(chunkResults, byId);

  const mergePayloads: HolisticChunkPayload[] = chunkResults.map((ch, idx) => {
    const nums = ch.episodeIds
      .map((id) => byId.get(id)?.episode_number)
      .filter((n): n is number => typeof n === "number");
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    const rangeLabel = lo === hi ? `${lo}화` : `${lo}~${hi}화`;
    return {
      chunkIndex: idx,
      rangeLabel,
      result: ch.result,
    };
  });

  const episodeWeights = ordered.map((e) => ({
    episode_number: e.episode_number,
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  const { result: rawMerged, version, trendsContextBlock, trendsReferences } =
    await runHolisticMergeAnalysis(
    work.genre ?? "",
    mergePayloads,
    episodeWeights,
    effectiveVersion,
    work.title ?? "",
    Array.isArray(work.tags) ? work.tags : undefined
  );

  const orderedForWeight = ordered.map((e) => ({
    episode_number: e.episode_number,
    title: e.title ?? "",
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  const { weightedOverall } = buildHolisticDisplay(rawMerged, orderedForWeight);
  const result: HolisticAnalysisResult = {
    ...rawMerged,
    overall_score: weightedOverall,
  };

  logHolisticPipeline(
    "merge_model_result",
    {
      workId: work.id,
      orderedEpisodeIds,
      chunkCount: chunkResults.length,
      ...holisticEpisodeScoreCoverage(expectedNums, rawMerged),
      overallScoreAfterWeight: weightedOverall,
    },
    holisticPipelineDbCtx(pipelineDbLog, work.id)
  );

  const contents = ordered.map((e) => e.content ?? "");
  const contentHash = md5Hex(
    `${orderedEpisodeIds.join("|")}|merge|${effectiveVersion}|${opts.includeLore}|${opts.includePlatformOptimization}|${contents.join("||")}`
  );

  const optionsRecord = {
    includeLore: opts.includeLore,
    includePlatformOptimization: opts.includePlatformOptimization,
    requested_agent: requestedVersion,
    effective_agent: effectiveVersion,
    merged_from_chunks: chunkResults.length,
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
    throw new Error(insErr.message ?? "저장에 실패했습니다.");
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
    await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
    throw new Error("NAT 차감에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const rpc = rpcData as ConsumeNatRpcResult;
  if (!rpc?.ok) {
    await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
    const err = new Error(`NAT가 부족합니다. 병합에는 ${mergeCost} NAT가 필요합니다.`);
    (err as Error & { code?: string }).code = "INSUFFICIENT_NAT";
    throw err;
  }

  // 최종 통합 리포트 저장(best-effort): reports 테이블
  try {
    const reportBody = buildHolisticReportMarkdown({
      workTitle: work.title ?? null,
      genre: work.genre ?? null,
      orderedEpisodeIds,
      result,
    });
    await supabase.from("reports").insert({
      app_user_id: work.author_id,
      work_id: work.id,
      holistic_run_id: row.id,
      title: `${work.title ?? "작품"} · 통합 분석 리포트`,
      body: reportBody,
      result_json: result,
      rag_context: { block: trendsContextBlock, references: trendsReferences },
    });
  } catch (e) {
    console.warn("reports 저장 실패(무시):", e);
  }

  // 최종 통합 리포트 저장(best-effort): reports 테이블
  try {
    const reportBody = buildHolisticReportMarkdown({
      workTitle: work.title ?? null,
      genre: work.genre ?? null,
      orderedEpisodeIds,
      result,
    });
    await supabase.from("reports").insert({
      app_user_id: work.author_id,
      work_id: work.id,
      holistic_run_id: row.id,
      title: `${work.title ?? "작품"} · 통합 분석 리포트`,
      body: reportBody,
      result_json: result,
      rag_context: { block: trendsContextBlock, references: trendsReferences },
    });
  } catch (e) {
    console.warn("reports 저장 실패(무시):", e);
  }

  // 파인튜닝/학습 데이터용 로그(best-effort): [원고 + RAG + 최종 답변]
  try {
    const MAX = 200_000;
    const manuscript = analysisInputBase.manuscript.slice(0, MAX);
    await insertTrainingLogPair(supabase, work.author_id, {
      userMessage: manuscript,
      assistantMessage: JSON.stringify(result).slice(0, MAX),
      context: {
        kind: "holistic_analysis",
        work_id: work.id,
        holistic_run_id: row.id,
        episode_ids: orderedEpisodeIds,
        agent_version: version.id,
        rag: { block: trendsContextBlock, references: trendsReferences },
      },
    });
  } catch (e) {
    console.warn("training_logs 저장 실패(무시):", e);
  }

  let totalNatSpent = mergeCost;
  chunkResults.forEach((ch, idx) => {
    const c = computeHolisticChunkNatCost(ch.episodeIds.length, idx, opts);
    totalNatSpent += c;
  });

  return {
    holisticRow: row as HolisticBatchWorkerResult["holisticRow"],
    totalNatSpent,
  };
}

function parsedChunksSort(
  chunks: Array<{ episodeIds: number[]; result: HolisticAnalysisResult }>,
  byId: Map<number, EpRow>
) {
  chunks.sort((a, b) => {
    const amin = Math.min(
      ...a.episodeIds.map((id) => byId.get(id)!.episode_number)
    );
    const bmin = Math.min(
      ...b.episodeIds.map((id) => byId.get(id)!.episode_number)
    );
    return amin - bmin;
  });
}

async function finalizeSingleHolisticRun(args: {
  supabase: SupabaseClient;
  work: {
    id: number;
    genre: string | null;
    title: string | null;
    author_id: number;
    world_setting: unknown;
    character_settings: unknown;
  };
  ordered: EpRow[];
  orderedEpisodeIds: number[];
  requestedVersion: string;
  effectiveVersion: string;
  opts: NatAnalysisOptions;
  analysisInputBase: {
    manuscript: string;
    genre: string;
    work_title: string | undefined;
    world_setting: AnalysisWorldSetting | undefined;
    character_settings: AnalysisCharacterSetting[] | undefined;
  };
  onPhase: (phase: "ai_analyzing" | "report_writing") => Promise<void>;
  pipelineDbLog?: HolisticPipelineDbLogInput;
}): Promise<HolisticBatchWorkerResult> {
  const {
    supabase,
    work,
    ordered,
    orderedEpisodeIds,
    requestedVersion,
    effectiveVersion,
    opts,
    analysisInputBase,
    onPhase,
    pipelineDbLog,
  } = args;

  const segments = ordered.map((e) => ({
    episode_number: e.episode_number,
    title: e.title ?? "",
    content: e.content ?? "",
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  const { result: rawResult, version, trendsContextBlock, trendsReferences } =
    await runHolisticAnalysis(analysisInputBase, segments, effectiveVersion);

  const orderedForWeight = ordered.map((e) => ({
    episode_number: e.episode_number,
    title: e.title ?? "",
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  const { weightedOverall } = buildHolisticDisplay(rawResult, orderedForWeight);
  const result: HolisticAnalysisResult = {
    ...rawResult,
    overall_score: weightedOverall,
  };

  logHolisticPipeline(
    "single_model_result",
    {
      workId: work.id,
      orderedEpisodeIds,
      ...holisticEpisodeScoreCoverage(
        ordered.map((e) => e.episode_number),
        rawResult
      ),
      overallScoreAfterWeight: weightedOverall,
    },
    holisticPipelineDbCtx(pipelineDbLog, work.id)
  );

  await onPhase("report_writing");

  const totalCombinedChars = ordered.reduce(
    (s, e) => s + countManuscriptChars(e.content ?? ""),
    0
  );
  const cost = computeHolisticNatCost(ordered.length, opts);
  const contents = ordered.map((e) => e.content ?? "");
  const contentHash = holisticContentHash(
    orderedEpisodeIds,
    contents,
    opts,
    effectiveVersion
  );

  const optionsRecord = {
    includeLore: opts.includeLore,
    includePlatformOptimization: opts.includePlatformOptimization,
    requested_agent: requestedVersion,
    effective_agent: effectiveVersion,
    total_combined_chars: totalCombinedChars,
    episode_ids: orderedEpisodeIds,
  };

  const { data: row, error: insErr } = await supabase
    .from("holistic_analysis_runs")
    .insert({
      work_id: work.id,
      episode_ids: orderedEpisodeIds,
      agent_version: version.id,
      result_json: result,
      nat_cost: cost,
      options_json: optionsRecord,
      content_hash: contentHash,
    })
    .select(
      "id, work_id, episode_ids, agent_version, result_json, nat_cost, created_at"
    )
    .single();

  if (insErr) {
    console.error(insErr);
    if (insErr.code === "42P01" || insErr.message?.includes("holistic_analysis_runs")) {
      throw new Error(
        "통합 분석 테이블이 아직 준비되지 않았습니다. supabase-migration-holistic-analysis.sql 을 실행해 주세요."
      );
    }
    throw new Error(insErr.message ?? "저장에 실패했습니다.");
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_nat", {
    p_amount: cost,
    p_ref_type: "holistic_analysis_run",
    p_ref_id: row.id,
    p_metadata: {
      work_id: work.id,
      episode_ids: orderedEpisodeIds,
      agent_version: version.id,
    },
  });

  if (rpcErr) {
    console.error(rpcErr);
    await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
    throw new Error("NAT 차감에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const rpc = rpcData as ConsumeNatRpcResult;
  if (!rpc?.ok) {
    await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
    const err = new Error(
      `NAT가 부족합니다. 이번 통합 분석에는 ${cost} NAT가 필요합니다.`
    );
    (err as Error & { code?: string }).code = "INSUFFICIENT_NAT";
    throw err;
  }

  // 파인튜닝/학습 데이터용 로그(best-effort): [원고 + RAG + 최종 답변]
  try {
    const MAX = 200_000;
    const manuscript = analysisInputBase.manuscript.slice(0, MAX);
    await insertTrainingLogPair(supabase, work.author_id, {
      userMessage: manuscript,
      assistantMessage: JSON.stringify(result).slice(0, MAX),
      context: {
        kind: "holistic_analysis",
        work_id: work.id,
        holistic_run_id: row.id,
        episode_ids: orderedEpisodeIds,
        agent_version: version.id,
        rag: { block: trendsContextBlock, references: trendsReferences },
      },
    });
  } catch (e) {
    console.warn("training_logs 저장 실패(무시):", e);
  }

  return {
    holisticRow: row as HolisticBatchWorkerResult["holisticRow"],
    totalNatSpent: cost,
  };
}
