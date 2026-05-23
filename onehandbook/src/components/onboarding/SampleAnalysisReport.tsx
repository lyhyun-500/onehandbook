"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { GenreTag } from "@/components/atoms/GenreTag";
import {
  SAMPLE_ANALYZED_EPISODES,
  SAMPLE_DIMENSIONS,
  SAMPLE_IMPROVEMENT_POINTS,
  SAMPLE_REVISIONS,
  SAMPLE_WORK,
  type SampleDimension,
} from "@/lib/sampleAnalysis";

/**
 * 신규 작가 온보딩 (05A) 풀스크린 안에 임베드되는 샘플 분석 리포트.
 *
 * 시안 design_novel/novel-agent/analysis.jsx 의 AnalysisReport 포팅 —
 * ScoreRing + DimensionBar + AnalysisNavigator (sticky 280px) 통합.
 *
 * LEE 결정: 샘플 전용 별도 컴포넌트. 운영 회차 상세(EpisodeDetailClient) 무영향.
 */
export function SampleAnalysisReport() {
  return (
    <div className="mx-auto flex max-w-[1280px] gap-6 px-6 py-6">
      <main className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-2 text-[11px] text-stone-500">
          <span>NOVEL AGENT</span>
          <span className="text-stone-700">›</span>
          <span>{SAMPLE_WORK.title}</span>
          <span className="text-stone-700">›</span>
          <span className="text-stone-300">{SAMPLE_WORK.episodeNum}화 분석</span>
        </div>

        <header className="mb-6">
          <h1 className="font-serif text-[26px] leading-tight tracking-tight text-stone-100">
            {SAMPLE_WORK.episodeNum}화 · {SAMPLE_WORK.episodeTitle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-stone-500">
            <GenreTag genre={SAMPLE_WORK.genre} />
            <span className="tabular-nums">{SAMPLE_WORK.analyzedAt}</span>
            <span className="text-stone-700">·</span>
            <span>NAT {SAMPLE_WORK.natCost}</span>
            <span className="text-stone-700">·</span>
            <span className="tabular-nums">
              {SAMPLE_WORK.charCount.toLocaleString("ko-KR")}자
            </span>
          </div>
        </header>

        <section
          className="mb-7 rounded-xl border border-stone-800/60 p-8"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.20 0.02 250 / 0.4) 0%, oklch(0.18 0.005 270 / 0.4) 100%)",
          }}
        >
          <div className="flex items-center gap-8">
            <ScoreRing score={SAMPLE_WORK.overallScore} size={150} />
            <div className="flex-1">
              <div className="font-mono text-[10px] uppercase tracking-widest text-sky-300/85">
                종합 점수 · {SAMPLE_WORK.percentile}
              </div>
              <h2 className="mt-2 font-serif text-[22px] leading-snug text-stone-100">
                도입부가 강한 회차입니다.
              </h2>
              <p className="mt-3 max-w-[560px] font-serif text-[13.5px] leading-relaxed text-stone-300">
                {SAMPLE_WORK.agentNote}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 font-serif text-[18px] text-stone-100">
            6개 축 분석
          </h2>
          <div className="overflow-hidden rounded-lg border border-stone-800/60 bg-stone-900/20">
            {SAMPLE_DIMENSIONS.map((dim, i) => (
              <DimensionBar key={dim.key} dim={dim} defaultExpanded={i === 0} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-[18px] text-stone-100">
            개선 포인트
          </h2>
          <ol className="space-y-2.5">
            {SAMPLE_IMPROVEMENT_POINTS.map((point, i) => (
              <li
                key={i}
                className="grid grid-cols-[28px_1fr] gap-2 rounded-lg border border-stone-800/60 bg-stone-900/20 px-5 py-3"
              >
                <span className="font-mono text-[14px] tabular-nums text-sky-300/85">
                  {i + 1}
                </span>
                <span className="font-serif text-[13px] leading-relaxed text-stone-300">
                  {point}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <AnalysisNavigator currentEpNum={SAMPLE_WORK.episodeNum} />
    </div>
  );
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = (score / 100) * circumference;
  const tone =
    score >= 90
      ? "oklch(0.85 0.12 145)"
      : score >= 80
        ? "oklch(0.82 0.12 80)"
        : score >= 70
          ? "oklch(0.78 0.12 60)"
          : "oklch(0.72 0.10 30)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.25 0.005 270)"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="3"
          strokeDasharray={`${pct} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* 시안 ScoreText size="xl" = text-6xl. 운영 atom 은 lg 까지라 inline 직접 처리. */}
        <span
          className={`font-serif text-6xl font-medium tabular-nums ${
            score >= 90
              ? "text-emerald-300"
              : score >= 80
                ? "text-amber-200"
                : score >= 70
                  ? "text-amber-300/90"
                  : score >= 60
                    ? "text-orange-300/90"
                    : "text-rose-300/80"
          }`}
        >
          {score}
        </span>
        <div className="mt-1 text-[10px] text-stone-500">/ 100</div>
      </div>
    </div>
  );
}

function DimensionBar({
  dim,
  defaultExpanded = false,
}: {
  dim: SampleDimension;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const tone =
    dim.score >= 85
      ? "oklch(0.78 0.10 145)"
      : dim.score >= 75
        ? "oklch(0.78 0.10 60)"
        : "oklch(0.72 0.08 30)";
  return (
    <div className="border-b border-stone-800/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="grid w-full grid-cols-[180px_1fr_60px_20px] items-center gap-4 px-5 py-3.5 text-left hover:bg-stone-100/[0.02]"
      >
        <div className="font-serif text-[14px] text-stone-200">{dim.label}</div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-stone-800/80">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${dim.score}%`, backgroundColor: tone }}
          />
        </div>
        <div className="text-right font-serif text-[15px] tabular-nums text-stone-100">
          {dim.score}
        </div>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`text-stone-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="px-5 pb-4 pt-1">
          <p className="font-serif text-[13px] leading-relaxed text-stone-300">
            {dim.comment}
          </p>
        </div>
      )}
    </div>
  );
}

function AnalysisNavigator({ currentEpNum }: { currentEpNum: number }) {
  const [tab, setTab] = useState<"episodes" | "history">("episodes");
  const scoreDotTone = (s: number) =>
    s >= 90
      ? "bg-emerald-400"
      : s >= 80
        ? "bg-amber-300"
        : s >= 70
          ? "bg-amber-400/80"
          : "bg-orange-400/80";
  const scoreTextTone = (s: number) =>
    s >= 90
      ? "text-emerald-300"
      : s >= 80
        ? "text-amber-200"
        : s >= 70
          ? "text-amber-300/90"
          : "text-orange-300/90";

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[280px] shrink-0 flex-col rounded-lg border border-stone-800/60 bg-stone-900/20 lg:flex">
      <div className="flex border-b border-stone-800/60">
        {(
          [
            { id: "episodes" as const, label: "다른 회차", count: SAMPLE_ANALYZED_EPISODES.length },
            { id: "history" as const, label: "분석 이력", count: SAMPLE_REVISIONS.length },
          ]
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-[12px] transition-colors ${
                active ? "text-stone-100" : "text-stone-500 hover:text-stone-300"
              }`}
            >
              {t.label}
              <span
                className={`text-[10px] tabular-nums ${
                  active ? "text-sky-300/80" : "text-stone-600"
                }`}
              >
                {t.count}
              </span>
              {active && (
                <span className="absolute -bottom-px left-3 right-3 h-px bg-sky-400/80" />
              )}
            </button>
          );
        })}
      </div>

      {tab === "episodes" && (
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="mb-2 px-2 pt-1">
            <div className="mb-1.5 flex items-center justify-between text-[10px] text-stone-500">
              <span>최근 분석 추이</span>
              <span className="tabular-nums">{SAMPLE_ANALYZED_EPISODES.length}회</span>
            </div>
            <div className="flex h-10 items-end gap-[3px]">
              {[...SAMPLE_ANALYZED_EPISODES].reverse().map((e) => {
                const h = Math.max(8, (e.score / 100) * 36);
                const isCur = e.num === currentEpNum;
                return (
                  <div
                    key={e.num}
                    className="group relative flex-1"
                    title={`${e.num}화 · ${e.score}점`}
                  >
                    <div
                      className={`w-full rounded-sm transition-opacity ${isCur ? "opacity-100" : "opacity-50 group-hover:opacity-90"} ${scoreDotTone(e.score)}`}
                      style={{ height: `${h}px` }}
                    />
                    {isCur && (
                      <div className="absolute -bottom-1 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-sky-300" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="my-2 h-px bg-stone-800/50" />

          {SAMPLE_ANALYZED_EPISODES.map((ep) => {
            const isCur = ep.num === currentEpNum;
            return (
              <button
                key={ep.num}
                type="button"
                className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                  isCur
                    ? "bg-sky-400/[0.06] text-stone-100"
                    : "text-stone-400 hover:bg-stone-100/[0.02] hover:text-stone-200"
                }`}
              >
                <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
                  {String(ep.num).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate font-serif text-[12.5px]">
                  {ep.title}
                </span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${scoreTextTone(ep.score)}`}
                >
                  {ep.score}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tab === "history" && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <ol className="space-y-3">
            {SAMPLE_REVISIONS.map((rev) => (
              <li
                key={rev.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  rev.current
                    ? "border-sky-400/30 bg-sky-400/[0.04]"
                    : "border-stone-800/60 bg-stone-900/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tabular-nums text-stone-300">
                    {rev.label}
                  </span>
                  {rev.current && (
                    <span className="rounded-sm bg-sky-400/15 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-sky-200">
                      현재
                    </span>
                  )}
                </div>
                <div
                  className={`mt-1 font-serif text-[18px] tabular-nums ${scoreTextTone(rev.overall)}`}
                >
                  {rev.overall}
                </div>
                <div className="mt-0.5 text-[10.5px] text-stone-500">{rev.note}</div>
                <div className="mt-1 font-mono text-[9.5px] tabular-nums text-stone-600">
                  {rev.runAt}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="border-t border-stone-800/60 px-3 py-3">
        <button
          type="button"
          disabled
          className="w-full rounded-md border border-dashed border-stone-700 bg-stone-900/30 px-3 py-2 text-center font-mono text-[10.5px] tracking-widest text-stone-500"
        >
          새 분석 실행 (샘플)
        </button>
      </div>
    </aside>
  );
}
