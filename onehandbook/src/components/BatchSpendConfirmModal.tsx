"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  ANALYSIS_PROFILES,
  type AnalysisProfileConfig,
} from "@/config/analysis-profiles";
import { computeHolisticNatCost } from "@/lib/nat";
import { formatEpisodeLabel } from "@/lib/episodeLabel";

interface SelectedEpisodeSummary {
  id: number;
  episode_number: number;
  title: string;
}

interface BatchSpendConfirmModalProps {
  open: boolean;
  workId: string;
  workTitle: string;
  selected: SelectedEpisodeSummary[];
  balance: number;
  onClose: () => void;
  /** 분석 작업이 정상 큐에 들어갔을 때 호출 — orchestrator 가 후속 UI 갱신 */
  onJobQueued: (jobId: string) => void;
}

const KNOWN_PROFILES: AnalysisProfileConfig[] = ANALYSIS_PROFILES;

/**
 * 통합 일괄 분석 진입 확인 모달 — `/api/analyze-batch-holistic` POST.
 *
 * 시안 NatSpendConfirmModal 영역 정합 + 통합 분석 본질 차이:
 * - NAT breakdown = `computeHolisticNatCost` (회차당 1 NAT + 옵션 가산)
 * - 플랫폼 선택 영역 (agentVersion)
 * - 옵션 토글 (includeLore / includePlatformOptimization)
 * - 에러 코드 분기 (402 / 403 / 409 / 400)
 */
