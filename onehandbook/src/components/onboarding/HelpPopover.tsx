"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, HelpCircle, Sparkles } from "lucide-react";

interface HelpMenuItem {
  icon: ReactNode;
  title: string;
  sub: string;
  href: string;
  accent?: boolean;
}

const ITEMS: HelpMenuItem[] = [
  {
    icon: <Sparkles size={13} aria-hidden="true" />,
    title: "샘플 분석 둘러보기",
    sub: "예시 회차로 점수·코멘트 보기",
    href: "/onboarding?from=help",
    accent: true,
  },
  {
    icon: <BookOpen size={13} aria-hidden="true" />,
    title: "사용 가이드",
    sub: "분석 축 6개 · NAT 사용법",
    href: "/guide",
  },
  {
    icon: <HelpCircle size={13} aria-hidden="true" />,
    title: "1:1 문의",
    sub: "보통 1영업일 내 답변",
    href: "/account/inquiries",
  },
];

/**
 * 도움말 popover (05C) — TopBar 우측 ? 버튼.
 *
 * (app) 모든 페이지 영구 진입점.
 * 시안 design_novel/novel-agent/portfolio-canvas.jsx HelpMenuFrame 정합.
 */
export function HelpPopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // outside click 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="도움말"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-400/40 bg-sky-400/[0.10] text-sky-200 ring-2 ring-sky-400/20 transition-colors hover:bg-sky-400/[0.16]"
      >
        <span className="font-serif text-[12px]">?</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-[340px] rounded-xl border border-stone-800/80 bg-stone-950/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur">
          <div className="border-b border-stone-800/60 px-4 py-3">
            <div className="font-serif text-[14px] text-stone-100">도움말</div>
            <div className="mt-0.5 text-[11px] text-stone-500">
              막힐 때 다시 돌아오세요
            </div>
          </div>
          <div className="px-2 py-2">
            {ITEMS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left ${
                  item.accent
                    ? "bg-sky-400/[0.06] hover:bg-sky-400/[0.10]"
                    : "hover:bg-stone-100/[0.04]"
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded ${
                    item.accent
                      ? "bg-sky-400/15 text-sky-200"
                      : "bg-stone-800/60 text-stone-400"
                  }`}
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[13px] text-stone-100">
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-stone-500">
                    {item.sub}
                  </div>
                </div>
                <ChevronRight
                  size={11}
                  aria-hidden="true"
                  className="text-stone-600 group-hover:text-stone-300"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
