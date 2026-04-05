"use client";

import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAnalysisJobsOptional } from "@/contexts/AnalysisJobsContext";

const SCAN_MS = 1500;

type WorkRow = {
  id: number;
  title: string;
  genre: string;
  status: string;
  total_episodes: number;
};

const STATUS_LABEL: Record<string, string> = {
  연재중: "연재중",
  완결: "완결",
  휴재: "휴재",
};

function scoreClass(score: number) {
  if (score >= 70) return "text-cyan-300";
  if (score >= 40) return "text-amber-400";
  return "text-zinc-500";
}

export function DashboardWorkCard({
  work,
  agentScore,
}: {
  work: WorkRow;
  agentScore: number | null;
}) {
  const analysisJobs = useAnalysisJobsOptional();
  const workAnalyzing = analysisJobs?.workHasAnalyzingEpisode(work.id) ?? false;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      queueMicrotask(() => setRevealed(true));
      return;
    }
    const t = window.setTimeout(() => setRevealed(true), SCAN_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <Link
      href={`/works/${work.id}`}
      className={`relative flex items-center justify-between gap-4 overflow-hidden rounded-xl border border-cyan-500/10 bg-zinc-900/50 p-5 shadow-md shadow-black/10 transition-colors hover:border-cyan-500/25 hover:bg-zinc-900/70 sm:p-6 ${!revealed ? "pb-9 sm:pb-10" : ""}`}
    >
      {!revealed && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
            aria-hidden
          >
            <div className="ohb-scan-beam" />
          </div>
          <p className="pointer-events-none absolute bottom-2 left-0 right-0 z-20 px-4 text-center text-[11px] leading-snug text-cyan-400/85 sm:bottom-3 sm:text-xs">
            <CopyWithBreaks as="span">
              에이전트가 원고를 정밀 분석 중입니다...
            </CopyWithBreaks>
          </p>
        </>
      )}

      <div className="relative z-0 min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold text-zinc-100">
          {work.title}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
          <span>{work.genre}</span>
          <span className="text-zinc-600">·</span>
          <span>{STATUS_LABEL[work.status] ?? work.status}</span>
          <span className="text-zinc-600">·</span>
          <span>{work.total_episodes}화</span>
          {workAnalyzing && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-950/40 px-2 py-0.5 text-xs font-medium text-sky-200/95">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
              </span>
              <span className="animate-pulse">분석 중</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative z-0 flex shrink-0 items-center gap-6">
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-400/80">
            Agent Score
          </p>
          {revealed ? (
            agentScore != null ? (
              <>
                <p
                  className={`text-2xl font-bold tabular-nums ${scoreClass(agentScore)}`}
                >
                  {agentScore}
                </p>
                <p className="text-xs text-zinc-500">/ 100</p>
              </>
            ) : (
              <p className="text-lg font-medium text-zinc-600">—</p>
            )
          ) : (
            <div className="min-h-[3.25rem] min-w-[3rem] pt-0.5" aria-hidden />
          )}
        </div>
      </div>
    </Link>
  );
}
