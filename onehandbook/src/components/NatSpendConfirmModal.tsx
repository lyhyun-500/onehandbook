"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  ANALYSIS_PROFILES,
  type AnalysisProfileConfig,
} from "@/config/analysis-profiles";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { formatEpisodeLabel } from "@/lib/episodeLabel";
import {
  getLoreNullPromptText,
  type LoreNullCase,
} from "@/lib/works/loreCheck";

export type NatSpendLine = { label: string; nat: number };

// 정책 변경: 단일 택1 모델 — generic(범용) UI 노출 + 맨 앞 정렬.
const PLATFORM_PROFILES: AnalysisProfileConfig[] = [
  ...ANALYSIS_PROFILES.filter((p) => p.id === "generic"),
  ...ANALYSIS_PROFILES.filter((p) => p.id !== "generic"),
];

type Props = {
  open: boolean;

  /** 회차 영역 — 헤더 EP.NN · title 표기 */
  episode: { episode_number: number; title: string | null };
  workTitle: string;
  charCount: number;

  /** 플랫폼 controlled state — 단일 택1 (범용/플랫폼 4종) */
  agentVersion: string;
  onAgentVersionChange: (value: string) => void;

  /** NAT 영역 — AnalyzePanel buildNatBreakdown 결과 전달 */
  natLines: NatSpendLine[];
  natTotal: number;
  balance: number;

  /** 액션 */
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;

  /**
   * NULL 분기 사양 (단계 C-2 — 의제 신규-1+2).
   * - "both_present" = 현 NAT 차감 컨펌만 (변경 X)
   * - 기타 = 안내 텍스트 + 「예」 = onLoreConfirm (추출 진입, 단계 C-4 정합) / 「아니오」 = onCancel
   */
  loreNullCase?: LoreNullCase;
  onLoreConfirm?: () => void;

  /** 에러 (선택) */
  errorMessage?: string | null;
};

/**
 * 회차 분석 진입 모달 — BatchSpendConfirmModal 패턴 정합.
 *
 * - 옵션/플랫폼 영역 통합 (AnalyzePanel state controlled)
 * - NAT breakdown (글자수 tier 기본 + 옵션 +1 NAT × 2)
 * - 플랫폼 카드 grid (includePlatformOptimization 분기)
 * - 잔량 arrow + 잔액 부족 분기 + ohb-scan-beam loading 유지
 */
export function NatSpendConfirmModal({
  open,
  episode,
  workTitle,
  charCount,
  agentVersion,
  onAgentVersionChange,
  natLines,
  natTotal,
  balance,
  loading,
  onCancel,
  onConfirm,
  loreNullCase,
  onLoreConfirm,
  errorMessage,
}: Props) {
  if (!open) return null;

  const canAfford = balance >= natTotal;
  const afterBalance = canAfford ? balance - natTotal : balance;
  const baseLine = natLines[0];
  const lorePrompt = loreNullCase
    ? getLoreNullPromptText(loreNullCase)
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nat-spend-modal-title"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-sky-400/15 bg-stone-900 shadow-2xl shadow-black/40"
      >
        {loading && (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
              aria-hidden
            >
              <div className="ohb-scan-beam" />
            </div>
            <p className="pointer-events-none absolute bottom-[5.25rem] left-0 right-0 z-20 px-4 text-center text-[11px] leading-snug text-sky-300/90 sm:text-xs">
              <CopyWithBreaks as="span">
                에이전트가 원고를 정밀 분석 중입니다...
              </CopyWithBreaks>
            </p>
          </>
        )}
        <div className="relative z-0 p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300/70">
            회차 분석 진입
          </div>
          <h2
            id="nat-spend-modal-title"
            className="mt-1 font-serif text-[18px] text-stone-100"
          >
            {formatEpisodeLabel(episode)}
          </h2>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-stone-500">
            {workTitle} · 약 {charCount.toLocaleString()}자
          </p>

          {/* NAT breakdown */}
          <div className="mt-5 rounded-lg border border-stone-800 bg-stone-950/50 p-4">
            <ul className="space-y-2 text-[12.5px]">
              {/* 정책 변경: 단일 택1. 체크박스·하드코딩 줄 폐기, natLines 전체 렌더(NM-1 a). */}
              {natLines.map((line, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-stone-300"
                >
                  <span className="text-stone-400">{line.label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-sky-300">
                    {line.nat} NAT
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-stone-800 pt-2 text-stone-100">
                <span className="font-medium">합계</span>
                <span className="tabular-nums text-[16px] font-semibold text-sky-300">
                  {natTotal} NAT
                </span>
              </li>
            </ul>
          </div>

          {/* 정책 변경: 단일 택1 — 카드 그리드 항상 노출 (범용 포함 4개, 2×2). */}
          <div className="mt-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
              플랫폼 선택
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORM_PROFILES.map((p) => {
                const sel = agentVersion === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAgentVersionChange(p.id)}
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

          {/* 잔량 */}
          <div className="mt-4 flex items-center justify-between rounded-md border border-stone-800/60 bg-stone-950/40 px-3 py-2 text-[12px]">
            <span className="text-stone-400">보유 NAT</span>
            <span className="tabular-nums">
              <span className="text-stone-200">{balance}</span>
              <span className="mx-1.5 text-stone-700">→</span>
              <span className={canAfford ? "text-stone-200" : "text-amber-300"}>
                {afterBalance}
              </span>
            </span>
          </div>

          {!canAfford && (
            <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2 text-[12px] text-amber-200/95">
              잔액이 부족합니다. NAT를 충전한 뒤 다시 시도해 주세요.
              <div className="mt-1 font-mono text-[11px] tabular-nums text-amber-200/70">
                필요 {natTotal} NAT · 보유 {balance} NAT
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/[0.05] px-3 py-2 text-[12px] text-rose-200/95">
              <CopyWithBreaks as="span">{errorMessage}</CopyWithBreaks>
            </div>
          )}

          {/* NULL 분기 안내 (단계 C-2 — 분기 P-α, lorePrompt 있을 때만 노출) */}
          {lorePrompt && (
            <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/[0.05] px-4 py-3 text-[12.5px] leading-relaxed text-amber-100/95">
              <p className="whitespace-pre-wrap">{lorePrompt}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-stone-700 bg-stone-950/50 px-4 py-2.5 text-[12.5px] font-medium text-stone-200 transition-colors hover:border-stone-600 hover:bg-stone-800/60 disabled:opacity-50"
            >
              {lorePrompt ? "아니오" : "취소"}
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
                onClick={lorePrompt && onLoreConfirm ? onLoreConfirm : onConfirm}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-500 px-4 py-2.5 text-[12.5px] font-semibold text-stone-950 transition-colors hover:bg-sky-400 disabled:opacity-50"
              >
                <Sparkles size={11} aria-hidden="true" />
                {loading
                  ? "진입 중…"
                  : lorePrompt
                    ? `예 · 자동 추출 후 ${natTotal} NAT 차감`
                    : `${natTotal} NAT 차감 후 분석 진입`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
