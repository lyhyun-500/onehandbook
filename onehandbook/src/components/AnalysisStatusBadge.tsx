"use client";

import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";
import { isContentUnchangedFailure } from "@/lib/analysis/analysisJobFailureHeuristics";

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
    const unchanged = isContentUnchangedFailure(job);
    const detail = job.error_message?.trim();
    if (unchanged) {
      return (
        <div className="flex max-w-[16rem] flex-col gap-1">
          <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-amber-500/35 bg-amber-950/30 px-2 py-0.5 text-xs font-medium text-amber-200/95">
            원고 변경 없음
          </span>
          {detail ? (
            <span
              className="text-[10px] leading-snug text-amber-200/75 line-clamp-4"
              title={detail}
            >
              {detail}
            </span>
          ) : null}
        </div>
      );
    }
    return (
      <div className="flex max-w-[16rem] flex-col gap-1">
        <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-red-500/35 bg-red-950/35 px-2 py-0.5 text-xs font-medium text-red-300/95">
          분석 실패
        </span>
        {detail ? (
          <span
            className="text-[10px] leading-snug text-red-300/80 line-clamp-4"
            title={detail}
          >
            {detail}
          </span>
        ) : (
          <span className="text-[10px] text-zinc-500">
            Supabase analysis_jobs 테이블의 error_message 열을 확인해 주세요.
          </span>
        )}
      </div>
    );
  }

  return null;
}
