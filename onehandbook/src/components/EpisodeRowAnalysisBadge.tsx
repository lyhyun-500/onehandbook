"use client";

import { useAnalysisJobsOptional } from "@/contexts/AnalysisJobsContext";
import { AnalysisStatusBadge } from "@/components/AnalysisStatusBadge";

export function EpisodeRowAnalysisBadge({ episodeId }: { episodeId: number }) {
  const ctx = useAnalysisJobsOptional();
  const job = ctx?.getLatestJobForEpisode(episodeId) ?? null;
  return <AnalysisStatusBadge job={job} variant="episode" />;
}
