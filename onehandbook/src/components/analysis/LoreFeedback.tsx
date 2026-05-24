// 추출 결과 피드백 inline — 의제 신규-1+2 단계 C-5 (commit 4) 정합.
//
// LEE 결정 영속화:
// - 결정 11 (옵션 F-4): inline + 닫기 가능 (사용자 자율)
// - 결정 12 (옵션 G-2): 3 옵션 (적합/부분 적합/부적합) + 자유 텍스트 선택
// - 결정 13 (옵션 H-3): lore_extraction_feedback INSERT
// - 결정 14 (옵션 I-3): 인센티브 X (감사 안내만)
// - 결정 30 (옵션 F-1): 기 피드백 = server fetch (shouldShow props 정합)
// - 결정 32 (옵션 P-2): src/components/analysis/LoreFeedback.tsx 정합

"use client";

import { useState } from "react";
import { X } from "lucide-react";

type FeedbackRating = "적합" | "부분 적합" | "부적합";

const RATINGS: readonly FeedbackRating[] = ["적합", "부분 적합", "부적합"];

interface LoreFeedbackProps {
  workId: string;
  /**
   * 추출 진행 작품 (worldview_source 또는 characters_source = 'auto_extracted') +
   * 기 피드백 부재 시 true (server fetch 정합).
   */
  shouldShow: boolean;
}

export function LoreFeedback({ workId, shouldShow }: LoreFeedbackProps) {
  const [closed, setClosed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(
    null,
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!shouldShow) return null;

  if (submitted) {
    return (
      <div className="mx-auto mt-8 max-w-6xl rounded-xl border border-emerald-400/30 bg-emerald-400/[0.04] px-6 py-4">
        <p className="text-center font-serif text-[13px] text-emerald-200/95">
          피드백 감사합니다. 추출 정확도 개선에 사용됩니다.
        </p>
      </div>
    );
  }

  if (closed) return null;

  async function handleSubmit() {
    if (!selectedRating || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/works/${workId}/lore-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_rating: selectedRating,
          feedback_comment: comment.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : "피드백 제출 실패",
        );
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "피드백 제출 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative mx-auto mt-8 max-w-6xl rounded-xl border border-sky-400/25 bg-stone-900/40 px-7 py-6">
      <button
        type="button"
        onClick={() => setClosed(true)}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100/[0.04] hover:text-stone-200"
        aria-label="피드백 닫기"
      >
        <X size={14} aria-hidden="true" />
      </button>

      <div className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-sky-300/85">
        에이전트 추출 피드백
      </div>
      <h3 className="mt-1.5 font-serif text-[17px] font-medium text-stone-100">
        에이전트가 추출한 세계관·인물이 적합한가요?
      </h3>
      <p className="mt-1 font-serif text-[12.5px] leading-relaxed text-stone-400">
        피드백은 추출 정확도 개선에 사용됩니다. 인센티브는 별도로 없습니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {RATINGS.map((rating) => {
          const active = selectedRating === rating;
          return (
            <button
              key={rating}
              type="button"
              onClick={() => setSelectedRating(rating)}
              className={`rounded-full border px-4 py-1.5 font-serif text-[12.5px] transition-colors ${
                active
                  ? "border-sky-400/50 bg-sky-400/[0.14] text-sky-100"
                  : "border-stone-800 bg-stone-900/40 text-stone-300 hover:border-stone-700 hover:text-stone-100"
              }`}
            >
              {rating}
            </button>
          );
        })}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="추가 의견 (선택)"
        maxLength={2000}
        rows={3}
        className="mt-4 w-full resize-y rounded-md border border-stone-800 bg-stone-900/60 px-4 py-3 font-serif text-[13px] leading-relaxed text-stone-100 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
      />

      {error && (
        <p className="mt-2 rounded-md bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="rounded-md border border-stone-800/80 bg-stone-900/40 px-4 py-2 font-serif text-[12.5px] text-stone-300 hover:border-stone-700 hover:text-stone-100"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedRating || submitting}
          className="rounded-md bg-sky-400 px-5 py-2 font-serif text-[12.5px] font-medium text-stone-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500"
        >
          {submitting ? "제출 중…" : "제출"}
        </button>
      </div>
    </div>
  );
}
