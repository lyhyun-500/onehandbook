"use client";

import { useEffect, useState } from "react";
import { formatEpisodeLabel } from "@/lib/episodeLabel";

export interface RangeSelectorEpisode {
  id: number;
  episode_number: number;
  title: string;
  /** 개별/통합 분석 완료 여부 — "분석된 회차만" 빠른 선택 영역에 사용. */
  analyzed: boolean;
}

interface HolisticRangeSelectorProps {
  episodes: RangeSelectorEpisode[];
  selectedIds: Set<number>;
  onChange: (next: Set<number>) => void;
}

const QUICK_PRESETS: { label: string; range: [number, number] }[] = [
  { label: "1~10화", range: [1, 10] },
  { label: "11~20화", range: [11, 20] },
  { label: "1~5화", range: [1, 5] },
  { label: "6~10화", range: [6, 10] },
];

/**
 * 시안 `design_novel/novel-agent/holistic-report.jsx:315` 정합.
 *
 * 영역 본질:
 * - amber notice (안내)
 * - quick presets (1~10/11~20/1~5/6~10화)
 * - 시작/끝 회차 input + 4 액션 (범위로 선택 / 전체 / 해제 / 분석된 회차만)
 * - 회차 checkbox grid (최대 280px scroll)
 */
export function HolisticRangeSelector({
  episodes,
  selectedIds,
  onChange,
}: HolisticRangeSelectorProps) {
  const [startNum, setStartNum] = useState<string>("");
  const [endNum, setEndNum] = useState<string>("");

  // 첫 진입 시 input 기본값 = 회차 범위
  useEffect(() => {
    if (episodes.length === 0) return;
    if (startNum === "" && endNum === "") {
      setStartNum(String(episodes[0].episode_number));
      setEndNum(String(episodes[episodes.length - 1].episode_number));
    }
  }, [episodes, startNum, endNum]);

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(episodes.map((e) => e.id)));
  const clearAll = () => onChange(new Set());

  const selectAnalyzed = () => {
    // "분석된 회차만" — 시안 라벨 본질. 실 동작 = 분석되지 않은 회차만 골라 일괄 분석 진입.
    // (분석 완료된 회차 + 미분석 회차 중 후자만 선택해야 새 일괄 분석에 의미가 있음.)
    // → 미분석 회차만 선택으로 정정.
    const next = new Set(
      episodes.filter((e) => !e.analyzed).map((e) => e.id)
    );
    onChange(next);
  };

  const applyRange = () => {
    const s = parseInt(startNum, 10);
    const e = parseInt(endNum, 10);
    if (Number.isNaN(s) || Number.isNaN(e)) return;
    const lo = Math.min(s, e);
    const hi = Math.max(s, e);
    const next = new Set(
      episodes
        .filter((ep) => ep.episode_number >= lo && ep.episode_number <= hi)
        .map((ep) => ep.id)
    );
    onChange(next);
  };

  const selectPreset = (lo: number, hi: number) => {
    setStartNum(String(lo));
    setEndNum(String(hi));
    const next = new Set(
      episodes
        .filter((ep) => ep.episode_number >= lo && ep.episode_number <= hi)
        .map((ep) => ep.id)
    );
    onChange(next);
  };

  return (
    <section className="rounded-lg border border-stone-800/60 bg-stone-900/30 p-6">
      <header className="mb-2">
        <h3 className="font-serif text-[16px] text-stone-100">
          선택 구간 점수
        </h3>
        <p className="mt-1 text-[12px] text-stone-500">
          아래 목록은 1화부터 오름차순입니다.
        </p>
      </header>

      <div className="my-4 rounded-md border border-amber-400/30 bg-amber-400/[0.04] px-4 py-3">
        <p className="font-serif text-[12.5px] leading-relaxed text-amber-200/90">
          체크박스로 분석할 회차를 고른 뒤, 선택한 원고를 한 번에 합쳐 통합
          리포트를 받습니다.
          <br />
          회차별 개별 점수가 아니라 작품 흐름 기준 종합 분석입니다.
          <br />한 화만 보려면 회차 상세 페이지의 단일 분석을 이용하세요.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
          QUICK
        </span>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => selectPreset(p.range[0], p.range[1])}
            className="rounded-full border border-stone-700 bg-stone-900/40 px-2.5 py-1 font-mono text-[10.5px] tabular-nums text-stone-300 transition-colors hover:border-sky-400/40 hover:text-sky-200"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-stone-500">
            시작 회차 <span className="text-stone-600">(화 번호)</span>
          </label>
          <input
            type="number"
            value={startNum}
            onChange={(e) => setStartNum(e.target.value)}
            className="mt-1 w-24 rounded-md border border-stone-800 bg-stone-900/60 px-3 py-2 text-center font-mono text-[14px] tabular-nums text-stone-100 focus:border-sky-400/40 focus:outline-none"
          />
        </div>
        <span className="pb-2 text-stone-600" aria-hidden="true">
          ~
        </span>
        <div>
          <label className="block text-[11px] text-stone-500">
            끝 회차 <span className="text-stone-600">(화 번호)</span>
          </label>
          <input
            type="number"
            value={endNum}
            onChange={(e) => setEndNum(e.target.value)}
            className="mt-1 w-24 rounded-md border border-stone-800 bg-stone-900/60 px-3 py-2 text-center font-mono text-[14px] tabular-nums text-stone-100 focus:border-sky-400/40 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={applyRange}
            className="rounded-md border border-stone-700 bg-stone-900/60 px-3 py-2 text-[11.5px] text-stone-200 transition-colors hover:border-sky-400/40 hover:text-sky-200"
          >
            범위로 선택
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="rounded-md border border-stone-800 bg-stone-900/40 px-3 py-2 text-[11.5px] text-stone-300 transition-colors hover:border-stone-700"
          >
            전체
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-stone-800 bg-stone-900/40 px-3 py-2 text-[11.5px] text-stone-300 transition-colors hover:border-stone-700"
          >
            해제
          </button>
          <button
            type="button"
            onClick={selectAnalyzed}
            className="rounded-md border border-stone-800 bg-stone-900/40 px-3 py-2 text-[11.5px] text-stone-300 transition-colors hover:border-stone-700"
          >
            미분석 회차만
          </button>
        </div>
      </div>

      <div className="mt-5 max-h-[280px] overflow-y-auto rounded-md border border-stone-800/60">
        {episodes.map((e) => {
          const checked = selectedIds.has(e.id);
          return (
            <label
              key={e.id}
              className={`flex cursor-pointer items-center gap-3 border-b border-stone-800/40 px-4 py-2.5 transition-colors last:border-b-0 ${
                checked ? "bg-sky-400/[0.05]" : "hover:bg-stone-900/40"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(e.id)}
                className="h-4 w-4 cursor-pointer accent-sky-400"
              />
              <span className="w-16 shrink-0 font-mono text-[11.5px] tabular-nums text-stone-500">
                {formatEpisodeLabel(
                  { episode_number: e.episode_number, title: null },
                  { withTitle: false },
                )}
              </span>
              <span
                className={`line-clamp-1 flex-1 font-serif text-[13px] ${
                  checked ? "text-stone-100" : "text-stone-300"
                }`}
              >
                {e.title}
              </span>
              {e.analyzed && (
                <span className="shrink-0 rounded bg-emerald-400/[0.10] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-emerald-300/80">
                  분석
                </span>
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
