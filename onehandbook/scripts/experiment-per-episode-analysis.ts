#!/usr/bin/env tsx
/**
 * 실험: 회차별 구조화 출력 검증 (Phase 3 Step 1)
 *
 * 프로덕션 소스는 수정하지 않습니다. DB에 결과를 쓰지 않고 `tmp/experiment-results.json` 만 생성합니다.
 *
 * 실행 (onehandbook 디렉터리에서):
 *   npx tsx scripts/experiment-per-episode-analysis.ts
 *
 * 환경변수:
 *   ANTHROPIC_API_KEY — 필수 (Claude 호출)
 *   NEXT_PUBLIC_SUPABASE_URL — 필수
 *   SUPABASE_SERVICE_ROLE_KEY — 필수
 *   EXPERIMENT_WORK_ID — 필수 (숫자 작품 id)
 *   EXPERIMENT_EPISODE_COUNT — 선택, 기본 10
 *   EXPERIMENT_AGENT_VERSION — 선택, 기본 첫 번째 프로필 (예: munpia)
 *   EXPERIMENT_EPISODE_IDS — 선택, "22,23,..." 형태. 지정 시 해당 id 순서대로 사용 (개수는 배열 길이)
 *   EXPERIMENT_INCLUDE_LORE — 선택, "false" 이면 세계관/인물 로어를 유저 프롬프트에서 제외 (기본: 포함)
 *
 * .env.local 이 있으면 dotenv로 로드합니다.
 */
import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { createClient } from "@supabase/supabase-js";
import { getProfileConfig } from "@/lib/ai/profileLookup";
import { parseHolisticAnalysisJson } from "@/lib/ai/parseHolistic";
import { extractBalancedJsonObject } from "@/lib/ai/jsonExtract";
import {
  buildHolisticSystemPrompt,
  buildHolisticUserPrompt,
  type HolisticEpisodeSegment,
} from "@/lib/ai/holisticPrompts";
import {
  completeAnthropicWithUsage,
  completeAnthropicConversationWithUsage,
} from "@/lib/ai/providers/anthropic";
import type {
  AnalysisInput,
  AnalysisWorldSetting,
  AnalysisCharacterSetting,
} from "@/lib/ai/types";
import {
  normalizeCharacterSettings,
  normalizeWorldSetting,
} from "@/lib/works/loreTypes";
import { countManuscriptChars } from "@/lib/nat";
import { loadBaseSystem, loadPlatformSnippet } from "@/lib/ai/loadAnalysisPrompt";
import { buildGenreEvalAxesSection } from "@/lib/ai/genreEvalAddons";
import type { AnalysisProfileConfig } from "@/config/analysis-profiles";
import { DEFAULT_AGENT_VERSION } from "@/lib/ai/registry";

// --- holisticPrompts.ts 와 동기화한 블록 (Variant B 전용 확장 스키마만 스크립트에 하드코딩) ---
const HOLISTIC_TASK_COPY = `## 통합 분석 임무
아래 원고는 **여러 회차를 시간 순으로 이어 붙인 것**입니다. 각 회차 구간은 제목으로 구분되어 있습니다.
**작품 전체 서사·톤·인물 호흡이 회차 간에 어떻게 이어지는지**를 중심으로 평가하세요. 단일 회차 품질만 보지 말고, 연속된 흐름·아크·복선이 구간 전체에서 어떻게 작동하는지 봅니다.
플랫폼 적합성 차원은 선택된 분석 프로필(플랫폼 가이드)에 맞춰 판단하되, 범용 모드일 때는 일반 웹소설 독자 기대에의 적합도로 해석하세요.`;

const KOREAN_LINEBREAK_RULE_COPY = `## 문단·줄바꿈 규칙 (필수)
- 쉼표(,) 뒤에서 줄바꿈/문단 분리를 하지 마세요. (예: "A,\\nB" 금지)
- 줄바꿈은 문단을 나눌 때만 사용하고, 한 문장 안에서는 줄을 끊지 마세요.
- 결과 JSON의 문자열 필드(comment, alignment 등)도 같은 규칙을 적용하세요.`;

