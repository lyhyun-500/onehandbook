"use client";

import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import type { HolisticAnalysisResult } from "@/lib/ai/types";
import { TrendReferencesSection } from "@/components/TrendReferencesSection";
import { getProfileLabel } from "@/lib/ai/profileLookup";
import {
  buildHolisticDisplay,
  type HolisticChartPoint,
} from "@/lib/holisticWeightedScore";

function formatKoreanDateTime(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

const DIM_ORDER = [
  "플로우 일관성",
  "캐릭터 아크",
  "복선 활용도",
  "플랫폼 적합성",
] as const;

function ScoreLineChart({ points }: { points: HolisticChartPoint[] }) {
  if (points.length === 0) return null;
  const w = 560;
  const h = 200;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const scores = points.map((p) => p.score);
  const minS = Math.max(0, Math.min(...scores) - 5);
  const maxS = Math.min(100, Math.max(...scores) + 5);
  const span = Math.max(maxS - minS, 1);

  const xs = points.map((_, i) => {
    if (points.length === 1) return padL + innerW / 2;
    return padL + (innerW * i) / (points.length - 1);
  });

  const yAt = (score: number) =>
    padT + innerH - ((score - minS) / span) * innerH;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${yAt(p.score)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full max-w-2xl text-cyan-400"
        role="img"
        aria-label="회차별 점수 추이"
      >
        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={innerH}
          fill="none"
          stroke="rgb(39 39 42)"
          strokeWidth={1}
          rx={4}
        />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * t;
          const val = Math.round(maxS - span * t);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={padL + innerW}
                y1={y}
                y2={y}
                stroke="rgb(39 39 42)"
                strokeDasharray="4 4"
                opacity={0.6}
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-zinc-500 text-[10px]"
              >
                {val}
              </text>
            </g>
          );
        })}
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={p.episode_number}>
            <circle
              cx={xs[i]}
              cy={yAt(p.score)}
              r={5}
              className="fill-zinc-950 stroke-cyan-400"
              strokeWidth={2}
            />
            <text
              x={xs[i]}
              y={h - 10}
              textAnchor="middle"
              className="fill-zinc-400 text-[10px]"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function BatchHolisticReport({
  result,
  agentVersion,
  natConsumed,
  analyzedAt,
  orderedEpisodes,
}: {
  result: HolisticAnalysisResult;
  agentVersion: string;
  natConsumed: number;
  analyzedAt: string;
  orderedEpisodes: Array<{
    episode_number: number;
    title: string;
    charCount: number;
  }>;
}) {
  const { weightedOverall, chartPoints } = buildHolisticDisplay(
    result,
    orderedEpisodes
  );

  return (
    <div className="space-y-8 rounded-xl border border-cyan-500/15 bg-zinc-950/40 p-6">
      <header className="flex flex-col gap-2 border-b border-zinc-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-500/80">
            통합 일괄 분석 리포트
          </p>
          <h2 className="mt-1 text-2xl font-bold text-zinc-100">
            전체 종합 점수
            <span className="ml-2 tabular-nums text-cyan-400">
              {weightedOverall}
              <span className="text-lg font-normal text-zinc-500">/100</span>
            </span>
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            <CopyWithBreaks as="span" className="block">
              선택 회차 원고 길이(자 수)로 가중한 평균입니다.
            </CopyWithBreaks>
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>{getProfileLabel(agentVersion)}</p>
          <p className="tabular-nums">NAT {natConsumed}</p>
          <p>{formatKoreanDateTime(analyzedAt)}</p>
        </div>
      </header>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">
          회차별 점수 추이
        </h3>
        <ScoreLineChart points={chartPoints} />
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">
          항목별 종합 평가
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {DIM_ORDER.map((key) => {
            const d = result.dimensions[key];
            if (!d) return null;
            return (
              <div
                key={key}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-200">{key}</span>
                  <span className="tabular-nums text-lg font-bold text-cyan-400">
                    {d.score}
                    <span className="text-sm font-normal text-zinc-500">
                      /100
                    </span>
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {d.comment}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-emerald-200/90">
            전체 잘된 점
          </h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {result.strengths.map((s, i) => (
              <li
                key={i}
                className="rounded-lg border border-emerald-500/15 bg-emerald-950/20 px-3 py-2"
              >
                <CopyWithBreaks as="span">{s}</CopyWithBreaks>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-semibold text-amber-200/90">
            개선 필요 점
          </h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {result.improvements.map((s, i) => (
              <li
                key={i}
                className="rounded-lg border border-amber-500/15 bg-amber-950/20 px-3 py-2"
              >
                <CopyWithBreaks as="span">{s}</CopyWithBreaks>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="mb-3 text-sm font-semibold text-cyan-200/95">
          에이전트 최종 총평
        </h3>
        <p className="text-sm leading-[1.75] text-zinc-300">
          <CopyWithBreaks as="span">{result.executive_summary}</CopyWithBreaks>
        </p>
      </section>

      <TrendReferencesSection references={result.trends_references} />
    </div>
  );
}
