"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AnalysisResult } from "@/lib/ai/types";
import { formatKoreanDateTime } from "@/lib/formatKoreanDateTime";
import { getProfileLabel } from "@/lib/ai/profileLookup";
import {
  NAT_GENERIC_AGENT_ID,
  buildNatBreakdown,
  resolveAnalysisAgentVersion,
} from "@/lib/nat";
import {
  getManuscriptAnalysisTier,
  MANUSCRIPT_LOW_VOLUME_WARNING,
  MANUSCRIPT_TOO_SHORT_MESSAGE,
} from "@/lib/manuscriptEligibility";
import { NatSpendConfirmModal } from "@/components/NatSpendConfirmModal";
import { ManuscriptLowVolumeModal } from "@/components/ManuscriptLowVolumeModal";
import { ContentUnchangedModal } from "@/components/ContentUnchangedModal";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { useAnalysisNavigationGuard } from "@/hooks/useAnalysisNavigationGuard";
import { formatDimensionLabel } from "@/lib/analysis/dimensionLabel";
import type { PreviousAnalysisResultPayload } from "@/lib/analysisResultCache";

export type VersionOption = {
  id: string;
  label: string;
  description: string;
  available: boolean;
};

export type AnalysisRow = {
  id: number;
  agent_version: string;
  result_json: AnalysisResult;
  created_at: string;
};

