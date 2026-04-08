import type { SupabaseClient } from "@supabase/supabase-js";
import { runHolisticAnalysis } from "@/lib/ai";
import { getProfileConfig } from "@/lib/ai/profileLookup";
import type {
  AnalysisCharacterSetting,
  AnalysisWorldSetting,
  HolisticAnalysisResult,
} from "@/lib/ai/types";
import { isProviderConfigured } from "@/lib/ai/availability";
import {
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
import type { AppUser } from "@/lib/supabase/appUser";
import { syncAppUser } from "@/lib/supabase/appUser";
import { AnalysisProviderExhaustedError } from "@/lib/analysis/analysisErrors";
import {
  holisticEpisodeScoreCoverage,
  logHolisticPipeline,
  type HolisticPipelineDbLogInput,
} from "@/lib/analysis/holisticPipelineLog";

type ConsumeNatRpcResult = {
  ok?: boolean;
  error?: string;
  balance?: number;
  required?: number;
};

type EpRow = {
  id: number;
  episode_number: number;
  title: string | null;
  content: string | null;
};

/**
 * 통합 분석 중 10화(이하) 구간 1회 AI 호출 + NAT 차감.
 * (기존 holisticBatchWorker 청크 루프와 동일한 비즈니스 규칙)
 */
export async function runHolisticChunkAnalysis(
  supabase: SupabaseClient,
  appUser: AppUser,
  params: {
    workId: number;
    chunkEpisodeIds: number[];
    requestedVersion: string;
    opts: NatAnalysisOptions;
    pipelineDbLog?: HolisticPipelineDbLogInput;
  }
): Promise<{ episodeIds: number[]; result: HolisticAnalysisResult }> {
  const { workId, chunkEpisodeIds, requestedVersion, opts, pipelineDbLog } =
    params;
  if (chunkEpisodeIds.length === 0 || chunkEpisodeIds.length > 10) {
    throw new Error("청크 회차는 1~10개여야 합니다.");
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
    .select("id, genre, title, author_id, world_setting, character_settings")
    .eq("id", workId)
    .single();

  if (wErr || !work || work.author_id !== appUser.id) {
    throw new Error("이 작품을 수정할 권한이 없습니다.");
  }

  const { data: epRows, error: epErr } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content")
    .eq("work_id", work.id)
    .in("id", chunkEpisodeIds);

  if (epErr || !epRows || epRows.length !== chunkEpisodeIds.length) {
    throw new Error("선택한 회차를 모두 찾을 수 없거나 작품과 맞지 않습니다.");
  }

  const byId = new Map(
    epRows.map((e) => {
      const id = Number(e.id);
      return [id, { ...(e as EpRow), id } as EpRow];
    })
  );
  const ordered = chunkEpisodeIds.map((id) => {
    const row = byId.get(Number(id));
    if (!row) {
      throw new Error("선택한 회차를 모두 찾을 수 없거나 작품과 맞지 않습니다.");
    }
    return row;
  });

  for (const e of ordered) {
    const n = countManuscriptChars(e.content ?? "");
    if (n < MIN_ANALYSIS_CHARS) {
      throw new Error(MANUSCRIPT_TOO_SHORT_MESSAGE);
    }
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

  const analysisInputBase = {
    manuscript: "",
    genre: work.genre ?? "",
    work_title: work.title ?? undefined,
    world_setting,
    character_settings:
      character_settings.length > 0 ? character_settings : undefined,
  };

  const segments = ordered.map((e) => ({
    episode_number: e.episode_number,
    title: e.title ?? "",
    content: e.content ?? "",
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  const totalCombinedChars = ordered.reduce(
    (s, e) => s + countManuscriptChars(e.content ?? ""),
    0
  );
  const cost = computeHolisticNatCost(totalCombinedChars, opts);

  const refreshed = await syncAppUser(supabase);
  if (!refreshed) throw new Error("사용자 정보를 찾을 수 없습니다.");
  const balance = refreshed.nat_balance ?? 0;
  if (balance < cost) {
    const err = new Error(
      `NAT가 부족합니다. 이번 배치에는 ${cost} NAT가 필요합니다.`
    );
    (err as Error & { code?: string }).code = "INSUFFICIENT_NAT";
    throw err;
  }

  let lastErr = "배치 분석에 실패했습니다.";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { result: rawResult, version } = await runHolisticAnalysis(
        analysisInputBase,
        segments,
        effectiveVersion
      );

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
        "client_chunk_api_model_result",
        {
          workId: work.id,
          chunkEpisodeIds,
          chunkEpisodeNumbers: ordered.map((e) => e.episode_number),
          ...holisticEpisodeScoreCoverage(
            ordered.map((e) => e.episode_number),
            rawResult
          ),
          overallScoreAfterWeight: weightedOverall,
        },
        pipelineDbLog
          ? {
              ...pipelineDbLog,
              workId: work.id,
              holisticRunId: null,
              analysisJobId: pipelineDbLog.analysisJobId ?? null,
            }
          : undefined
      );

      const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_nat", {
        p_amount: cost,
        p_ref_type: "holistic_batch_chunk",
        p_ref_id: null,
        p_metadata: {
          work_id: work.id,
          episode_ids: chunkEpisodeIds,
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

      return { episodeIds: chunkEpisodeIds, result };
    } catch (e) {
      if (e instanceof AnalysisProviderExhaustedError) throw e;
      lastErr = e instanceof Error ? e.message : "배치 분석에 실패했습니다.";
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error(lastErr);
}
