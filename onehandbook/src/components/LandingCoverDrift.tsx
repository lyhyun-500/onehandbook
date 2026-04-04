"use client";

import Image from "next/image";
import type { LandingCoverItem, LandingCoverRows } from "@/lib/landing-covers";

const gradientClass = [
  "from-violet-950/80 to-zinc-950",
  "from-rose-950/80 to-zinc-950",
  "from-amber-950/70 to-zinc-950",
  "from-sky-950/70 to-zinc-950",
  "from-emerald-950/70 to-zinc-950",
  "from-fuchsia-950/70 to-zinc-950",
] as const;

/** 2:3 대비 세로 20% 증가 → 2 : 3.6 */
const coverFrameClass =
  "relative shrink-0 overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(4.75rem,11vw,6.75rem)] aspect-[2/3.6]";

type Props = { rows: LandingCoverRows };

function CoverThumb({ item, hash }: { item: LandingCoverItem; hash: number }) {
  return (
    <div className={coverFrameClass}>
      {item.src ? (
        <Image
          src={item.src}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 88px, 112px"
          loading="lazy"
        />
      ) : (
        <div
          className={`h-full w-full bg-gradient-to-br ${gradientClass[hash % gradientClass.length]}`}
        />
      )}
    </div>
  );
}

function MarqueeRow({
  items,
  direction,
  durationSec,
  rowKey,
}: {
  items: LandingCoverItem[];
  direction: "left" | "right";
  durationSec: number;
  rowKey: "top" | "bottom";
}) {
  const loop = [...items, ...items];
  const animClass =
    direction === "left" ? "ohb-cover-row-marquee-left" : "ohb-cover-row-marquee-right";

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className={`flex w-max flex-row items-center gap-4 md:gap-5 ${animClass}`}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loop.map((item, i) => (
          <CoverThumb
            key={`${rowKey}-${i}-${item.src ?? "p"}`}
            item={item}
            hash={rowKey === "top" ? i : i + 17}
          />
        ))}
      </div>
    </div>
  );
}

export function LandingCoverDrift({ rows }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] flex min-h-0 flex-col justify-center gap-4 py-6 opacity-[0.15] md:gap-5 md:py-8"
      aria-hidden
    >
      <MarqueeRow
        items={rows.top}
        direction="left"
        durationSec={34}
        rowKey="top"
      />
      <MarqueeRow
        items={rows.bottom}
        direction="right"
        durationSec={38}
        rowKey="bottom"
      />
    </div>
  );
}
