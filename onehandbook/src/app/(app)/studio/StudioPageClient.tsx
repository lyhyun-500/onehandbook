"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAnalysisJobsOptional } from "@/contexts/AnalysisJobsContext";
import {
  StudioWorkCard,
  type StudioWorkData,
  type StudioWorkLayout,
} from "@/components/studio/StudioWorkCard";
import {
  StudioStatsStrip,
  type StudioStats,
} from "@/components/studio/StudioStatsStrip";
import {
  StudioFilters,
  type StudioWorkFilter,
} from "@/components/studio/StudioFilters";
import { AddWorkButton } from "./AddWorkButton";

export interface StudioPageClientProps {
  userId: number;
  works: StudioWorkData[];
  stats: StudioStats;
}

export function StudioPageClient({
  userId,
  works,
  stats,
}: StudioPageClientProps) {
  const [filter, setFilter] = useState<StudioWorkFilter>("전체");
  const [layout, setLayout] = useLocalStorage<StudioWorkLayout>(
    "studio-layout",
    "card",
  );

  const analysisJobs = useAnalysisJobsOptional();

  const filteredWorks = useMemo(() => {
    if (filter === "전체") return works;
    return works.filter((w) => w.status === filter);
  }, [filter, works]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[11px] tracking-widest text-sky-300/85">
            작가 스튜디오
          </div>
          <h1 className="font-serif text-[28px] leading-tight tracking-tight text-stone-100">
            오늘도 작업실을 엽니다,{" "}
            <span className="font-normal text-stone-400">작가님</span>.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-stone-400">
            등록된 작품 {stats.totalWorks}편 · 분석된 작품 {stats.totalAnalyzed}
            편 · 평균 {stats.avgScore ?? "-"}점
          </p>
        </div>
        <AddWorkButton userId={userId} />
      </div>

      <div className="mb-8">
        <StudioStatsStrip stats={stats} />
      </div>

      <div className="mb-4">
        <StudioFilters
          filter={filter}
          onFilterChange={setFilter}
          layout={layout}
          onLayoutChange={setLayout}
        />
      </div>

      {filteredWorks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-700/60 bg-stone-900/30 p-10 text-center text-sm text-stone-400">
          {filter} 작품이 없습니다.
        </div>
      ) : layout === "card" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorks.map((w) => (
            <StudioWorkCard
              key={w.id}
              work={w}
              layout="card"
              workAnalyzing={
                analysisJobs?.workHasAnalyzingEpisode(w.id) ?? false
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorks.map((w) => (
            <StudioWorkCard
              key={w.id}
              work={w}
              layout="list"
              workAnalyzing={
                analysisJobs?.workHasAnalyzingEpisode(w.id) ?? false
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
