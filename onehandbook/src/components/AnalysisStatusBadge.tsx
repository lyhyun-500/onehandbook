"use client";

import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";

type Variant = "episode" | "work";

export function AnalysisStatusBadge({
  job,
  variant = "episode",
}: {
  job: AnalysisJobListItem | null;
  variant?: Variant;
}) {
  if (!job) return null;

  if (job.status === "pending" || job.status === "processing") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-950/40 px-2 py-0.5 text-xs font-medium text-sky-200/95 ${
          variant === "work" ? "shrink-0" : ""
        }`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
        </span>
        <span className="animate-pulse">분석 중</span>
      </span>
    );
  }

  if (job.status === "completed") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-950/35 px-2 py-0.5 text-xs font-medium text-emerald-300/95">
        분석 완료
      </span>
    );
  }

  if (job.status === "failed") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-red-500/35 bg-red-950/35 px-2 py-0.5 text-xs font-medium text-red-300/95">
        분석 실패
      </span>
    );
  }

  return null;
}
