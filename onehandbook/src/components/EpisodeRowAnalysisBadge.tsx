"use client";

import { useAnalysisJobsOptional } from "@/contexts/AnalysisJobsContext";
import { AnalysisStatusBadge } from "@/components/AnalysisStatusBadge";
import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";

/**
 * 통합 분석 완료 작업이 회차마다 DB 동기화되기 전에도 모든 회차에 "분석 완료"가 붙는 문제:
 * 서버에서 내려준 해당 회차 최신 analysis_runs.created_at 이 이번 통합 작업 이전이면(스테일) 완료 뱃지 대신 안내.
 *
 * 비교 기준은 `updated_at`이 아니라 `created_at`(작업 큐 시각)이다. 회차별 run은 배치 중에 먼저 쌓이고
 * 부모 행의 `updated_at`은 전체 종료 시점이라 항상 run보다 늦어, updated_at 기준이면 정상 반영 후에도
 * "통합 반영 전"이 뜨는 오판이 난다.
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
  const batchStartMs = new Date(job.created_at).getTime();
  if (Number.isNaN(runMs) || Number.isNaN(batchStartMs)) return false;
  return runMs < batchStartMs - 5000;
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