/** Variant B: episode_scores 항목에 회차별 dimensions / improvements / comment 추가 */
const VARIANT_B_JSON_SHAPE = `반드시 아래 키만 가진 JSON 하나만 출력하세요. 다른 설명·마크다운·코드펜스 금지.
{
  "overall_score": 0-100 정수,
  "episode_scores": [
    {
      "episode_number": 회차번호,
      "episode_title": "해당 회차 제목(선택)",
      "score": 0-100 정수,
      "dimensions": {
        "플로우 일관성": { "score": 0-100 정수, "comment": "이 회차 본문만 근거로 한 한두 문장" },
        "캐릭터 아크": { "score": 0-100 정수, "comment": "이 회차 본문만 근거로 한 한두 문장" },
        "복선 활용도": { "score": 0-100 정수, "comment": "이 회차 본문만 근거로 한 한두 문장" },
        "플랫폼 적합성": { "score": 0-100 정수, "comment": "이 회차 본문만 근거로 한 한두 문장" }
      },
      "improvements": ["이 회차만의 개선점 한 줄", "..."],
      "comment": "이 회차만의 총평 한 문단 (해당 회차 원고에만 근거)"
    }
  ],
  "dimensions": {
    "플로우 일관성": { "score": 0-100 정수, "comment": "전체 통합 관점 한두 문장" },
    "캐릭터 아크": { "score": 0-100 정수, "comment": "전체 통합 관점 한두 문장" },
    "복선 활용도": { "score": 0-100 정수, "comment": "전체 통합 관점 한두 문장" },
    "플랫폼 적합성": { "score": 0-100 정수, "comment": "전체 통합 관점 한두 문장" }
  },
  "strengths": ["잘된 점 한 줄", "..."],
  "improvements": ["전체 통합 관점의 개선점 한 줄", "..."],
  "tag_trend_fit": {
    "alignment": "선택: 유저 태그가 해당 플랫폼의 현재 트렌드 태그와 얼마나 일치하는지 (2~4문장)",
    "differentiation": "선택: 태그 관점에서 차별화되는 포인트/리스크/보완 전략 (2~4문장)",
    "suggested_trend_tags": ["선택: 함께 쓰기 좋은 보조 태그", "..."]
  },
  "executive_summary": "에이전트 최종 총평을 한 문단으로 작성 (전체 선택 구간)"
}

**규칙 (필수):**
- 유저 메시지에 포함된 **모든 회차**에 대해 episode_scores에 항목을 넣으세요. 회차 순서는 유저가 제시한 순서와 같아야 합니다.
- **각 회차의** episode_scores[i].dimensions / episode_scores[i].improvements / episode_scores[i].comment 는 **해당 회차 본문만** 근거로 작성하세요. 다른 회차 내용을 섞지 마세요.
- 최상위 dimensions / improvements / executive_summary 는 **전체 통합 관점**입니다. 회차별 필드와 문장이 겹치지 않게 관점을 구분하세요.
- overall_score는 각 회차 score를 해당 회차 원고 글자 수로 가중한 값과 **일치**하도록 하세요. 가중 평균 = Σ(score_i × 글자수_i) / Σ(글자수_i), 반올림하여 정수.
- strengths·improvements 각 항목 문자열에 마크다운 굵게(\`**\`)·이탤릭·# 제목·불릿 기호를 넣지 마세요. 일반 문장만.
- dimensions 키 이름은 위 네 가지 **한글 이름을 정확히** 사용하세요.`;

const JSON_PARSE_RETRY_USER_MESSAGE =
  "너의 이전 답변은 JSON 형식이 유효하지 않아. 다른 잡담은 하지 말고 오직 순수한 JSON 구조로만 다시 답변해줘.";

function buildVariantBSystemPrompt(
  genre: string,
  profile: AnalysisProfileConfig,
  trendsContextBlock?: string | null
): string {
  const base = loadBaseSystem().replace(/\{\{genre\}\}/g, genre);
  const genreAxes = buildGenreEvalAxesSection(genre);
  const platform = loadPlatformSnippet(profile);
  const parts = [
    base,
    HOLISTIC_TASK_COPY,
    genreAxes,
    platform,
    KOREAN_LINEBREAK_RULE_COPY,
  ].filter(Boolean);
  const core = parts.join("\n\n");
  const trends = trendsContextBlock?.trim()
    ? `\n\n${trendsContextBlock.trim()}`
    : "";
  return `${core}${trends}\n\n${VARIANT_B_JSON_SHAPE}`;
}

type EpisodeRow = {
  id: number;
  episode_number: number;
  title: string | null;
  content: string | null;
};

type VariantOutcome = {
  success: boolean;
  rawResponse: string;
  parsedResult: unknown | null;
  tokenUsage: { input?: number; output?: number };
  durationMs: number;
  error?: string;
  perEpisodeAnalysis?: {
    episodesWithDimensions: number;
    uniqueDimensionComments: number;
    uniqueImprovements: number;
    uniqueComments: number;
    hasEpisodeSpecificReferences: boolean[];
    flowCommentsSample: string[];
  };
};

