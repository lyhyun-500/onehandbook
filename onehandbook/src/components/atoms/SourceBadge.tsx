/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:369-383` 정합 — 회차 분석 source 표시.
 *
 * source = "individual" — 회차 단독 분석. sky 톤 강조.
 * source = "holistic" — 일괄 분석에서 derive 된 점수. stone 톤 약화 (opacity).
 */
export type AnalysisSource = "individual" | "holistic";

interface SourceBadgeProps {
  source: AnalysisSource;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const isHolistic = source === "holistic";
  return (
    <span
      title={
        isHolistic
          ? "일괄 분석에서 derive 된 overview 점수"
          : "회차 단독 분석 결과"
      }
      className={`inline-flex items-center rounded-sm px-1 py-px font-mono text-[8.5px] uppercase tracking-widest ${
        isHolistic
          ? "bg-stone-700/40 text-stone-400"
          : "bg-sky-400/[0.10] text-sky-200/90"
      }`}
    >
      {isHolistic ? "일괄" : "개별"}
    </span>
  );
}
