"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatEpisodeLabel } from "@/lib/episodeLabel";
import { ScoreText } from "@/components/atoms/ScoreText";
import type { AnalysisRunRow } from "@/lib/analysisSummary";

interface EpisodeRow {
  id: number;
  episode_number: number;
  title: string;
  content: string;
  created_at: string;
}

interface EpisodeRowsProps {
  episodes: EpisodeRow[];
  workId: string;
  latestByEpisode: Map<number, AnalysisRunRow>;
}

/**
 * 작품 상세 회차 테이블 행 — F-C 정정 (LEE 묶음2 결함).
 *
 * 행 클릭 = 분석 화면 진입 (A2 정합).
 * 행 안 「편집」 버튼 = stopPropagation + 편집 화면 진입 (회차편집 nav 별도 트랙 정합).
 * 「분석/재분석」 버튼은 행 클릭과 동일 결과로 시각 강조 (별도 hit area 아님).
 */
export function EpisodeRows({
  episodes,
  workId,
  latestByEpisode,
}: EpisodeRowsProps) {
  const router = useRouter();
  return (
    <>
      {episodes.map((ep) => {
        const latestRun = latestByEpisode.get(ep.id);
        const score = latestRun?.result_json.overall_score ?? null;
        const analyzed = latestByEpisode.has(ep.id);
        const chars = ep.content?.length ?? 0;
        const epLabel = formatEpisodeLabel(
          { episode_number: ep.episode_number, title: null },
          { withTitle: false },
        );
        const goAnalysis = () => router.push(`/works/${workId}/episodes/${ep.id}`);
        const goEdit = (e: React.MouseEvent) => {
          e.stopPropagation();
          router.push(`/works/${workId}/episodes/${ep.id}/edit`);
        };
        return (
          <div
            key={ep.id}
            role="button"
            tabIndex={0}
            onClick={goAnalysis}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goAnalysis();
              }
            }}
            className="group grid cursor-pointer grid-cols-[80px_1fr_90px_80px_70px_70px_40px] items-center gap-4 border-b border-stone-800/40 px-4 py-3.5 text-[13px] transition-colors last:border-b-0 hover:bg-stone-100/[0.02] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-sky-400/40"
          >
            <div className="font-mono text-[12px] tabular-nums text-stone-500">
              {epLabel}
            </div>
            <div className="min-w-0">
              <div className="truncate font-serif text-[14px] text-stone-100">
                {ep.title}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-stone-500">
                {new Date(ep.created_at).toLocaleDateString("ko-KR")}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums text-[12px] text-stone-400">
              {chars.toLocaleString("ko-KR")}자
            </div>
            <div className="text-right">
              {score != null ? (
                <ScoreText score={score} size="sm" />
              ) : (
                <span className="font-mono text-[11px] text-stone-600">—</span>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={goEdit}
                className="inline-flex items-center rounded-md border border-stone-700 bg-stone-900/40 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-stone-300 transition-colors hover:border-sky-400/40 hover:text-sky-200"
              >
                편집
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goAnalysis();
                }}
                className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  analyzed
                    ? "border-stone-700 bg-stone-900/40 text-stone-300 hover:border-sky-400/40 hover:text-sky-200"
                    : "border-sky-400/30 bg-sky-400/[0.08] text-sky-200 hover:border-sky-400/50 hover:bg-sky-400/[0.14]"
                }`}
              >
                {analyzed ? "재분석" : "분석"}
              </button>
            </div>
            <div className="flex justify-end text-stone-600 group-hover:text-sky-300">
              <ChevronRight size={13} aria-hidden="true" />
            </div>
          </div>
        );
      })}
    </>
  );
}
