"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type AnalysisTab = "individual" | "holistic";

interface TabSegmentProps {
  workId: string;
  activeTab: AnalysisTab;
}

const TABS: { id: AnalysisTab; label: string; hint: string }[] = [
  {
    id: "individual",
    label: "개별 분석 리포트",
    hint: "회차 단독 분석 결과 집계",
  },
  {
    id: "holistic",
    label: "일괄 분석 리포트",
    hint: "선택 구간 통합 narrative",
  },
];

/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:412-434` 정합 — 2 탭 segment.
 *
 * URL searchParams ?tab=individual|holistic 본질 (LEE 결정 Z4 (a)).
 * 기존 ?tab=batch 영역 = page.tsx 영역에서 "holistic" 으로 정규화.
 */
export function TabSegment({ workId, activeTab }: TabSegmentProps) {
  const router = useRouter();

  return (
    <div className="mb-6 inline-flex w-full max-w-2xl rounded-lg border border-stone-800/70 bg-stone-900/30 p-1">
      {TABS.map((t) => {
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              const params = new URLSearchParams();
              params.set("tab", t.id);
              router.push(`/works/${workId}/analysis?${params.toString()}`);
            }}
            className={cn(
              "relative flex-1 rounded-md px-4 py-2.5 text-left transition-colors",
              active
                ? "bg-stone-100/[0.06] text-stone-100 ring-1 ring-inset ring-stone-700/60"
                : "text-stone-400 hover:text-stone-200",
            )}
          >
            <div className="font-serif text-[13.5px]">{t.label}</div>
            <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-widest text-stone-500">
              {t.hint}
            </div>
          </button>
        );
      })}
    </div>
  );
}
