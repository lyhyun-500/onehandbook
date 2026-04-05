"use client";

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

/** box-border + 고정 flex-basis로 가로 간격 유지(transform flex에서 gap 깨짐 방지) */
const thumbSm =
  "relative box-border block shrink-0 grow-0 basis-auto overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(2.65rem,12vw,3.65rem)] min-w-[clamp(2.65rem,12vw,3.65rem)] max-w-[clamp(2.65rem,12vw,3.65rem)] h-[calc(clamp(2.65rem,12vw,3.65rem)*1.8)]";
const thumbMd =
  "relative box-border block shrink-0 grow-0 basis-auto overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(3.35rem,9vw,4.85rem)] min-w-[clamp(3.35rem,9vw,4.85rem)] max-w-[clamp(3.35rem,9vw,4.85rem)] h-[calc(clamp(3.35rem,9vw,4.85rem)*1.8)]";
const thumbLg =
  "relative box-border block shrink-0 grow-0 basis-auto overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(4rem,7.5vw,5.75rem)] min-w-[clamp(4rem,7.5vw,5.75rem)] max-w-[clamp(4rem,7.5vw,5.75rem)] h-[calc(clamp(4rem,7.5vw,5.75rem)*1.8)]";
const thumbXl =
  "relative box-border block shrink-0 grow-0 basis-auto overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 w-[clamp(4.75rem,5.5vw,8rem)] min-w-[clamp(4.75rem,5.5vw,8rem)] max-w-[clamp(4.75rem,5.5vw,8rem)] h-[calc(clamp(4.75rem,5.5vw,8rem)*1.8)]";

/** 초와이드에서도 한 세트 너비가 뷰포트를 넘기도록 타일 수 보장 */
const MIN_MARQUEE_TILES = 72;

function buildMarqueeLoop(source: LandingCoverItem[]): LandingCoverItem[] {
  if (source.length === 0) return [];
  const segment: LandingCoverItem[] = [];
  for (let i = 0; i < MIN_MARQUEE_TILES; i++) {
    segment.push(source[i % source.length]!);
  }
  return [...segment, ...segment];
}

type ThumbSize = "sm" | "md" | "lg" | "xl";

/** Tailwind gap은 transform 레이어에서 깨질 수 있어 픽셀 간격만 사용 */
const MARQUEE_SPACING: Record<ThumbSize, { gapPx: number; padEndPx: number }> = {
  sm: { gapPx: 12, padEndPx: 12 },
  md: { gapPx: 16, padEndPx: 16 },
  lg: { gapPx: 20, padEndPx: 16 },
  xl: { gapPx: 24, padEndPx: 20 },
};

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
          sizes="(max-width: 768px) 72px, (max-width: 1024px) 96px, (max-width: 1920px) 120px, 160px"
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

/** 한 줄 높이만 차지 — 부모를 `h-full`로 키우지 않음 (위·아래 얇은 띠용) */
function MarqueeRow({
  items,
  direction,
  durationSec,
  rowKey,
  thumbSize,
}: {
  items: LandingCoverItem[];
  direction: "left" | "right";
  durationSec: number;
  rowKey: string;
  thumbSize: ThumbSize;
}) {
  const loop = buildMarqueeLoop(items);
  const animClass =
    direction === "left" ? "ohb-cover-row-marquee-left" : "ohb-cover-row-marquee-right";
  const fc = thumbClass(thumbSize);
  const hashOff =
    rowKey.includes("top") || rowKey.endsWith("-top") ? 0 : 19;
  const { gapPx, padEndPx } = MARQUEE_SPACING[thumbSize];

  return (
    <div className="flex min-h-0 w-full min-w-0 items-center overflow-hidden">
      <div
        className={`flex w-max min-w-max flex-none flex-row flex-nowrap items-center ${animClass}`}
        style={{
          animationDuration: `${durationSec}s`,
          paddingRight: padEndPx,
        }}
      >
        {loop.map((item, i) => (
          <div
            key={`${rowKey}-${i}`}
            className="shrink-0"
            style={
              i < loop.length - 1 ? { marginRight: gapPx } : undefined
            }
          >
            <CoverThumb item={item} hash={i + hashOff} frameClass={fc} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 위·아래 각각 ‘썸네일 한 줄’만 — 높이는 콘텐츠에 맡김 (50% 구역 불필요) */
function TwoRowBackdrop({
  thumbSize,
  topKey,
  botKey,
  twoRow,
}: {
  thumbSize: ThumbSize;
  topKey: string;
  botKey: string;
  twoRow: LandingCoverBackdropData["twoRow"];
}) {
  const strip =
    "pointer-events-none absolute inset-x-0 w-full overflow-hidden opacity-[0.48] isolate min-h-0";
  /** 고정 네비 아래에서 시작 — 썸네일이 헤더에 가려지지 않음 (히어로 본문 paddingTop과 동일 기준) */
  const topUnderNav = {
    top: "max(env(safe-area-inset-top, 0px), var(--ohb-landing-header-h))",
  } as const;
  return (
    <>
      <div className={strip} style={topUnderNav}>
        <MarqueeRow
          items={twoRow.top}
          direction="left"
          durationSec={92}
          rowKey={topKey}
          thumbSize={thumbSize}
        />
      </div>
      <div className={`${strip} bottom-0`}>
        <MarqueeRow
          items={twoRow.bottom}
          direction="right"
          durationSec={102}
          rowKey={botKey}
          thumbSize={thumbSize}
        />
      </div>
    </>
  );
}

/** 히어로 `z-0` 배경 레이어 안에만 넣을 때 사용 (부모가 `absolute inset-0` 등으로 크기를 잡음) */
export function LandingHeroCoverSliders({ data }: Props) {
  const { twoRow } = data;

  const layerClass =
    "absolute inset-0 h-full w-full min-h-0 overflow-hidden";

  return (
    <div
      className="pointer-events-none relative h-full min-h-0 w-full overflow-hidden bg-black"
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      {/* 한 구간에 하나만 보이게: <768 sm | 768–1023 md | 1024–1919 lg | 1920+ xl */}
      <div className={`${layerClass} block md:hidden`}>
        <TwoRowBackdrop
          twoRow={twoRow}
          thumbSize="sm"
          topKey="mob-top"
          botKey="mob-bot"
        />
      </div>

      <div className={`${layerClass} hidden md:block lg:hidden`}>
        <TwoRowBackdrop
          twoRow={twoRow}
          thumbSize="md"
          topKey="tab-top"
          botKey="tab-bot"
        />
      </div>

      <div className={`${layerClass} hidden lg:max-[1919px]:block`}>
        <TwoRowBackdrop
          twoRow={twoRow}
          thumbSize="lg"
          topKey="desk-top"
          botKey="desk-bot"
        />
      </div>

      <div className={`${layerClass} hidden min-[1920px]:block`}>
        <TwoRowBackdrop
          twoRow={twoRow}
          thumbSize="xl"
          topKey="wide-top"
          botKey="wide-bot"
        />
      </div>
    </div>
  );
}

/** @deprecated 히어로는 `LandingHeroCoverSliders` + 페이지 레이어 구조 사용 */
export function LandingCoverDrift({ data }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-black"
      aria-hidden
    >
      <LandingHeroCoverSliders data={data} />
    </div>
  );
}
