import { GenreTag } from "@/components/atoms/GenreTag";
import { StatusDot } from "@/components/atoms/StatusDot";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface WorkHeaderProps {
  title: string;
  genre: string;
  status: string;
  totalEpisodes: number;
  analyzedEpisodes: number;
  /** 마지막 분석 시점 ISO. null 시점 = 분석 0건 본질. */
  lastAnalyzedAt: string | null;
  /** 분석 완료 회차의 작품 평균 점수. null = 분석 0건 시점. */
  avgScore: number | null;
}

/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:317-365` 정합 — 작품 분석 헤더.
 *
 * WorkSelector 영역 부재 (LEE 결정 Z7 (b) — Phase 2-D-8-5 후보).
 * 우측 작품 평균 = 분석 1+ 회차 시점에만 표시.
 */
export function WorkHeader({
  title,
  genre,
  status,
  totalEpisodes,
  analyzedEpisodes,
  lastAnalyzedAt,
  avgScore,
}: WorkHeaderProps) {
  const showAvg = avgScore != null && analyzedEpisodes > 0;
  return (
    <header className="border-b border-stone-800/60 bg-stone-900/40">
      <div className="mx-auto max-w-6xl px-6 py-9">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/70">
              분석 리포트
            </div>
            <h1 className="mt-2 font-serif text-[34px] font-medium leading-tight tracking-tight text-stone-100">
              {title}
            </h1>
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
