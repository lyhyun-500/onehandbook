"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AnalysisResult } from "@/lib/ai/types";
import { TrendReferencesSection } from "@/components/TrendReferencesSection";
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
import { getLoreNullCase } from "@/lib/works/loreCheck";
import type {
  CharacterSettings,
  WorldSetting,
} from "@/components/side-panel/types";
import { ManuscriptLowVolumeModal } from "@/components/ManuscriptLowVolumeModal";
import { ContentUnchangedModal } from "@/components/ContentUnchangedModal";
import { CachedAnalysisChoiceModal } from "@/components/CachedAnalysisChoiceModal";
import { EpisodeInActiveAnalysisModal } from "@/components/EpisodeInActiveAnalysisModal";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { useAnalysisJobs } from "@/contexts/AnalysisJobsContext";
import type { AnalyzeJobPollBody } from "@/lib/analysis/buildAnalyzeJobPollResponse";
import {
  ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED,
  ANALYSIS_JOB_FAILURE_SUPERSEDED_BY_FORCE,
} from "@/lib/analysis/analysisJobFailureCodes";
import { isContentUnchangedFailure } from "@/lib/analysis/analysisJobFailureHeuristics";
import { PHONE_SIGNUP_REWARD_COINS } from "@/config/phoneSignupReward";
import { formatDimensionLabel } from "@/lib/analysis/dimensionLabel";
import type { PreviousAnalysisResultPayload } from "@/lib/analysisResultCache";
import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";
import { AnalysisCTA } from "@/components/atoms/AnalysisCTA";
import { AnalysisProcessing } from "@/components/atoms/AnalysisProcessing";
import { AnalysisFailed } from "@/components/atoms/AnalysisFailed";
import { OverallSummaryCard } from "@/components/atoms/OverallSummaryCard";
import { DimensionResultCard } from "@/components/atoms/DimensionResultCard";

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
   /** 일괄 분석에서 파생된 회차별 행 (`options_json.holistic_derived`) */
  holistic_derived?: boolean;
};

function analysisRowFromApi(raw: {
  id: number;
  agent_version: string;
  result_json: unknown;
  created_at: string;
  holistic_derived?: boolean;
}): AnalysisRow {
  return {
    id: raw.id,
    agent_version: raw.agent_version,
    result_json: raw.result_json as AnalysisResult,
    created_at: raw.created_at,
    holistic_derived: raw.holistic_derived === true,
  };
}

