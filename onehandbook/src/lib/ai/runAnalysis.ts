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
  TrendReferenceItem,
} from "./types";
import { isProviderConfigured } from "./availability";

const JSON_PARSE_RETRY_USER_MESSAGE =
  "너의 이전 답변은 JSON 형식이 유효하지 않아. 다른 잡담은 하지 말고 오직 순수한 JSON 구조로만 다시 답변해줘.";

type TrendsContextPack = {
  block: string | null;
  references: TrendReferenceItem[];
};

function loopbackTrendsSearchBaseUrl(): string | null {
  const explicit = process.env.TRENDS_RAG_SEARCH_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) return site;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return null;
}

async function fetchTrendsContextForAnalysisMaybe(
  genre: string,
  workTitle: string,
  tags: string[] | undefined
): Promise<TrendsContextPack> {
  // Vercel serverless 번들 크기(250MB) 초과를 피하기 위해
  // 프로덕션 빌드에서는 로컬 Chroma(@chroma-core/default-embed 포함)를 아예 포함하지 않습니다.
  if (process.env.NODE_ENV === "production") {
    return { block: null, references: [] };
  }

  const secret = process.env.TRENDS_RAG_API_SECRET?.trim();
  const base = loopbackTrendsSearchBaseUrl();
  if (!secret || !base) return { block: null, references: [] };

  const tagsNorm = Array.isArray(tags)
    ? tags
        .map((t) => String(t ?? "").trim().replace(/^#+/, "").trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const tagsLine = tagsNorm.length > 0 ? ` 태그: ${tagsNorm.join(", ")}.` : "";

  try {
    const res = await fetch(`${base}/api/rag/trends/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        query: `장르: ${genre}. 작품 제목: ${workTitle}.${tagsLine}`,
        n: 8,
        genre,
        ...(tagsNorm.length > 0 ? { tags: tagsNorm } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { block: null, references: [] };
    const data = (await res.json()) as {
      hits?: Array<{ document?: string; metadata?: { source?: string; date?: string } }>;
    };
    const hits = Array.isArray(data.hits) ? data.hits : [];
    const references: TrendReferenceItem[] = hits
      .map((h) => ({
        source: h.metadata?.source ?? "내부 트렌드 코퍼스",
        date: h.metadata?.date ?? "날짜 미표기",
      }))
      .filter((r) => Boolean(r.source) && Boolean(r.date));
    const block =
      hits.length > 0
        ? `## 최신 웹소설 트렌드 참고 자료 (RAG)\n(개발 모드 루프백)\n\n${hits
            .slice(0, 8)
            .map((h, i) => `### 스니펫 ${i + 1}\n${String(h.document ?? "").trim()}`)
            .join("\n\n")}`
        : null;
    return { block, references };
  } catch {
    return { block: null, references: [] };
  }
}

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
    await fetchTrendsContextForAnalysisMaybe(
      input.genre,
      input.work_title ?? "",
      input.tags
    );
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
    await fetchTrendsContextForAnalysisMaybe(
      input.genre,
      input.work_title ?? "",
      input.tags
    );
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
  workTitle?: string,
  tags?: string[]
): Promise<{
  result: HolisticAnalysisResult;
  version: AgentVersionConfig;
}> {
  const profile = getProfileConfig(versionId);
  if (!profile) {
    throw new Error(`알 수 없는 분석 프로필: ${versionId}`);
  }

  const { block: trendsBlock, references: trendRefs } =
    await fetchTrendsContextForAnalysisMaybe(genre, workTitle ?? "", tags);
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
