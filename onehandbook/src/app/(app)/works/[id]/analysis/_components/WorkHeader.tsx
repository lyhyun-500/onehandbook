"use client";

import { useRouter } from "next/navigation";
import { GenreTag } from "@/components/atoms/GenreTag";
import { StatusDot } from "@/components/atoms/StatusDot";
import { WorkSelector, type WorkOption } from "@/components/atoms/WorkSelector";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface WorkHeaderProps {
  workId: string;
  works: WorkOption[];
  genre: string;
  status: string;
  totalEpisodes: number;
  analyzedEpisodes: number;
  /** 마지막 분석 시점 ISO. null 시점 = 분석 0건. */
  lastAnalyzedAt: string | null;
  /** 분석 완료 회차의 작품 평균 점수. null = 분석 0건. */
  avgScore: number | null;
}

/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:317-365` 정합 — WorkSelector md 통합.
 */
export function WorkHeader({
  workId,
  works,
  genre,
  status,
  totalEpisodes,
  analyzedEpisodes,
  lastAnalyzedAt,
  avgScore,
}: WorkHeaderProps) {
  const router = useRouter();
  const showAvg = avgScore != null && analyzedEpisodes > 0;

  return (
    <header className="border-b border-stone-800/60 bg-stone-900/40">
      <div className="mx-auto max-w-6xl px-6 py-9">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/70">
              분석 리포트
            </div>
            <div className="mt-2">
              <WorkSelector
                works={works}
                currentId={workId}
                size="lg"
                onChange={(id) => router.push(`/works/${id}/analysis`)}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-stone-400">
              <GenreTag genre={genre} />
              <span className="flex items-center gap-1.5">
                <StatusDot status={status} />
                <span>{status}</span>
              </span>
              <span className="text-stone-700" aria-hidden="true">
                ·
              </span>
              <span>
                <span className="tabular-nums text-stone-300">
                  {totalEpisodes}
                </span>
                <span className="text-stone-500">회차</span>
                <span className="mx-1.5 text-stone-700" aria-hidden="true">
                  ·
                </span>
                <span className="tabular-nums text-stone-200">
                  {analyzedEpisodes}
                </span>
                <span className="text-stone-500">회차 분석 완료</span>
              </span>
              {lastAnalyzedAt && (
                <>
                  <span className="text-stone-700" aria-hidden="true">
                    ·
                  </span>
                  <span>
                    마지막 분석{" "}
                    <span className="text-stone-200">
                      {formatRelativeTime(lastAnalyzedAt)}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          {showAvg && (
            <div className="hidden shrink-0 text-right md:block">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-stone-500">
                작품 평균
              </div>
              <div className="mt-2 flex items-baseline justify-end gap-1.5">
                <span className="font-serif text-[64px] font-medium leading-none tabular-nums text-sky-300">
                  {avgScore}
                </span>
                <span className="font-mono text-[13px] tabular-nums text-stone-500">
                  /100
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
