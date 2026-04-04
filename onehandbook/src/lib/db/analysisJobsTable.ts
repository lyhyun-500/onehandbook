/**
 * analysis_jobs 테이블 미생성 시 PostgREST/Supabase 오류 감지
 */
export function isMissingAnalysisJobsTableError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "PGRST205" || code === "42P01") return true;
  if (msg.includes("analysis_jobs") && (msg.includes("does not exist") || msg.includes("schema cache")))
    return true;
  return false;
}
