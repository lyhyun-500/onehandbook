"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

export type BatchAnalyzeCTAState = "none" | "partial" | "all_analyzed";

interface BatchAnalyzeCTAProps {
  workId: string;
  state: BatchAnalyzeCTAState;
  /** 총 회차 수 */
  totalEpisodes: number;
  /** 분석 완료 회차 수 */
  analyzedEpisodes: number;
  /** 미분석 회차에 한정한 일괄 분석 NAT 비용 (state = partial 시 의미) */
  partialNatCost: number;
  /** 전체 회차 일괄 분석 NAT 비용 (state = none 또는 all_analyzed 시 의미) */
  totalNatCost: number;
  /** 마지막 분석 시점 (all_analyzed 표시 영역) */
  lastAnalyzedAt: string | null;
}

/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:217` 정합 — 3 state CTA.
 *
 * 위치: WorkHeader 와 TabSegment 사이 (작품 단위 전역 노출, tab 무관).
 * 클릭 동작: holistic tab `mode = "select"` 진입 — `?tab=holistic&mode=select` 라우팅.
 * NAT 산식: `computeHolisticNatCost` — 회차당 1 NAT + 옵션 가산.
 */
export function BatchAnalyzeCTA({
  workId,
  state,
  totalEpisodes,
  analyzedEpisodes,
  partialNatCost,
  totalNatCost,
  lastAnalyzedAt,
}: BatchAnalyzeCTAProps) {
  const router = useRouter();
  const unanalyzedCount = Math.max(0, totalEpisodes - analyzedEpisodes);

  const goSelect = (preselect?: "missing" | "all") => {
    const params = new URLSearchParams();
    params.set("tab", "holistic");
    params.set("mode", "select");
    if (preselect) params.set("preselect", preselect);
    router.push(`/works/${workId}/analysis?${params.toString()}`);
  };

  if (state === "none") {
    return (
      <section className="mb-8 rounded-lg border border-dashed border-stone-700 bg-stone-900/40 px-8 py-12">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-400/[0.08] text-sky-300 ring-1 ring-inset ring-sky-400/20">
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <h3 className="font-serif text-[18px] text-stone-100">
            작품 일괄 분석 진입
          </h3>
          <p className="mt-2 font-serif text-[13px] leading-relaxed text-stone-400">
            <span className="tabular-nums text-stone-200">{totalEpisodes}</span>
            개 회차를 한 번에 분석합니다. 작품 통합 점수, 회차별 결과, 6축 추세가
            자동으로 정리됩니다.
          </p>

          <div className="mt-5 flex items-center gap-2 rounded-md border border-stone-800/80 bg-stone-950/60 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
              차감
            </span>
            <span className="inline-flex items-center rounded-md bg-sky-400/[0.10] px-2 py-0.5 font-mono text-[11.5px] tabular-nums text-sky-200 ring-1 ring-inset ring-sky-400/20">
              {totalNatCost} NAT
            </span>
            <span className="text-[11px] text-stone-500">
              회차당 1 NAT × {totalEpisodes}회차 합산
            </span>
          </div>

          <button
            type="button"
            onClick={() => goSelect("all")}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-sky-500 px-5 text-[13px] font-medium text-stone-950 transition-colors hover:bg-sky-400"
          >
            <Sparkles size={13} aria-hidden="true" />
            일괄 분석 진입
          </button>
        </div>
      </section>
    );
  }

  if (state === "partial") {
    return (
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-sky-400/30 bg-sky-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-400/[0.12] text-sky-300">
            <Sparkles size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-serif text-[13px] text-stone-100">
              미분석 회차{" "}
              <span className="tabular-nums text-sky-200">
                {unanalyzedCount}
              </span>
              건
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] tabular-nums text-stone-400">
              {unanalyzedCount}회차 일괄 분석 = {partialNatCost} NAT 차감
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => goSelect("missing")}
          className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3.5 py-2 text-[12px] font-medium text-stone-950 transition-colors hover:bg-sky-400"
        >
          <Sparkles size={11} aria-hidden="true" />
          미분석 회차 일괄 분석
        </button>
      </div>
    );
  }

  // all_analyzed
  return (
    <section className="mb-8 flex flex-col gap-3 rounded-lg border border-stone-800/60 bg-stone-900/30 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/[0.10] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            모든 회차 분석 완료
          </span>
          {lastAnalyzedAt && (
            <span className="font-mono text-[10.5px] text-stone-500">
              마지막 분석 {formatRelativeTime(lastAnalyzedAt)}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-xl font-serif text-[12.5px] leading-relaxed text-stone-400">
          분석 결과는 회차 본문 변경 시 자동으로 갱신되지 않습니다. 본문을 수정한
          회차가 있다면 재분석을 진입해 주세요.
        </p>
      </div>
      <button
        type="button"
        onClick={() => goSelect("all")}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/60 px-3.5 py-2 text-[12px] text-stone-200 transition-colors hover:border-sky-400/40 hover:text-sky-200"
      >
        <Sparkles size={11} aria-hidden="true" />
        일괄 재분석 진입
      </button>
    </section>
  );
}
