import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  연재중: "bg-emerald-400",
  휴재: "bg-amber-400",
  완결: "bg-stone-500",
};

const FALLBACK_CLASS = "bg-stone-500";

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  status: string;
}

export const StatusDot = forwardRef<HTMLSpanElement, StatusDotProps>(
  function StatusDot({ status, className, ...props }, ref) {
    const colorClass = STATUS_COLORS[status] ?? FALLBACK_CLASS;
    return (
      <span
        ref={ref}
        aria-label={status}
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          colorClass,
          className,
        )}
        {...props}
      />
    );
  },
);
StatusDot.displayName = "StatusDot";
