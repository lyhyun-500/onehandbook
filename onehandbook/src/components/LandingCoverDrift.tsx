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
    rowKey.includes("top") || rowKey.endsWith("-top") ? 0 : 19;

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

/** 상단(top:0) / 하단(bottom:0) 고정, 높이 50% — 히어로 안에서만 overflow */
function EdgeStrip({
  children,
  edge,
  className,
}: {
  children: ReactNode;
  edge: "top" | "bottom";
  className?: string;
}) {
  const pos =
    edge === "top"
      ? "top-0 left-0 right-0"
      : "bottom-0 left-0 right-0";
  return (
    <div
      className={`pointer-events-none absolute z-[1] h-1/2 min-h-0 overflow-hidden opacity-[0.48] ${pos} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function TwoRowBackdrop({
  thumbSize,
  gapClass,
  topKey,
  botKey,
  twoRow,
}: {
  thumbSize: ThumbSize;
  gapClass: string;
  topKey: string;
  botKey: string;
  twoRow: LandingCoverBackdropData["twoRow"];
}) {
  return (
    <>
      <EdgeStrip edge="top">
        <MarqueeRow
          items={twoRow.top}
          direction="left"
          durationSec={34}
          rowKey={topKey}
          thumbSize={thumbSize}
          gapClass={gapClass}
        />
      </EdgeStrip>
      <EdgeStrip edge="bottom">
        <MarqueeRow
          items={twoRow.bottom}
          direction="right"
          durationSec={38}
          rowKey={botKey}
          thumbSize={thumbSize}
          gapClass={gapClass}
        />
      </EdgeStrip>
    </>
  );
}

export function LandingCoverDrift({ data }: Props) {
  const { twoRow } = data;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-black"
      aria-hidden
    >
      <div className="absolute inset-0 overflow-hidden md:hidden">
        <TwoRowBackdrop
          twoRow={twoRow}
          thumbSize="sm"
          gapClass="gap-2.5 pr-3"
          topKey="mob-top"
          botKey="mob-bot"
        />
      </div>

      <div className="absolute inset-0 hidden overflow-hidden md:block min-[1025px]:hidden">
        <TwoRowBackdrop
          twoRow={twoRow}
          thumbSize="md"
          gapClass="gap-3.5 pr-4"
          topKey="tab-top"
          botKey="tab-bot"
        />
      </div>

      <div className="absolute inset-0 hidden overflow-hidden min-[1025px]:block min-[1920px]:hidden">
        <TwoRowBackdrop
          twoRow={twoRow}
          thumbSize="lg"
          gapClass="gap-4 pr-4 md:gap-5"
          topKey="desk-top"
          botKey="desk-bot"
        />
      </div>

      <div className="absolute inset-0 hidden overflow-hidden min-[1920px]:block">
        <TwoRowBackdrop
          twoRow={twoRow}
          thumbSize="xl"
          gapClass="gap-5 pr-5"
          topKey="wide-top"
          botKey="wide-bot"
        />
      </div>
    </div>
  );
}
