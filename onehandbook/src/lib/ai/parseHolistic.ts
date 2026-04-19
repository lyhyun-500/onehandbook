import { extractBalancedJsonObject } from "./jsonExtract";
import type { HolisticAnalysisResult } from "./types";

const DIM_KEYS = [
  "플로우 일관성",
  "캐릭터 아크",
  "복선 활용도",
  "플랫폼 적합성",
] as const;

function parseEpisodeDimensionsOrUndefined(
  raw: unknown
): Record<string, { score: number; comment: string }> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;

  const requiredKeys = [
    "플로우 일관성",
    "캐릭터 아크",
    "복선 활용도",
    "플랫폼 적합성",
  ];
  const result: Record<string, { score: number; comment: string }> = {};

  for (const key of requiredKeys) {
    const dim = r[key];
    if (
      !dim ||
      typeof dim !== "object" ||
      typeof (dim as Record<string, unknown>).score !== "number" ||
      typeof (dim as Record<string, unknown>).comment !== "string"
    ) {
      return undefined;
    }
    result[key] = {
      score: (dim as { score: number }).score,
      comment: (dim as { comment: string }).comment,
    };
  }

  return result;
}

export function parseHolisticAnalysisJson(raw: string): HolisticAnalysisResult {
  const trimmed = raw.trim();
  let jsonStr: string;
  try {
    jsonStr = extractBalancedJsonObject(trimmed);
  } catch {
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
    jsonStr = fenced ? fenced[1].trim() : trimmed;
  }
  const data = JSON.parse(jsonStr) as unknown;
  if (!data || typeof data !== "object") {
    throw new Error("통합 분석 결과가 올바른 객체가 아닙니다.");
  }
  const o = data as Record<string, unknown>;
  if (typeof o.overall_score !== "number") {
    throw new Error("overall_score 가 없습니다.");
  }
  if (!Array.isArray(o.episode_scores)) {
    throw new Error("episode_scores 가 없습니다.");
  }
  const episode_scores = o.episode_scores.map((row) => {
    const r = row as Record<string, unknown>;
    const ep = typeof r.episode_number === "number" ? r.episode_number : 0;
    const score = typeof r.score === "number" ? r.score : 0;
    const title =
      typeof r.episode_title === "string" ? r.episode_title : undefined;

    const dimensions = parseEpisodeDimensionsOrUndefined(r.dimensions);
    const improvements = Array.isArray(r.improvements)
      ? r.improvements.filter((s): s is string => typeof s === "string")
      : undefined;
    const comment = typeof r.comment === "string" ? r.comment : undefined;

    return {
      episode_number: ep,
      episode_title: title,
      score,
      dimensions,
      improvements,
      comment,
    };
  });
  if (!o.dimensions || typeof o.dimensions !== "object") {
    throw new Error("dimensions 가 없습니다.");
  }
  const dims = o.dimensions as Record<string, { score: number; comment: string }>;
  for (const k of DIM_KEYS) {
    const d = dims[k];
    if (!d || typeof d.score !== "number" || typeof d.comment !== "string") {
      throw new Error(`dimensions["${k}"] 형식이 올바르지 않습니다.`);
    }
  }
  if (!Array.isArray(o.strengths)) {
    throw new Error("strengths 가 없습니다.");
  }
  if (!Array.isArray(o.improvements)) {
    throw new Error("improvements 가 없습니다.");
  }
  if (typeof o.executive_summary !== "string") {
    throw new Error("executive_summary 가 없습니다.");
  }
  const ttf = o.tag_trend_fit as
    | {
        alignment?: unknown;
        differentiation?: unknown;
        suggested_trend_tags?: unknown;
      }
    | undefined;
  return {
    overall_score: Math.round(o.overall_score),
    episode_scores,
    dimensions: dims,
    strengths: o.strengths as string[],
    improvements: o.improvements as string[],
    executive_summary: o.executive_summary,
    tag_trend_fit:
      ttf &&
      typeof ttf === "object" &&
      typeof ttf.alignment === "string" &&
      typeof ttf.differentiation === "string"
        ? {
            alignment: ttf.alignment,
            differentiation: ttf.differentiation,
            suggested_trend_tags: Array.isArray(ttf.suggested_trend_tags)
              ? (ttf.suggested_trend_tags as unknown[])
                  .map((x) => String(x ?? "").trim())
                  .filter(Boolean)
                  .slice(0, 12)
              : undefined,
          }
        : undefined,
  };
}
