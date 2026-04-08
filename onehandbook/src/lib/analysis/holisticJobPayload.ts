/**
 * analysis_jobs.payload / job_kind 가 환경·직렬화마다 달라질 수 있어 통합 분석 여부를 안전히 판별한다.
 */

function normalizeJobKind(jobKind: unknown): string {
  return String(jobKind ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase();
}

/** JSONB가 문자열로 온 경우 등 */
export function parseJobPayloadRecord(payload: unknown): Record<string, unknown> | null {
  if (payload == null) return null;
  if (typeof payload === "string") {
    try {
      const o = JSON.parse(payload) as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) {
        return o as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return null;
}

/**
 * analysis_jobs.payload 에서 통합 분석 회차 목록 추출
 */
export function orderedEpisodeIdsFromJobPayload(payload: unknown): number[] | null {
  const p = parseJobPayloadRecord(payload);
  if (!p) return null;
  const raw = p.orderedEpisodeIds ?? p.ordered_episode_ids;
  let arr: unknown[] | null = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return null;
    }
  }
  if (!arr || arr.length === 0) return null;
  const out: number[] = [];
  for (const x of arr) {
    if (typeof x === "number" && !Number.isNaN(x)) {
      out.push(x);
      continue;
    }
    if (typeof x === "string") {
      const n = parseInt(x, 10);
      if (!Number.isNaN(n)) out.push(n);
    }
  }
  return out.length > 0 ? out : null;
}

export function isHolisticAnalysisJobPeek(
  jobKind: unknown,
  payload: unknown
): boolean {
  if (normalizeJobKind(jobKind) === "holistic_batch") return true;
  return orderedEpisodeIdsFromJobPayload(payload) != null;
}
