"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { GenreTag } from "@/components/atoms/GenreTag";
import { StatusDot } from "@/components/atoms/StatusDot";
import { getWorkCoverColor } from "@/lib/workCoverColor";

export interface WorkOption {
  id: string;
  title: string;
  genre: string;
  status: string;
  totalEpisodes: number;
  /** 작품 평균 — null = 분석 0건. */
  agentScore: number | null;
}

interface WorkSelectorProps {
  works: WorkOption[];
  currentId: string;
  /** 작품 전환 시 라우팅 — `(id) => router.push(...)` 패턴. */
  onChange: (id: string) => void;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: { title: "text-[13px]", meta: "text-[10px]", trigger: "py-1.5 px-2.5 gap-2", chev: 11, strip: "h-6" },
  md: { title: "text-[15px]", meta: "text-[10.5px]", trigger: "py-2 px-3 gap-2.5", chev: 12, strip: "h-6" },
  lg: { title: "text-[18px]", meta: "text-[11px]", trigger: "py-2.5 px-3.5 gap-3", chev: 13, strip: "h-7" },
} as const;

/**
 * 시안 `design_novel/novel-agent/atoms.jsx:91` 정합 — 작품 전환 selector.
 *
 * works 테이블에 `cover` 컬럼 부재 → 장르 기반 색상으로 결정 (lib/workCoverColor).
 */
export function WorkSelector({
  works,
  currentId,
  onChange,
  size = "md",
}: WorkSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const current = works.find((w) => w.id === currentId) ?? works[0];
  if (!current) return null;

  const sz = SIZE_MAP[size];

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex items-center rounded-md border border-stone-800 bg-stone-900/60 transition-colors hover:border-stone-700 ${sz.trigger}`}
      >
        <span
          className={`flex w-1.5 shrink-0 rounded-sm ${sz.strip}`}
          style={{ backgroundColor: getWorkCoverColor(current.genre) }}
          aria-hidden="true"
        />
        <div className="min-w-0 text-left">
          <div
            className={`font-mono uppercase tracking-[0.25em] text-stone-500 ${sz.meta}`}
          >
            작품
          </div>
          <div
            className={`truncate font-serif leading-tight text-stone-100 ${sz.title}`}
          >
            {current.title}
          </div>
        </div>
        <ChevronDown
          size={sz.chev}
          aria-hidden="true"
          className={
            open
              ? "rotate-180 text-stone-300 transition-transform"
              : "text-stone-500 transition-transform"
          }
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1.5 w-[380px] overflow-hidden rounded-md border border-stone-800 bg-stone-900/95 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)] backdrop-blur"
        >
          <div className="flex items-baseline justify-between border-b border-stone-800/60 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
              작품 전환
            </div>
            <div className="font-mono text-[11px] tabular-nums text-stone-400">
              {works.length}건
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {works.map((w) => {
              const isCur = w.id === current.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="option"
                  aria-selected={isCur}
                  onClick={() => {
                    onChange(w.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-800/60 ${
                    isCur
                      ? "border-l-2 border-sky-400 bg-sky-400/[0.06]"
                      : "border-l-2 border-transparent"
                  }`}
                >
                  <span
                    className="flex h-8 w-1.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: getWorkCoverColor(w.genre) }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate font-serif text-[13.5px] leading-snug ${
                        isCur ? "text-stone-100" : "text-stone-200"
                      }`}
                    >
                      {w.title}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-500">
                      <GenreTag genre={w.genre} />
                      <span className="tabular-nums">{w.totalEpisodes}화</span>
                      <span aria-hidden="true" className="text-stone-700">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <StatusDot status={w.status} />
                        {w.status}
                      </span>
                    </div>
                  </div>
                  {w.agentScore != null ? (
                    <div className="shrink-0 text-right">
                      <div className="font-serif text-[18px] leading-none tabular-nums text-sky-300">
                        {w.agentScore}
                      </div>
                      <div className="mt-1 font-mono text-[9.5px] uppercase tracking-widest text-stone-500">
                        /100
                      </div>
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] text-stone-600">
                      분석 없음
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * WorkSelector 의 atom 영역에서 useRouter 종속을 제외하기 위한 헬퍼.
 * 일반적인 호출 위치(analysis 페이지 / 작품 상세 페이지)에서 라우팅 경로만 다르므로
 * 사용처에서 `onChange={(id) => router.push(buildHref(id))}` 패턴으로 주입.
 *
 * 본 export 는 단순 wrapper — useRouter 사용 시 import 본 hook 으로 통일.
 */
export function useWorkRouterChange(buildHref: (id: string) => string) {
  const router = useRouter();
  return (id: string) => router.push(buildHref(id));
}
