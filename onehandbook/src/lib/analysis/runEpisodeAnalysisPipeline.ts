import type { SupabaseClient } from "@supabase/supabase-js";
import { runAnalysis } from "@/lib/ai";
import { getProfileConfig } from "@/lib/ai/profileLookup";
import { isProviderConfigured } from "@/lib/ai/availability";
import type { AnalysisCharacterSetting, AnalysisWorldSetting } from "@/lib/ai/types";
import {
  normalizeCharacterSettings,
  normalizeWorldSetting,
} from "@/lib/works/loreTypes";
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
import {
  parseAnalysisFeedback,
  serializeAnalysisFeedback,
  type PreviousAnalysisResultPayload,
} from "@/lib/analysisResultCache";
import { md5Hex } from "@/lib/contentHash";
import { buildPreviousEpisodesAnalysisContext } from "@/lib/previousEpisodeContext";
import {
  computeWorkAnalysisContextHash,
  workContextAllowsContentUnchanged,
} from "@/lib/analysis/workAnalysisContextHash";
import {
  fetchLatestAnalysisResultForContentGuard,
  insertAnalysisResultSnapshot,
} from "@/lib/analysis/analysisResultsWorkContextSupport";
import type { AppUser } from "@/lib/supabase/appUser";
import { AnalysisProviderExhaustedError } from "@/lib/analysis/analysisErrors";
import { insertTrainingLogPair } from "@/lib/training/trainingLogs";

type ConsumeNatRpcResult = {
  ok?: boolean;
  error?: string;
  balance?: number;
  required?: number;
};

