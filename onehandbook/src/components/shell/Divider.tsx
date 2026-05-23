import { cn } from "@/lib/utils";

export interface DividerProps {
  className?: string;
}

/**
 * 공통 divider — shell.jsx atoms.jsx 정합.
 * 기본은 배경 토큰만 적용. 차원 (h-px / h-6 w-px 등) 은 호출처 className 으로 결정.
 */
export function Divider({ className }: DividerProps) {
  return <div className={cn("bg-stone-800/80", className)} aria-hidden="true" />;
}
