import { forwardRef } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GenreTag } from "@/components/atoms/GenreTag";
import { StatusDot } from "@/components/atoms/StatusDot";
import { ScoreText } from "@/components/atoms/ScoreText";
import { Sparkline } from "@/components/studio/Sparkline";

export type StudioWorkLayout = "card" | "list";
export type StudioWorkDensity = "compact" | "dense" | "default";

export interface StudioWorkData {
  id: number;
  title: string;
  genre: string;
  status: string;
  totalEpisodes: number;
  agentScore?: number | null;
  lastAnalyzedAt?: string | null;
  recentScores?: number[] | null;
}

export interface StudioWorkCardProps {
  work: StudioWorkData;
  layout: StudioWorkLayout;
  density?: StudioWorkDensity;
  /**
   * AnalysisJobsContext 박은 분석 진행 표시 (시안 외 — 기존 기능 보존).
   * Phase 2-D-5 페이지 마이그레이션 박음 시점에 useAnalysisJobsOptional 결과 박음.
   */
  workAnalyzing?: boolean;
}

const PADDING_BY_DENSITY: Record<StudioWorkDensity, string> = {
  compact: "p-4",
  dense: "p-3",
  default: "p-5",
};

function AnalyzingPulse() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-950/40 px-2 py-0.5 text-[10.5px] font-medium text-sky-200/95">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
      </span>
      <span className="animate-pulse">분석 중</span>
    </span>
  );
}

export const StudioWorkCard = forwardRef<HTMLAnchorElement, StudioWorkCardProps>(
  function StudioWorkCard(
    { work, layout, density = "default", workAnalyzing = false },
    ref,
  ) {
    const padding = PADDING_BY_DENSITY[density];
    const href = `/works/${work.id}`;

    if (layout === "list") {
      return (
        <Link
          ref={ref}
          href={href}
          className={cn(
            "group flex items-center gap-5 rounded-lg border border-stone-800/60 bg-stone-900/30 transition-colors hover:border-sky-500/30 hover:bg-stone-900/50",
            padding,
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h3 className="truncate font-serif text-[15px] font-medium text-stone-100">
                {work.title}
              </h3>
              <GenreTag genre={work.genre} />
              {workAnalyzing && <AnalyzingPulse />}
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-stone-400">
              <span className="flex items-center gap-1.5">
                <StatusDot status={work.status} />
                {work.status}
              </span>
              <span>{work.totalEpisodes}화</span>
              {work.lastAnalyzedAt && (
                <span>마지막 분석 · {work.lastAnalyzedAt}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-8">
            <div className="text-right">
              <div className="text-[10px] text-stone-400">에이전트 점수</div>
              <div className="leading-tight">
                <ScoreText score={work.agentScore ?? null} size="md" />
              </div>
            </div>
            <ChevronRight
              size={14}
              className="text-stone-400 group-hover:text-stone-200"
              aria-hidden="true"
            />
          </div>
        </Link>
      );
    }

    return (
      <Link
        ref={ref}
        href={href}
        className="group relative flex flex-col rounded-lg border border-stone-800/60 bg-stone-900/30 transition-all hover:border-sky-500/40 hover:bg-stone-900/60"
      >
        <div className={padding}>
          <div className="mb-3 flex items-center justify-between">
            <GenreTag genre={work.genre} />
            <span className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <StatusDot status={work.status} />
              {work.status}
            </span>
          </div>
          <h3 className="line-clamp-2 font-serif text-[16px] font-medium leading-snug text-stone-100">
            {work.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400">
            <span>{work.totalEpisodes}화</span>
            {workAnalyzing && <AnalyzingPulse />}
          </div>
          {work.recentScores && work.recentScores.length > 0 && (
            <Sparkline scores={work.recentScores} />
          )}
        </div>
        <div className="mt-auto flex items-end justify-between border-t border-stone-800/40 px-5 py-3">
          <div>
            <div className="text-[10px] text-stone-400">에이전트 점수</div>
            <ScoreText score={work.agentScore ?? null} size="md" />
          </div>
          <div className="flex items-center gap-1 text-[11px] text-stone-400 transition-colors group-hover:text-sky-200">
            작품 열기
            <ChevronRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </div>
      </Link>
    );
  },
);
StudioWorkCard.displayName = "StudioWorkCard";