export type EpisodeAnalysisSuccess = {
  analysis: {
    id: number;
    episode_id: number;
    work_id: number;
    agent_version: string;
    result_json: unknown;
    created_at: string;
  };
  previousResult: PreviousAnalysisResultPayload | null;
  nat: { spent: number; balance: number | undefined };
  breakdown: ReturnType<typeof buildNatBreakdown>;
  cached: false;
  /** Claude provider일 때 usage(input/output tokens) */
  llmUsage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * 캐시 미스·변경 있음일 때만 호출. NAT는 성공 저장 후 consume_nat.
 */
export async function runEpisodeAnalysisPipeline(
  supabase: SupabaseClient,
  params: {
    episodeId: number;
    appUser: AppUser;
    force: boolean;
    requestedVersion: string;
    opts: NatAnalysisOptions;
    analysisJobProgress?: { jobId: string };
  }
): Promise<EpisodeAnalysisSuccess> {
  const { episodeId, appUser, force, requestedVersion, opts, analysisJobProgress } =
    params;

  const effectiveVersion = resolveAnalysisAgentVersion(
    opts.includePlatformOptimization,
    requestedVersion
  );

  const profile = getProfileConfig(effectiveVersion);
  if (!profile) {
    throw new Error("알 수 없는 분석 프로필입니다.");
  }

  const { data: episode, error: epErr } = await supabase
    .from("episodes")
    .select("id, content, work_id, episode_number")
    .eq("id", episodeId)
    .single();

  if (epErr || !episode) {
    throw new Error("회차를 찾을 수 없습니다.");
  }

  const { data: work, error: wErr } = await supabase
    .from("works")
    .select("id, genre, title, tags, author_id, world_setting, character_settings")
    .eq("id", episode.work_id)
    .single();

  if (wErr || !work || work.author_id !== appUser.id) {
    throw new Error("이 작품을 수정할 권한이 없습니다.");
  }

  const charCount = countManuscriptChars(episode.content);
  if (charCount < MIN_ANALYSIS_CHARS) {
    throw new Error(MANUSCRIPT_TOO_SHORT_MESSAGE);
  }

  const cost = computeNatCost(charCount, opts);
  const breakdown = buildNatBreakdown(charCount, opts);
  const currentHash = md5Hex(episode.content);
  const workContextHash = computeWorkAnalysisContextHash(work, opts.includeLore);

  if (!isProviderConfigured(profile.provider)) {
    throw new Error(
      `${profile.label}에 필요한 API 키가 설정되어 있지 않습니다.`
    );
  }

  const balance = appUser.coin_balance ?? 0;
  if (balance < cost) {
    const err = new Error("NAT가 부족합니다.");
    (err as Error & { code?: string }).code = "INSUFFICIENT_NAT";
    (err as Error & { required?: number }).required = cost;
    (err as Error & { balance?: number }).balance = balance;
    throw err;
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
    const err = new Error(
      "변경된 사항이 없습니다. 그래도 분석하려면 확인 후 다시 요청해 주세요."
    );
    (err as Error & { code?: string }).code = "CONTENT_UNCHANGED";
    (err as Error & { contentHash?: string }).contentHash = currentHash;
    throw err;
  }

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

  let previousResult: PreviousAnalysisResultPayload | null = null;
  if (previousRow) {
    previousResult = {
      score: previousRow.score,
      feedback: parseAnalysisFeedback(previousRow.feedback ?? ""),
      nat_consumed: previousRow.nat_consumed,
      created_at: previousRow.created_at,
    };
  }

  const previousEpisodesContext = await buildPreviousEpisodesAnalysisContext(
    supabase,
    work.id,
    episode.id,
    episode.episode_number
  );

  let result;
  let version;
  let trendsContextBlock: string | null = null;
  let trendsReferences: unknown[] = [];
  let llmUsage: { input_tokens?: number; output_tokens?: number } | undefined;
  try {
    const out = await runAnalysis(
      {
        manuscript: episode.content,
        episode_number: episode.episode_number,
        genre: work.genre,
        work_title: work.title ?? undefined,
        tags: Array.isArray(work.tags) ? work.tags : undefined,
        world_setting,
        character_settings:
          character_settings.length > 0 ? character_settings : undefined,
        previous_episodes_context: previousEpisodesContext || undefined,
      },
      effectiveVersion
    );
    result = out.result;
    version = out.version;
    trendsContextBlock = out.trendsContextBlock;
    trendsReferences = out.trendsReferences;
    llmUsage = out.llmUsage;
    if (out.llmUsage && analysisJobProgress?.jobId) {
      const { data: cur } = await supabase
        .from("analysis_jobs")
        .select("payload")
        .eq("id", analysisJobProgress.jobId)
        .maybeSingle();
      const base = (cur?.payload as Record<string, unknown> | null) ?? {};
      await supabase
        .from("analysis_jobs")
        .update({
          payload: {
            ...base,
            llm_usage: {
              provider: "anthropic",
              model: version.model,
              input_tokens: out.llmUsage.input_tokens ?? null,
              output_tokens: out.llmUsage.output_tokens ?? null,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", analysisJobProgress.jobId);
    }
  } catch (e) {
    if (e instanceof AnalysisProviderExhaustedError) {
      throw e;
    }
    const message = e instanceof Error ? e.message : "분석에 실패했습니다.";
    throw new Error(message);
  }

  if (analysisJobProgress?.jobId) {
    await supabase
      .from("analysis_jobs")
      .update({
        progress_phase: "report_writing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisJobProgress.jobId);
  }

  const optionsRecord = {
    includeLore: opts.includeLore,
    includePlatformOptimization: opts.includePlatformOptimization,
    requested_agent: requestedVersion,
    effective_agent: effectiveVersion,
    char_count: charCount,
  };

  let shouldSkipNatConsume = false;
  let skipNatFromHolisticRunId: string | null = null;
  if (analysisJobProgress?.jobId) {
    const { data: cur } = await supabase
      .from("analysis_jobs")
      .select("payload")
      .eq("id", analysisJobProgress.jobId)
      .maybeSingle();

    const payload = (cur?.payload as Record<string, unknown> | null) ?? null;
    const skipRequested = payload?.skip_nat_consume === true;
    const fromHolisticRunId =
      typeof payload?.from_holistic_run_id === "string"
        ? payload.from_holistic_run_id
        : null;

    if (skipRequested && fromHolisticRunId) {
      skipNatFromHolisticRunId = fromHolisticRunId;
      const { data: holisticRun } = await supabase
        .from("holistic_analysis_runs")
        .select("id, work_id")
        .eq("id", fromHolisticRunId)
        .maybeSingle();

      let ownershipOk = false;
      if (holisticRun?.work_id != null) {
        const { data: ownerWork } = await supabase
          .from("works")
          .select("author_id")
          .eq("id", holisticRun.work_id)
          .maybeSingle();
        ownershipOk = ownerWork != null && ownerWork.author_id === appUser.id;
      }

      if (ownershipOk) {
        shouldSkipNatConsume = true;
        console.log(
          "[runEpisodeAnalysisPipeline] NAT consume skipped: post_holistic source",
          {
            jobId: analysisJobProgress.jobId,
            episodeId: episode.id,
            fromHolisticRunId: fromHolisticRunId,
          }
        );
      } else {
        console.warn(
          "[runEpisodeAnalysisPipeline] skip_nat_consume requested but holistic_run ownership check failed. Falling back to normal NAT consume.",
          {
            jobId: analysisJobProgress.jobId,
            fromHolisticRunId: payload?.from_holistic_run_id,
          }
        );
      }
    }
  }

  const { data: row, error: insErr } = await supabase
    .from("analysis_runs")
    .insert({
      episode_id: episode.id,
      work_id: work.id,
      agent_version: version.id,
      result_json: result,
      nat_cost: shouldSkipNatConsume ? 0 : cost,
      options_json: optionsRecord,
    })
    .select("id, episode_id, work_id, agent_version, result_json, created_at")
    .single();

  if (insErr) {
    console.error(insErr);
    throw new Error(insErr.message ?? "저장에 실패했습니다.");
  }

  let rpc: ConsumeNatRpcResult | null = null;
  if (!shouldSkipNatConsume) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_nat", {
      p_amount: cost,
      p_ref_type: "analysis_run",
      p_ref_id: row.id,
      p_metadata: {
        episode_id: episode.id,
        work_id: work.id,
        agent_version: version.id,
      },
    });

    if (rpcErr) {
      console.error(rpcErr);
      await supabase.from("analysis_runs").delete().eq("id", row.id);
      throw new Error("NAT 차감에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }

    rpc = rpcData as ConsumeNatRpcResult;
    if (!rpc?.ok) {
      await supabase.from("analysis_runs").delete().eq("id", row.id);
      const err = new Error(
        `NAT가 부족합니다. 이번 분석에는 ${cost} NAT가 필요합니다.`
      );
      (err as Error & { code?: string }).code = "INSUFFICIENT_NAT";
      (err as Error & { required?: number }).required = rpc?.required ?? cost;
      (err as Error & { balance?: number }).balance = rpc?.balance ?? balance;
      throw err;
    }
  }

  const analyzedAt = new Date().toISOString();
  const { error: cacheErr } = await insertAnalysisResultSnapshot(supabase, {
    work_id: work.id,
    episode_id: episode.id,
    analysis_run_id: row.id,
    score: result.overall_score,
    feedback: serializeAnalysisFeedback(result),
    nat_consumed: shouldSkipNatConsume ? 0 : cost,
    content_hash: currentHash,
    work_context_hash: workContextHash,
    analyzed_at: analyzedAt,
  });
  if (cacheErr) {
    console.error("analysis_results 캐시 저장 실패:", cacheErr.message);
  }

  const { error: epHashErr } = await supabase
    .from("episodes")
    .update({ content_hash: currentHash })
    .eq("id", episode.id);
  if (epHashErr) {
    console.warn("episodes content_hash 반영 실패:", epHashErr.message);
  }

  // 파인튜닝/학습 데이터용 로그: [입력 원고 + 참고한 트렌드(RAG) + AI 답변(결과 JSON)]
  // 실패해도 분석 결과 저장은 막지 않도록 best-effort로 처리합니다.
  try {
    await insertTrainingLogPair(supabase, appUser.id, {
      userMessage: episode.content,
      assistantMessage: JSON.stringify(result),
      context: {
        kind: "episode_analysis",
        work_id: work.id,
        episode_id: episode.id,
        analysis_run_id: row.id,
        agent_version: version.id,
        rag: {
          block: trendsContextBlock,
          references: trendsReferences,
        },
      },
    });
  } catch (e) {
    console.warn("training_logs 저장 실패(무시):", e);
  }

  return {
    analysis: row,
    previousResult,
    nat: {
      spent: shouldSkipNatConsume ? 0 : cost,
      balance: shouldSkipNatConsume ? balance : rpc?.balance,
    },
    breakdown,
    cached: false,
    ...(llmUsage ? { llmUsage } : {}),
  };
}
