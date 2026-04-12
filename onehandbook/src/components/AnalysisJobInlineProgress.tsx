"use client";

import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";
import {
  deriveInlineAnalysisProgress,
  formatAnalysisJobEtaLine,
} from "@/lib/analysis/analysisJobProgressUi";

type Props = {
  /** 서버/Realtime으로 채워진 job (없으면 bootstrapping만 표시) */
  job: AnalysisJobListItem | null;
  /** optimistic 폴링 직후 job 행이 아직 없을 때 */
  bootstrapping?: boolean;
  /** 상단 제목 */
  title?: string;
};

export function AnalysisJobInlineProgress({
  job,
  bootstrapping = false,
  title = "분석 진행 중",
}: Props) {
  if (!job && !bootstrapping) return null;

  const { percent, label, etaLine } = deriveInlineAnalysisProgress(job, {
    bootstrapping,
  });
  const eta =
    etaLine ??
    (job &&
    (job.status === "pending" || job.status === "processing") &&
    job.estimated_seconds != null &&
    job.estimated_seconds > 0
      ? formatAnalysisJobEtaLine(job)
      : null);

  return (
    <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-4 py-3">
      <p className="text-sm font-medium text-cyan-100/95">{title}</p>
      <p className="mt-1 text-xs text-zinc-400">{label}</p>
      {eta && (
        <p className="mt-0.5 text-[11px] text-zinc-500">{eta}</p>
      )}
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-cyan-500/90 transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs tabular-nums text-cyan-200/90">
        {percent}%
      </p>
    </div>
  );
}
