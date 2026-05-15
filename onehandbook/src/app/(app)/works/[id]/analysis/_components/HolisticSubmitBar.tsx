"use client";

import { Sparkles } from "lucide-react";

interface HolisticSubmitBarProps {
  selectedCount: number;
  natCost: number;
  onCancel: () => void;
  onSubmit: () => void;
  cancelLabel?: string;
}

const MIN_SELECTED = 2;

/**
 * 시안 `design_novel/novel-agent/holistic-report.jsx:412` 정합.
 *
 * 선택 회차 카운트 + NAT 비용 표시 + 일괄 분석 진입 버튼.
 * 최소 2회차 선택 시점에 활성화.
 */
export function HolisticSubmitBar({
  selectedCount,
  natCost,
  onCancel,
  onSubmit,
  cancelLabel = "취소",
}: HolisticSubmitBarProps) {
  const disabled = selectedCount < MIN_SELECTED;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-sky-400/30 bg-sky-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-serif text-[13px] text-stone-100">
          선택한 회차:{" "}
          <span className="tabular-nums text-sky-200">{selectedCount}</span>건
        </div>
        <div className="mt-0.5 font-mono text-[10.5px] tabular-nums text-stone-400">
          일괄 분석 = 회차당 1 NAT × {selectedCount}회차 ={" "}
          <span className="text-sky-200">{natCost} NAT</span> 차감
        </div>
        {disabled && (
          <div className="mt-1 font-mono text-[10px] tabular-nums text-amber-300/80">
            최소 {MIN_SELECTED}회차 이상 선택 필요
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-2 text-[11.5px] text-stone-400 transition-colors hover:bg-stone-100/[0.04] hover:text-stone-200"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-2 text-[12.5px] font-medium text-stone-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500"
        >
          <Sparkles size={11} aria-hidden="true" />
          일괄 분석 진입
        </button>
      </div>
    </div>
  );
}
