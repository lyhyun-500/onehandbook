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
          className="object-cover"
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
    rowKey.includes("top") ? 0 : rowKey.includes("middle") ? 31 : rowKey.includes("single") ? 7 : 19;

  return (
    <div className="flex h-full min-h-0 w-full items-stretch overflow-hidden">
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
      className={`pointer-events-none w-full shrink-0 overflow-hidden opacity-[0.15] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function LandingCoverDrift({ data }: Props) {
  const { single, twoRow, threeRow } = data;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] bg-black" aria-hidden>
      {/* 모바일(max-md): 1줄 · 상단 · 작은 썸네일 */}
      <div className="absolute inset-x-0 top-0 z-[1] h-[20svh] md:hidden">
        <Strip className="h-full">
          <MarqueeRow
            items={single}
            direction="left"
            durationSec={36}
            rowKey="single"
            thumbSize="sm"
            gapClass="gap-2.5 pr-3"
          />
        </Strip>
      </div>

      {/* 태블릿 768–1024px: 2줄 상·하 */}
      <div className="absolute inset-0 z-[1] hidden flex-col justify-between md:flex min-[1025px]:hidden">
        <Strip className="h-[26svh]">
          <MarqueeRow
            items={twoRow.top}
            direction="left"
            durationSec={34}
            rowKey="tab-top"
            thumbSize="md"
            gapClass="gap-3.5 pr-4"
          />
        </Strip>
        <Strip className="h-[26svh]">
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

      {/* 데스크톱 1025–1919px: 2줄 더 큼 */}
      <div className="absolute inset-0 z-[1] hidden flex-col justify-between min-[1025px]:flex min-[1920px]:hidden">
        <Strip className="h-[32svh]">
          <MarqueeRow
            items={twoRow.top}
            direction="left"
            durationSec={34}
            rowKey="desk-top"
            thumbSize="lg"
            gapClass="gap-4 pr-4 md:gap-5"
          />
        </Strip>
        <Strip className="h-[32svh]">
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

      {/* 데스크톱 1920–2559px: 2줄, 뷰포트 기준 크게 */}
      <div className="absolute inset-0 z-[1] hidden flex-col justify-between min-[1920px]:flex min-[2560px]:hidden">
        <Strip className="h-[min(40svh,42vh)]">
          <MarqueeRow
            items={twoRow.top}
            direction="left"
            durationSec={34}
            rowKey="wide-top"
            thumbSize="xl"
            gapClass="gap-5 pr-5"
          />
        </Strip>
        <Strip className="h-[min(40svh,42vh)]">
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

      {/* 4K ≥2560px: 3줄 */}
      <div className="absolute inset-0 z-[1] hidden flex-col justify-between min-[2560px]:flex">
        <Strip className="h-[28svh]">
          <MarqueeRow
            items={threeRow.top}
            direction="left"
            durationSec={34}
            rowKey="4k-top"
            thumbSize="xl"
            gapClass="gap-5 pr-5"
          />
        </Strip>
        <Strip className="h-[28svh]">
          <MarqueeRow
            items={threeRow.middle}
            direction="right"
            durationSec={36}
            rowKey="4k-mid"
            thumbSize="xl"
            gapClass="gap-5 pr-5"
          />
        </Strip>
        <Strip className="h-[28svh]">
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
