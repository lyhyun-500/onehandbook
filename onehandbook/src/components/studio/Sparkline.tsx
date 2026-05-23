import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Sparkline 막대 색상 매핑 — 시안 studio.jsx L43-44 정합 (alpha /80, /60).
 * scoreColor utility (Phase 2-B-2) 의 alpha 정책과 다름 (시안 sparkline 의 별 톤 박음) —
 * 본 영역 인라인 박음 박음, 추후 재사용 발생 시 utility 추출 검토 (별 의제).
 */
function getSparkBarColor(score: number): string {
  if (score >= 90) return "bg-emerald-400/80";
  if (score >= 80) return "bg-amber-300/80";
  if (score >= 70) return "bg-amber-400/60";
  if (score >= 60) return "bg-orange-400/60";
  return "bg-rose-400/60";
}

export interface SparklineProps extends HTMLAttributes<HTMLDivElement> {
  scores: number[];
  /** 막대 컨테이너 높이 (px). default 28 (시안 h-7). */
  height?: number;
}

export const Sparkline = forwardRef<HTMLDivElement, SparklineProps>(
  function Sparkline({ scores, height = 28, className, ...props }, ref) {
    if (!scores || scores.length === 0) return null;
    return (
      <div ref={ref} className={cn("mt-3", className)} {...props}>
        <div
          className="flex items-end gap-[3px]"
          style={{ height: `${height}px` }}
        >
          {scores.map((s, i) => {
            const tone = getSparkBarColor(s);
            const h = Math.max(6, (s / 100) * (height - 2));
            return (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className={cn("flex-1 rounded-sm", tone)}
                style={{ height: `${h}px` }}
                aria-hidden="true"
              />
            );
          })}
        </div>
        <div className="mt-1 text-[10px] text-stone-600">
          최근 {scores.length}화 추이
        </div>
      </div>
    );
  },
);
Sparkline.displayName = "Sparkline";
