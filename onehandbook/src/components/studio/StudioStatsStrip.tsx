import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface StudioStats {
  totalWorks: number;
  totalEpisodes: number;
  totalAnalyzed: number;
  /** 분석 회차 평균 점수 (정수). 0건 박힘 시 null. */
  avgScore: number | null;
  /** 연재중 작품 수 (서브 카피 박음). */
  ongoingCount: number;
}

export interface StudioStatsStripProps extends HTMLAttributes<HTMLDivElement> {
  stats: StudioStats;
}

export const StudioStatsStrip = forwardRef<HTMLDivElement, StudioStatsStripProps>(
  function StudioStatsStrip({ stats, className, ...props }, ref) {
    const cells: { k: string; v: string | number; sub: string }[] = [
      {
        k: "총 작품",
        v: stats.totalWorks,
        sub: `연재중 ${stats.ongoingCount}편`,
      },
      {
        k: "총 회차",
        v: stats.totalEpisodes,
        sub: "누적 집필",
      },
      {
        k: "분석된 작품",
        v: `${stats.totalAnalyzed}/${stats.totalWorks}`,
        sub: "Agent Score 보유",
      },
      {
        k: "평균 점수",
        v: stats.avgScore ?? "-",
        sub: "분석 회차 평균",
      },
    ];

    return (
      <div
        ref={ref}
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-800/60 bg-stone-800/60 sm:grid-cols-4",
          className,
        )}
        {...props}
      >
        {cells.map((s) => (
          <div key={s.k} className="bg-stone-950/60 px-5 py-4">
            <div className="text-[11px] text-stone-400">{s.k}</div>
            <div className="mt-1.5 font-serif text-[24px] leading-none tabular-nums text-stone-100">
              {s.v}
            </div>
            <div className="mt-1 text-[11px] text-stone-400">{s.sub}</div>
          </div>
        ))}
      </div>
    );
  },
);
StudioStatsStrip.displayName = "StudioStatsStrip";
