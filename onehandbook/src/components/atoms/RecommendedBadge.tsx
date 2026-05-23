/**
 * 시안 `design_novel/novel-agent/pricing.jsx:65-70` 정합 — 패키지 카드 추천 chip.
 *
 * 사용처: 본 채널 진입 시점에 PackageCard 한정 (recommended || autoFeatured).
 * 다른 사용처 발생 시 위치 검토.
 */
export function RecommendedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/[0.08] px-2 py-0.5 ring-1 ring-inset ring-sky-400/30 shadow-[0_2px_8px_-2px_rgba(56,189,248,0.3)]">
      <span
        className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(125,211,252,0.7)]"
        aria-hidden="true"
      />
      <span className="font-mono text-[10px] uppercase tracking-widest text-sky-300">
        추천
      </span>
    </span>
  );
}
