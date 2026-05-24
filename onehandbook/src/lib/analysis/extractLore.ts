// 추출 LLM 호출 — 의제 신규-1+2 단계 C-4 (commit 3) 정합.
//
// LEE 결정 영속화:
// - 결정 11 (옵션 EX-3): 통합 LLM 호출 + 프롬프트 안 NULL 분기
// - 결정 28 (옵션 B-1): 분석 대상 회차 본문만 입력
// - 결정 29 (옵션 L-1): Claude API (multi-LLM abstraction 정합)
// - 결정 20 (옵션 J-1): extracted_* JSONB schema 정합 (side-panel/types.ts 정합)

import { completeAnthropic } from "@/lib/ai/providers/anthropic";
import { ANALYSIS_CLAUDE_MODEL } from "@/config/analysis-profiles";
import { extractBalancedJsonObject } from "@/lib/ai/jsonExtract";
import {
  LORE_EXTRACTION_SYSTEM_PROMPT,
  buildLoreExtractionUserPrompt,
  type ExtractionScope,
} from "@/lib/ai/loreExtractionPrompt";
import type { LoreNullCase } from "@/lib/works/loreCheck";
import type {
  Character,
  WorldSetting,
} from "@/components/side-panel/types";

export interface LoreExtractionResult {
  worldview: WorldSetting | null;
  characters: Character[] | null;
}

export interface LoreExtractionInput {
  workTitle: string;
  genre: string;
  loreNullCase: LoreNullCase;
  episodeBody: string;
}

/** LoreNullCase → extraction_scope 매핑 (경우 4 = 추출 X). */
function getExtractionScope(loreCase: LoreNullCase): ExtractionScope {
  switch (loreCase) {
    case "both_null":
      return "both";
    case "worldview_only_null":
      return "worldview_only";
    case "characters_only_null":
      return "characters_only";
    case "both_present":
      throw new Error("Cannot extract lore when both fields are present");
  }
}

/** 추출 결과 normalize (extraction_scope 외 항목 제거 + Character[] cast). */
function normalizeExtractionResult(
  raw: Record<string, unknown>,
  scope: ExtractionScope,
): LoreExtractionResult {
  const worldview =
    scope === "both" || scope === "worldview_only"
      ? (raw.worldview as WorldSetting | undefined) ?? null
      : null;

  let characters: Character[] | null = null;
  if (scope === "both" || scope === "characters_only") {
    const rawChars = raw.characters;
    if (Array.isArray(rawChars)) {
      characters = rawChars
        .filter(
          (c): c is Record<string, unknown> =>
            !!c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string",
        )
        .map((c) => ({
          name: String(c.name),
          role: typeof c.role === "string" ? c.role : undefined,
          personality:
            typeof c.personality === "string" ? c.personality : undefined,
          abilities: typeof c.abilities === "string" ? c.abilities : undefined,
          goals: typeof c.goals === "string" ? c.goals : undefined,
          relationships:
            typeof c.relationships === "string" ? c.relationships : undefined,
          summary: typeof c.summary === "string" ? c.summary : undefined,
        }));
    }
  }

  return { worldview, characters };
}

export async function extractLore(
  input: LoreExtractionInput,
): Promise<LoreExtractionResult> {
  const scope = getExtractionScope(input.loreNullCase);

  const userPrompt = buildLoreExtractionUserPrompt({
    workTitle: input.workTitle,
    genre: input.genre,
    extractionScope: scope,
    episodeBody: input.episodeBody,
  });

  const responseText = await completeAnthropic({
    model: ANALYSIS_CLAUDE_MODEL,
    system: LORE_EXTRACTION_SYSTEM_PROMPT,
    user: userPrompt,
  });

  const jsonText = extractBalancedJsonObject(responseText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("추출 응답이 유효한 JSON 형식이 아닙니다.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("추출 응답이 유효한 JSON 객체가 아닙니다.");
  }

  return normalizeExtractionResult(parsed as Record<string, unknown>, scope);
}
