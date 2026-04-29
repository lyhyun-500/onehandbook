"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
  type ComponentProps,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnalyzePanel, type VersionOption } from "@/components/AnalyzePanel";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { PHONE_SIGNUP_REWARD_COINS } from "@/config/phoneSignupReward";
import { NatSpendConfirmModal } from "@/components/NatSpendConfirmModal";
import { ManuscriptLowVolumeModal } from "@/components/ManuscriptLowVolumeModal";
import { BatchHolisticReport } from "@/components/BatchHolisticReport";
import { BatchContentUnchangedModal } from "@/components/BatchContentUnchangedModal";
import type { AnalysisRunRow, HolisticRunRow } from "@/lib/analysisSummary";
import {
  latestAnalysisPerEpisode,
  scoreStatsForSelection,
} from "@/lib/analysisSummary";
import { getProfileLabel } from "@/lib/ai/profileLookup";
import {
  NAT_GENERIC_AGENT_ID,
  buildHolisticNatBreakdown,
  estimateHolisticBatchTotalNat,
  resolveAnalysisAgentVersion,
} from "@/lib/nat";
import { useAnalysisJobsOptional } from "@/contexts/AnalysisJobsContext";
import { EpisodeInActiveAnalysisModal } from "@/components/EpisodeInActiveAnalysisModal";
import { EpisodeRowAnalysisBadge } from "@/components/EpisodeRowAnalysisBadge";
import {
  MANUSCRIPT_LOW_VOLUME_WARNING,
  MANUSCRIPT_TOO_SHORT_MESSAGE,
  MIN_ANALYSIS_CHARS,
} from "@/lib/manuscriptEligibility";
import { HOLISTIC_CLIENT_CHUNK_SIZE } from "@/lib/analysis/holisticEpisodeChunks";
import { AnalysisJobInlineProgress } from "@/components/AnalysisJobInlineProgress";

type EpisodeRow = {
  id: number;
  episode_number: number;
  title: string;
  charCount: number;
};

function holisticRunRangeLabel(
  h: HolisticRunRow,
  episodes: EpisodeRow[]
): string {
  const byId = new Map(episodes.map((e) => [e.id, e]));
  const nums = h.episode_ids
    .map((id) => byId.get(Number(id))?.episode_number)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  if (nums.length === 0) return "회차 정보 없음";
  if (nums.length === 1) return `${nums[0]}화`;
  return `${nums[0]}~${nums[nums.length - 1]}화 (${nums.length}개)`;
}

