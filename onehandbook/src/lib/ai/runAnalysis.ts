import {
  ANALYSIS_PROFILES,
  type AnalysisProfileConfig,
} from "@/config/analysis-profiles";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import {
  buildHolisticSystemPrompt,
  buildHolisticUserPrompt,
  type HolisticEpisodeSegment,
} from "./holisticPrompts";
import { parseAnalysisJson } from "./parse";
import { parseHolisticAnalysisJson } from "./parseHolistic";
import {
  buildHolisticMergeSystemPrompt,
  buildHolisticMergeUserPrompt,
  type HolisticChunkPayload,
} from "./holisticMergePrompts";
import { getProfileConfig } from "./profileLookup";
import type { AgentVersionConfig } from "./registry";
import {
  completeAnthropic,
  completeAnthropicConversation,
} from "./providers/anthropic";
import { completeGoogle, completeGoogleConversation } from "./providers/google";
import type {
  AnalysisInput,
  AnalysisResult,
  HolisticAnalysisResult,
} from "./types";
import { isProviderConfigured } from "./availability";
import { fetchTrendsContextForAnalysis } from "@/lib/chroma/trendsSearchCore";

const JSON_PARSE_RETRY_USER_MESSAGE =
  "너의 이전 답변은 JSON 형식이 유효하지 않아. 다른 잡담은 하지 말고 오직 순수한 JSON 구조로만 다시 답변해줘.";

function formatJsonParseFailures(first: unknown, second: unknown): string {
  const a = first instanceof Error ? first.message : String(first);
  const b = second instanceof Error ? second.message : String(second);
  return `1차: ${a} / 2차: ${b}`;
}

/** 첫 응답 파싱 실패 시 1회만 JSON 재요청 후 파싱. 두 번째도 실패하면 에러. */
async function completeAndParseModelJson<T>(
  profile: AnalysisProfileConfig,
  system: string,
  user: string,
  parse: (raw: string) => T
): Promise<T> {
  let raw =
    profile.provider === "anthropic"
      ? await completeAnthropic({
          model: profile.model,
          system,
          user,
        })
      : await completeGoogle({
          model: profile.model,
          system,
          user,
        });

  try {
    return parse(raw);
  } catch (e1) {
    raw =
      profile.provider === "anthropic"
        ? await completeAnthropicConversation({
            model: profile.model,
            system,
            messages: [
              { role: "user", content: user },
              { role: "assistant", content: raw },
              { role: "user", content: JSON_PARSE_RETRY_USER_MESSAGE },
            ],
          })
        : await completeGoogleConversation({
            model: profile.model,
            system,
            messages: [
              { role: "user", content: user },
              { role: "model", content: raw },
              { role: "user", content: JSON_PARSE_RETRY_USER_MESSAGE },
            ],
          });

    try {
      return parse(raw);
    } catch (e2) {
      throw new Error(
        `AI 응답 JSON 파싱에 실패했습니다. ${formatJsonParseFailures(e1, e2)}`
      );
    }
  }
}

export async function runAnalysis(
  input: AnalysisInput,
  versionId: string = ANALYSIS_PROFILES[0]!.id
): Promise<{ result: AnalysisResult; version: AgentVersionConfig }> {
  const profile = getProfileConfig(versionId);
  if (!profile) {
    throw new Error(`알 수 없는 분석 프로필: ${versionId}`);
  }

  const { block: trendsBlock, references: trendRefs } =
    await fetchTrendsContextForAnalysis(input.genre, input.work_title ?? "");
  const system = buildSystemPrompt(input.genre, profile, trendsBlock);
  const user = buildUserPrompt(input);

  const parsed = await completeAndParseModelJson(profile, system, user, parseAnalysisJson);
  const result: AnalysisResult = {
    ...parsed,
    ...(trendRefs.length > 0 ? { trends_references: trendRefs } : {}),
  };
  const version: AgentVersionConfig = {
    id: profile.id,
    label: profile.label,
    description: profile.description,
    provider: profile.provider,
    model: profile.model,
  };
  return { result, version };
}

export async function runHolisticAnalysis(
  input: AnalysisInput,
  segments: HolisticEpisodeSegment[],
  versionId: string = ANALYSIS_PROFILES[0]!.id
): Promise<{
  result: HolisticAnalysisResult;
  version: AgentVersionConfig;
}> {
  const profile = getProfileConfig(versionId);
  if (!profile) {
    throw new Error(`알 수 없는 분석 프로필: ${versionId}`);
  }

  const { block: trendsBlock, references: trendRefs } =
    await fetchTrendsContextForAnalysis(input.genre, input.work_title ?? "");
  const system = buildHolisticSystemPrompt(input.genre, profile, trendsBlock);
  const user = buildHolisticUserPrompt(input.genre, input, segments);

  const parsed = await completeAndParseModelJson(
    profile,
    system,
    user,
    parseHolisticAnalysisJson
  );
  const result: HolisticAnalysisResult = {
    ...parsed,
    ...(trendRefs.length > 0 ? { trends_references: trendRefs } : {}),
  };
  const version: AgentVersionConfig = {
    id: profile.id,
    label: profile.label,
    description: profile.description,
    provider: profile.provider,
    model: profile.model,
  };
  return { result, version };
}

export async function runHolisticMergeAnalysis(
  genre: string,
  chunks: HolisticChunkPayload[],
  episodeWeights: Array<{ episode_number: number; charCount: number }>,
  versionId: string = ANALYSIS_PROFILES[0]!.id,
  workTitle?: string
): Promise<{
  result: HolisticAnalysisResult;
  version: AgentVersionConfig;
}> {
  const profile = getProfileConfig(versionId);
  if (!profile) {
    throw new Error(`알 수 없는 분석 프로필: ${versionId}`);
  }

  const { block: trendsBlock, references: trendRefs } =
    await fetchTrendsContextForAnalysis(genre, workTitle ?? "");
  const system = buildHolisticMergeSystemPrompt(genre, profile, trendsBlock);
  const user = buildHolisticMergeUserPrompt(genre, chunks, episodeWeights);

  const parsed = await completeAndParseModelJson(
    profile,
    system,
    user,
    parseHolisticAnalysisJson
  );
  const result: HolisticAnalysisResult = {
    ...parsed,
    ...(trendRefs.length > 0 ? { trends_references: trendRefs } : {}),
  };
  const version: AgentVersionConfig = {
    id: profile.id,
    label: profile.label,
    description: profile.description,
    provider: profile.provider,
    model: profile.model,
  };
  return { result, version };
}

/** UI/API용: 키가 있는 프로바이더만 사용 가능한 버전으로 표시 */
export function listAgentVersionsWithAvailability(): Array<
  AgentVersionConfig & { available: boolean }
> {
  return ANALYSIS_PROFILES.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    provider: p.provider,
    model: p.model,
    available: isProviderConfigured(p.provider),
  }));
}