function uniqueCount(strings: string[]): number {
  const set = new Set(strings.map((s) => s.trim()).filter(Boolean));
  return set.size;
}

/** 회차 comment에 본문 앞부분에서 뽑은 토큰이 포함되는지 대략 검사 */
function heuristicEpisodeGrounding(
  episodeContent: string,
  perEpisodeComment: string
): boolean {
  const text = (episodeContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length < 20 || perEpisodeComment.length < 8) return false;
  const slice = text.slice(0, 400);
  const words = slice
    .split(/[\s,.!?]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 24);
  const comment = perEpisodeComment;
  let hits = 0;
  for (const w of words) {
    if (w.length >= 2 && comment.includes(w)) hits++;
  }
  return hits >= 2;
}

function analyzeVariantBEpisodes(
  parsed: unknown,
  episodes: EpisodeRow[]
): VariantOutcome["perEpisodeAnalysis"] | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const o = parsed as Record<string, unknown>;
  const eps = o.episode_scores;
  if (!Array.isArray(eps)) return undefined;

  const flowComments: string[] = [];
  const improvementFingerprints: string[] = [];
  const episodeComments: string[] = [];
  let withDims = 0;
  const grounding: boolean[] = [];

  const byNum = new Map(episodes.map((e) => [e.episode_number, e]));

  for (const row of eps) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const epNum =
      typeof r.episode_number === "number" ? r.episode_number : 0;
    const dims = r.dimensions as Record<string, unknown> | undefined;
    const flow = dims?.["플로우 일관성"] as
      | { comment?: string }
      | undefined;
    const c =
      flow && typeof flow.comment === "string" ? flow.comment.trim() : "";
    if (c) flowComments.push(c);

    const im = r.improvements;
    if (Array.isArray(im)) {
      improvementFingerprints.push(
        im.map((x) => String(x ?? "").trim()).join(" | ")
      );
    } else {
      improvementFingerprints.push("");
    }

    const ec =
      typeof r.comment === "string" ? r.comment.trim() : "";
    episodeComments.push(ec);

    if (dims && typeof dims === "object") withDims++;

    const ep = byNum.get(epNum);
    grounding.push(
      ep
        ? heuristicEpisodeGrounding(ep.content ?? "", ec)
        : false
    );
  }

  return {
    episodesWithDimensions: withDims,
    uniqueDimensionComments: uniqueCount(flowComments),
    uniqueImprovements: uniqueCount(improvementFingerprints),
    uniqueComments: uniqueCount(episodeComments),
    hasEpisodeSpecificReferences: grounding,
    flowCommentsSample: flowComments.slice(0, 10),
  };
}

function parseJsonLenient(raw: string): unknown {
  const trimmed = raw.trim();
  let jsonStr: string;
  try {
    jsonStr = extractBalancedJsonObject(trimmed);
  } catch {
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
    jsonStr = fenced ? fenced[1]!.trim() : trimmed;
  }
  return JSON.parse(jsonStr) as unknown;
}

async function callAnthropicJson(
  model: string,
  system: string,
  user: string
): Promise<{ text: string; usage: { input?: number; output?: number } }> {
  const out = await completeAnthropicWithUsage({ model, system, user });
  return {
    text: out.text,
    usage: {
      input: out.usage?.input_tokens,
      output: out.usage?.output_tokens,
    },
  };
}

