import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

export interface HolisticLink {
  runId: string;
  workId: number;
  /** 이 run 이 포함한 회차 수. */
  episodeCount: number;
  /** 이 run 의 회차 범위 라벨 (예: "43~46화"). */
  rangeLabel: string;
  /** 일괄 분석 overall_score. 부재면 null. */
  runScore: number | null;
  /** yyyy.MM.dd */
  runDate: string;
}

/**
 * 회차 상세에서 "이 회차가 속한 일괄 분석 보기" 인라인 link.
 *
 * D-19/B-3: 한 회차가 N개 holistic_run 소속 가능 (LEE 결정 = 최신 1건만 표시).
 * 클릭 → `/works/[id]/analysis?tab=holistic&run=<runId>` — 기존 deep-link 지원
 * (`WorkAnalysisPage` 의 `currentRunId` searchParam 처리, S-IA 실측).
 */
export function HolisticLinkBanner({ link }: { link: HolisticLink }) {
  return (
    <Link
      href={`/works/${link.workId}/analysis?tab=holistic&run=${link.runId}`}
      className="group mb-4 flex items-center gap-3 rounded-md border border-sky-400/25 bg-sky-400/[0.06] px-4 py-3 transition-colors hover:border-sky-400/40 hover:bg-sky-400/[0.10]"
    >
      <Sparkles
        size={14}
        aria-hidden="true"
        className="shrink-0 text-sky-300"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 font-mono text-[10.5px] uppercase tracking-widest text-sky-200/90">
          <span>일괄 분석</span>
          <span className="text-stone-600">·</span>
          <span className="tabular-nums">{link.runDate}</span>
          <span className="text-stone-600">·</span>
          <span className="tabular-nums">{link.episodeCount}회차</span>
        </div>
        <div className="mt-1 font-serif text-[13px] text-stone-300">
          이 회차가 속한{" "}
          <span className="text-stone-100">{link.rangeLabel}</span> 통합 일괄
          분석 보기
        </div>
      </div>
      {link.runScore != null && (
        <span className="shrink-0 font-mono text-[14px] tabular-nums text-sky-200">
          {link.runScore}
          <span className="ml-0.5 text-[10px] text-stone-500">/100</span>
        </span>
      )}
      <ChevronRight
        size={14}
        aria-hidden="true"
        className="shrink-0 text-stone-600 group-hover:text-sky-300"
      />
    </Link>
  );
}
