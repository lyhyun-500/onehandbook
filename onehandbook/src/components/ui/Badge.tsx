import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const baseClasses =
  "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-accent text-accent-foreground",
  secondary: "bg-muted text-muted-foreground",
  // outline: --border 토큰이 다크 배경 위에서 시각적으로 약함 — Badge 한정 foreground/20 로 강화 (ADR-0024)
  outline: "border border-foreground/20 bg-transparent text-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "h-5 px-2 text-xs",
  md: "h-6 px-2.5 text-sm",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "default", size = "sm", className, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  );
});
Badge.displayName = "Badge";
