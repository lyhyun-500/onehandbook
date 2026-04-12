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
import { serializeAnalysisFeedback } from "@/lib/analysisResultCache";
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

/**
 * 일괄(holistic) 분석에 포함: 단일 회차 분석과 동일한 LLM·저장 경로이나 NAT 차감 없음(부모 일괄 비용에 포함).
 * 완료 후 `analysis_jobs` episode 행을 `parent_job_id`로 부모와 연결합니다.
 */
export async function runEpisodeAnalysisBundledInHolistic(
  supabase: SupabaseClient,
  params: {
    episodeId: number;
    appUser: AppUser;
    force: boolean;
    requestedVersion: string;
    opts: NatAnalysisOptions;
    parentJobId: string;
  }
): Promise<{ analysisRunId: number; childJobId: string }> {
  const { episodeId, appUser, force, requestedVersion, opts, parentJobId } =
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

  const notionalCost = computeNatCost(charCount, opts);
  void buildNatBreakdown(charCount, opts);

  const currentHash = md5Hex(episode.content);
  const workContextHash = computeWorkAnalysisContextHash(work, opts.includeLore);

  if (!isProviderConfigured(profile.provider)) {
    throw new Error(
      `${profile.label}에 필요한 API 키가 설정되어 있지 않습니다.`
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
    const err = new Error(
      "변경된 사항이 없습니다. 그래도 분석하려면 확인 후 다시 요청해 주세요."
    );
    (err as Error & { code?: string }).code = "CONTENT_UNCHANGED";
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
  try {
    const out = await runAnalysis(
      {
        manuscript: episode.content,
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
  } catch (e) {
    if (e instanceof AnalysisProviderExhaustedError) {
      throw e;
    }
    const message = e instanceof Error ? e.message : "분석에 실패했습니다.";
    throw new Error(message);
  }

  const optionsRecord = {
    includeLore: opts.includeLore,
    includePlatformOptimization: opts.includePlatformOptimization,
    requested_agent: requestedVersion,
    effective_agent: effectiveVersion,
    char_count: charCount,
    bundled_in_holistic_batch: true,
    parent_analysis_job_id: parentJobId,
    notional_nat_if_standalone: notionalCost,
  };

  const { data: row, error: insErr } = await supabase
    .from("analysis_runs")
    .insert({
      episode_id: episode.id,
      work_id: work.id,
      agent_version: version.id,
      result_json: result,
      nat_cost: 0,
      options_json: optionsRecord,
    })
    .select("id, episode_id, work_id, agent_version, result_json, created_at")
    .single();

  if (insErr || !row) {
    console.error(insErr);
    throw new Error(insErr?.message ?? "저장에 실패했습니다.");
  }

  const analyzedAt = new Date().toISOString();
  const { error: cacheErr } = await insertAnalysisResultSnapshot(supabase, {
    work_id: work.id,
    episode_id: episode.id,
    analysis_run_id: row.id,
    score: result.overall_score,
    feedback: serializeAnalysisFeedback(result),
    nat_consumed: 0,
    content_hash: currentHash,
    work_context_hash: workContextHash,
    analyzed_at: analyzedAt,
  });
  if (cacheErr) {
    console.error("analysis_results (번들 이 화) 캐시 저장 실패:", cacheErr.message);
  }

  const { error: epHashErr } = await supabase
    .from("episodes")
    .update({ content_hash: currentHash })
    .eq("id", episode.id);
  if (epHashErr) {
    console.warn("episodes content_hash (번들 이 화) 실패:", epHashErr.message);
  }

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
        bundled_in_holistic_batch: true,
        parent_analysis_job_id: parentJobId,
        rag: {
          block: trendsContextBlock,
          references: trendsReferences,
        },
      },
    });
  } catch (e) {
    console.warn("training_logs 저장 실패(무시):", e);
  }

  const now = new Date().toISOString();
  const payload = {
    requestedVersion,
    includeLore: opts.includeLore,
    includePlatformOptimization: opts.includePlatformOptimization,
    bundledInHolisticBatch: true,
    parentJobId,
    estimatedSeconds: 75,
  };

  const { data: jobIns, error: jobErr } = await supabase
    .from("analysis_jobs")
    .insert({
      app_user_id: appUser.id,
      episode_id: episode.id,
      work_id: work.id,
      job_kind: "episode",
      status: "completed",
      parent_job_id: parentJobId,
      analysis_run_id: row.id,
      payload,
      progress_phase: null,
      error_message: null,
      holistic_run_id: null,
      updated_at: now,
      created_at: now,
    })
    .select("id")
    .single();

  if (jobErr || !jobIns?.id) {
    await supabase.from("analysis_runs").delete().eq("id", row.id);
    throw new Error(
      jobErr?.message ?? "일괄 산하 이 화 분석 작업 행을 저장하지 못했습니다."
    );
  }

  return { analysisRunId: row.id, childJobId: String(jobIns.id) };
}

/**
 * 일괄 분석에 포함된 회차마다 이 화 분석을 수행. 중간 실패 시 이번 단계에서 만든 run·job 행을 롤백합니다.
 */
export async function runBundledEpisodesForHolisticSelection(
  supabase: SupabaseClient,
  appUser: AppUser,
  orderedEpisodes: Array<{ id: number }>,
  requestedVersion: string,
  opts: NatAnalysisOptions,
  parentJobId: string,
  force: boolean
): Promise<void> {
  const insertedRunIds: number[] = [];
  const insertedChildJobIds: string[] = [];
  try {
    for (const ep of orderedEpisodes) {
      const r = await runEpisodeAnalysisBundledInHolistic(supabase, {
        episodeId: ep.id,
        appUser,
        force,
        requestedVersion,
        opts,
        parentJobId,
      });
      insertedRunIds.push(r.analysisRunId);
      insertedChildJobIds.push(r.childJobId);
    }
  } catch (e) {
    for (const id of [...insertedRunIds].reverse()) {
      await supabase.from("analysis_runs").delete().eq("id", id);
    }
    for (const jid of insertedChildJobIds) {
      await supabase.from("analysis_jobs").delete().eq("id", jid);
    }
    throw e;
  }
}
