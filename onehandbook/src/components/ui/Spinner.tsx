import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  /** 접근성 라벨 — 로딩 컨텍스트별 override 박음 (default: "로딩 중") */
  label?: string;
}

const baseClasses =
  "inline-block animate-spin rounded-full border-2 " +
  "border-current/20 border-t-current text-accent";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = "md", label = "로딩 중", className, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cn(baseClasses, sizeClasses[size], className)}
      {...props}
    />
  );
});
Spinner.displayName = "Spinner";
