"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RunOption {
  id: string;
  label: string;
  createdAt: string;
  natCost: number;
  platform: string;
  overallScore: number;
}

interface RunSelectorProps {
  runs: RunOption[];
  currentId: string;
  onChange: (id: string) => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/**
 * 시안 `design_novel/novel-agent/holistic-report.jsx:254-312` 정합 — 일괄 분석 이력 dropdown.
 *
 * 트리거 = 작품 라벨 + 짧은 timestamp. 드롭다운 = 전체 timestamp + 점수.
 * 1 run 시점 = 호출처에서 영역 부재 처리 (본 컴포넌트 호출 부재).
 */
export function RunSelector({ runs, currentId, onChange }: RunSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const current = runs.find((r) => r.id === currentId) ?? runs[0];
  if (!current) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-md border border-stone-800 bg-stone-900/60 px-3.5 py-2 hover:border-stone-700"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-stone-500">
          분석 이력
        </span>
        <span className="font-serif text-[13px] text-stone-100">
          {current.label}
        </span>
        <span className="font-mono text-[11.5px] tabular-nums text-stone-400">
          {shortDate(current.createdAt)}
        </span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn(
            "transition-transform",
            open ? "rotate-180 text-stone-300" : "text-stone-500",
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-[360px] overflow-hidden rounded-md border border-stone-800 bg-stone-900/95 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)] backdrop-blur">
          <div className="flex items-baseline justify-between border-b border-stone-800/60 px-4 py-3">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-stone-500">
              분석 이력
            </div>
            <div className="font-mono text-[11.5px] tabular-nums text-stone-300">
              {runs.length}건
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto" role="listbox">
            {runs.map((r) => {
              const isCur = r.id === currentId;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={isCur}
                  onClick={() => {
                    onChange(r.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-stone-800/60",
                    isCur
                      ? "bg-sky-400/[0.06] border-l-2 border-sky-400"
                      : "border-l-2 border-transparent",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "font-serif text-[14px] leading-snug",
                        isCur ? "text-stone-100" : "text-stone-200",
                      )}
                    >
                      {r.label}
                    </div>
                    <div className="mt-1 font-mono text-[12px] tabular-nums text-stone-400">
                      {formatTimestamp(r.createdAt)}
                    </div>
                    <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-widest text-stone-500">
                      {r.platform} · NAT {r.natCost}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-serif text-[20px] leading-none tabular-nums text-sky-300">
                      {r.overallScore}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-stone-500">
                      /100
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
