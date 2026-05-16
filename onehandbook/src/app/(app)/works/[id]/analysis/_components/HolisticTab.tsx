"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";
import { computeHolisticNatCost } from "@/lib/nat";
import { formatEpisodeLabel } from "@/lib/episodeLabel";
import { BatchSpendConfirmModal } from "@/components/BatchSpendConfirmModal";
import { EmptyState } from "@/components/atoms/EmptyState";
import {
  EpisodeTrendChart,
  type EpisodeScorePoint,
} from "./EpisodeTrendChart";
import {
  HolisticDimensionCard,
  type HolisticDimension,
} from "./HolisticDimensionCard";
import { RunSelector, type RunOption } from "./RunSelector";
import {
  HolisticRangeSelector,
  type RangeSelectorEpisode,
} from "./HolisticRangeSelector";
import { HolisticSubmitBar } from "./HolisticSubmitBar";

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

export type HolisticTabMode = "report" | "select";

interface HolisticTabProps {
  workId: string;
  workTitle: string;
  runs: HolisticRunView[];
  /** URL searchParams ?run=<id> 또는 첫 번째 run. */
  currentRunId: string | null;
  /** URL searchParams ?mode= — select 모드 진입 영역. */
  mode: HolisticTabMode;
  /** RangeSelector / SubmitBar 영역에 사용. */
  episodes: RangeSelectorEpisode[];
  /** "missing" = 미분석 회차 자동 선택, "all" = 전체 자동 선택. */
  preselect: "missing" | "all" | null;
  /** 사용자 NAT 잔량 — BatchSpendConfirmModal 영역에 사용. */
  natBalance: number;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 시안 `design_novel/novel-agent/holistic-report.jsx` 정합.
 *
 * 3 mode:
 * - `report`: 분석 결과 표시 (1+ run 영역)
 * - `select`: RangeSelector + SubmitBar (BatchAnalyzeCTA 또는 "추가 분석" 진입)
 * - (no-runs): runs.length === 0 본질 — empty state.
 */
export function HolisticTab({
  workId,
  workTitle,
  runs,
  currentRunId,
  mode,
  episodes,
  preselect,
  natBalance,
}: HolisticTabProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // preselect 영역 자동 적용 — mode = select 진입 시점에만.
  useEffect(() => {
    if (mode !== "select") return;
    if (preselect === "all") {
      setSelectedIds(new Set(episodes.map((e) => e.id)));
    } else if (preselect === "missing") {
      setSelectedIds(new Set(episodes.filter((e) => !e.analyzed).map((e) => e.id)));
    }
  }, [mode, preselect, episodes]);

  const exitSelect = () => {
    const params = new URLSearchParams();
    params.set("tab", "holistic");
    router.push(`/works/${workId}/analysis?${params.toString()}`);
  };

  const selectedEpisodes = useMemo(
    () => episodes.filter((e) => selectedIds.has(e.id)),
    [episodes, selectedIds]
  );

  // mode = select — RangeSelector + SubmitBar
  if (mode === "select") {
    const natCost = computeHolisticNatCost(selectedIds.size, {
      includeLore: true,
      includePlatformOptimization: true,
    });
    return (
      <>
        <div className="mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
            통합 분석 진입
          </div>
          <h2 className="mt-1 font-serif text-[20px] text-stone-100">
            분석 회차 선택
          </h2>
        </div>

        <HolisticRangeSelector
          episodes={episodes}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />

        <HolisticSubmitBar
          selectedCount={selectedIds.size}
          natCost={natCost}
          onCancel={exitSelect}
          onSubmit={() => setConfirmOpen(true)}
        />

        <BatchSpendConfirmModal
          open={confirmOpen}
          workId={workId}
          workTitle={workTitle}
          selected={selectedEpisodes.map((e) => ({
            id: e.id,
            episode_number: e.episode_number,
            title: e.title,
          }))}
          balance={natBalance}
          onClose={() => setConfirmOpen(false)}
          onJobQueued={() => {
            setConfirmOpen(false);
            // job 큐 진입 후 report 모드 복귀 — 백그라운드 처리 본질 (알림 채널 갱신).
            exitSelect();
          }}
        />
      </>
    );
  }

  // mode = report — 분석 결과 표시
  if (runs.length === 0) {
    return (
      <EmptyState
        variant="sky"
        icon={<Sparkles size={22} aria-hidden="true" />}
        title="아직 일괄 분석 이력이 없습니다"
        body={
          <>
            <span className="block">여러 회차를 묶어 작품 흐름 기준의 통합 리포트를 받습니다.</span>
            <span className="block mt-1">상단 일괄 분석 영역에서 시작하세요.</span>
          </>
        }
      />
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
          {current.episodeScores
            .map((e) =>
              formatEpisodeLabel(
                { episode_number: e.episode_number, title: null },
                { withTitle: false },
              ),
            )
            .join(" · ")}
        </div>
      </footer>
    </div>
  );
}