function AnalysisResultDetailBody({ latest }: { latest: AnalysisRow }) {
  return (
    <>
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

      {latest.result_json.tag_trend_fit && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
          <h3 className="text-sm font-medium text-zinc-300">
            태그 · 플랫폼 트렌드 적합도
          </h3>
          <div className="mt-2 space-y-2 text-sm text-zinc-400">
            <div>
              <p className="text-xs font-medium text-zinc-500">일치</p>
              <p className="mt-1 text-zinc-300">
                <CopyWithBreaks as="span">
                  {latest.result_json.tag_trend_fit.alignment}
                </CopyWithBreaks>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">차별화</p>
              <p className="mt-1 text-zinc-300">
                <CopyWithBreaks as="span">
                  {latest.result_json.tag_trend_fit.differentiation}
                </CopyWithBreaks>
              </p>
            </div>
            {latest.result_json.tag_trend_fit.suggested_trend_tags &&
              latest.result_json.tag_trend_fit.suggested_trend_tags.length >
                0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500">
                    추천 트렌드 태그
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {latest.result_json.tag_trend_fit.suggested_trend_tags.map(
                      (t, i) => (
                        <span
                          key={`${t}-${i}`}
                          className="rounded-full border border-zinc-700 bg-zinc-900/40 px-2.5 py-1 text-xs text-zinc-200"
                        >
                          #{t}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {latest.result_json.comparable_note && (
        <p className="text-sm text-zinc-500">
          비교:{" "}
          <CopyWithBreaks as="span">
            {latest.result_json.comparable_note}
          </CopyWithBreaks>
        </p>
      )}

      <TrendReferencesSection
        references={latest.result_json.trends_references}
      />
    </>
  );
}

export function AnalyzePanel({
  workId,
  episodeId,
  episodeLabel,
  episodeTitle,
  episodeNumber,
  workTitle,
  versions,
  initialAnalyses,
  natBalance,
  charCount,
  phoneVerified,
  worldSetting,
  characterSettings,
}: {
  workId: number;
  episodeId: number;
  episodeLabel?: string;
  /** 알림 패널 제목용 — `episodes.title` */
  episodeTitle?: string;
  /** 알림 패널 제목용 — `episodes.episode_number` */
  episodeNumber?: number;
  workTitle?: string;
  versions: VersionOption[];
  initialAnalyses: AnalysisRow[];
  natBalance: number;
  charCount: number;
  phoneVerified: boolean;
  /** 의제 신규-1+2 (단계 C-2): NULL 분기 검증용 (server fetch parseWorldSetting 정합). */
  worldSetting: WorldSetting;
  characterSettings: CharacterSettings;
}) {
  const router = useRouter();
  const {
    registerJobStarted,
    notifyAnalysisStarted,
    getLatestJobForEpisode,
    getActiveJobCoveringEpisode,
    showUnchangedJobNotice,
  } = useAnalysisJobs();
  // 의제 신규-1+2: 세계관·인물 = 기본 포함 (state 폐기, 항상 true 정합).
  const [includePlatformOptimization, setIncludePlatformOptimization] =
    useState(true);

  // 의제 신규-1+2 (단계 C-2): NULL 분기 영속화 (결정 9 옵션 N-2 + 결정 10 분기 P-α).
  const loreNullCase = useMemo(
    () => getLoreNullCase(worldSetting, characterSettings),
    [worldSetting, characterSettings],
  );
  const [agentVersion, setAgentVersion] = useState(
    versions.find((v) => v.available)?.id ?? versions[0]?.id ?? ""
  );
  const [lowVolumeOpen, setLowVolumeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unchangedOpen, setUnchangedOpen] = useState(false);
  const [cachedChoiceOpen, setCachedChoiceOpen] = useState(false);
  /** 분석 API 요청 중 (모달·버튼 로딩용, 화면 전체는 막지 않음) */
  const [analyzing, setAnalyzing] = useState(false);
  // 단계 D-fixup-1 (결정 33 UX-1 + 34 D-1): 추출 단계 = 통합 "분석 중" UX.
  const [extracting, setExtracting] = useState(false);
  const [pendingScrollToResult, setPendingScrollToResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobFailedBanner, setJobFailedBanner] = useState<{
    message: string;
    retryable: boolean;
    code?: string;
  } | null>(null);
  const [pollJobId, setPollJobId] = useState<string | null>(null);
  const [episodeBusyModalOpen, setEpisodeBusyModalOpen] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  /** null이면 `analyses[0]`(최신) 기준으로 표시 */
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(
    null
  );
  const [rerunCompare, setRerunCompare] = useState<{
    previous: PreviousAnalysisResultPayload;
    currentScore: number;
  } | null>(null);

  const charCountKnown = charCount > 0;
  const charCountFailed = charCount < 0;
  const tier = useMemo(
    () => (charCountKnown ? getManuscriptAnalysisTier(charCount) : "ok"),
    [charCount, charCountKnown]
  );

  useEffect(() => {
    setAnalyses(initialAnalyses);
    setSelectedAnalysisId(null);
    setRerunCompare(null);
    setPendingScrollToResult(false);
    setJobFailedBanner(null);
  }, [episodeId, initialAnalyses]);

  useEffect(() => {
    if (!includePlatformOptimization) {
      setAgentVersion(NAT_GENERIC_AGENT_ID);
    }
  }, [includePlatformOptimization]);

  const latestJobForEp = getLatestJobForEpisode(episodeId);

  const singleInlineProgress = useMemo(() => {
    const active = getActiveJobCoveringEpisode(episodeId, workId);
    let job: AnalysisJobListItem | null = null;
    if (
      active?.job_kind === "episode" &&
      active.episode_id === episodeId &&
      (active.status === "pending" || active.status === "processing")
    ) {
      job = active;
    }
    const bootstrapping = pollJobId != null && job == null;
    return {
      job,
      bootstrapping,
      show: job != null || bootstrapping,
    };
  }, [episodeId, workId, pollJobId, getActiveJobCoveringEpisode]);

  const prevEpJobStatus = useRef<string | undefined>(undefined);

  useEffect(() => {
    prevEpJobStatus.current = undefined;
  }, [episodeId]);

  useEffect(() => {
    const st = latestJobForEp?.status;
    const jid = latestJobForEp?.id;
    const was = prevEpJobStatus.current;
    prevEpJobStatus.current = st;

    if (!jid || !st) return;

    const applyCompleted = async () => {
      const pr = await fetch(`/api/analyze/jobs/${jid}`);
      const pj = await pr.json().catch(() => ({}));
      if (!pr.ok) return;
      if (pj.status === "completed" && pj.analysis) {
        setAnalyses((prev) => {
          const row = analysisRowFromApi(pj.analysis);
          return [row, ...prev.filter((a) => a.id !== row.id)];
        });
        setSelectedAnalysisId(null);
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
        setJobFailedBanner(null);
        router.refresh();
      }
    };

    const applyFailed = async () => {
      const pr = await fetch(`/api/analyze/jobs/${jid}`);
      const pj = (await pr.json().catch(() => ({}))) as AnalyzeJobPollBody;
      if (!pr.ok) return;
      if (pj.status === "failed") {
        if (pj.code === ANALYSIS_JOB_FAILURE_SUPERSEDED_BY_FORCE) {
          return;
        }
        const unchanged =
          pj.code === ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED ||
          isContentUnchangedFailure({
            failure_code: null,
            error_message:
              typeof pj.error === "string" ? pj.error : null,
          });
        if (unchanged) {
          if (pj.job_kind === "holistic_batch") {
            showUnchangedJobNotice({
              jobIds: [jid],
              workId: pj.work_id ?? latestJobForEp?.work_id ?? workId,
              episodeIds: [
                pj.episode_id ?? latestJobForEp?.episode_id ?? episodeId,
              ],
              jobKind: "holistic_batch",
              details: typeof pj.error === "string" ? [pj.error] : [],
            });
          } else {
            setUnchangedOpen(true);
          }
          setJobFailedBanner(null);
          setError(null);
          router.refresh();
          return;
        }
        setJobFailedBanner({
          message:
            typeof pj.error === "string" ? pj.error : "분석에 실패했습니다.",
          retryable: pj.retryable !== false,
          code: typeof pj.code === "string" ? pj.code : undefined,
        });
        router.refresh();
      }
    };

    if (st === "completed" && (was === "pending" || was === "processing")) {
      void applyCompleted();
    }
    if (st === "failed" && (was === "pending" || was === "processing")) {
      void applyFailed();
    }
  }, [
    latestJobForEp?.id,
    latestJobForEp?.status,
    latestJobForEp?.episode_id,
    latestJobForEp?.work_id,
    episodeId,
    workId,
    router,
    showUnchangedJobNotice,
  ]);

  useEffect(() => {
    if (!pollJobId) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/analyze/jobs/${pollJobId}`, {
          cache: "no-store",
        });
        if (res.status === 404) {
          if (!cancelled) setPollJobId(null);
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as AnalyzeJobPollBody;
        if (body.status === "pending" || body.status === "processing") return;

        if (!cancelled) setPollJobId(null);

        if (
          body.status === "completed" &&
          body.job_kind === "holistic_batch"
        ) {
          setJobFailedBanner(null);
          setError(null);
          router.refresh();
          return;
        }

        if (body.status === "completed" && body.analysis) {
          const row = analysisRowFromApi(
            body.analysis as Parameters<typeof analysisRowFromApi>[0]
          );
          setAnalyses((prev) => {
            const id = row.id;
            return [row, ...prev.filter((a) => a.id !== id)];
          });
          setSelectedAnalysisId(null);
          setPendingScrollToResult(true);
          setCacheNotice(null);
          const prev = body.previousResult ?? null;
          if (
            prev &&
            typeof (body.analysis.result_json as { overall_score?: number })
              ?.overall_score === "number"
          ) {
            setRerunCompare({
              previous: prev,
              currentScore: (body.analysis.result_json as { overall_score: number })
                .overall_score,
            });
          } else {
            setRerunCompare(null);
          }
          setJobFailedBanner(null);
          router.refresh();
          return;
        }

        if (body.status === "failed") {
          if (body.code === ANALYSIS_JOB_FAILURE_SUPERSEDED_BY_FORCE) {
            if (!cancelled) setPollJobId(null);
            return;
          }
          const unchanged =
            body.code === ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED ||
            isContentUnchangedFailure({
              failure_code: null,
              error_message:
                typeof body.error === "string" ? body.error : null,
            });
          if (unchanged) {
            setUnchangedOpen(true);
            setJobFailedBanner(null);
            setError(null);
            router.refresh();
            return;
          }
          setError(body.error ?? "분석에 실패했습니다.");
          setJobFailedBanner({
            message: body.error ?? "분석에 실패했습니다.",
            retryable: body.retryable !== false,
            code: body.code,
          });
          router.refresh();
        }
      } catch {
        /* 다음 폴링에서 재시도 */
      }
    };

    const id = setInterval(() => void tick(), 2000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollJobId, router]);

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
    (!charCountKnown ? false : tier === "blocked") ||
    !effectiveAvailable ||
    !phoneVerified;

  const { lines: natLines, total: natTotal } = useMemo(
    () =>
      buildNatBreakdown(charCount, {
        includePlatformOptimization,
      }),
    [charCount, includePlatformOptimization]
  );

  const requestAnalyze = async (opts?: {
    force?: boolean;
    acceptCached?: boolean;
  }) => {
    const force = opts?.force === true;
    const acceptCached = opts?.acceptCached === true;
    if (force) {
      setPollJobId(null);
    }
    // 강제 재분석: 서버가 같은 회차의 기존 단일 job을 대체 종료하므로 클라이언트 '진행 중' 가드는 건너뜀
    if (
      !force &&
      getActiveJobCoveringEpisode(episodeId, workId)
    ) {
      setEpisodeBusyModalOpen(true);
      return;
    }
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
          // includeLore = 항상 true (의제 신규-1+2 정합), payload 호환용 영속화.
          includeLore: true,
          includePlatformOptimization,
          ...(force ? { force: true } : {}),
          ...(acceptCached ? { acceptCached: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "EPISODE_ANALYSIS_IN_PROGRESS") {
          setAnalyzing(false);
          setEpisodeBusyModalOpen(true);
          return;
        }
        if (data.code === "CACHED_ANALYSIS_AVAILABLE") {
          setAnalyzing(false);
          setCachedChoiceOpen(true);
          return;
        }
        if (data.code === "CONTENT_UNCHANGED") {
          setAnalyzing(false);
          setUnchangedOpen(true);
          return;
        }
        if (data.code === "PHONE_NOT_VERIFIED") {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : `🎉 베타 오픈 기념! 휴대폰 인증하면 ${PHONE_SIGNUP_REWARD_COINS}코인 즉시 지급
인증 한 번이면 AI 분석 바로 시작할 수 있어요`
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
        const now = new Date().toISOString();
        registerJobStarted({
          id: jobId,
          episode_id: episodeId,
          work_id: workId,
          work_title: workTitle?.trim() || null,
          episode_title: episodeTitle?.trim() || null,
          episode_number:
            typeof episodeNumber === "number" && !Number.isNaN(episodeNumber)
              ? episodeNumber
              : null,
          status: "pending",
          updated_at: now,
          created_at: now,
          job_kind: "episode",
          progress_phase: "received",
          holistic_run_id: null,
          parent_job_id: null,
          ordered_episode_ids: [episodeId],
          error_message: null,
          estimated_seconds: 75,
          failure_code: null,
          progress_percent: null,
          read_at: null,
        });
        notifyAnalysisStarted();
        setPollJobId(jobId);
        return;
      }

      if (data.analysis) {
        setAnalyses((prev) => {
          const row = analysisRowFromApi(
            data.analysis as Parameters<typeof analysisRowFromApi>[0]
          );
          return [row, ...prev.filter((a) => a.id !== row.id)];
        });
        setSelectedAnalysisId(null);
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
    void requestAnalyze({ force: true });
  };

  const onClickAnalyze = () => {
    if (analyzeDisabled) return;
    if (getActiveJobCoveringEpisode(episodeId, workId)) {
      setEpisodeBusyModalOpen(true);
      return;
    }
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

  const displayedAnalysis = useMemo(() => {
    if (analyses.length === 0) return null;
    if (selectedAnalysisId != null) {
      const hit = analyses.find((a) => a.id === selectedAnalysisId);
      if (hit) return hit;
    }
    return analyses[0] ?? null;
  }, [analyses, selectedAnalysisId]);

  const latestRun = analyses[0];
  const viewingLatest =
    displayedAnalysis != null &&
    latestRun != null &&
    displayedAnalysis.id === latestRun.id;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="mb-1 text-lg font-semibold text-zinc-100">AI 흥행 분석</h2>
      {episodeLabel && (
        <p className="mb-4 text-sm text-zinc-400">{episodeLabel}</p>
      )}
      {/* 단계 D-fixup-1 (결정 33 UX-1 + 34 D-1 + 35 P-1/T-1):
          추출 + 분석 = 통합 "분석 중" UX + 단계 명시 + spinner only (진행률 X + 추정 시간 X). */}
      {(extracting || analyzing) && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-sky-400/30 bg-sky-400/[0.06] px-4 py-3">
          <span
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-sky-400/30 border-t-sky-300"
            style={{ animation: "na-spin 1.1s linear infinite" }}
            aria-hidden="true"
          />
          <p className="font-serif text-[13px] text-sky-100">
            분석 중 —{" "}
            <span className="text-sky-300">
              {extracting ? "세계관·인물 추출 중" : "분석 진행 중"}
            </span>
            …
          </p>
        </div>
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
        <span className="text-zinc-400">
          {charCountFailed
            ? "글자 수 불러오기 실패"
            : charCountKnown
              ? `${charCount.toLocaleString()}자`
              : "글자 수 계산 중…"}
        </span>{" "}
        ·
        보유{" "}
        <span className="font-medium text-cyan-300/90">
          {natBalance.toLocaleString()} NAT
        </span>
      </p>

      {!phoneVerified && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/95">
          <CopyWithBreaks as="span">
            {`🎉 베타 오픈 기념! 휴대폰 인증하면 ${PHONE_SIGNUP_REWARD_COINS}코인 즉시 지급
인증 한 번이면 AI 분석 바로 시작할 수 있어요`}
          </CopyWithBreaks>{" "}
          <Link
            href="/verify-phone"
            className="font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            휴대폰 인증하고 받기
          </Link>
        </p>
      )}

      {charCountKnown && tier === "blocked" && (
        <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/95">
          {MANUSCRIPT_TOO_SHORT_MESSAGE}
        </p>
      )}

      {charCountKnown && tier === "low" && (
        <p className="mb-4 rounded-lg border border-cyan-500/15 bg-cyan-950/20 px-3 py-2 text-sm text-cyan-100/90">
          <CopyWithBreaks as="span" className="block">
            원고가 1,000자 미만입니다. 분석 시 정확도가 낮을 수 있어, 진행 전 안내를 표시합니다.
          </CopyWithBreaks>
        </p>
      )}

      {!effectiveAvailable && (
        <p className="mb-4 text-sm text-amber-200/90">
          <CopyWithBreaks as="span" className="block">
            이 조건으로 분석을 시작할 수 없습니다. 서버에 Claude(Anthropic) API 키가 설정되어 있는지 확인하거나, 옵션을 바꿔 주세요.
          </CopyWithBreaks>
        </p>
      )}

      {singleInlineProgress.show && <AnalysisProcessing />}

      {!singleInlineProgress.show &&
        !jobFailedBanner &&
        analyses.length === 0 && (
          <AnalysisCTA
            totalNat={natTotal}
            costHint={
              !charCountKnown
                ? "글자수 계산 중"
                : charCount > 10000
                  ? "10,000자 초과 회차"
                  : charCount > 6000
                    ? "~10,000자 회차"
                    : "6,000자 이하 회차"
            }
            onAnalyze={onClickAnalyze}
            disabled={analyzeDisabled}
          />
        )}

      {cacheNotice && (
        <p className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-3 py-2 text-sm text-emerald-100/95">
          <CopyWithBreaks as="span">{cacheNotice}</CopyWithBreaks>
        </p>
      )}

      {jobFailedBanner && (
        <AnalysisFailed
          message={jobFailedBanner.message}
          retryNat={natTotal}
          onRetry={
            jobFailedBanner.retryable
              ? () => {
                  setJobFailedBanner(null);
                  void requestAnalyze();
                }
              : () => setJobFailedBanner(null)
          }
          errorCode={jobFailedBanner.code}
        />
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
        episode={{
          episode_number: episodeNumber ?? 0,
          title: episodeTitle ?? null,
        }}
        workTitle={workTitle ?? ""}
        charCount={charCount}
        includePlatformOptimization={includePlatformOptimization}
        onIncludePlatformOptimizationChange={setIncludePlatformOptimization}
        agentVersion={agentVersion}
        onAgentVersionChange={setAgentVersion}
        natLines={natLines}
        natTotal={natTotal}
        balance={natBalance}
        loading={analyzing}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void requestAnalyze();
        }}
        loreNullCase={loreNullCase}
        onLoreConfirm={() => {
          // 단계 C-4 (commit 3): 추출 API → 분석 진입.
          // 단계 D-fixup-1 (결정 33 UX-1): 추출 + 분석 = 통합 "분석 중" UX.
          setConfirmOpen(false);
          void (async () => {
            setExtracting(true);
            try {
              const res = await fetch(
                `/api/works/${workId}/extract-lore`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ episodeId }),
                },
              );
              const data = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              if (!res.ok) {
                const msg =
                  typeof data.error === "string" && data.error.length > 0
                    ? data.error
                    : "추출 실패";
                console.error("extract-lore:", msg);
                window.alert(`추출 실패: ${msg}`);
                return;
              }
              setExtracting(false);
              await requestAnalyze();
            } catch (e) {
              const msg = e instanceof Error ? e.message : "추출 네트워크 오류";
              console.error("extract-lore network:", msg);
              window.alert(`추출 실패: ${msg}`);
            } finally {
              setExtracting(false);
            }
          })();
        }}
      />

      <ContentUnchangedModal
        open={unchangedOpen}
        loading={analyzing}
        onCancel={() => setUnchangedOpen(false)}
        onConfirm={onConfirmUnchangedAnalyze}
      />

      <CachedAnalysisChoiceModal
        open={cachedChoiceOpen}
        loading={analyzing}
        onCancel={() => setCachedChoiceOpen(false)}
        onLoadCached={() => {
          setCachedChoiceOpen(false);
          void requestAnalyze({ acceptCached: true });
        }}
        onReanalyze={() => {
          setCachedChoiceOpen(false);
          void requestAnalyze({ force: true });
        }}
      />

      <EpisodeInActiveAnalysisModal
        open={episodeBusyModalOpen}
        onClose={() => setEpisodeBusyModalOpen(false)}
      />

      {displayedAnalysis && (
        <div
          id="analysis-result-anchor"
          className="space-y-4 scroll-mt-24 border-t border-zinc-800 pt-6"
        >
          {rerunCompare && viewingLatest && (
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
          {displayedAnalysis.holistic_derived && (
            <div className="flex items-center gap-2 text-xs text-amber-200/80">
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-950/25 px-2 py-0.5 font-medium text-amber-100">
                일괄 분석 일부
              </span>
              <Link
                href={`/works/${workId}/analysis?tab=batch`}
                className="text-cyan-400 underline-offset-2 hover:text-cyan-300"
              >
                통합 리포트 보기 →
              </Link>
            </div>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p
              className={
                viewingLatest
                  ? "text-sm text-zinc-500"
                  : "text-sm text-amber-200/90"
              }
            >
              {viewingLatest ? "최신 분석" : "이전 결과 보기"} ·{" "}
              {getProfileLabel(displayedAnalysis.agent_version)} ·{" "}
              {formatKoreanDateTime(displayedAnalysis.created_at)}
            </p>
          </div>

          <OverallSummaryCard
            score={displayedAnalysis.result_json.overall_score}
            title={viewingLatest ? "분석 완료" : "이전 결과"}
            body={
              displayedAnalysis.result_json.comparable_note ||
              displayedAnalysis.result_json.improvement_points[0] ||
              "6축 점수와 회차별 코멘트가 자동으로 정리됐습니다."
            }
            onRerun={onClickAnalyze}
            rerunDisabled={analyzeDisabled || analyzing}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(displayedAnalysis.result_json.dimensions).map(
              ([name, d]) => (
                <DimensionResultCard
                  key={name}
                  label={formatDimensionLabel(name)}
                  score={d.score}
                  comment={d.comment}
                />
              ),
            )}
          </div>

          {displayedAnalysis.holistic_derived ? (
            <details open className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3">
              <summary className="cursor-pointer text-sm text-zinc-400">
                이 회차의 상세 분석 (항목별 · 개선 · 트렌드)
              </summary>
              <div className="mt-4 space-y-4 border-t border-zinc-800/80 pt-4">
                <AnalysisResultDetailBody latest={displayedAnalysis} />
              </div>
            </details>
          ) : (
            <AnalysisResultDetailBody latest={displayedAnalysis} />
          )}
        </div>
      )}

      {analyses.length > 1 && (
        <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <summary className="cursor-pointer select-none text-sm font-medium text-zinc-300">
            개별 분석 기록 ({analyses.length}건)
            <span className="ml-2 font-normal text-zinc-500">
              — 항목을 눌러 이전 결과를 볼 수 있습니다
            </span>
          </summary>
          <ul className="mt-3 max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-1">
            {analyses.map((a, idx) => {
              const viewing = displayedAnalysis?.id === a.id;
              const isLatest = idx === 0;
              const isHolistic = a.holistic_derived === true;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedAnalysisId(a.id)}
                    className={`flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      viewing
                        ? "border-cyan-500/45 bg-cyan-950/35 text-cyan-100"
                        : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/80"
                    }`}
                  >
                    <span className="font-medium">
                      종합 {a.result_json.overall_score}점
                      {isLatest && (
                        <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300/95">
                          최신
                        </span>
                      )}
                      {isHolistic && (
                        <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300/95">
                          일괄
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-xs text-zinc-500 sm:text-right">
                      {formatKoreanDateTime(a.created_at)} ·{" "}
                      {getProfileLabel(a.agent_version)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
