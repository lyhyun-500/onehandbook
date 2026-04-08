"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  Suspense,
  type ComponentProps,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnalyzePanel, type VersionOption } from "@/components/AnalyzePanel";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
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

type EpisodeRow = {
  id: number;
  episode_number: number;
  title: string;
  charCount: number;
};

function WorkAnalysisHubInner({
  workId,
  workTitle,
  episodes,
  runs,
  latestHolistic,
  versions,
  natBalance,
  initialFocusEpisodeId,
  initialTab,
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
  const latest = useMemo(() => latestAnalysisPerEpisode(runs), [runs]);

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

  const [activeTab, setActiveTab] = useState<"single" | "batch">(initialTab);

  useEffect(() => {
    const next: "single" | "batch" =
      searchParams.get("tab") === "batch" ? "batch" : "single";
    setActiveTab(next);
  }, [searchParams]);

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

  useEffect(() => {
    if (
      holisticClient &&
      latestHolistic &&
      latestHolistic.id === holisticClient.id
    ) {
      setHolisticClient(null);
    }
  }, [latestHolistic, holisticClient]);

  useEffect(() => {
    if (!batchIncludePlatform) {
      setBatchAgent(NAT_GENERIC_AGENT_ID);
    }
  }, [batchIncludePlatform]);

  useEffect(() => {
    setBatchAgent((prev) =>
      prev && versions.some((v) => v.id === prev) ? prev : defaultAgent
    );
  }, [defaultAgent, versions]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const e of episodes) s.add(e.id);
    return s;
  });

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const [panelEpisodeId, setPanelEpisodeId] = useState<number | null>(() => {
    if (initialFocusEpisodeId && episodes.some((e) => e.id === initialFocusEpisodeId)) {
      return initialFocusEpisodeId;
    }
    return episodes[0]?.id ?? null;
  });

  useEffect(() => {
    if (
      initialFocusEpisodeId &&
      episodes.some((e) => e.id === initialFocusEpisodeId)
    ) {
      setActiveTab("single");
      setPanelEpisodeId(initialFocusEpisodeId);
      requestAnimationFrame(() => {
        document
          .getElementById("ai-analysis-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [initialFocusEpisodeId, episodes]);

  const orderedSelectedIds = useMemo(() => {
    return episodes.filter((e) => selectedIds.has(e.id)).map((e) => e.id);
  }, [episodes, selectedIds]);

  const rangeStats = useMemo(
    () => scoreStatsForSelection(orderedSelectedIds, latest),
    [orderedSelectedIds, latest]
  );

  const panelAnalyses = useMemo(() => {
    if (panelEpisodeId == null) return [];
    return runs
      .filter((r) => r.episode_id === panelEpisodeId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((r) => ({
        id: r.id,
        agent_version: r.agent_version,
        result_json: r.result_json,
        created_at: r.created_at,
      }));
  }, [runs, panelEpisodeId]);

  const panelEpisode = episodes.find((e) => e.id === panelEpisodeId);
  const panelCharCount = panelEpisode?.charCount ?? 0;

  const batchTotalChars = useMemo(() => {
    return orderedSelectedIds.reduce((sum, id) => {
      const e = episodes.find((x) => x.id === id);
      return sum + (e?.charCount ?? 0);
    }, 0);
  }, [orderedSelectedIds, episodes]);

  const batchBreakdown = useMemo(() => {
    const opts = {
      includeLore: batchIncludeLore,
      includePlatformOptimization: batchIncludePlatform,
    };
    if (orderedSelectedIds.length === 0) {
      return { lines: [] as { label: string; nat: number }[], total: 0 };
    }
    if (orderedSelectedIds.length <= 10) {
      return buildHolisticNatBreakdown(
        batchTotalChars,
        orderedSelectedIds.length,
        opts
      );
    }
    const est = estimateHolisticBatchTotalNat(episodes, orderedSelectedIds, opts);
    const lines: { label: string; nat: number }[] = [
        {
        label: `10화 단위 배치 ${est.chunkCount}회`,
        nat: est.batchNat,
      },
    ];
    if (est.mergeNat > 0) {
      lines.push({ label: "최종 통합 리포트 병합", nat: est.mergeNat });
    }
    return { lines, total: est.total };
  }, [
    batchTotalChars,
    orderedSelectedIds,
    episodes,
    batchIncludeLore,
    batchIncludePlatform,
  ]);

  const activeHolistic = holisticClient ?? latestHolistic;

  const holisticReportEpisodes = useMemo(() => {
    if (!activeHolistic) return null;
    const byId = new Map(episodes.map((e) => [e.id, e]));
    const ordered = activeHolistic.episode_ids
      .map((id) => byId.get(Number(id)))
      .filter((e): e is EpisodeRow => Boolean(e));
    if (ordered.length === 0) return null;
    return ordered.map((e) => ({
      episode_number: e.episode_number,
      title: e.title,
      charCount: e.charCount,
    }));
  }, [activeHolistic, episodes]);

  const effectiveBatchAgentId = resolveAnalysisAgentVersion(
    batchIncludePlatform,
    batchAgent
  );
  const batchEffectiveAvailable = versions.some(
    (v) => v.id === effectiveBatchAgentId && v.available
  );

  const batchHasBlockedEpisode = useMemo(() => {
    return orderedSelectedIds.some((id) => {
      const ep = episodes.find((e) => e.id === id);
      return (ep?.charCount ?? 0) < MIN_ANALYSIS_CHARS;
    });
  }, [orderedSelectedIds, episodes]);

  const batchHasLowVolumeEpisode = useMemo(() => {
    if (batchHasBlockedEpisode) return false;
    return orderedSelectedIds.some((id) => {
      const c = episodes.find((e) => e.id === id)?.charCount ?? 0;
      return c >= MIN_ANALYSIS_CHARS && c < 1000;
    });
  }, [orderedSelectedIds, episodes, batchHasBlockedEpisode]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(episodes.map((e) => e.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const selectAnalyzedOnly = () => {
    const next = new Set<number>();
    for (const e of episodes) {
      if (latest.has(e.id)) next.add(e.id);
    }
    setSelectedIds(next);
  };

  const applyEpisodeNumberRange = () => {
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from > to) return;
    const next = new Set<number>();
    for (const e of episodes) {
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
              .map((id) => episodes.find((e) => e.id === id)?.episode_number)
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
            (id) => episodes.find((e) => e.id === id)?.episode_number
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
          agentVersion: batchAgent,
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
              : "휴대폰 인증 후 이용 가능합니다."
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
              (id) => episodes.find((e) => e.id === id)?.episode_number
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
            status: "processing",
            updated_at: now,
            created_at: now,
            job_kind: "holistic_batch",
            progress_phase: "ai_analyzing",
            holistic_run_id: null,
            ordered_episode_ids: [...orderedSelectedIds],
            error_message: null,
            estimated_seconds:
              typeof data.estimated_seconds === "number"
                ? data.estimated_seconds
                : null,
            failure_code: null,
            progress_percent: 0,
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
              agentVersion: batchAgent,
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
          status: "pending",
          updated_at: now,
          created_at: now,
          job_kind: "holistic_batch",
          progress_phase: "received",
          holistic_run_id: null,
          ordered_episode_ids: [...orderedSelectedIds],
          error_message: null,
          estimated_seconds:
            typeof data.estimated_seconds === "number"
              ? data.estimated_seconds
              : null,
          failure_code: null,
          progress_percent: null,
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

  const maxEp = episodes.length
    ? Math.max(...episodes.map((e) => e.episode_number))
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
          이 화 분석
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
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-1 text-lg font-semibold text-zinc-100">
              회차 선택
            </h2>
            <p className="mb-6 text-sm text-zinc-500">
              <CopyWithBreaks as="span" className="block">
                아래 목록은 1화부터 오름차순입니다. 분석할 회차에서 「이 화 분석」을 누르면 아래에 AI 분석 패널이 열립니다.
              </CopyWithBreaks>
            </p>

            {episodes.length === 0 ? (
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
                    {episodes.map((ep) => {
                      const run = latest.get(ep.id);
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
                              serverLatestRunCreatedAt={
                                run?.created_at ?? null
                              }
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
                              이 화 분석
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
          체크박스로 분석할 회차를 고른 뒤, 선택한 원고를 한 번에 합쳐 통합 리포트를 받습니다. 회차별 개별 점수가 아니라 작품 흐름 기준 종합 분석입니다. 한 화만 보려면 상단 「이 화 분석」을 이용하세요.
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
                <CopyWithBreaks as="span">휴대폰 인증 후 이용 가능합니다.</CopyWithBreaks>{" "}
                <Link
                  href="/verify-phone"
                  className="font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline"
                >
                  휴대폰 인증하기
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
                  onChange={(e) => setBatchIncludePlatform(e.target.checked)}
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
                  value={batchAgent}
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
                          serverLatestRunCreatedAt={
                            run?.created_at ?? null
                          }
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
                          이 화 분석
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
          <div className="mt-10">
            <BatchHolisticReport
              result={activeHolistic.result_json}
              agentVersion={activeHolistic.agent_version}
              natConsumed={activeHolistic.nat_cost}
              analyzedAt={activeHolistic.created_at}
              orderedEpisodes={holisticReportEpisodes}
            />
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
