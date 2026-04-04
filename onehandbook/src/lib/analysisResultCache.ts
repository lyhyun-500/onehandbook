import type { AnalysisResult } from "@/lib/ai/types";

/** `analysis_results.feedback` JSON 문자열 형태 */
export type AnalysisFeedbackPayload = {
  improvement_points: string[];
  comparable_note: string | null;
};

export function serializeAnalysisFeedback(result: AnalysisResult): string {
  const payload: AnalysisFeedbackPayload = {
    improvement_points: result.improvement_points,
    comparable_note: result.comparable_note ?? null,
  };
  return JSON.stringify(payload);
}

export function parseAnalysisFeedback(raw: string): AnalysisFeedbackPayload {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") {
      return { improvement_points: [], comparable_note: null };
    }
    const imp = (o as { improvement_points?: unknown }).improvement_points;
    const comp = (o as { comparable_note?: unknown }).comparable_note;
    return {
      improvement_points: Array.isArray(imp)
        ? imp.filter((x): x is string => typeof x === "string")
        : [],
      comparable_note:
        typeof comp === "string" || comp === null ? comp : null,
    };
  } catch {
    return { improvement_points: [], comparable_note: null };
  }
}

export type PreviousAnalysisResultPayload = {
  score: number;
  feedback: AnalysisFeedbackPayload;
  nat_consumed: number;
  created_at: string;
};
