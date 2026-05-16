import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderAnalysisBell } from "@/contexts/AnalysisJobsContext";
import { Divider } from "./Divider";

export interface TopBarProps {
  /** breadcrumb 배열 — 마지막 항목은 색상 강조 (text-stone-300). */
  breadcrumb?: string[];
  /** 메인 제목 — font-serif 17px (시안 shell.jsx:107 정합). */
  title: string;
  /** 우측 actions slot — Divider · NatChip · Bell 앞에 박힘. */
  actions?: ReactNode;
  /** NatChip 표시값 — 사용자 coin_balance. null 이면 0. */
  natBalance: number;
}

/**
 * `(app)` shell 의 상단 가로 헤더. 시안 `design_novel/novel-agent/shell.jsx:93-121` 정합.
 *
 * TopBar 구현 본질 (LEE 결정 6) = 페이지 직접 렌더. layout.tsx 는 LeftRail 만 박힘.
 * 페이지가 자신의 breadcrumb / title / actions 를 props 로 전달.
 */
export function TopBar({ breadcrumb, title, actions, natBalance }: TopBarProps) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-800/60 bg-stone-950/40 px-6 backdrop-blur">
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-stone-500">
            {breadcrumb.map((c, i) => (
              <Fragment key={`${i}-${c}`}>
                {i > 0 && (
                  <ChevronRight size={10} aria-hidden="true" />
                )}
                <span
                  className={cn(
                    i === breadcrumb.length - 1 ? "text-stone-300" : "",
                  )}
                >
                  {c}
                </span>
              </Fragment>
            ))}
          </div>
        )}
        <h1 className="font-serif text-[17px] font-medium leading-tight tracking-tight text-stone-100">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Divider className="mx-2 h-6 w-px" />
        <Link
          href="/billing"
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/[0.08] px-2.5 py-1 text-xs font-medium text-sky-200 transition-colors hover:border-sky-400/40 hover:bg-sky-400/[0.12]"
          aria-label={`NAT 잔량 ${natBalance.toLocaleString("ko-KR")}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" />
          <span className="tabular-nums">{natBalance.toLocaleString("ko-KR")}</span>
          <span className="opacity-60">NAT</span>
        </Link>
        <HeaderAnalysisBell />
      </div>
    </div>
  );
}
