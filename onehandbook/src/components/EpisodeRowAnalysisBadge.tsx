"use client";

import { useAnalysisJobsOptional } from "@/contexts/AnalysisJobsContext";
import { AnalysisStatusBadge } from "@/components/AnalysisStatusBadge";
import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";

/**
 * 통합 분석 완료 작업이 회차마다 DB 동기화되기 전에도 모든 회차에 "분석 완료"가 붙는 문제:
 * 서버에서 내려준 해당 회차 최신 analysis_runs.created_at 이 작업 완료 시각보다 오래되면 완료 뱃지를 숨긴다.
 */
function holisticCompleteOutOfSyncWithServerRun(
  job: AnalysisJobListItem,
  serverLatestRunCreatedAt: string | null | undefined
): boolean {
  if (serverLatestRunCreatedAt === undefined) return false;
  if (
    job.status !== "completed" ||
    job.job_kind !== "holistic_batch" ||
    job.holistic_run_id == null
  ) {
    return false;
  }
  if (!serverLatestRunCreatedAt) return true;
  const runMs = new Date(serverLatestRunCreatedAt).getTime();
  const jobMs = new Date(job.updated_at).getTime();
  if (Number.isNaN(runMs) || Number.isNaN(jobMs)) return false;
  return runMs < jobMs - 5000;
}

export function EpisodeRowAnalysisBadge({
  episodeId,
  serverLatestRunCreatedAt,
}: {
  episodeId: number;
  /** 없으면(미전달) 통합·회차 시각 검사 생략 */
  serverLatestRunCreatedAt?: string | null;
}) {
  const ctx = useAnalysisJobsOptional();
  const job = ctx?.getLatestJobForEpisode(episodeId) ?? null;
  if (
    job &&
    holisticCompleteOutOfSyncWithServerRun(job, serverLatestRunCreatedAt)
  ) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-amber-500/25 bg-amber-950/20 px-2 py-0.5 text-[11px] font-medium text-amber-200/90">
        통합 반영 전 · 새로고침
      </span>
    );
  }
  return <AnalysisStatusBadge job={job} variant="episode" />;
}
