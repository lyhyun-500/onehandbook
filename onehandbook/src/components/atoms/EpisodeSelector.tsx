"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { formatEpisodeLabel } from "@/lib/episodeLabel";

export type EpisodeAnalysisStatus =
  | "completed"
  | "processing"
  | "failed"
  | "none";

export interface EpisodeOption {
  id: number;
  episode_number: number;
  title: string;
  analysis_status: EpisodeAnalysisStatus;
}

interface EpisodeSelectorProps {
  workId: number;
  currentEpisodeId: number;
  episodes: EpisodeOption[];
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: { title: "text-[13px]", meta: "text-[10px]", trigger: "py-1.5 px-2.5 gap-2", chev: 11 },
  md: { title: "text-[15px]", meta: "text-[10.5px]", trigger: "py-2 px-3 gap-2.5", chev: 12 },
  lg: { title: "text-[18px]", meta: "text-[11px]", trigger: "py-2.5 px-3.5 gap-3", chev: 13 },
} as const;

function StatusDot({ status }: { status: EpisodeAnalysisStatus }) {
  if (status === "processing") {
    return (
      <span className="relative inline-flex h-2 w-2 shrink-0" aria-label="분석 진행 중">
        <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" />
      </span>
    );
  }
  const cls =
    status === "completed"
      ? "bg-emerald-400"
      : status === "failed"
        ? "bg-rose-400"
        : "bg-stone-600";
  const label =
    status === "completed"
      ? "분석 완료"
      : status === "failed"
        ? "분석 실패"
        : "분석 없음";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`}
      aria-label={label}
    />
  );
}

/**
 * 회차 전환 selector — 시안 atoms.jsx WorkSelector 패턴 정합.
 * 시안 자체에 EpisodeSelector 부재 — 본 프로젝트 한정 신설.
 */
export function EpisodeSelector({
  workId,
  currentEpisodeId,
  episodes,
  size = "md",
}: EpisodeSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const sorted = [...episodes].sort(
    (a, b) => a.episode_number - b.episode_number,
  );
  const current = sorted.find((e) => e.id === currentEpisodeId) ?? sorted[0];
  if (!current) return null;

  const sz = SIZE_MAP[size];

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center rounded-md border border-stone-800 bg-stone-900/60 hover:border-stone-700 ${sz.trigger}`}
      >
        <StatusDot status={current.analysis_status} />
        <div className="min-w-0 text-left">
          <div
            className={`font-mono uppercase tracking-[0.25em] text-stone-500 ${sz.meta}`}
          >
            회차
          </div>
          <div
            className={`font-serif text-stone-100 leading-tight ${sz.title}`}
          >
            {formatEpisodeLabel(current)}
          </div>
        </div>
        <ChevronDown
          size={sz.chev}
          className={
            open
              ? "rotate-180 text-stone-300 transition-transform"
              : "text-stone-500 transition-transform"
          }
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-[380px] overflow-hidden rounded-md border border-stone-800 bg-stone-900/95 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)] backdrop-blur">
          <div className="flex items-baseline justify-between border-b border-stone-800/60 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
              회차 전환
            </div>
            <div className="font-mono text-[11px] tabular-nums text-stone-400">
              {sorted.length}화
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {sorted.map((ep) => {
              const isCur = ep.id === current.id;
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!isCur) {
                      router.push(`/works/${workId}/episodes/${ep.id}`);
                    }
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-800/60 ${
                    isCur
                      ? "bg-sky-400/[0.06] border-l-2 border-sky-400"
                      : "border-l-2 border-transparent"
                  }`}
                >
                  <StatusDot status={ep.analysis_status} />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-serif text-[13.5px] leading-snug ${
                        isCur ? "text-stone-100" : "text-stone-200"
                      } truncate`}
                    >
                      {formatEpisodeLabel(ep)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
