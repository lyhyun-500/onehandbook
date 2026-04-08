"use client";

import { CopyWithBreaks } from "@/components/CopyWithBreaks";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 표시용 회차 번호(없으면 생략) */
  episodeNumbers?: number[];
};

export function EpisodeInActiveAnalysisModal({
  open,
  onClose,
  episodeNumbers,
}: Props) {
  if (!open) return null;

  const label =
    episodeNumbers && episodeNumbers.length > 0
      ? episodeNumbers.sort((a, b) => a - b).join(", ")
      : null;

  return (
    <div className="fixed inset-0 z-[78] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-busy-title"
        className="w-full max-w-md rounded-xl border border-zinc-600/40 bg-zinc-900 p-6 shadow-2xl shadow-black/40"
      >
        <h2
          id="ep-busy-title"
          className="text-lg font-semibold text-zinc-100"
        >
          이미 분석 진행 중
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          <CopyWithBreaks as="span" className="block">
            해당 회차가 현재 진행 중인 분석 작업(단일 회차 분석 또는 통합 분석)에 포함되어 있어, 새 분석을 시작할 수 없습니다. 진행 중인 작업이 끝난 뒤 다시 시도해 주세요.
          </CopyWithBreaks>
        </p>
        {label ? (
          <p className="mt-3 text-sm font-medium text-amber-200/90">
            회차: {label}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
