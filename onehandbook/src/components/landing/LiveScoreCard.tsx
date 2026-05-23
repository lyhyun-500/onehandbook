"use client";

/**
 * LiveScoreCard — 비로그인 랜딩의 우측 라이브 점수 데모 카드.
 * 시안: design_novel/novel-agent/landing.jsx 의 HeroSampleReport 박음 그대로.
 *
 * 동작:
 * - useLiveScore 훅 박음 — RAF 기반 lerp(6%) 보간, 5초 interval 박음 새 target.
 * - 6축 + 종합 점수 동시 박음. delay 박음 stagger (`i * 200ms`) 박음.
 * - 6축 텍스트 톤 = scoreColor (객관 평가 — 90+/80+/70+/60+/<60).
 * - 종합 점수 톤 = 시안 인라인 분기 박음 (>=80 emerald, else amber-200 — 후한 톤).
 * - 6축 막대그래프 fill = oklch 인라인 (240ms transition 박음 — Tailwind class 박을 수 없는
 *   부드러운 색상 보간 박음, 시안 의도 보존).
 *
 * SSR: useState/useRef 모두 props.initial 박음 → 서버/클라이언트 동일 초기값 → hydration mismatch 없음.
 * cleanup: cancelAnimationFrame + clearInterval 박음 (마운트 해제 시).
 */

import {
  type HTMLAttributes,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { getScoreColor } from "@/lib/scoreColor";

interface UseLiveScoreOptions {
  min?: number;
  max?: number;
  delay?: number;
}

function useLiveScore(initial: number, opts: UseLiveScoreOptions = {}): number {
  const { min = 75, max = 92, delay = 0 } = opts;
  const [val, setVal] = useState(initial);
  const targetRef = useRef(initial);
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const startedAt = performance.now() + delay;
    const tick = (t: number) => {
      if (!alive) return;
      if (t < startedAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      setVal((v) => v + (targetRef.current - v) * 0.06);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const id = window.setInterval(() => {
      targetRef.current = min + Math.random() * (max - min);
    }, 5000);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [min, max, delay]);
  return val;
}

const SAMPLE_AXES: { label: string; initial: number }[] = [
  { label: "도입 후킹", initial: 80 },
  { label: "캐릭터 매력", initial: 80 },
  { label: "갈등 구조", initial: 80 },
  { label: "전개 속도", initial: 80 },
  { label: "세계관 일관성", initial: 80 },
  { label: "문장 가독성", initial: 80 },
];

function LiveAxisRow({
  label,
  initial,
  delay,
}: {
  label: string;
  initial: number;
  delay: number;
}) {
  const v = useLiveScore(initial, { delay });
  const display = Math.round(v);
  const fill =
    display >= 90
      ? "oklch(0.78 0.15 155)"
      : display >= 80
        ? "oklch(0.82 0.13 95)"
        : "oklch(0.78 0.13 60)";
  const tone = getScoreColor(display).text;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-[11px] text-stone-400">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-stone-800/80">
        <div
          className="h-full rounded-full"
          style={{
            width: `${v}%`,
            background: fill,
            transition: "background 240ms",
          }}
        />
      </div>
      <span
        className={cn(
          "w-7 text-right font-mono text-[11px] tabular-nums",
          tone,
        )}
      >
        {display}
      </span>
    </div>
  );
}

function LiveOverallScore({ initial }: { initial: number }) {
  const v = useLiveScore(initial);
  const display = Math.round(v);
  const tone =
    display >= 80 ? "text-emerald-300" : "text-amber-200";
  return (
    <span
      className={cn(
        "font-serif text-[88px] font-medium leading-none tabular-nums",
        tone,
      )}
    >
      {display}
    </span>
  );
}

export type LiveScoreCardProps = HTMLAttributes<HTMLDivElement>;

export const LiveScoreCard = forwardRef<HTMLDivElement, LiveScoreCardProps>(
  function LiveScoreCard({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-xl border border-stone-800/80 bg-stone-900/40",
          "shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]",
          className,
        )}
        {...props}
      >
        {/* faux window chrome */}
        <div className="flex items-center justify-between border-b border-stone-800/60 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-stone-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-stone-700" />
          </div>
          <div className="font-mono text-[10px] tracking-widest text-stone-400">
            novelagent.kr/studio/.../analysis/46
          </div>
          <div className="w-12" />
        </div>

        <div className="grid grid-cols-[1.1fr_1fr] gap-8 p-7">
          {/* left — score */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded border border-stone-800 bg-stone-900/60 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-amber-200/80">
                로맨스 판타지
              </span>
              <span className="text-[11px] text-stone-400">
                46화 · 황비의 마지막 카드
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-serif text-[14px] text-stone-400">
                종합 점수
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-[9.5px] tracking-widest text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                </span>
                LIVE
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-3">
              <LiveOverallScore initial={87} />
              <div className="leading-tight">
                <div className="text-[12px] text-stone-300">상위 12%</div>
                <div className="text-[10.5px] text-stone-400">
                  로맨스 판타지 · 47화 기준
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-md border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
              <div className="text-[10.5px] tracking-wider text-emerald-300/85">
                AGENT NOTE
              </div>
              <p className="mt-1.5 font-serif text-[12.5px] leading-relaxed text-stone-200">
                도입부의 회상 시퀀스가 강했습니다. 다만 중반 갈등이 직선적으로
                해결되어
                <span className="text-amber-200"> 다음 회차 후킹</span>이
                약합니다.
              </p>
            </div>
          </div>

          {/* right — axes */}
          <div>
            <div className="mb-3 flex items-center justify-between text-[11px] tracking-wider text-stone-400">
              <span>6개 축 분석</span>
              <span className="font-mono text-[9.5px] tracking-widest text-stone-400">
                실시간 측정 중…
              </span>
            </div>
            <div className="space-y-2.5">
              {SAMPLE_AXES.map((a, i) => (
                <LiveAxisRow
                  key={a.label}
                  label={a.label}
                  initial={a.initial}
                  delay={i * 200}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
LiveScoreCard.displayName = "LiveScoreCard";
