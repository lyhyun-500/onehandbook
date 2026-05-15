"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export type EmptyStateVariant = "sky" | "stone";
export type EmptyStateSize = "default" | "lg";

export interface EmptyStateCTA {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  cta?: EmptyStateCTA;
  variant?: EmptyStateVariant;
  size?: EmptyStateSize;
  className?: string;
}

const ICON_VARIANT: Record<EmptyStateVariant, string> = {
  sky: "bg-sky-500/[0.08] text-sky-300 ring-1 ring-inset ring-sky-500/20",
  stone: "bg-stone-800/40 text-stone-400 ring-1 ring-inset ring-stone-700/40",
};

const CTA_VARIANT: Record<NonNullable<EmptyStateCTA["variant"]>, string> = {
  primary:
    "inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-2 text-[12.5px] font-medium text-stone-950 transition-colors hover:bg-sky-400",
  secondary:
    "inline-flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/60 px-4 py-2 text-[12.5px] text-stone-200 transition-colors hover:border-sky-400/40 hover:text-sky-200",
};

const SIZE_PADDING: Record<EmptyStateSize, string> = {
  default: "px-8 py-14",
  lg: "px-10 py-20",
};

/**
 * 분석 페이지 / 회차 부재 / 검색 결과 부재 등 빈 상태 영역의 공통 atom.
 *
 * variant 본질:
 * - sky = 작품 분석 이력 부재 등 적극적 진입 유도 영역
 * - stone = 부재 그 자체를 담담히 안내하는 영역
 */
export function EmptyState({
  icon,
  title,
  body,
  cta,
  variant = "sky",
  size = "default",
  className,
}: EmptyStateProps) {
  const ctaClass = CTA_VARIANT[cta?.variant ?? "primary"];
  return (
    <div
      className={`mx-auto rounded-2xl border border-dashed border-stone-800 bg-stone-900/30 text-center ${SIZE_PADDING[size]} ${
        className ?? ""
      }`}
    >
      <div
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${ICON_VARIANT[variant]}`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-[20px] text-stone-100">{title}</h3>
      <div className="mx-auto mt-2 max-w-md font-serif text-[13.5px] leading-relaxed text-stone-400 text-pretty [word-break:keep-all]">
        {body}
      </div>
      {cta && (
        <div className="mt-6">
          {cta.onClick ? (
            <button type="button" onClick={cta.onClick} className={ctaClass}>
              {cta.label}
            </button>
          ) : cta.href ? (
            <Link href={cta.href} className={ctaClass}>
              {cta.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
