import { ANALYSIS_PROFILES } from "@/config/analysis-profiles";
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
import { completeAnthropic } from "./providers/anthropic";
import { completeGoogle } from "./providers/google";
import type {
  AnalysisInput,
  AnalysisResult,
  HolisticAnalysisResult,
} from "./types";
import { isProviderConfigured } from "./availability";

export async function runAnalysis(
  input: AnalysisInput,
  versionId: string = ANALYSIS_PROFILES[0]!.id
): Promise<{ result: AnalysisResult; version: AgentVersionConfig }> {
  const profile = getProfileConfig(versionId);
  if (!profile) {
    throw new Error(`알 수 없는 분석 프로필: ${versionId}`);
  }

  const system = buildSystemPrompt(input.genre, profile);
  const user = buildUserPrompt(input);

  let raw: string;
  if (profile.provider === "anthropic") {
    raw = await completeAnthropic({
      model: profile.model,
      system,
      user,
    });
  } else {
    raw = await completeGoogle({
      model: profile.model,
      system,
      user,
    });
  }

  const result = parseAnalysisJson(raw);
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

  const system = buildHolisticSystemPrompt(input.genre, profile);
  const user = buildHolisticUserPrompt(input.genre, input, segments);

  let raw: string;
  if (profile.provider === "anthropic") {
    raw = await completeAnthropic({
      model: profile.model,
      system,
      user,
    });
  } else {
    raw = await completeGoogle({
      model: profile.model,
      system,
      user,
    });
  }

  const result = parseHolisticAnalysisJson(raw);
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
  versionId: string = ANALYSIS_PROFILES[0]!.id
): Promise<{
  result: HolisticAnalysisResult;
  version: AgentVersionConfig;
}> {
  const profile = getProfileConfig(versionId);
  if (!profile) {
    throw new Error(`알 수 없는 분석 프로필: ${versionId}`);
  }

  const system = buildHolisticMergeSystemPrompt(genre, profile);
  const user = buildHolisticMergeUserPrompt(genre, chunks, episodeWeights);

  let raw: string;
  if (profile.provider === "anthropic") {
    raw = await completeAnthropic({
      model: profile.model,
      system,
      user,
    });
  } else {
    raw = await completeGoogle({
      model: profile.model,
      system,
      user,
    });
  }

  const result = parseHolisticAnalysisJson(raw);
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
