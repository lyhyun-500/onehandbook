/**
 * PostgREST/Supabase는 bigint 등을 number 또는 string 으로 돌려줄 수 있습니다.
 * `typeof x === "number"` 만 쓰면 통합 잡의 holistic_run_id 등이 누락됩니다.
 */
export function parseDbInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}