export function AnalyzePanel({
  episodeId,
  episodeLabel,
  versions,
  initialAnalyses,
  natBalance,
  charCount,
  phoneVerified,
}: {
  episodeId: number;
  episodeLabel?: string;
  versions: VersionOption[];
  initialAnalyses: AnalysisRow[];
  natBalance: number;
  charCount: number;
  phoneVerified: boolean;
}) {
  const router = useRouter();
  const [includeLore, setIncludeLore] = useState(true);
  const [includePlatformOptimization, setIncludePlatformOptimization] =
    useState(true);
  const [agentVersion, setAgentVersion] = useState(
    versions.find((v) => v.available)?.id ?? versions[0]?.id ?? ""
  );
  const [lowVolumeOpen, setLowVolumeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unchangedOpen, setUnchangedOpen] = useState(false);
  /** NAT 모달 닫은 뒤 API 진행 중 (배경 전체 로딩) */
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingScrollToResult, setPendingScrollToResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobFailedBanner, setJobFailedBanner] = useState<{
    message: string;
    retryable: boolean;
    code?: string;
  } | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [rerunCompare, setRerunCompare] = useState<{
    previous: PreviousAnalysisResultPayload;
    currentScore: number;
  } | null>(null);

  const tier = useMemo(
    () => getManuscriptAnalysisTier(charCount),
    [charCount]
  );

  useAnalysisNavigationGuard(analyzing);

  useEffect(() => {
    setAnalyses(initialAnalyses);
    setRerunCompare(null);
    setPendingScrollToResult(false);
    setJobFailedBanner(null);
  }, [episodeId, initialAnalyses]);

  useEffect(() => {
    if (!includePlatformOptimization) {
      setAgentVersion(NAT_GENERIC_AGENT_ID);
    }
  }, [includePlatformOptimization]);

  useEffect(() => {
    if (!analyzing && pendingScrollToResult && analyses[0]) {
      setPendingScrollToResult(false);
      requestAnimationFrame(() => {
        document
          .getElementById("analysis-result-anchor")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [analyzing, pendingScrollToResult, analyses]);

  const effectiveAgentId = useMemo(
    () =>
      resolveAnalysisAgentVersion(
        includePlatformOptimization,
        agentVersion
      ),
    [includePlatformOptimization, agentVersion]
  );

  const effectiveAvailable = versions.some(
    (v) => v.id === effectiveAgentId && v.available
  );

  const analyzeDisabled =
    tier === "blocked" || !effectiveAvailable || !phoneVerified;

  const { lines: natLines, total: natTotal } = useMemo(
    () =>
      buildNatBreakdown(charCount, {
        includeLore,
        includePlatformOptimization,
      }),
    [charCount, includeLore, includePlatformOptimization]
  );

  const requestAnalyze = async (force?: boolean) => {
    setAnalyzing(true);
    setError(null);
    setJobFailedBanner(null);
    setCacheNotice(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId,
          agentVersion,
          includeLore,
          includePlatformOptimization,
          ...(force ? { force: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "CONTENT_UNCHANGED") {
          setAnalyzing(false);
          setUnchangedOpen(true);
          return;
        }
        if (data.code === "PHONE_NOT_VERIFIED") {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "휴대폰 인증 후 이용 가능합니다."
          );
        }
        if (data.code === "INSUFFICIENT_NAT") {
          throw new Error(
            `NAT가 부족합니다. (필요 ${data.required ?? natTotal}, 보유 ${data.balance ?? natBalance})`
          );
        }
        if (data.code === "MANUSCRIPT_TOO_SHORT") {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : MANUSCRIPT_TOO_SHORT_MESSAGE
          );
        }
        if (data.code === "RATE_LIMIT_EXCEEDED") {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "잠시 후 다시 시도해주세요."
          );
        }
        if (data.code === "MIGRATION_REQUIRED") {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "데이터베이스 마이그레이션이 필요합니다."
          );
        }
        throw new Error(
          typeof data.error === "string" ? data.error : "분석 요청 실패"
        );
      }

      if (data.job_id && typeof data.job_id === "string") {
        const jobId = data.job_id;
        const poll = async (): Promise<void> => {
          const pr = await fetch(`/api/analyze/jobs/${jobId}`);
          const pj = await pr.json().catch(() => ({}));
          if (!pr.ok) {
            throw new Error(
              typeof pj.error === "string"
                ? pj.error
                : "분석 상태를 불러오지 못했습니다."
            );
          }
          if (pj.status === "pending" || pj.status === "processing") {
            await new Promise((r) => setTimeout(r, 2000));
            return poll();
          }
          if (pj.status === "failed") {
            setJobFailedBanner({
              message:
                typeof pj.error === "string"
                  ? pj.error
                  : "분석에 실패했습니다.",
              retryable: pj.retryable !== false,
              code: typeof pj.code === "string" ? pj.code : undefined,
            });
            return;
          }
          if (pj.status === "completed" && pj.analysis) {
            setAnalyses((prev) => {
              const id = pj.analysis.id as number;
              return [pj.analysis, ...prev.filter((a) => a.id !== id)];
            });
            setPendingScrollToResult(true);
            const prev = pj.previousResult as
              | PreviousAnalysisResultPayload
              | undefined;
            if (
              prev &&
              pj.analysis &&
              typeof pj.analysis.result_json?.overall_score === "number"
            ) {
              setRerunCompare({
                previous: prev,
                currentScore: pj.analysis.result_json.overall_score,
              });
            } else {
              setRerunCompare(null);
            }
            router.refresh();
            return;
          }
          throw new Error("알 수 없는 분석 응답입니다.");
        };
        await poll();
        return;
      }

      if (data.analysis) {
        setAnalyses((prev) => {
          const id = data.analysis.id as number;
          return [data.analysis, ...prev.filter((a) => a.id !== id)];
        });
        setPendingScrollToResult(true);
      }
      if (data.cached === true) {
        setCacheNotice(
          "동일 원고·동일 분석 모델의 저장 결과를 불러왔습니다. (NAT 미차감)"
        );
      }
      const prev = data.previousResult as PreviousAnalysisResultPayload | undefined;
      if (
        prev &&
        data.analysis &&
        typeof data.analysis.result_json?.overall_score === "number"
      ) {
        setRerunCompare({
          previous: prev,
          currentScore: data.analysis.result_json.overall_score,
        });
      } else {
        setRerunCompare(null);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const onConfirmUnchangedAnalyze = () => {
    setUnchangedOpen(false);
    void requestAnalyze(true);
  };

  const onClickAnalyze = () => {
    if (analyzeDisabled) return;
    if (tier === "low") {
      setLowVolumeOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const onLowVolumeConfirm = () => {
    setLowVolumeOpen(false);
    setConfirmOpen(true);
  };

  const latest = analyses[0];

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="mb-1 text-lg font-semibold text-zinc-100">AI 흥행 분석</h2>
      {episodeLabel && (
        <p className="mb-4 text-sm text-zinc-400">{episodeLabel}</p>
      )}
      <p className="mb-2 text-sm text-zinc-500">
        NAT가 소모됩니다. 옵션에 따라 비용이 달라집니다.{" "}
        <Link
          href="/billing"
          className="text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
        >
          잔액·충전
        </Link>
      </p>
      <p className="mb-4 text-xs text-zinc-600">
        이번 회차 원고 약{" "}
        <span className="text-zinc-400">{charCount.toLocaleString()}자</span> ·
        보유{" "}
        <span className="font-medium text-cyan-300/90">
          {natBalance.toLocaleString()} NAT
        </span>
      </p>

      {!phoneVerified && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/95">
          <CopyWithBreaks as="span">휴대폰 인증 후 이용 가능합니다.</CopyWithBreaks>{" "}
          <Link
            href="/verify-phone"
            className="font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            휴대폰 인증하기
          </Link>
        </p>
      )}

      {tier === "blocked" && (
        <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/95">
          {MANUSCRIPT_TOO_SHORT_MESSAGE}
        </p>
      )}

      {tier === "low" && (
        <p className="mb-4 rounded-lg border border-cyan-500/15 bg-cyan-950/20 px-3 py-2 text-sm text-cyan-100/90">
          <CopyWithBreaks as="span" className="block">
            원고가 1,000자 미만입니다. 분석 시 정확도가 낮을 수 있어, 진행 전 안내를 표시합니다.
          </CopyWithBreaks>
        </p>
      )}

      <div className="mb-4 space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={includeLore}
            onChange={(e) => setIncludeLore(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-cyan-600"
          />
          <span className="text-zinc-300">
            작품 설정의 세계관·인물을 반영{" "}
            <span className="text-cyan-400/80">(+1 NAT)</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={includePlatformOptimization}
            onChange={(e) =>
              setIncludePlatformOptimization(e.target.checked)
            }
            className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-cyan-600"
          />
          <span className="text-zinc-300">
            플랫폼 맞춤 분석{" "}
            <span className="text-cyan-400/80">(+1 NAT)</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              <CopyWithBreaks as="span" className="block">
                끄면 카카오·문피아 등 구분 없이 일반 점검으로 진행합니다. (같은 AI 모델)
              </CopyWithBreaks>
            </span>
          </span>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">분석 플랫폼</label>
          <select
            value={agentVersion}
            onChange={(e) => setAgentVersion(e.target.value)}
            disabled={!includePlatformOptimization}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.available}>
                {v.label}
                {!v.available ? " (설정 필요)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onClickAnalyze}
          disabled={analyzeDisabled}
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400 disabled:opacity-50"
        >
          분석 실행
        </button>
      </div>

      {!effectiveAvailable && (
        <p className="mb-4 text-sm text-amber-200/90">
          <CopyWithBreaks as="span" className="block">
            이 조건으로 분석을 시작할 수 없습니다. 서버에 Claude(Anthropic) API 키가 설정되어 있는지 확인하거나, 옵션을 바꿔 주세요.
          </CopyWithBreaks>
        </p>
      )}

      {cacheNotice && (
        <p className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-3 py-2 text-sm text-emerald-100/95">
          <CopyWithBreaks as="span">{cacheNotice}</CopyWithBreaks>
        </p>
      )}

      {jobFailedBanner && (
        <div className="mb-4 rounded-lg border border-amber-500/35 bg-amber-950/30 px-3 py-3 text-sm text-amber-100/95">
          <CopyWithBreaks as="span" className="block">
            {jobFailedBanner.message}
          </CopyWithBreaks>
          {jobFailedBanner.retryable && (
            <button
              type="button"
              onClick={() => {
                setJobFailedBanner(null);
                void requestAnalyze();
              }}
              className="mt-3 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <CopyWithBreaks as="span">{error}</CopyWithBreaks>
          {error.includes("NAT") && (
            <>
              {" "}
              <Link href="/billing" className="underline hover:text-red-300">
                충전 페이지
              </Link>
            </>
          )}
        </p>
      )}

      <ManuscriptLowVolumeModal
        open={lowVolumeOpen}
        message={MANUSCRIPT_LOW_VOLUME_WARNING}
        loading={analyzing}
        onCancel={() => setLowVolumeOpen(false)}
        onConfirm={onLowVolumeConfirm}
      />

      <NatSpendConfirmModal
        open={confirmOpen}
        title="분석 비용 확인"
        description="아래 NAT가 차감된 뒤 분석이 시작됩니다."
        lines={natLines}
        totalNat={natTotal}
        balance={natBalance}
        confirmLabel="계속"
        loading={false}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void requestAnalyze();
        }}
      />

      <ContentUnchangedModal
        open={unchangedOpen}
        loading={analyzing}
        onCancel={() => setUnchangedOpen(false)}
        onConfirm={onConfirmUnchangedAnalyze}
      />

      {analyzing && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-zinc-950/75 p-6 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="h-14 w-14 shrink-0 animate-spin rounded-full border-2 border-cyan-500/25 border-t-cyan-400"
            aria-hidden
          />
          <p className="max-w-sm text-center text-sm font-medium leading-relaxed text-zinc-200">
            <CopyWithBreaks as="span">
              에이전트가 원고를 정밀 분석 중입니다...
            </CopyWithBreaks>
          </p>
        </div>
      )}

      {latest && (
        <div
          id="analysis-result-anchor"
          className="space-y-4 scroll-mt-24 border-t border-zinc-800 pt-6"
        >
          {rerunCompare && (
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-4 py-3">
              <h3 className="text-sm font-semibold text-cyan-200/95">
                재분석 · 이전 결과와 비교
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-zinc-800/90 bg-zinc-950/50 p-3">
                  <p className="text-xs font-medium text-zinc-500">이전 분석</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-300">
                    {rerunCompare.previous.score}
                    <span className="text-base font-normal text-zinc-600">
                      /100
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatKoreanDateTime(rerunCompare.previous.created_at)} · NAT{" "}
                    {rerunCompare.previous.nat_consumed}
                  </p>
                  {rerunCompare.previous.feedback.improvement_points.length >
                    0 && (
                    <ul className="mt-2 list-inside list-disc text-xs text-zinc-500">
                      {rerunCompare.previous.feedback.improvement_points
                        .slice(0, 2)
                        .map((p, i) => (
                          <li key={i} className="line-clamp-2">
                            {p}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-md border border-cyan-500/20 bg-cyan-950/30 p-3">
                  <p className="text-xs font-medium text-zinc-500">이번 분석</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-cyan-400">
                    {rerunCompare.currentScore}
                    <span className="text-base font-normal text-zinc-600">
                      /100
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {(() => {
                      const d =
                        rerunCompare.currentScore - rerunCompare.previous.score;
                      if (d === 0) return "종합 점수 변동 없음";
                      if (d > 0)
                        return (
                          <span className="text-emerald-400">
                            종합 +{d}점 (상승)
                          </span>
                        );
                      return (
                        <span className="text-amber-400/95">
                          종합 {d}점 (하락)
                        </span>
                      );
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-zinc-500">
              최근 분석 · {getProfileLabel(latest.agent_version)} ·{" "}
              {formatKoreanDateTime(latest.created_at)}
            </p>
            <p className="text-3xl font-bold text-cyan-400">
              {latest.result_json.overall_score}
              <span className="text-lg font-normal text-zinc-500">/100</span>
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">항목별</h3>
            <ul className="space-y-2 text-sm">
              {Object.entries(latest.result_json.dimensions).map(([name, d]) => (
                <li
                  key={name}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                >
                  <span className="text-zinc-400">
                    {formatDimensionLabel(name)}
                  </span>{" "}
                  <span className="text-zinc-100">{d.score}점</span>
                  <p className="mt-1 text-zinc-500">
                    <CopyWithBreaks as="span">{d.comment}</CopyWithBreaks>
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-300">개선 포인트</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-400">
              {latest.result_json.improvement_points.map((p, i) => (
                <li key={i}>
                  <CopyWithBreaks as="span">{p}</CopyWithBreaks>
                </li>
              ))}
            </ul>
          </div>

          {latest.result_json.comparable_note && (
            <p className="text-sm text-zinc-500">
              비교:{" "}
              <CopyWithBreaks as="span">
                {latest.result_json.comparable_note}
              </CopyWithBreaks>
            </p>
          )}
        </div>
      )}

      {analyses.length > 1 && (
        <details className="mt-6 border-t border-zinc-800 pt-4">
          <summary className="cursor-pointer text-sm text-zinc-500">
            이전 분석 {analyses.length - 1}건
          </summary>
          <ul className="mt-2 space-y-2 text-sm text-zinc-500">
            {analyses.slice(1).map((a) => (
              <li key={a.id}>
                {formatKoreanDateTime(a.created_at)} ·{" "}
                {getProfileLabel(a.agent_version)} · 종합{" "}
                {a.result_json.overall_score}점
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
