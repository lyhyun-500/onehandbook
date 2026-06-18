"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DeleteEpisodeModalProps {
  open: boolean;
  workId: number;
  episodeId: number;
  episodeNumber: number;
  isPrologue: boolean;
  /** 본편 단독 — 삭제 후 남은 본편 회차 재배치 안내 표시 사양. */
  willReorder: boolean;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 회차 삭제 confirm modal — DeleteWorkButton 패턴 답습.
 *
 * 사양 (ADR-0032):
 * - mount 시 analysis_runs count 단독 fetch (저비용 indexed query).
 * - fetch 완료 전 「삭제」 button disabled 단독 (Q6 race 방지).
 * - 라벨 = ep===0 ? "프롤로그" : `${n}화` (ADR-0031 체크리스트 1).
 * - 재배치 문구 = "이후 회차 번호가 당겨집니다" (1화부터 재정렬 X — 중간
 *   삭제 오해 방지 사양).
 */
export function DeleteEpisodeModal({
  open,
  workId: _workId,
  episodeId,
  episodeNumber,
  isPrologue,
  willReorder,
  loading,
  error,
  onCancel,
  onConfirm,
}: DeleteEpisodeModalProps) {
  const [analysisCount, setAnalysisCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // body overflow lock (DeleteWorkButton 패턴 정합).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // mount 시 analysis_runs count fetch (Q6 race 방지 사양 — 완료 전 button disabled).
  useEffect(() => {
    if (!open) {
      setAnalysisCount(null);
      return;
    }
    let cancelled = false;
    setCountLoading(true);
    const supabase = createClient();
    void supabase
      .from("analysis_runs")
      .select("id", { count: "exact", head: true })
      .eq("episode_id", episodeId)
      .then(({ count }) => {
        if (cancelled) return;
        setAnalysisCount(count ?? 0);
        setCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, episodeId]);

  if (!open) return null;

  const epLabel = episodeNumber === 0 ? "프롤로그" : `${episodeNumber}화`;
  const confirmDisabled = loading || countLoading;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-red-500/15 bg-zinc-900 p-6 shadow-2xl shadow-black/40">
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">
          {epLabel} 회차를 삭제할까요?
        </h2>

        <div className="mb-5 space-y-2 rounded-lg border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-100/95">
          {countLoading ? (
            <p className="text-red-200/70">관련 데이터를 확인하는 중…</p>
          ) : (
            <p>
              분석 결과{" "}
              <span className="font-medium text-red-100">
                {analysisCount ?? 0}건
              </span>
              이 함께 영구 삭제됩니다.
            </p>
          )}
          <p className="text-[12.5px] text-red-200/80">
            관련 메모와 작품 바이블 fact도 함께 삭제됩니다.
          </p>
          {willReorder && !isPrologue && (
            <p className="text-[12.5px] text-amber-200/85">
              이후 회차 번호가 당겨집니다.
            </p>
          )}
        </div>

        {error && (
          <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <p className="mb-5 text-[12px] text-zinc-400">
          이 작업은 되돌릴 수 없습니다.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-md border border-red-500/40 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 hover:border-red-500/60 hover:bg-red-950/55 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
