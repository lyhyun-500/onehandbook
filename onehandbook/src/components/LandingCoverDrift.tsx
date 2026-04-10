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

/**
 * 브레이크포인트별 썸네일 크기를 한 요소에 합침 — 마퀴 레이어는 하나만 마운트해 DOM·이미지 수를 줄임.
 * (기존 sm/md/lg/xl 네 겹 레이어는 각각 144+ 타일을 들고 있어 초기 HTML이 과도했음.)
 */
const thumbResponsive =
  "relative box-border block shrink-0 grow-0 basis-auto overflow-hidden rounded-md border border-white/[0.07] bg-zinc-900 " +
  "w-[clamp(2.65rem,12vw,3.65rem)] min-w-[clamp(2.65rem,12vw,3.65rem)] max-w-[clamp(2.65rem,12vw,3.65rem)] h-[calc(clamp(2.65rem,12vw,3.65rem)*1.8)] " +
  "md:w-[clamp(3.35rem,9vw,4.85rem)] md:min-w-[clamp(3.35rem,9vw,4.85rem)] md:max-w-[clamp(3.35rem,9vw,4.85rem)] md:h-[calc(clamp(3.35rem,9vw,4.85rem)*1.8)] " +
  "lg:w-[clamp(4rem,7.5vw,5.75rem)] lg:min-w-[clamp(4rem,7.5vw,5.75rem)] lg:max-w-[clamp(4rem,7.5vw,5.75rem)] lg:h-[calc(clamp(4rem,7.5vw,5.75rem)*1.8)] " +
  "xl:w-[clamp(4.75rem,5.5vw,8rem)] xl:min-w-[clamp(4.75rem,5.5vw,8rem)] xl:max-w-[clamp(4.75rem,5.5vw,8rem)] xl:h-[calc(clamp(4.75rem,5.5vw,8rem)*1.8)]";

/** 무한 마퀴: 트랙을 동일 세그먼트 2개만 이어붙이고 translate -50%로 루프 (globals.css 키프레임) */
function duplicateForMarquee(source: LandingCoverItem[]): LandingCoverItem[] {
  if (source.length === 0) return [];
  return [...source, ...source];
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
}: {
  items: LandingCoverItem[];
  direction: "left" | "right";
  durationSec: number;
  rowKey: string;
}) {
  const loop = duplicateForMarquee(items);
  const animClass =
    direction === "left" ? "ohb-cover-row-marquee-left" : "ohb-cover-row-marquee-right";
  const hashOff =
    rowKey.includes("top") || rowKey.endsWith("-top") ? 0 : 19;

  return (
    <div className="flex min-h-0 w-full min-w-0 items-center overflow-hidden">
      <div
        className={`flex w-max min-w-max flex-none flex-row flex-nowrap items-center pr-3 md:pr-4 lg:pr-4 xl:pr-5 ${animClass}`}
        style={{
          animationDuration: `${durationSec}s`,
        }}
      >
        {loop.map((item, i) => (
          <div
            key={`${rowKey}-${i}`}
            className={
              i < loop.length - 1
                ? "shrink-0 mr-3 md:mr-4 lg:mr-5 xl:mr-6"
                : "shrink-0"
            }
          >
            <CoverThumb item={item} hash={i + hashOff} frameClass={thumbResponsive} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 위·아래 각각 ‘썸네일 한 줄’만 — 높이는 콘텐츠에 맡김 (50% 구역 불필요) */
function TwoRowBackdrop({
  topKey,
  botKey,
  twoRow,
}: {
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
        />
      </div>
      <div className={`${strip} bottom-0`}>
        <MarqueeRow
          items={twoRow.bottom}
          direction="right"
          durationSec={102}
          rowKey={botKey}
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
      <div className={layerClass}>
        <TwoRowBackdrop
          twoRow={twoRow}
          topKey="hero-top"
          botKey="hero-bot"
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
