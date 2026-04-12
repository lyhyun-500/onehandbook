"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { useAnalysisJobs } from "@/contexts/AnalysisJobsContext";
import type { AnalyzeJobPollBody } from "@/lib/analysis/buildAnalyzeJobPollResponse";

type Props = {
  open: boolean;
  jobIds: string[];
  workId: number;
  focusEpisodeIds?: number[];
  detail?: string;
  onDismiss: () => void;
};

export function AnalysisAsyncUnchangedModal({
  open,
  jobIds,
  workId,
  focusEpisodeIds,
  detail,
  onDismiss,
}: Props) {
  const router = useRouter();
  const { registerJobStarted, notifyAnalysisStarted } = useAnalysisJobs();
  const [forceLoading, setForceLoading] = useState(false);
  const [forceError, setForceError] = useState<string | null>(null);
  const [episodeNumbers, setEpisodeNumbers] = useState<number[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setForceError(null);
    setEpisodeNumbers(null);

    const ids =
      Array.isArray(focusEpisodeIds) && focusEpisodeIds.length > 0
        ? focusEpisodeIds.slice(0, 30)
        : [];
    if (ids.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/episodes/episode-numbers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeIds: ids }),
          cache: "no-store",
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || cancelled) return;
        const map = d.episode_numbers_by_id as Record<string, unknown>;
        const nums = ids
          .map((id) => map?.[String(id)])
          .filter((n): n is number => typeof n === "number");
        if (!cancelled) setEpisodeNumbers(nums);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, focusEpisodeIds]);

  if (!open) return null;

  const focusEpisodeId =
    Array.isArray(focusEpisodeIds) && focusEpisodeIds.length > 0
      ? focusEpisodeIds[0]
      : undefined;

  const href =
    typeof focusEpisodeId === "number" && !Number.isNaN(focusEpisodeId)
      ? `/works/${workId}/analysis?focus=${focusEpisodeId}`
      : `/works/${workId}/analysis`;

  const onForceAnalyze = async () => {
    const jobId = jobIds[0] ?? "";
    if (!jobId) return;
    setForceError(null);
    setForceLoading(true);
    try {
      const r = await fetch(`/api/analyze/jobs/${jobId}`, { cache: "no-store" });
      const body = (await r.json()) as AnalyzeJobPollBody;
      if (!r.ok || !body.unchangedForceRetry) {
        setForceError(
          "다시 요청에 필요한 정보를 불러오지 못했습니다. 분석 페이지에서 시도해 주세요."
        );
        return;
      }
      const fr = body.unchangedForceRetry;

      if (fr.mode === "episode") {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId: fr.episodeId,
            agentVersion: fr.agentVersion,
            includeLore: fr.includeLore,
            includePlatformOptimization: fr.includePlatformOptimization,
            force: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setForceError(
            typeof data.error === "string"
              ? data.error
              : "강제 재분석 요청에 실패했습니다."
          );
          return;
        }
        if (data.job_id && typeof data.job_id === "string") {
          const now = new Date().toISOString();
          registerJobStarted({
            id: data.job_id,
            episode_id: fr.episodeId,
            work_id: workId,
            work_title: null,
            episode_title: null,
            episode_number: null,
            status: "pending",
            updated_at: now,
            created_at: now,
            job_kind: "episode",
            progress_phase: "received",
            holistic_run_id: null,
            parent_job_id: null,
            ordered_episode_ids: [fr.episodeId],
            error_message: null,
            estimated_seconds: 75,
            failure_code: null,
            progress_percent: null,
          });
          notifyAnalysisStarted();
        }
        onDismiss();
        router.refresh();
        return;
      }

      const res = await fetch("/api/analyze-batch-holistic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: fr.workId,
          episodeIds: fr.episodeIds,
          agentVersion: fr.agentVersion,
          includeLore: fr.includeLore,
          includePlatformOptimization: fr.includePlatformOptimization,
          force: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForceError(
          typeof data.error === "string"
            ? data.error
            : "통합 분석 재요청에 실패했습니다."
        );
        return;
      }
      if (data.job_id && typeof data.job_id === "string") {
        const now = new Date().toISOString();
        registerJobStarted({
          id: data.job_id,
          episode_id: fr.episodeIds[0]!,
          work_id: fr.workId,
          work_title: null,
          episode_title: null,
          episode_number: null,
          status: "pending",
          updated_at: now,
          created_at: now,
          job_kind: "holistic_batch",
          progress_phase: "received",
          holistic_run_id: null,
          parent_job_id: null,
          ordered_episode_ids: [...fr.episodeIds],
          error_message: null,
          estimated_seconds:
            typeof data.estimated_seconds === "number"
              ? data.estimated_seconds
              : null,
          failure_code: null,
          progress_percent: null,
        });
        notifyAnalysisStarted();
      }
      onDismiss();
      router.refresh();
    } catch {
      setForceError("네트워크 오류가 났습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setForceLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[78] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="async-unchanged-title"
        className="w-full max-w-md rounded-xl border border-zinc-600/40 bg-zinc-900 p-6 shadow-2xl shadow-black/40"
      >
        <h2
          id="async-unchanged-title"
          className="text-lg font-semibold text-zinc-100"
        >
          원고 변경 없음
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          <CopyWithBreaks as="span" className="block">
            진행한 분석 작업이 원고 변경이 없어 종료되었습니다. 원고를 수정한 뒤 다시 분석하거나, 분석 페이지에서 강제로 재분석할 수 있습니다. NAT는 다시 차감될 수 있습니다.
          </CopyWithBreaks>
        </p>
        {episodeNumbers && episodeNumbers.length > 0 ? (
          <p className="mt-3 text-sm font-medium text-amber-200/90">
            변경 없음: {episodeNumbers.slice().sort((a, b) => a - b).join(", ")}화
          </p>
        ) : null}
        {detail ? (
          <p className="mt-3 rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-xs leading-relaxed text-zinc-400">
            {detail}
          </p>
        ) : null}
        {jobIds.length > 1 ? (
          <p className="mt-3 text-xs text-zinc-500">
            여러 건의 미변경 종료가 감지되어 한 번에 안내합니다. 강제 재분석은 분석 페이지에서 회차별로 실행해 주세요.
          </p>
        ) : null}
        {forceError ? (
          <p className="mt-3 text-sm text-red-300/95">{forceError}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onDismiss}
            disabled={forceLoading}
            className="rounded-lg border border-zinc-600 bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80 disabled:opacity-50"
          >
            닫기
          </button>
          <Link
            href={href}
            onClick={onDismiss}
            className="rounded-lg border border-zinc-600 bg-zinc-950/50 px-4 py-2.5 text-center text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80"
          >
            분석 페이지로 이동
          </Link>
          {jobIds.length === 1 ? (
            <button
              type="button"
              onClick={() => void onForceAnalyze()}
              disabled={forceLoading || jobIds.length !== 1}
              className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400 disabled:opacity-50"
            >
              {forceLoading ? "처리 중…" : "그래도 분석하기"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
