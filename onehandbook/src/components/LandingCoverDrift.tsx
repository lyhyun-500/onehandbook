"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import type { LandingCoverBackdropData, LandingCoverItem } from "@/lib/landing-covers";

const gradientClass = [
  "from-violet-950/80 to-zinc-950",
  "from-rose-950/80 to-zinc-950",
  "from-amber-950/70 to-zinc-950",
  "from-sky-950/70 to-zinc-950",
  "from-emerald-950/70 to-zinc-950",
  "from-fuchsia-950/70 to-zinc-950",
] as const;

const thumbSm =
  "relative shrink-0 overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(2.65rem,12vw,3.65rem)] aspect-[2/3.6]";
const thumbMd =
  "relative shrink-0 overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(3.35rem,9vw,4.85rem)] aspect-[2/3.6]";
const thumbLg =
  "relative shrink-0 overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(4rem,7.5vw,5.75rem)] aspect-[2/3.6]";
const thumbXl =
  "relative shrink-0 overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(4.75rem,6vw,7.25rem)] aspect-[2/3.6]";

type ThumbSize = "sm" | "md" | "lg" | "xl";

function thumbClass(size: ThumbSize): string {
  switch (size) {
    case "sm":
      return thumbSm;
    case "md":
      return thumbMd;
    case "lg":
      return thumbLg;
    case "xl":
      return thumbXl;
  }
}

type Props = { data: LandingCoverBackdropData };

function CoverThumb({
  item,
  hash,
  frameClass,
}: {
  item: LandingCoverItem;
  hash: number;
  frameClass: string;
}) {
  return (
    <div className={frameClass}>
      {item.src ? (
        <Image
          src={item.src}
          alt=""
          fill
          className="object-cover brightness-[1.08] contrast-[1.03]"
          sizes="(max-width: 768px) 72px, (max-width: 1024px) 96px, 120px"
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
  thumbSize,
  gapClass,
}: {
  items: LandingCoverItem[];
  direction: "left" | "right";
  durationSec: number;
  rowKey: string;
  thumbSize: ThumbSize;
  gapClass: string;
}) {
  const loop = [...items, ...items];
  const animClass =
    direction === "left" ? "ohb-cover-row-marquee-left" : "ohb-cover-row-marquee-right";
  const fc = thumbClass(thumbSize);
  const hashOff =
    rowKey.includes("top") || rowKey.endsWith("-top")
      ? 0
      : rowKey.includes("middle") || rowKey.includes("mid")
        ? 31
        : 19;

  return (
    <div className="flex h-full min-h-0 w-full items-center overflow-hidden">
      <div
        className={`flex w-max flex-row items-center ${gapClass} ${animClass}`}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loop.map((item, i) => (
          <CoverThumb
            key={`${rowKey}-${i}-${item.src ?? "p"}`}
            item={item}
            hash={i + hashOff}
            frameClass={fc}
          />
        ))}
      </div>
    </div>
  );
}

function Strip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none flex min-h-0 w-full flex-1 flex-col overflow-hidden opacity-[0.48] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function LandingCoverDrift({ data }: Props) {
  const { twoRow, threeRow } = data;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] bg-black" aria-hidden>
      {/* 모바일: 2줄 50/50 · 작은 썸네일 · 틈 없음 */}
      <div className="absolute inset-0 z-[1] flex h-full flex-col gap-0 md:hidden">
        <Strip>
          <MarqueeRow
            items={twoRow.top}
            direction="left"
            durationSec={34}
            rowKey="mob-top"
            thumbSize="sm"
            gapClass="gap-2.5 pr-3"
          />
        </Strip>
        <Strip>
          <MarqueeRow
            items={twoRow.bottom}
            direction="right"
            durationSec={38}
            rowKey="mob-bot"
            thumbSize="sm"
            gapClass="gap-2.5 pr-3"
          />
        </Strip>
      </div>

      {/* 태블릿 768–1024px */}
      <div className="absolute inset-0 z-[1] hidden h-full flex-col gap-0 md:flex min-[1025px]:hidden">
        <Strip>
          <MarqueeRow
            items={twoRow.top}
            direction="left"
            durationSec={34}
            rowKey="tab-top"
            thumbSize="md"
            gapClass="gap-3.5 pr-4"
          />
        </Strip>
        <Strip>
          <MarqueeRow
            items={twoRow.bottom}
            direction="right"
            durationSec={38}
            rowKey="tab-bot"
            thumbSize="md"
            gapClass="gap-3.5 pr-4"
          />
        </Strip>
      </div>

      {/* 데스크톱 1025–1919px */}
      <div className="absolute inset-0 z-[1] hidden h-full flex-col gap-0 min-[1025px]:flex min-[1920px]:hidden">
        <Strip>
          <MarqueeRow
            items={twoRow.top}
            direction="left"
            durationSec={34}
            rowKey="desk-top"
            thumbSize="lg"
            gapClass="gap-4 pr-4 md:gap-5"
          />
        </Strip>
        <Strip>
          <MarqueeRow
            items={twoRow.bottom}
            direction="right"
            durationSec={38}
            rowKey="desk-bot"
            thumbSize="lg"
            gapClass="gap-4 pr-4 md:gap-5"
          />
        </Strip>
      </div>

      {/* 데스크톱 1920–2559px */}
      <div className="absolute inset-0 z-[1] hidden h-full flex-col gap-0 min-[1920px]:flex min-[2560px]:hidden">
        <Strip>
          <MarqueeRow
            items={twoRow.top}
            direction="left"
            durationSec={34}
            rowKey="wide-top"
            thumbSize="xl"
            gapClass="gap-5 pr-5"
          />
        </Strip>
        <Strip>
          <MarqueeRow
            items={twoRow.bottom}
            direction="right"
            durationSec={38}
            rowKey="wide-bot"
            thumbSize="xl"
            gapClass="gap-5 pr-5"
          />
        </Strip>
      </div>

      {/* 4K ≥2560px: 3줄 균등 */}
      <div className="absolute inset-0 z-[1] hidden h-full flex-col gap-0 min-[2560px]:flex">
        <Strip>
          <MarqueeRow
            items={threeRow.top}
            direction="left"
            durationSec={34}
            rowKey="4k-top"
            thumbSize="xl"
            gapClass="gap-5 pr-5"
          />
        </Strip>
        <Strip>
          <MarqueeRow
            items={threeRow.middle}
            direction="right"
            durationSec={36}
            rowKey="4k-mid"
            thumbSize="xl"
            gapClass="gap-5 pr-5"
          />
        </Strip>
        <Strip>
          <MarqueeRow
            items={threeRow.bottom}
            direction="left"
            durationSec={38}
            rowKey="4k-bot"
            thumbSize="xl"
            gapClass="gap-5 pr-5"
          />
        </Strip>
      </div>
    </div>
  );
}