async function runVariantA(
  genre: string,
  profile: AnalysisProfileConfig,
  analysisInput: AnalysisInput,
  segments: HolisticEpisodeSegment[]
): Promise<VariantOutcome> {
  const t0 = Date.now();
  const system = buildHolisticSystemPrompt(genre, profile, null);
  const user = buildHolisticUserPrompt(genre, analysisInput, segments);
  try {
    const { text, usage } = await callAnthropicJson(
      profile.model,
      system,
      user
    );
    let parsed: unknown = null;
    let rawFinal = text;
    let usageFinal = usage;
    try {
      parsed = parseHolisticAnalysisJson(text);
    } catch {
      const out2 = await completeAnthropicConversationWithUsage({
        model: profile.model,
        system,
        messages: [
          { role: "user", content: user },
          { role: "assistant", content: text },
          { role: "user", content: JSON_PARSE_RETRY_USER_MESSAGE },
        ],
      });
      rawFinal = out2.text;
      usageFinal = {
        input: out2.usage?.input_tokens,
        output: out2.usage?.output_tokens,
      };
      try {
        parsed = parseHolisticAnalysisJson(out2.text);
      } catch {
        parsed = null;
      }
    }
    return {
      success: parsed !== null,
      rawResponse: rawFinal,
      parsedResult: parsed,
      tokenUsage: usageFinal,
      durationMs: Date.now() - t0,
      error: parsed === null ? "parseHolisticAnalysisJson 실패" : undefined,
    };
  } catch (e) {
    return {
      success: false,
      rawResponse: "",
      parsedResult: null,
      tokenUsage: {},
      durationMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function runVariantB(
  genre: string,
  profile: AnalysisProfileConfig,
  analysisInput: AnalysisInput,
  segments: HolisticEpisodeSegment[],
  episodes: EpisodeRow[]
): Promise<VariantOutcome> {
  const t0 = Date.now();
  const system = buildVariantBSystemPrompt(genre, profile, null);
  const user = buildHolisticUserPrompt(genre, analysisInput, segments);
  try {
    const { text, usage } = await callAnthropicJson(
      profile.model,
      system,
      user
    );
    let parsed: unknown = null;
    let rawFinal = text;
    let usageFinal = usage;
    try {
      parsed = parseJsonLenient(text);
    } catch {
      try {
        const out2 = await completeAnthropicConversationWithUsage({
          model: profile.model,
          system,
          messages: [
            { role: "user", content: user },
            { role: "assistant", content: text },
            { role: "user", content: JSON_PARSE_RETRY_USER_MESSAGE },
          ],
        });
        rawFinal = out2.text;
        usageFinal = {
          input: out2.usage?.input_tokens,
          output: out2.usage?.output_tokens,
        };
        parsed = parseJsonLenient(out2.text);
      } catch {
        parsed = null;
      }
    }
    const perEpisodeAnalysis =
      parsed !== null ? analyzeVariantBEpisodes(parsed, episodes) : undefined;
    return {
      success: parsed !== null,
      rawResponse: rawFinal,
      parsedResult: parsed,
      tokenUsage: usageFinal,
      durationMs: Date.now() - t0,
      error: parsed === null ? "Variant B JSON 파싱 실패" : undefined,
      perEpisodeAnalysis,
    };
  } catch (e) {
    return {
      success: false,
      rawResponse: "",
      parsedResult: null,
      tokenUsage: {},
      durationMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function outputTokenIncreasePct(aOut?: number, bOut?: number): number | null {
  if (
    typeof aOut !== "number" ||
    typeof bOut !== "number" ||
    aOut <= 0
  ) {
    return null;
  }
  return Math.round(((bOut - aOut) / aOut) * 10000) / 100;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.error("ANTHROPIC_API_KEY 가 필요합니다.");
    process.exit(1);
  }
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다."
    );
    process.exit(1);
  }

  const workIdRaw = process.env.EXPERIMENT_WORK_ID?.trim();
  const workId = workIdRaw ? parseInt(workIdRaw, 10) : NaN;
  if (Number.isNaN(workId) || workId < 1) {
    console.error("EXPERIMENT_WORK_ID 에 유효한 작품 id(양의 정수)를 설정하세요.");
    process.exit(1);
  }

  const countRaw = process.env.EXPERIMENT_EPISODE_COUNT?.trim();
  const episodeCount = countRaw ? parseInt(countRaw, 10) : 10;
  if (Number.isNaN(episodeCount) || episodeCount < 1 || episodeCount > 10) {
    console.error("EXPERIMENT_EPISODE_COUNT 는 1~10 이어야 합니다.");
    process.exit(1);
  }

  const versionId =
    process.env.EXPERIMENT_AGENT_VERSION?.trim() || DEFAULT_AGENT_VERSION;
  const profile = getProfileConfig(versionId);
  if (!profile) {
    console.error(`알 수 없는 EXPERIMENT_AGENT_VERSION: ${versionId}`);
    process.exit(1);
  }
  if (profile.provider !== "anthropic") {
    console.error("이 실험 스크립트는 Anthropic(Claude) 프로필만 지원합니다.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: work, error: wErr } = await supabase
    .from("works")
    .select("id, genre, title, tags, world_setting, character_settings")
    .eq("id", workId)
    .single();

  if (wErr || !work) {
    console.error("작품을 불러오지 못했습니다:", wErr?.message ?? workId);
    process.exit(1);
  }

  const idsEnv = process.env.EXPERIMENT_EPISODE_IDS?.trim();
  let episodeRows: EpisodeRow[];

  if (idsEnv) {
    const ids = idsEnv
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (ids.length === 0 || ids.length > 10) {
      console.error("EXPERIMENT_EPISODE_IDS 는 1~10개의 숫자여야 합니다.");
      process.exit(1);
    }
    const { data: eps, error: eErr } = await supabase
      .from("episodes")
      .select("id, episode_number, title, content")
      .eq("work_id", workId)
      .in("id", ids);
    if (eErr || !eps || eps.length !== ids.length) {
      console.error("지정한 episode id 들을 모두 찾지 못했습니다.");
      process.exit(1);
    }
    const byId = new Map(
      eps.map((e) => [Number(e.id), e as EpisodeRow])
    );
    episodeRows = ids.map((id) => {
      const row = byId.get(id);
      if (!row) throw new Error(`missing episode ${id}`);
      return {
        ...row,
        id: Number(row.id),
        episode_number: Number(row.episode_number),
      };
    });
  } else {
    const { data: eps, error: eErr } = await supabase
      .from("episodes")
      .select("id, episode_number, title, content")
      .eq("work_id", workId)
      .order("episode_number", { ascending: true })
      .limit(episodeCount);

    if (eErr || !eps || eps.length === 0) {
      console.error("회차를 불러오지 못했습니다:", eErr?.message);
      process.exit(1);
    }
    if (eps.length < episodeCount) {
      console.warn(
        `요청한 ${episodeCount}화보다 적게 존재합니다. 실제 ${eps.length}화만 사용합니다.`
      );
    }
    episodeRows = eps.map((e) => ({
      id: Number(e.id),
      episode_number: Number(e.episode_number),
      title: e.title,
      content: e.content,
    }));
  }

  const includeLore = process.env.EXPERIMENT_INCLUDE_LORE !== "false";

  const wLore = normalizeWorldSetting(work.world_setting);
  const world_setting: AnalysisWorldSetting | undefined =
    includeLore && (wLore.background || wLore.era || wLore.rules)
      ? {
          background: wLore.background || undefined,
          era: wLore.era || undefined,
          rules: wLore.rules || undefined,
        }
      : undefined;

  const character_settings: AnalysisCharacterSetting[] = includeLore
    ? normalizeCharacterSettings(work.character_settings).filter((c) =>
        c.name.trim()
      )
    : [];

  const analysisInput: AnalysisInput = {
    manuscript: "",
    genre: work.genre ?? "",
    work_title: work.title ?? undefined,
    tags: Array.isArray(work.tags) ? work.tags : undefined,
    world_setting,
    character_settings:
      character_settings.length > 0 ? character_settings : undefined,
  };

  const segments: HolisticEpisodeSegment[] = episodeRows.map((e) => ({
    episode_number: e.episode_number,
    title: e.title ?? "",
    content: e.content ?? "",
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  const genre = work.genre ?? "";

  console.info("실험 시작:", {
    workId,
    episodeCount: episodeRows.length,
    versionId,
    episodeIds: episodeRows.map((e) => e.id),
  });

  const variantA = await runVariantA(
    genre,
    profile,
    analysisInput,
    segments
  );
  const variantB = await runVariantB(
    genre,
    profile,
    analysisInput,
    segments,
    episodeRows
  );

  const aOut = variantA.tokenUsage.output;
  const bOut = variantB.tokenUsage.output;
  const outputTokenIncreasePercent = outputTokenIncreasePct(aOut, bOut);

  const payload = {
    timestamp: new Date().toISOString(),
    episode_count: episodeRows.length,
    work_id: workId,
    agent_version: versionId,
    variantA: {
      success: variantA.success,
      rawResponse: variantA.rawResponse,
      parsedResult: variantA.parsedResult,
      tokenUsage: variantA.tokenUsage,
      durationMs: variantA.durationMs,
      error: variantA.error,
    },
    variantB: {
      success: variantB.success,
      rawResponse: variantB.rawResponse,
      parsedResult: variantB.parsedResult,
      tokenUsage: variantB.tokenUsage,
      durationMs: variantB.durationMs,
      error: variantB.error,
      perEpisodeAnalysis: variantB.perEpisodeAnalysis,
    },
    metrics: {
      outputTokenIncreasePercentVariantBVsA: outputTokenIncreasePercent,
    },
  };

  const outDir = resolve(process.cwd(), "tmp");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, "experiment-results.json");
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.info("저장 완료:", outPath);
  console.info("요약:", {
    variantA_ok: variantA.success,
    variantB_ok: variantB.success,
    uniqueFlowComments_B:
      variantB.perEpisodeAnalysis?.uniqueDimensionComments ?? null,
    outputTokenIncreasePercent,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
