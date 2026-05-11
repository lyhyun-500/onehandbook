import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { getScoreColor } from "@/lib/scoreColor";

export type ScoreTextSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<ScoreTextSize, string> = {
  sm: "text-[11px]",
  md: "font-serif text-[18px]",
  lg: "font-serif text-[28px]",
};

export interface ScoreTextProps extends HTMLAttributes<HTMLSpanElement> {
  score: number | null | undefined;
  size?: ScoreTextSize;
}

export const ScoreText = forwardRef<HTMLSpanElement, ScoreTextProps>(
  function ScoreText({ score, size = "md", className, ...props }, ref) {
    if (score == null) {
      return (
        <span
          ref={ref}
          className={cn("tabular-nums text-stone-400", SIZE_CLASSES[size], className)}
          {...props}
        >
          -
        </span>
      );
    }
    const { text } = getScoreColor(score);
    return (
      <span
        ref={ref}
        className={cn("tabular-nums", text, SIZE_CLASSES[size], className)}
        {...props}
      >
        {score}
      </span>
    );
  },
);
ScoreText.displayName = "ScoreText";
