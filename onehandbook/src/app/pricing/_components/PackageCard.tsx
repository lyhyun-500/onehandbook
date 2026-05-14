import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecommendedBadge } from "@/components/atoms/RecommendedBadge";

export interface PricingPackage {
  id: string;
  name: string;
  nat: number;
  price_krw: number;
  is_recommended: boolean;
  blurb: string;
  save_pct?: number;
}

interface PackageCardProps {
  pkg: PricingPackage;
  /** 402 INSUFFICIENT_NAT + 작가 패키지 영역 강조 본질. */
  autoFeatured: boolean;
}

function formatKRW(n: number): string {
  return "₩" + n.toLocaleString("ko-KR");
}

/**
 * 시안 `design_novel/novel-agent/pricing.jsx:144-207` 정합 — 3 패키지 카드.
 *
 * 구매 버튼 = 베타 기간 Paddle 미연동 영역 → 비활성 placeholder 본질.
 * StandardPlanButton.tsx 파일 = LEE 결정 Y5 보존 (Paddle 본질 영역 유지).
 * 별 sub-phase 에서 PackageCard 영역 결제 본질 통합 예정.
 */
export function PackageCard({ pkg, autoFeatured }: PackageCardProps) {
  const recommended = pkg.is_recommended || autoFeatured;
  const perNat = Math.round(pkg.price_krw / pkg.nat);

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border p-5 transition-colors",
        recommended
          ? "border-sky-400/40 bg-sky-500/[0.04] ring-2 ring-sky-400/60"
          : "border-stone-800/60 bg-stone-900/40 hover:bg-stone-900/60 hover:ring-1 hover:ring-stone-700/60",
      )}
    >
      {recommended && (
        <div className="absolute -top-2.5 right-5">
          <RecommendedBadge />
        </div>
      )}

      <header className="mb-5">
        <h3 className="font-serif text-[18px] text-stone-100">{pkg.name}</h3>
        <p className="mt-0.5 text-[11.5px] text-stone-500">{pkg.blurb}</p>
      </header>

      <div className="mb-5">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] font-medium leading-none tabular-nums text-sky-300">
            {pkg.nat}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300/70">
            NAT
          </span>
        </div>
      </div>

      <div className="mb-4 h-px bg-stone-800/70" aria-hidden="true" />

      <div className="mb-5 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[20px] tabular-nums text-stone-200">
            {formatKRW(pkg.price_krw)}
          </span>
          {pkg.save_pct ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300/85">
              −{pkg.save_pct}%
            </span>
          ) : null}
        </div>
        <div className="font-mono text-[10.5px] tabular-nums text-stone-500">
          1 NAT 당 {formatKRW(perNat)}
        </div>
      </div>

      <button
        type="button"
        disabled
        title="베타 기간 — 결제 연동 준비 중"
        className={cn(
          "mt-auto flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[12.5px] font-medium",
          "cursor-not-allowed opacity-60",
          recommended
            ? "bg-sky-400 text-stone-950"
            : "bg-sky-500 text-stone-950",
        )}
      >
        구매하기
        <ChevronRight size={12} aria-hidden="true" />
      </button>

      <div className="mt-2 text-center font-mono text-[9.5px] uppercase tracking-widest text-stone-600">
        Powered by Paddle
      </div>
    </article>
  );
}
