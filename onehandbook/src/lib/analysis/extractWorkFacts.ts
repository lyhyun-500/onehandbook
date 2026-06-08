/**
 * extractWorkFacts — Haiku 호출 + JSON 파서 + 1회 재시도.
 * ADR-0029 정합 (비차단, 실패 시 호출자가 best-effort 흡수).
 */
import { completeAnthropic } from "@/lib/ai/providers/anthropic";
import { ANALYSIS_HAIKU_MODEL } from "@/config/analysis-profiles";
import { extractBalancedJsonObject } from "@/lib/ai/jsonExtract";
import {
  FACT_EXTRACTION_SYSTEM_PROMPT,
  buildFactExtractionUserPrompt,
  type FactExtractionUserPromptParams,
} from "@/lib/ai/factExtractionPrompt";

export type ExtractedEntityRef = `ent_${string}` | `ent_existing_${number}`;

export const FACT_TYPES = [
  "event",
  "state_change",
  "relationship_change",
  "foreshadow_planted",
  "foreshadow_resolved",
] as const;
export type FactType = (typeof FACT_TYPES)[number];

export const NEW_ENTITY_TYPES = ["character", "foreshadow"] as const;
export type NewEntityType = (typeof NEW_ENTITY_TYPES)[number];

export interface ExtractedNewEntity {
  ref: string;
  entity_type: NewEntityType;
  canonical_name: string;
  brief: string | null;
}

export interface ExtractedFact {
  fact_type: FactType;
  entity_refs: string[];
  content: string;
  value: Record<string, unknown> | null;
  confidence: number;
}

export interface WorkFactsExtractionResult {
  new_entities: ExtractedNewEntity[];
  facts: ExtractedFact[];
}

function normalize(raw: Record<string, unknown>): WorkFactsExtractionResult {
  const newEntitiesRaw = Array.isArray(raw.new_entities) ? raw.new_entities : [];
  const new_entities: ExtractedNewEntity[] = newEntitiesRaw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => {
      const ref = typeof e.ref === "string" ? e.ref.trim() : "";
      const entityType =
        typeof e.entity_type === "string" ? e.entity_type.trim() : "";
      const canonicalName =
        typeof e.canonical_name === "string" ? e.canonical_name.trim() : "";
      const brief = typeof e.brief === "string" ? e.brief.trim() : "";
      if (
        !ref ||
        !canonicalName ||
        !NEW_ENTITY_TYPES.includes(entityType as NewEntityType)
      ) {
        return null;
      }
      return {
        ref,
        entity_type: entityType as NewEntityType,
        canonical_name: canonicalName,
        brief: brief || null,
      };
    })
    .filter((e): e is ExtractedNewEntity => e !== null);

  const factsRaw = Array.isArray(raw.facts) ? raw.facts : [];
  const facts: ExtractedFact[] = factsRaw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => {
      const factType =
        typeof f.fact_type === "string" ? f.fact_type.trim() : "";
      const content = typeof f.content === "string" ? f.content.trim() : "";
      const refs = Array.isArray(f.entity_refs)
        ? f.entity_refs
            .filter((r): r is string => typeof r === "string")
            .map((r) => r.trim())
            .filter(Boolean)
        : [];
      const confidence =
        typeof f.confidence === "number" && Number.isFinite(f.confidence)
          ? Math.max(0, Math.min(1, f.confidence))
          : 0;
      const value =
        f.value && typeof f.value === "object" && !Array.isArray(f.value)
          ? (f.value as Record<string, unknown>)
          : null;
      if (
        !FACT_TYPES.includes(factType as FactType) ||
        !content ||
        refs.length === 0
      ) {
        return null;
      }
      return {
        fact_type: factType as FactType,
        entity_refs: refs,
        content,
        value,
        confidence,
      };
    })
    .filter((f): f is ExtractedFact => f !== null);

  return { new_entities, facts };
}

const JSON_RETRY_MESSAGE =
  "이전 답변이 유효한 JSON 형식이 아니거나 schema 정합 X. 잡담 없이 순수 JSON 으로만 다시 답변해.";

export async function extractWorkFacts(
  params: FactExtractionUserPromptParams,
): Promise<WorkFactsExtractionResult> {
  const userPrompt = buildFactExtractionUserPrompt(params);

  let raw: string;
  try {
    raw = await completeAnthropic({
      model: ANALYSIS_HAIKU_MODEL,
      system: FACT_EXTRACTION_SYSTEM_PROMPT,
      user: userPrompt,
    });
  } catch (e) {
    throw new Error(
      `[work-bible] Haiku 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const tryParse = (text: string): WorkFactsExtractionResult => {
    const json = extractBalancedJsonObject(text);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("JSON object 가 아닙니다.");
    }
    return normalize(parsed as Record<string, unknown>);
  };

  try {
    return tryParse(raw);
  } catch {
    // 1회 재시도
    const retry = await completeAnthropic({
      model: ANALYSIS_HAIKU_MODEL,
      system: FACT_EXTRACTION_SYSTEM_PROMPT,
      user: `${userPrompt}\n\n[재시도] ${JSON_RETRY_MESSAGE}`,
    });
    return tryParse(retry);
  }
}