function formatShortKst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function WorkAnalysisHubInner({
  workId,
  workTitle,
  episodes,
  runs,
  latestHolistic,
  versions,
  natBalance,
  initialFocusEpisodeId,
  phoneVerified,
}: {
  workId: string;
  workTitle: string;
  episodes: EpisodeRow[];
  runs: AnalysisRunRow[];
  latestHolistic: HolisticRunRow | null;
  versions: VersionOption[];
  natBalance: number;
  initialFocusEpisodeId?: number;
  initialTab: "single" | "batch";
  phoneVerified: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const analysisJobsCtx = useAnalysisJobsOptional();
  const workIdNum = parseInt(workId, 10);

  const [serverEpisodes, setServerEpisodes] = useState<EpisodeRow[] | null>(
    null
  );
  const [serverRuns, setServerRuns] = useState<AnalysisRunRow[] | null>(null);
  const [serverHolisticList, setServerHolisticList] = useState<
    HolisticRunRow[] | null
  >(null);
  /** null이면 `holisticHistoryList[0]`(최신) 표시 */
  const [selectedHolisticId, setSelectedHolisticId] = useState<number | null>(
    null
  );
  const [serverLoadError, setServerLoadError] = useState<string | null>(null);

  const effectiveEpisodes = serverEpisodes ?? episodes;
  const effectiveRuns = serverRuns ?? runs;

  const reloadAnalysisData = useCallback(async () => {
    try {
      const res = await fetch(`/api/works/${workId}/analysis-data`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setServerLoadError(
          `분석 데이터 로딩 실패 (HTTP ${res.status}). 새로고침 후에도 지속되면 로그인/권한 또는 서버 오류를 확인해 주세요.`
        );
        return;
      }
      const data = (await res.json()) as {
        episodes?: EpisodeRow[];
        runs?: AnalysisRunRow[];
        latestHolistic?: HolisticRunRow | null;
        holisticHistory?: HolisticRunRow[];
      };
      if (Array.isArray(data.episodes)) setServerEpisodes(data.episodes);
      if (Array.isArray(data.runs)) setServerRuns(data.runs);
      setServerLoadError(null);
      const hist = Array.isArray(data.holisticHistory)
        ? data.holisticHistory
        : data.latestHolistic && typeof data.latestHolistic.id === "number"
          ? [data.latestHolistic]
          : [];
      setServerHolisticList(hist.length > 0 ? hist : null);
      setSelectedHolisticId(null);
    } catch (e) {
      setServerLoadError(e instanceof Error ? e.message : "데이터 로딩 실패");
    }
  }, [workId]);

  const holisticHistoryList = useMemo((): HolisticRunRow[] => {
    if (serverHolisticList && serverHolisticList.length > 0) {
      return serverHolisticList;
    }
    if (latestHolistic && typeof latestHolistic.id === "number") {
      return [latestHolistic];
    }
    return [];
  }, [serverHolisticList, latestHolistic]);

  const latest = useMemo(
    () => latestAnalysisPerEpisode(effectiveRuns),
    [effectiveRuns]
  );

  const defaultAgent = useMemo(
    () =>
      versions.find((v) => v.available)?.id ?? versions[0]?.id ?? "",
    [versions]
  );

  const [batchAgent, setBatchAgent] = useState(defaultAgent);
  const [batchIncludeLore, setBatchIncludeLore] = useState(true);
  const [batchIncludePlatform, setBatchIncludePlatform] = useState(true);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchLowVolumeOpen, setBatchLowVolumeOpen] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchUnchangedOpen, setBatchUnchangedOpen] = useState(false);
  const [batchUnchangedEpisodeNumbers, setBatchUnchangedEpisodeNumbers] =
    useState<number[]>([]);
  const [batchEpisodeBusyOpen, setBatchEpisodeBusyOpen] = useState(false);
  const [batchBusyEpisodeNumbers, setBatchBusyEpisodeNumbers] = useState<
    number[]
  >([]);
  /** 10화 초과 통합: 클라이언트 청크·병합 진행률(페이지 내 표시) */
  const [holisticClientProgress, setHolisticClientProgress] = useState<{
    percent: number;
    phase: "chunks" | "merge";
    label: string;
  } | null>(null);
  const [holisticClient, setHolisticClient] = useState<HolisticRunRow | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reloadAnalysisData();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [workId, reloadAnalysisData]);

  /**
   * 일괄 분석 완료 직후 race condition 대응:
   * analysis_jobs.completed 시점과 sync_per_episode 완료 시점 사이 race window
   * 에서 reloadAnalysisData 가 stale 데이터를 받을 수 있음.
   *
   * 최근 30초 이내 완료된 holistic_batch job 이 있으면 3초 간격으로 polling.
   * 30초 후 자동 중단 (또는 컴포넌트 unmount 시).
   */
  useEffect(() => {
    const panelJobs = analysisJobsCtx?.panelJobs ?? [];
    const now = Date.now();

    const hasRecentHolisticBatch = panelJobs.some((j) => {
      if (j.status !== "completed") return false;
      if (j.job_kind !== "holistic_batch") return false;
      if (j.holistic_run_id == null) return false;
      const updatedMs = new Date(j.updated_at).getTime();
      if (Number.isNaN(updatedMs)) return false;
      return now - updatedMs < 30000;
    });

    if (!hasRecentHolisticBatch) return;

    const interval = setInterval(() => {
      void reloadAnalysisData();
    }, 3000);

    const stop = setTimeout(() => {
      clearInterval(interval);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [analysisJobsCtx?.panelJobs, reloadAnalysisData]);

  const urlTab: "single" | "batch" =
    searchParams.get("tab") === "batch" ? "batch" : "single";

  const activeTab: "single" | "batch" =
    initialFocusEpisodeId &&
    effectiveEpisodes.some((e) => e.id === initialFocusEpisodeId)
      ? "single"
      : urlTab;

  const goToTab = useCallback(
    (next: "single" | "batch") => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (next === "batch") {
        nextParams.set("tab", "batch");
        nextParams.delete("focus");
      } else {
        nextParams.delete("tab");
      }
      const qs = nextParams.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const displayHolisticBase = useMemo(() => {
    if (holisticHistoryList.length === 0) return null;
    if (selectedHolisticId != null) {
      const hit = holisticHistoryList.find((h) => h.id === selectedHolisticId);
      if (hit) return hit;
    }
    return holisticHistoryList[0] ?? null;
  }, [holisticHistoryList, selectedHolisticId]);

  const effectiveHolisticClient =
    holisticClient &&
    displayHolisticBase &&
    holisticClient.id === displayHolisticBase.id
      ? null
      : holisticClient;

  const effectiveBatchAgent = useMemo(() => {
    if (!batchIncludePlatform) return NAT_GENERIC_AGENT_ID;
    return batchAgent && versions.some((v) => v.id === batchAgent)
      ? batchAgent
      : defaultAgent;
  }, [batchIncludePlatform, batchAgent, defaultAgent, versions]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const e of effectiveEpisodes) s.add(e.id);
    return s;
  });

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const [panelEpisodeId, setPanelEpisodeId] = useState<number | null>(() => {
    if (
      initialFocusEpisodeId &&
      effectiveEpisodes.some((e) => e.id === initialFocusEpisodeId)
    ) {
      return initialFocusEpisodeId;
    }
    // 기본 선택(1화 자동 오픈)을 하지 않는다. 사용자가 '개별 분석'을 눌렀을 때만 패널 오픈.
    return null;
  });

  const [charCountRetryNonce, setCharCountRetryNonce] = useState(0);
  const [charCountFailedEpisodeIds, setCharCountFailedEpisodeIds] = useState<
    Set<number>
  >(() => new Set());
  const requestedCharCountRef = useRef<Set<number>>(new Set());
  const charCountAttemptRef = useRef<Map<number, number>>(new Map());

  // content 전체를 `analysis-data`에서 불러오지 않기 위해, 패널로 연 회차만 글자수를 지연 계산한다.
  useEffect(() => {
    if (panelEpisodeId == null) return;

    const ep = effectiveEpisodes.find((e) => e.id === panelEpisodeId);
    if (!ep || (ep.charCount ?? 0) > 0) return;
    if (requestedCharCountRef.current.has(panelEpisodeId)) return;
    const prevAttempts = charCountAttemptRef.current.get(panelEpisodeId) ?? 0;
    if (prevAttempts >= 3) {
      // 3회 실패 시 "계산 중"이 영구 고착되지 않도록 실패 상태를 표시한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCharCountFailedEpisodeIds((prev) => {
        const next = new Set(prev);
        next.add(panelEpisodeId);
        return next;
      });
      return;
    }
    charCountAttemptRef.current.set(panelEpisodeId, prevAttempts + 1);
    requestedCharCountRef.current.add(panelEpisodeId);

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/episodes/${panelEpisodeId}/char-count`, {
          cache: "no-store",
        });
        if (!res.ok) {
          requestedCharCountRef.current.delete(panelEpisodeId);
          if (!cancelled) {
            window.setTimeout(() => setCharCountRetryNonce((n) => n + 1), 1500);
          }
          return;
        }
        const data = (await res.json()) as { charCount?: number };
        const next = typeof data.charCount === "number" ? data.charCount : 0;
        if (cancelled || next <= 0) {
          requestedCharCountRef.current.delete(panelEpisodeId);
          if (!cancelled) {
            window.setTimeout(() => setCharCountRetryNonce((n) => n + 1), 1500);
          }
          return;
        }
        setServerEpisodes((prev) => {
          const base = prev ?? effectiveEpisodes;
          return base.map((row) =>
            row.id === panelEpisodeId ? { ...row, charCount: next } : row
          );
        });
      } catch {
        // best-effort: 글자수는 비용 안내용이므로 실패해도 패널 자체는 동작
        requestedCharCountRef.current.delete(panelEpisodeId);
        if (!cancelled) {
          window.setTimeout(() => setCharCountRetryNonce((n) => n + 1), 1500);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [panelEpisodeId, effectiveEpisodes, charCountRetryNonce]);

  useEffect(() => {
    if (
      initialFocusEpisodeId &&
      effectiveEpisodes.some((e) => e.id === initialFocusEpisodeId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelEpisodeId(initialFocusEpisodeId);
      requestAnimationFrame(() => {
        document
          .getElementById("ai-analysis-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [initialFocusEpisodeId, effectiveEpisodes]);

  const orderedSelectedIds = useMemo(() => {
    return effectiveEpisodes
      .filter((e) => selectedIds.has(e.id))
      .map((e) => e.id);
  }, [effectiveEpisodes, selectedIds]);

  const rangeStats = useMemo(
    () => scoreStatsForSelection(orderedSelectedIds, latest),
    [orderedSelectedIds, latest]
  );

  const panelAnalyses = useMemo(() => {
    if (panelEpisodeId == null) return [];
    return effectiveRuns
      .filter((r) => Number(r.episode_id) === panelEpisodeId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((r) => ({
        id: r.id,
        agent_version: r.agent_version,
        result_json: r.result_json,
        created_at: r.created_at,
        holistic_derived:
          (r.options_json as Record<string, unknown> | null | undefined)
            ?.holistic_derived === true,
      }));
  }, [effectiveRuns, panelEpisodeId]);

  const panelEpisode = effectiveEpisodes.find((e) => e.id === panelEpisodeId);
  const panelCharCount =
    panelEpisodeId != null && charCountFailedEpisodeIds.has(panelEpisodeId)
      ? -1
      : (panelEpisode?.charCount ?? 0);

  const batchBreakdown = useMemo(() => {
    const opts = {
      includeLore: batchIncludeLore,
      includePlatformOptimization: batchIncludePlatform,
    };
    if (orderedSelectedIds.length === 0) {
      return { lines: [] as { label: string; nat: number }[], total: 0 };
    }
    if (orderedSelectedIds.length <= 10) {
      return buildHolisticNatBreakdown(orderedSelectedIds.length, opts);
    }
    const est = estimateHolisticBatchTotalNat(
      effectiveEpisodes,
      orderedSelectedIds,
      opts
    );
    const lines: { label: string; nat: number }[] = [
      {
        label: `${orderedSelectedIds.length}화 통합 · ${HOLISTIC_CLIENT_CHUNK_SIZE}화씩 ${est.chunkCount}회 분석`,
        nat: est.batchNat,
      },
    ];
    if (est.mergeNat > 0) {
      lines.push({ label: "최종 통합 리포트 병합", nat: est.mergeNat });
    }
    return { lines, total: est.total };
  }, [orderedSelectedIds, effectiveEpisodes, batchIncludeLore, batchIncludePlatform]);

  const activeHolistic = effectiveHolisticClient ?? displayHolisticBase;

  const holisticReportEpisodes = useMemo(() => {
    if (!activeHolistic) return null;
    const byId = new Map(effectiveEpisodes.map((e) => [e.id, e]));
    const ordered = activeHolistic.episode_ids
      .map((id) => byId.get(Number(id)))
      .filter((e): e is EpisodeRow => Boolean(e));
    if (ordered.length === 0) return null;
    return ordered.map((e) => ({
      episode_number: e.episode_number,
      title: e.title,
      charCount: e.charCount,
    }));
  }, [activeHolistic, effectiveEpisodes]);

  const effectiveBatchAgentId = resolveAnalysisAgentVersion(
    batchIncludePlatform,
    effectiveBatchAgent
  );
  const batchEffectiveAvailable = versions.some(
    (v) => v.id === effectiveBatchAgentId && v.available
  );

  const batchHasBlockedEpisode = useMemo(() => {
    return orderedSelectedIds.some((id) => {
      const ep = effectiveEpisodes.find((e) => e.id === id);
      const c = ep?.charCount ?? 0;
      // 0은 "아직 글자 수를 모름"이므로 미만으로 판단하지 않는다(오탐 방지).
      if (c <= 0) return false;
      return c < MIN_ANALYSIS_CHARS;
    });
  }, [orderedSelectedIds, effectiveEpisodes]);

  const batchHasLowVolumeEpisode = useMemo(() => {
    if (batchHasBlockedEpisode) return false;
    return orderedSelectedIds.some((id) => {
      const c = effectiveEpisodes.find((e) => e.id === id)?.charCount ?? 0;
      if (c <= 0) return false;
      return c >= MIN_ANALYSIS_CHARS && c < 1000;
    });
  }, [orderedSelectedIds, effectiveEpisodes, batchHasBlockedEpisode]);

  /** 10화 이하 등 서버 단일 인보케이션 통합 분석 — 청크 UI 없을 때 페이지 내 진행 표시 */
  const batchHolisticServerJob = useMemo(() => {
    if (orderedSelectedIds.length > HOLISTIC_CLIENT_CHUNK_SIZE) return null;
    if (!analysisJobsCtx || orderedSelectedIds.length === 0) return null;
    const j = analysisJobsCtx.getActiveJobCoveringEpisode(
      orderedSelectedIds[0]!,
      workIdNum
    );
    if (
      !j ||
      j.job_kind !== "holistic_batch" ||
      (j.status !== "pending" && j.status !== "processing")
    ) {
      return null;
    }
    return j;
  }, [analysisJobsCtx, orderedSelectedIds, workIdNum]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(effectiveEpisodes.map((e) => e.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const selectAnalyzedOnly = () => {
    const next = new Set<number>();
    for (const e of effectiveEpisodes) {
      if (latest.has(e.id)) next.add(e.id);
    }
    setSelectedIds(next);
  };

  const applyEpisodeNumberRange = () => {
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from > to) return;
    const next = new Set<number>();
    for (const e of effectiveEpisodes) {
      if (e.episode_number >= from && e.episode_number <= to) {
        next.add(e.id);
      }
    }
    setSelectedIds(next);
  };

  const runBatchAnalyzeSelected = async (opts?: {
    skipUnchangedPrecheck?: boolean;
  }) => {
    if (orderedSelectedIds.length === 0) return;
    if (!batchEffectiveAvailable) {
      setBatchError("이 조건으로 분석을 시작할 수 없습니다. API 키와 옵션을 확인해 주세요.");
      return;
    }
    const workIdNum = parseInt(workId, 10);
    if (Number.isNaN(workIdNum)) {
      setBatchError("작품 정보가 올바르지 않습니다.");
      return;
    }

    setBatchConfirmOpen(false);
    setBatchError(null);

    // A안: 통합 분석 시작 전 "원고 변경 없음"을 한 번에 안내 후, 이번 실행에서는 추가 확인 없이 진행
    // (모달에서 재호출 시 opts.skipUnchangedPrecheck — setState 플래그는 같은 틱에 반영되지 않아 반복 모달이 남)
    if (!opts?.skipUnchangedPrecheck) {
      try {
        const pr = await fetch("/api/analyze-batch-holistic-precheck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeIds: orderedSelectedIds,
            includeLore: batchIncludeLore,
            includePlatformOptimization: batchIncludePlatform,
          }),
        });
        const pd = await pr.json().catch(() => ({}));
        if (pr.ok) {
          const raw = pd.unchanged_episode_ids as unknown;
          const ids = Array.isArray(raw)
            ? raw
                .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
                .filter((n) => !Number.isNaN(n))
            : [];
          if (ids.length > 0) {
            const nums = ids
              .map(
                (id) =>
                  effectiveEpisodes.find((e) => e.id === id)?.episode_number
              )
              .filter((n): n is number => typeof n === "number");
            setBatchUnchangedEpisodeNumbers(nums);
            setBatchUnchangedOpen(true);
            return;
          }
        }
      } catch {
        // precheck 실패해도 분석 플로우는 계속 진행
      }
    }

    if (analysisJobsCtx) {
      const blocked = orderedSelectedIds.filter((id) =>
        analysisJobsCtx.getActiveJobCoveringEpisode(id, workIdNum)
      );
      if (blocked.length > 0) {
        const nums = blocked
          .map(
            (id) =>
              effectiveEpisodes.find((e) => e.id === id)?.episode_number
          )
          .filter((n): n is number => typeof n === "number");
        setBatchBusyEpisodeNumbers(nums.length > 0 ? nums : []);
        setBatchEpisodeBusyOpen(true);
        return;
      }
    }

    try {
      const res = await fetch("/api/analyze-batch-holistic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: workIdNum,
          episodeIds: orderedSelectedIds,
          agentVersion: effectiveBatchAgent,
          includeLore: batchIncludeLore,
          includePlatformOptimization: batchIncludePlatform,
          ...(opts?.skipUnchangedPrecheck ? { force: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "PHONE_NOT_VERIFIED") {
          setBatchError(
            typeof data.error === "string"
              ? data.error
              : `🎉 베타 오픈 기념! 휴대폰 인증하면 ${PHONE_SIGNUP_REWARD_COINS}코인 즉시 지급
인증 한 번이면 AI 분석 바로 시작할 수 있어요`
          );
          return;
        }
        if (data.code === "MANUSCRIPT_TOO_SHORT") {
          setBatchError(
            typeof data.error === "string"
              ? data.error
              : MANUSCRIPT_TOO_SHORT_MESSAGE
          );
          return;
        }
        if (data.code === "INSUFFICIENT_NAT") {
          setBatchError(
            `NAT가 부족합니다. (필요 ${data.required ?? "?"}, 보유 ${data.balance ?? "?"})`
          );
          return;
        }
        if (data.code === "MIGRATION_REQUIRED") {
          setBatchError(
            typeof data.error === "string"
              ? data.error
              : "데이터베이스 마이그레이션이 필요합니다."
          );
          return;
        }
        if (data.code === "EPISODE_ANALYSIS_IN_PROGRESS") {
          const raw = data.conflicting_episode_ids as unknown;
          const ids = Array.isArray(raw)
            ? raw.filter((x): x is number => typeof x === "number")
            : [];
          const nums = ids
            .map(
              (id) =>
                effectiveEpisodes.find((e) => e.id === id)?.episode_number
            )
            .filter((n): n is number => typeof n === "number");
          setBatchBusyEpisodeNumbers(nums.length > 0 ? nums : []);
          setBatchEpisodeBusyOpen(true);
          return;
        }
        setBatchError(
          typeof data.error === "string"
            ? data.error
            : "통합 분석 요청에 실패했습니다."
        );
        return;
      }

      const jobId = data.job_id;
      if (typeof jobId !== "string") {
        setBatchError("작업 ID를 받지 못했습니다.");
        return;
      }

      const clientChunked = data.client_chunked === true;
      const sessionId =
        typeof data.session_id === "string" ? data.session_id : "";
      const chunkPlan: number[][] | null =
        clientChunked && Array.isArray(data.chunk_plan)
          ? (data.chunk_plan as unknown[]).map((row) =>
              Array.isArray(row)
                ? row
                    .map((x) =>
                      typeof x === "number" ? x : parseInt(String(x), 10)
                    )
                    .filter((n) => !Number.isNaN(n))
                : []
            )
          : null;

      if (clientChunked) {
        if (
          !sessionId ||
          !chunkPlan ||
          chunkPlan.length < 2 ||
          chunkPlan.some((c) => c.length === 0)
        ) {
          setBatchError("통합 분석 청크 정보가 올바르지 않습니다.");
          return;
        }

        if (analysisJobsCtx) {
          const now = new Date().toISOString();
          analysisJobsCtx.registerJobStarted({
            id: jobId,
            episode_id: orderedSelectedIds[0]!,
            work_id: workIdNum,
            work_title: workTitle.trim() || null,
            episode_title: null,
            episode_number: null,
            status: "processing",
            updated_at: now,
            created_at: now,
            job_kind: "holistic_batch",
            progress_phase: "ai_analyzing",
            holistic_run_id: null,
            parent_job_id: null,
            ordered_episode_ids: [...orderedSelectedIds],
            error_message: null,
            estimated_seconds:
              typeof data.estimated_seconds === "number"
                ? data.estimated_seconds
                : null,
            failure_code: null,
            progress_percent: 0,
            read_at: null,
          });
          analysisJobsCtx.notifyAnalysisStarted();
        }

        const total = chunkPlan.length;
        try {
          for (let i = 0; i < total; i++) {
            setHolisticClientProgress({
              percent: Math.round((i / total) * 85),
              phase: "chunks",
              label: `구간 ${i + 1}/${total} AI 분석 중`,
            });
            const cr = await fetch("/api/analyze-batch-holistic-chunk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jobId,
                sessionId,
                chunkIndex: i,
                episodeIds: chunkPlan[i],
              }),
            });
            const cd = await cr.json().catch(() => ({}));
            if (!cr.ok) {
              setHolisticClientProgress(null);
              if (cd.code === "MIGRATION_REQUIRED") {
                setBatchError(
                  typeof cd.error === "string"
                    ? cd.error
                    : "DB 마이그레이션이 필요합니다."
                );
              } else if (cd.code === "INSUFFICIENT_NAT") {
                setBatchError(
                  typeof cd.error === "string" ? cd.error : "NAT가 부족합니다."
                );
              } else {
                setBatchError(
                  typeof cd.error === "string"
                    ? cd.error
                    : "통합 분석 구간 처리에 실패했습니다."
                );
              }
              router.refresh();
              return;
            }
            if (typeof cd.progress_percent === "number") {
              setHolisticClientProgress({
                percent: Math.min(88, cd.progress_percent),
                phase: "chunks",
                label: `구간 저장 ${cd.chunks_completed ?? i + 1}/${cd.chunk_total ?? total}`,
              });
            }
          }

          setHolisticClientProgress({
            percent: 90,
            phase: "merge",
            label: "구간 병합·리포트 작성 중",
          });
          const mr = await fetch("/api/analyze-batch-holistic-merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "db_session",
              sessionId,
              jobId,
              workId: workIdNum,
              orderedEpisodeIds: orderedSelectedIds,
              agentVersion: effectiveBatchAgent,
              includeLore: batchIncludeLore,
              includePlatformOptimization: batchIncludePlatform,
            }),
          });
          const md = await mr.json().catch(() => ({}));
          if (!mr.ok) {
            setHolisticClientProgress(null);
            if (md.code === "INSUFFICIENT_NAT") {
              setBatchError(
                typeof md.error === "string"
                  ? md.error
                  : "병합에 필요한 NAT가 부족합니다."
              );
            } else {
              setBatchError(
                typeof md.error === "string"
                  ? md.error
                  : "통합 결과 병합에 실패했습니다."
              );
            }
            router.refresh();
            return;
          }

          setHolisticClientProgress({
            percent: 100,
            phase: "merge",
            label: "완료",
          });
          window.setTimeout(() => setHolisticClientProgress(null), 900);
          const hol = md.holistic as HolisticRunRow | undefined;
          if (hol && typeof hol.id === "number") {
            setHolisticClient(hol);
          }
          router.refresh();
          await reloadAnalysisData();
          setHolisticClient(null);
        } catch (err) {
          setHolisticClientProgress(null);
          setBatchError(
            err instanceof Error ? err.message : "통합 분석 중 오류가 났습니다."
          );
          router.refresh();
        }
        return;
      }

      if (analysisJobsCtx) {
        const now = new Date().toISOString();
        analysisJobsCtx.registerJobStarted({
          id: jobId,
          episode_id: orderedSelectedIds[0]!,
          work_id: workIdNum,
          work_title: workTitle.trim() || null,
          episode_title: null,
          episode_number: null,
          status: "pending",
          updated_at: now,
          created_at: now,
          job_kind: "holistic_batch",
          progress_phase: "received",
          holistic_run_id: null,
          parent_job_id: null,
          ordered_episode_ids: [...orderedSelectedIds],
          error_message: null,
          estimated_seconds:
            typeof data.estimated_seconds === "number"
              ? data.estimated_seconds
              : null,
          failure_code: null,
          progress_percent: null,
          read_at: null,
        });
        analysisJobsCtx.notifyAnalysisStarted();
      }
      router.refresh();
    } catch (e) {
      setBatchError(
        e instanceof Error ? e.message : "일괄 분석 요청 중 오류가 났습니다."
      );
    }
  };

  const maxEp = effectiveEpisodes.length
    ? Math.max(...effectiveEpisodes.map((e) => e.episode_number))
    : 0;

  return (
    <div className="space-y-8">
      <div
        className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-950/50 p-1"
        role="tablist"
        aria-label="분석 모드"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "single"}
          onClick={() => goToTab("single")}
          className={`min-h-[44px] flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "single"
              ? "bg-zinc-800 text-cyan-100 shadow-sm"
              : "text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-300"
          }`}
        >
          개별 분석
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "batch"}
          onClick={() => goToTab("batch")}
          className={`min-h-[44px] flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "batch"
              ? "bg-zinc-800 text-cyan-100 shadow-sm"
              : "text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-300"
          }`}
        >
          일괄 분석
        </button>
      </div>

      {activeTab === "single" && (
        <div className="space-y-8">
          {serverLoadError && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/95">
              {serverLoadError}
            </div>
          )}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-1 text-lg font-semibold text-zinc-100">
              회차 선택
            </h2>
            <p className="mb-6 text-sm text-zinc-500">
              <CopyWithBreaks as="span" className="block">
                아래 목록은 1화부터 오름차순입니다. 분석할 회차에서 「개별 분석」을 누르면 아래에 AI 분석 패널이 열립니다.
              </CopyWithBreaks>
            </p>
            <p className="mb-6 text-xs font-medium text-zinc-500">
              🔒 입력하신 원고는 작가님 외 누구도 열람할 수 없으며, AI 학습 데이터로 사용되지 않습니다
            </p>

            {effectiveEpisodes.length === 0 ? (
              <p className="text-sm text-zinc-500">등록된 회차가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="pb-2 pr-4 font-medium">회차</th>
                      <th className="pb-2 pr-4 font-medium">제목</th>
                      <th className="pb-2 pr-4 font-medium">분석</th>
                      <th className="pb-2 pr-4 font-medium">종합</th>
                      <th className="pb-2 pr-4 font-medium">플랫폼</th>
                      <th className="pb-2 font-medium">동작</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {effectiveEpisodes.map((ep) => {
                      const run = latest.get(ep.id);
                      const serverLatestRunCreatedAt =
                        serverRuns == null ? undefined : (run?.created_at ?? null);
                      return (
                        <tr
                          key={ep.id}
                          className="border-b border-zinc-800/80 last:border-0"
                        >
                          <td className="py-2 pr-4 align-top tabular-nums text-zinc-400">
                            {ep.episode_number}화
                          </td>
                          <td className="py-2 pr-4 align-top">
                            <Link
                              href={`/works/${workId}/episodes/${ep.id}`}
                              className="line-clamp-1 hover:text-zinc-100"
                            >
                              {ep.title}
                            </Link>
                          </td>
                          <td className="py-2 pr-4 align-top">
                            <EpisodeRowAnalysisBadge
                              episodeId={ep.id}
                              serverLatestRunCreatedAt={serverLatestRunCreatedAt}
                            />
                          </td>
                          <td className="py-2 pr-4 align-top font-medium text-zinc-100">
                            {run ? run.result_json.overall_score : "—"}
                          </td>
                          <td className="py-2 pr-4 align-top text-zinc-500">
                            {run ? getProfileLabel(run.agent_version) : "—"}
                          </td>
                          <td className="py-2 align-top">
                            <button
                              type="button"
                              onClick={() => {
                                setPanelEpisodeId(ep.id);
                                requestAnimationFrame(() => {
                                  document
                                    .getElementById("ai-analysis-panel")
                                    ?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                });
                              }}
                              className="text-cyan-400/90 hover:text-cyan-300"
                            >
                              개별 분석
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {panelEpisodeId != null &&
            panelEpisode &&
            !Number.isNaN(workIdNum) && (
            <div id="ai-analysis-panel">
              <p className="mb-3 text-sm text-zinc-500">
                대상:{" "}
                <span className="text-zinc-300">
                  {panelEpisode.episode_number}화 · {panelEpisode.title}
                </span>
              </p>
              <AnalyzePanel
                key={panelEpisodeId}
                workId={workIdNum}
                episodeId={panelEpisodeId}
                workTitle={workTitle}
                episodeTitle={panelEpisode.title}
                episodeNumber={panelEpisode.episode_number}
                episodeLabel={`${panelEpisode.episode_number}화 · ${panelEpisode.title} · ${workTitle}`}
                versions={versions}
                initialAnalyses={panelAnalyses}
                natBalance={natBalance}
                charCount={panelCharCount}
                phoneVerified={phoneVerified}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === "batch" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">
          선택 구간 점수
        </h2>
        <p className="mb-2 text-sm text-zinc-500">
          <CopyWithBreaks as="span" className="block">
            아래 목록은 1화부터 오름차순입니다.
          </CopyWithBreaks>
        </p>
        <CopyWithBreaks
          as="p"
          className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-200/90"
        >
          체크박스로 분석할 회차를 고른 뒤, 선택한 원고를 한 번에 합쳐 통합 리포트를 받습니다. 회차별 개별 점수가 아니라 작품 흐름 기준 종합 분석입니다. 한 화만 보려면 상단 「개별 분석」을 이용하세요.
        </CopyWithBreaks>

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              시작 회차 (화 번호)
            </label>
            <input
              type="number"
              min={1}
              max={maxEp || undefined}
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              placeholder="1"
              className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <span className="pb-2 text-zinc-500">~</span>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              끝 회차 (화 번호)
            </label>
            <input
              type="number"
              min={1}
              max={maxEp || undefined}
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              placeholder={String(maxEp || "")}
              className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <button
            type="button"
            onClick={applyEpisodeNumberRange}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            범위로 선택
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            전체
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            해제
          </button>
          <button
            type="button"
            onClick={selectAnalyzedOnly}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            분석된 회차만
          </button>
        </div>

        <div className="mb-8 flex flex-wrap gap-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-5 py-4">
            <p className="text-xs text-zinc-500">선택 구간 평균</p>
            <p className="text-3xl font-bold text-cyan-400">
              {rangeStats.averageInRange != null ? (
                <>
                  {rangeStats.averageInRange}
                  <span className="text-lg font-normal text-zinc-500">/100</span>
                </>
              ) : (
                <span className="text-xl text-zinc-600">—</span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-5 py-4">
            <p className="text-xs text-zinc-500">최소 / 최대 (선택 중)</p>
            <p className="text-xl font-semibold text-zinc-100">
              {rangeStats.min != null && rangeStats.max != null ? (
                <>
                  {rangeStats.min}
                  <span className="text-zinc-500"> / </span>
                  {rangeStats.max}
                </>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-5 py-4">
            <p className="text-xs text-zinc-500">선택한 회차 / 분석 기록 있는 회차</p>
            <p className="text-xl font-semibold text-zinc-100">
              {rangeStats.selectedCount}
              <span className="text-zinc-500">
                {" "}
                중 {rangeStats.withAnalysisCount}개에 분석 기록
              </span>
            </p>
          </div>
        </div>

        {episodes.length > 0 && (
          <div className="mb-8 space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
            {!phoneVerified && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/95">
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
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
                <input
                  type="checkbox"
                  checked={batchIncludeLore}
                  onChange={(e) => setBatchIncludeLore(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-cyan-600"
                />
                세계관·인물 반영 (+1 NAT, 통합 1회)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
                <input
                  type="checkbox"
                  checked={batchIncludePlatform}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setBatchIncludePlatform(next);
                    if (!next) {
                      setBatchAgent(NAT_GENERIC_AGENT_ID);
                    } else {
                      setBatchAgent((prev) =>
                        prev && versions.some((v) => v.id === prev)
                          ? prev
                          : defaultAgent
                      );
                    }
                  }}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-cyan-600"
                />
                플랫폼 맞춤 분석 (+1 NAT, 통합 1회)
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  분석 플랫폼
                </label>
                <select
                  value={effectiveBatchAgent}
                  onChange={(e) => setBatchAgent(e.target.value)}
                  disabled={!batchIncludePlatform}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
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
                onClick={() => {
                  if (batchHasBlockedEpisode) {
                    setBatchError(MANUSCRIPT_TOO_SHORT_MESSAGE);
                    return;
                  }
                  if (batchHasLowVolumeEpisode) {
                    setBatchLowVolumeOpen(true);
                    return;
                  }
                  setBatchConfirmOpen(true);
                }}
                disabled={
                  orderedSelectedIds.length === 0 ||
                  !batchEffectiveAvailable ||
                  batchHasBlockedEpisode ||
                  !phoneVerified ||
                  holisticClientProgress != null
                }
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 hover:bg-cyan-400 disabled:opacity-50"
              >
                {`선택 회차 통합 분석 (${orderedSelectedIds.length}개)`}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              보유 NAT:{" "}
              <span className="text-cyan-300/90">{natBalance.toLocaleString()}</span>
              {batchBreakdown.total > 0 && (
                <>
                  {" "}
                  · 예상 합계:{" "}
                  <span className="text-zinc-300">
                    {batchBreakdown.total.toLocaleString()} NAT
                  </span>
                </>
              )}
            </p>
            {!batchEffectiveAvailable && (
              <p className="text-sm text-amber-200/90">
                <CopyWithBreaks as="span" className="block">
                  이 조건으로 분석할 수 없습니다. 서버에 Claude(Anthropic) API 키가 설정되어 있는지 확인하거나, 옵션을 바꿔 주세요.
                </CopyWithBreaks>
              </p>
            )}
            {batchHasBlockedEpisode && orderedSelectedIds.length > 0 && (
              <p className="text-sm text-amber-100/90">
                <CopyWithBreaks as="span" className="block">
                  {`선택한 회차 중 원고가 ${MIN_ANALYSIS_CHARS}자 미만인 회차가 있습니다. 해당 회차를 빼거나 본문을 늘린 뒤 다시 시도해 주세요.`}
                </CopyWithBreaks>
              </p>
            )}
            {!holisticClientProgress && batchHolisticServerJob && (
              <div className="mb-4">
                <AnalysisJobInlineProgress
                  job={batchHolisticServerJob}
                  title="통합 분석 진행 중"
                />
              </div>
            )}
            {holisticClientProgress && (
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-4 py-3">
                <p className="text-sm font-medium text-cyan-100/95">
                  통합 분석 진행 중
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {holisticClientProgress.label}
                </p>
                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800"
                  role="progressbar"
                  aria-valuenow={holisticClientProgress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-cyan-500/90 transition-[width] duration-300"
                    style={{ width: `${holisticClientProgress.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs tabular-nums text-cyan-200/90">
                  {holisticClientProgress.percent}%
                </p>
              </div>
            )}
            {batchError && (
              <p className="text-sm text-red-400">
                <CopyWithBreaks as="span">{batchError}</CopyWithBreaks>{" "}
                <Link href="/billing" className="underline hover:text-red-300">
                  충전
                </Link>
              </p>
            )}
            <ManuscriptLowVolumeModal
              open={batchLowVolumeOpen}
              message={MANUSCRIPT_LOW_VOLUME_WARNING}
              loading={false}
              onCancel={() => setBatchLowVolumeOpen(false)}
              onConfirm={() => {
                setBatchLowVolumeOpen(false);
                setBatchConfirmOpen(true);
              }}
            />
            <NatSpendConfirmModal
              open={batchConfirmOpen}
              title="통합 분석 비용 확인"
              description={`선택한 ${orderedSelectedIds.length}개 회차 원고를 합쳐 1회 분석합니다. (회차별 개별 분석 아님)`}
              lines={batchBreakdown.lines}
              totalNat={batchBreakdown.total}
              balance={natBalance}
              confirmLabel="NAT 차감 후 통합 분석"
              loading={false}
              onCancel={() => setBatchConfirmOpen(false)}
              onConfirm={() => {
                void runBatchAnalyzeSelected();
              }}
            />
            <BatchContentUnchangedModal
              open={batchUnchangedOpen}
              episodeNumbers={batchUnchangedEpisodeNumbers}
              loading={false}
              onCancel={() => {
                setBatchUnchangedOpen(false);
                setBatchUnchangedEpisodeNumbers([]);
              }}
              onConfirm={() => {
                setBatchUnchangedOpen(false);
                setBatchUnchangedEpisodeNumbers([]);
                void runBatchAnalyzeSelected({ skipUnchangedPrecheck: true });
              }}
            />
          </div>
        )}

        {episodes.length === 0 ? (
          <p className="text-sm text-zinc-500">등록된 회차가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="w-10 pb-2 pr-2" />
                  <th className="pb-2 pr-4 font-medium">회차</th>
                  <th className="pb-2 pr-4 font-medium">제목</th>
                  <th className="pb-2 pr-4 font-medium">분석</th>
                  <th className="pb-2 pr-4 font-medium">종합</th>
                  <th className="pb-2 pr-4 font-medium">플랫폼</th>
                  <th className="pb-2 font-medium">동작</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {episodes.map((ep) => {
                  const run = latest.get(ep.id);
                  const serverLatestRunCreatedAt =
                    serverRuns == null ? undefined : (run?.created_at ?? null);
                  const checked = selectedIds.has(ep.id);
                  return (
                    <tr
                      key={ep.id}
                      className="border-b border-zinc-800/80 last:border-0"
                    >
                      <td className="py-2 pr-2 align-top">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(ep.id)}
                          className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-cyan-600"
                        />
                      </td>
                      <td className="py-2 pr-4 align-top tabular-nums text-zinc-400">
                        {ep.episode_number}화
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <Link
                          href={`/works/${workId}/episodes/${ep.id}`}
                          className="line-clamp-1 hover:text-zinc-100"
                        >
                          {ep.title}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <EpisodeRowAnalysisBadge
                          episodeId={ep.id}
                          serverLatestRunCreatedAt={serverLatestRunCreatedAt}
                        />
                      </td>
                      <td className="py-2 pr-4 align-top font-medium text-zinc-100">
                        {run ? run.result_json.overall_score : "—"}
                      </td>
                      <td className="py-2 pr-4 align-top text-zinc-500">
                        {run ? getProfileLabel(run.agent_version) : "—"}
                      </td>
                      <td className="py-2 align-top">
                        <button
                          type="button"
                          onClick={() => {
                            setPanelEpisodeId(ep.id);
                            const nextParams = new URLSearchParams(
                              searchParams.toString()
                            );
                            nextParams.set("focus", String(ep.id));
                            nextParams.delete("tab");
                            const qs = nextParams.toString();
                            router.replace(
                              qs ? `${pathname}?${qs}` : pathname,
                              { scroll: false }
                            );
                            requestAnimationFrame(() => {
                              document
                                .getElementById("ai-analysis-panel")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            });
                          }}
                          className="text-cyan-400/90 hover:text-cyan-300"
                        >
                          개별 분석
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeHolistic && holisticReportEpisodes && (
          <div className="mt-10 space-y-4">
            <BatchHolisticReport
              result={activeHolistic.result_json}
              agentVersion={activeHolistic.agent_version}
              natConsumed={activeHolistic.nat_cost}
              analyzedAt={activeHolistic.created_at}
              orderedEpisodes={holisticReportEpisodes}
            />
            {holisticHistoryList.length > 0 && (
              <details className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-medium text-zinc-300">
                  통합 분석 기록 ({holisticHistoryList.length}건)
                  <span className="ml-2 font-normal text-zinc-500">
                    — 항목을 눌러 이전 리포트를 볼 수 있습니다
                  </span>
                </summary>
                <ul className="mt-3 max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-1">
                  {holisticHistoryList.map((h, idx) => {
                    const viewing = activeHolistic.id === h.id;
                    const isLatest = idx === 0;
                    const scoreNum =
                      typeof h.result_json?.overall_score === "number"
                        ? h.result_json.overall_score
                        : null;
                    return (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedHolisticId(h.id)}
                          className={`flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors sm:flex-row sm:items-center sm:justify-between ${
                            viewing
                              ? "border-cyan-500/45 bg-cyan-950/35 text-cyan-100"
                              : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/80"
                          }`}
                        >
                          <span className="font-medium">
                            {holisticRunRangeLabel(h, effectiveEpisodes)}
                            {isLatest && (
                              <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300/95">
                                최신
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-xs text-zinc-500 sm:text-right">
                            종합 {scoreNum != null ? `${scoreNum}점` : "—"} ·{" "}
                            {formatShortKst(h.created_at)} ·{" "}
                            {getProfileLabel(h.agent_version)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </div>
        )}
        </section>
      )}

      <EpisodeInActiveAnalysisModal
        open={batchEpisodeBusyOpen}
        onClose={() => setBatchEpisodeBusyOpen(false)}
        episodeNumbers={batchBusyEpisodeNumbers}
      />
    </div>
  );
}

function WorkAnalysisHubSuspenseFallback() {
  return (
    <div className="space-y-8">
      <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-950/50 p-1">
        <div className="min-h-[44px] flex-1 animate-pulse rounded-lg bg-zinc-800/40" />
        <div className="min-h-[44px] flex-1 animate-pulse rounded-lg bg-zinc-800/40" />
      </div>
      <div className="h-96 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/30" />
    </div>
  );
}

export function WorkAnalysisHub(
  props: ComponentProps<typeof WorkAnalysisHubInner>
) {
  return (
    <Suspense fallback={<WorkAnalysisHubSuspenseFallback />}>
      <WorkAnalysisHubInner {...props} />
    </Suspense>
  );
}
