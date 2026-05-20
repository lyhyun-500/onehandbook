type NatChipSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<NatChipSize, string> = {
  sm: "text-[11px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

/**
 * NAT 잔량 칩 — 시안 atoms.jsx NatChip 포팅.
 * 사용처: TopBar / 온보딩 hero / 빈 스튜디오 가치 제안.
 */
export function NatChip({
  amount,
  size = "md",
}: {
  amount: number;
  size?: NatChipSize;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-sky-400/25 bg-sky-400/[0.08] font-medium text-sky-200 ${SIZE_MAP[size]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" />
      <span className="tabular-nums">{amount}</span>
      <span className="opacity-60">NAT</span>
    </span>
  );
}
