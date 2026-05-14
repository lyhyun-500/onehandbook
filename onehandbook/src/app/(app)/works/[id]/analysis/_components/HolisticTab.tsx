"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";
import {
  EpisodeTrendChart,
  type EpisodeScorePoint,
} from "./EpisodeTrendChart";
import {
  HolisticDimensionCard,
  type HolisticDimension,
} from "./HolisticDimensionCard";
import { RunSelector, type RunOption } from "./RunSelector";

export interface HolisticRunView {
  id: string;
  label: string;
  createdAt: string;
  natCost: number;
  platform: string;
  episodeIds: number[];
  overallScore: number;
  scoreBasis: string;
  executiveSummary: string;
  episodeScores: EpisodeScorePoint[];
  dimensions: HolisticDimension[];
  strengths: string[];
  improvements: string[];
}

interface HolisticTabProps {
  workId: string;
  runs: HolisticRunView[];
  /** URL searchParams ?run=<id> 또는 첫 번째 run 본질. */
  currentRunId: string | null;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 시안 `design_novel/novel-agent/holistic-report.jsx` 정합 — 일괄 분석 view-only.
 *
 * LEE 결정 Z5 (a) — 분석 실행 진입점 부재 본질 (HolisticRangeSelector + HolisticSubmitBar 영역 외).
 * mode = "report" | "no-runs" 본질만.
 */
export function HolisticTab({ workId, runs, currentRunId }: HolisticTabProps) {
  const router = useRouter();

  if (runs.length === 0) {
    // mode = "no-runs"
    return (
      <div className="rounded-xl border border-dashed border-stone-700 bg-stone-900/30 px-8 py-14 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-400/[0.08] text-sky-300 ring-1 ring-inset ring-sky-400/20">
          <Sparkles size={22} aria-hidden="true" />
        </div>
        <h3 className="font-serif text-[18px] text-stone-100">
          아직 일괄 분석 이력이 없습니다
        </h3>
        <p className="mx-auto mt-2 max-w-md font-serif text-[13px] leading-relaxed text-stone-400">
          여러 회차를 묶어 작품 흐름 기준의 통합 리포트를 받을 수 있습니다. 일괄
          분석은 별도 진입점에서 시작합니다.
        </p>
      </div>
    );
  }

  const current = runs.find((r) => r.id === currentRunId) ?? runs[0];

  const runOptions: RunOption[] = runs.map((r) => ({
    id: r.id,
    label: r.label,
    createdAt: r.createdAt,
    natCost: r.natCost,
    platform: r.platform,
    overallScore: r.overallScore,
  }));

  return (
    <div>
      {/* Run selector strip — 2+ run 시점에만 노출 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
          현재 표시:{" "}
          <span className="text-stone-300">{current.label}</span>
        </div>
        {runs.length > 1 && (
          <RunSelector
            runs={runOptions}
            currentId={current.id}
            onChange={(id) => {
              const params = new URLSearchParams();
              params.set("tab", "holistic");
              params.set("run", id);
              router.push(`/works/${workId}/analysis?${params.toString()}`);
            }}
          />
        )}
      </div>

      {/* Hero */}
      <section>
        <header className="mb-5 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <h2 className="font-serif text-[20px] text-stone-100">
              일괄 분석 종합 점수
            </h2>
          </div>
          <div className="flex items-end gap-8">
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
                작품 평균
              </div>
              <div className="mt-1 flex items-baseline justify-end gap-1">
                <span
                  className={`font-serif text-[40px] font-medium leading-none tabular-nums ${getAnalysisScoreColor(current.overallScore)}`}
                >
                  {current.overallScore}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-stone-500">
                  /100
                </span>
              </div>
            </div>
            <div className="hidden self-end pb-1 text-right md:block">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-stone-400">
                {current.platform} 분석
              </div>
              <div className="mt-1 font-mono text-[10.5px] tabular-nums text-stone-500">
                NAT {current.natCost} · {current.episodeIds.length}화 선택
              </div>
              <div className="mt-0.5 font-mono text-[10px] tabular-nums text-stone-600">
                {formatTimestamp(current.createdAt)}
              </div>
            </div>
          </div>
        </header>
      </section>

      {/* Executive Summary — 서브타이틀 영역 일괄 삭제 (LEE 결정 정합), p text 영역만 보존 */}
      {current.executiveSummary && (
        <section className="mt-7 rounded-lg border border-stone-800/60 bg-stone-950/40 px-6 py-5">
          <p
            className="font-serif text-[13.5px] leading-[1.85] text-stone-300"
            style={{ textWrap: "pretty" }}
          >
            {current.executiveSummary}
          </p>
        </section>
      )}

      {/* Episode trend chart */}
      {current.episodeScores.length > 0 && (
        <section className="mt-7">
          <header className="mb-4">
            <h2 className="font-serif text-[17px] text-stone-100">
              회차별 점수 추이
            </h2>
          </header>
          <div className="rounded-lg border border-stone-800/60 bg-stone-950/40 p-4">
            <EpisodeTrendChart data={current.episodeScores} />
          </div>
        </section>
      )}

      {/* Dimensions */}
      {current.dimensions.length > 0 && (
        <section className="mt-8">
          <header className="mb-4">
            <h2 className="font-serif text-[17px] text-stone-100">
              항목별 종합 평가
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {current.dimensions.map((d) => (
              <HolisticDimensionCard key={d.key} dim={d} />
            ))}
          </div>
        </section>
      )}

      {/* Strengths + Improvements */}
      {(current.strengths.length > 0 || current.improvements.length > 0) && (
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {current.strengths.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-serif text-[14px] font-medium text-emerald-300">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                />
                전체 잘된 점
              </h3>
              <ul className="flex flex-col gap-2">
                {current.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-emerald-400/25 bg-emerald-400/[0.04] px-4 py-3"
                  >
                    <p className="font-serif text-[12.5px] leading-relaxed text-stone-200">
                      {s}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {current.improvements.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-serif text-[14px] font-medium text-amber-300">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-amber-400"
                />
                개선 필요 점
              </h3>
              <ul className="flex flex-col gap-2">
                {current.improvements.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-amber-400/25 bg-amber-400/[0.04] px-4 py-3"
                  >
                    <p className="font-serif text-[12.5px] leading-relaxed text-stone-200">
                      {s}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="mt-8 border-t border-stone-800/60 pt-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
          대상 회차 ·{" "}
          {current.episodeScores.map((e) => `${e.episode_number}화`).join(" · ")}
        </div>
      </footer>
    </div>
  );
}