export function BatchSpendConfirmModal({
  open,
  workId,
  workTitle,
  selected,
  balance,
  onClose,
  onJobQueued,
}: BatchSpendConfirmModalProps) {
  const router = useRouter();
  const [includeLore, setIncludeLore] = useState(true);
  const [includePlatformOptimization, setIncludePlatformOptimization] =
    useState(true);
  const [agentVersion, setAgentVersion] = useState<string>("kakao-page");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const totalNat = computeHolisticNatCost(selected.length, {
    includeLore,
    includePlatformOptimization,
  });
  const canAfford = balance >= totalNat;
  const afterBalance = canAfford ? balance - totalNat : balance;

  async function handleSubmit(force: boolean = false) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/analyze-batch-holistic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: Number(workId),
          episodeIds: selected.map((s) => s.id),
          agentVersion,
          includeLore,
          includePlatformOptimization,
          force,
        }),
      });

      const data: Record<string, unknown> = await res.json().catch(() => ({}));

      if (res.ok && typeof data.job_id === "string") {
        onJobQueued(data.job_id);
        return;
      }

      const code = typeof data.code === "string" ? data.code : null;
      if (res.status === 402 && code === "INSUFFICIENT_NAT") {
        router.push("/pricing?from=insufficient");
        return;
      }
      if (res.status === 403 && code === "PHONE_NOT_VERIFIED") {
        setError("휴대폰 인증 후 이용 가능합니다.");
        return;
      }
      if (res.status === 409 && code === "EPISODE_ANALYSIS_IN_PROGRESS") {
        setError(
          "선택한 회차 중 일부가 이미 진행 중인 분석에 포함되어 있습니다. 완료 후 다시 시도해 주세요."
        );
        return;
      }
      if (res.status === 400 && code === "MANUSCRIPT_TOO_SHORT") {
        setError(
          "선택한 회차 중 500자 미만 본문이 있습니다. 분석 가능한 회차만 선택해 주세요."
        );
        return;
      }
      setError(
        typeof data.error === "string"
          ? data.error
          : "분석 진입에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    } catch {
      setError("네트워크 오류로 분석 진입에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const summaryTitle =
    selected.length <= 4
      ? selected
          .map((s) =>
            formatEpisodeLabel(
              { episode_number: s.episode_number, title: null },
              { withTitle: false },
            ),
          )
          .join(", ")
      : `${selected[0].episode_number}화 ~ ${
          selected[selected.length - 1].episode_number
        }화 외 ${selected.length}건`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-spend-modal-title"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-sky-400/15 bg-stone-900 shadow-2xl shadow-black/40"
      >
        <div className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300/70">
            통합 일괄 분석 진입
          </div>
          <h2
            id="batch-spend-modal-title"
            className="mt-1 font-serif text-[18px] text-stone-100"
          >
            {workTitle}
          </h2>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-stone-500">
            {summaryTitle}
          </p>

          {/* NAT breakdown */}
          <div className="mt-5 rounded-lg border border-stone-800 bg-stone-950/50 p-4">
            <ul className="space-y-2 text-[12.5px]">
              <li className="flex items-center justify-between text-stone-300">
                <span className="text-stone-400">
                  기본 (회차당 1 NAT × {selected.length}화)
                </span>
                <span className="shrink-0 font-medium tabular-nums text-sky-300">
                  {selected.length} NAT
                </span>
              </li>
              <li className="flex items-center justify-between text-stone-300">
                <label className="inline-flex cursor-pointer items-center gap-2 text-stone-400">
                  <input
                    type="checkbox"
                    checked={includeLore}
                    onChange={(e) => setIncludeLore(e.target.checked)}
                    className="h-3.5 w-3.5 cursor-pointer accent-sky-400"
                  />
                  세계관·인물 설정 포함 (통합 1회)
                </label>
                <span
                  className={`shrink-0 font-medium tabular-nums ${
                    includeLore ? "text-sky-300" : "text-stone-600"
                  }`}
                >
                  {includeLore ? "+1" : "—"} NAT
                </span>
              </li>
              <li className="flex items-center justify-between text-stone-300">
                <label className="inline-flex cursor-pointer items-center gap-2 text-stone-400">
                  <input
                    type="checkbox"
                    checked={includePlatformOptimization}
                    onChange={(e) =>
                      setIncludePlatformOptimization(e.target.checked)
                    }
                    className="h-3.5 w-3.5 cursor-pointer accent-sky-400"
                  />
                  플랫폼 최적화 분석 포함 (통합 1회)
                </label>
                <span
                  className={`shrink-0 font-medium tabular-nums ${
                    includePlatformOptimization ? "text-sky-300" : "text-stone-600"
                  }`}
                >
                  {includePlatformOptimization ? "+1" : "—"} NAT
                </span>
              </li>
              <li className="flex items-center justify-between border-t border-stone-800 pt-2 text-stone-100">
                <span className="font-medium">합계</span>
                <span className="tabular-nums text-[16px] font-semibold text-sky-300">
                  {totalNat} NAT
                </span>
              </li>
            </ul>
          </div>

          {/* 플랫폼 선택 */}
          {includePlatformOptimization && (
            <div className="mt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
                플랫폼 선택
              </div>
              <div className="grid grid-cols-2 gap-2">
                {KNOWN_PROFILES.filter((p) => p.id !== "generic").map((p) => {
                  const sel = agentVersion === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAgentVersion(p.id)}
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        sel
                          ? "border-sky-400/40 bg-sky-400/[0.06]"
                          : "border-stone-800 bg-stone-900/40 hover:border-stone-700"
                      }`}
                    >
                      <div
                        className={`font-serif text-[12.5px] ${
                          sel ? "text-stone-100" : "text-stone-300"
                        }`}
                      >
                        {p.label.replace(/\s*분석\s*$/, "")}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-stone-500">
                        {p.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 잔량 */}
          <div className="mt-4 flex items-center justify-between rounded-md border border-stone-800/60 bg-stone-950/40 px-3 py-2 text-[12px]">
            <span className="text-stone-400">보유 NAT</span>
            <span className="tabular-nums">
              <span className="text-stone-200">{balance}</span>
              <span className="mx-1.5 text-stone-700">→</span>
              <span
                className={
                  canAfford ? "text-stone-200" : "text-amber-300"
                }
              >
                {afterBalance}
              </span>
            </span>
          </div>

          {!canAfford && (
            <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2 text-[12px] text-amber-200/95">
              잔액이 부족합니다. NAT를 충전한 뒤 다시 시도해 주세요.
              <div className="mt-1 font-mono text-[11px] tabular-nums text-amber-200/70">
                필요 {totalNat} NAT · 보유 {balance} NAT
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/[0.05] px-3 py-2 text-[12px] text-rose-200/95">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-stone-700 bg-stone-950/50 px-4 py-2.5 text-[12.5px] font-medium text-stone-200 transition-colors hover:border-stone-600 hover:bg-stone-800/60 disabled:opacity-50"
            >
              취소
            </button>
            {!canAfford ? (
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-md bg-sky-500 px-4 py-2.5 text-center text-[12.5px] font-semibold text-stone-950 transition-colors hover:bg-sky-400"
              >
                NAT 충전하기
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-500 px-4 py-2.5 text-[12.5px] font-semibold text-stone-950 transition-colors hover:bg-sky-400 disabled:opacity-50"
              >
                <Sparkles size={11} aria-hidden="true" />
                {submitting ? "진입 중…" : `${totalNat} NAT 차감 후 분석 진입`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
