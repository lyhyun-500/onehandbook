import type { AnalysisResult } from "./types";

/** 모델 응답에서 JSON만 추출 (```json 펜스 허용) */
export function parseAnalysisJson(raw: string): AnalysisResult {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;
  const data = JSON.parse(jsonStr) as unknown;
  if (!data || typeof data !== "object") {
    throw new Error("분석 결과가 올바른 객체가 아닙니다.");
  }
  const o = data as Record<string, unknown>;
  if (typeof o.overall_score !== "number") {
    throw new Error("overall_score 가 없습니다.");
  }
  if (!o.dimensions || typeof o.dimensions !== "object") {
    throw new Error("dimensions 가 없습니다.");
  }
  if (!Array.isArray(o.improvement_points)) {
    throw new Error("improvement_points 가 없습니다.");
  }
  return {
    overall_score: o.overall_score,
    dimensions: o.dimensions as AnalysisResult["dimensions"],
    improvement_points: o.improvement_points as string[],
    comparable_note:
      typeof o.comparable_note === "string" ? o.comparable_note : undefined,
  };
}
