import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";

export function formatAnalysisJobEtaLine(job: AnalysisJobListItem): string {
  const est = job.estimated_seconds;
  if (est == null || est <= 0) return "잠시 후 완료 예정";
  const start = new Date(job.created_at).getTime();
  const elapsed = (Date.now() - start) / 1000;
  const left = Math.max(15, Math.round(est - elapsed));
  if (left < 90) return `약 ${left}초 남음`;
  return `약 ${Math.max(1, Math.round(left / 60))}분 남음`;
}

/**
 * 인라인 프로그레스 바용 퍼센트·라벨 (단일/통합 서버 구동 공통).
 * 통합 청크 모드는 payload.progressPercent가 있으면 우선.
 */
export function deriveInlineAnalysisProgress(
  job: AnalysisJobListItem | null,
  opts?: { bootstrapping?: boolean }
): { percent: number; label: string; etaLine: string | null } {
  if (opts?.bootstrapping && !job) {
    return {
      percent: 12,
      label: "분석 작업 준비 중…",
      etaLine: null,
    };
  }
  if (!job) {
    return { percent: 0, label: "", etaLine: null };
  }

  if (
    job.job_kind === "holistic_batch" &&
    job.progress_percent != null &&
    job.progress_percent > 0
  ) {
    return {
      percent: Math.min(94, Math.round(job.progress_percent)),
      label: `통합 분석 ${Math.round(job.progress_percent)}%`,
      etaLine: formatAnalysisJobEtaLine(job),
    };
  }

  const st = job.status;
  const ph = job.progress_phase;

  if (st === "pending") {
    return {
      percent: 18,
      label: "원고 접수·대기 중",
      etaLine: formatAnalysisJobEtaLine(job),
    };
  }

  if (ph === "report_writing") {
    return {
      percent: 82,
      label: "리포트 작성 중",
      etaLine: formatAnalysisJobEtaLine(job),
    };
  }

  if (ph === "ai_analyzing") {
    return {
      percent: 52,
      label: "AI 분석 중",
      etaLine: formatAnalysisJobEtaLine(job),
    };
  }

  if (ph === "received") {
    return {
      percent: 28,
      label: "AI 분석 중",
      etaLine: formatAnalysisJobEtaLine(job),
    };
  }

  return {
    percent: 42,
    label: "AI 분석 중",
    etaLine: formatAnalysisJobEtaLine(job),
  };
}
