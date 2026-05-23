"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Notice } from "@/lib/notices";

/**
 * 공지 단일 펼침 아코디언 — R3 / D-12 확정.
 *
 * openId 단일 state: 다른 row 클릭 시 이전 row 자동 닫힘, 동일 row 재클릭 시 닫힘.
 * 시안 notices.jsx 의 상세 라우트 (`/notices/[id]`) 패턴 폐기 — 같은 페이지에서 인라인 펼침.
 */
export function NoticesAccordion({ notices }: { notices: Notice[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="border-t border-stone-800/60">
      {notices.map((n) => {
        const open = openId === n.id;
        return (
          <li key={n.id} className="border-b border-stone-800/40">
            <button
              type="button"
              onClick={() => setOpenId((prev) => (prev === n.id ? null : n.id))}
              className="group flex w-full items-center gap-4 px-1 py-4 text-left transition-colors hover:bg-stone-100/[0.02]"
              aria-expanded={open}
              aria-controls={`notice-body-${n.id}`}
            >
              <span className="line-clamp-1 flex-1 font-serif text-[15px] text-stone-100 transition-colors group-hover:text-sky-200">
                {n.title}
              </span>
              <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-stone-500">
                {n.date}
              </span>
              <span
                className={`shrink-0 text-stone-600 transition-transform ${
                  open ? "rotate-180 text-sky-300" : "group-hover:text-sky-300"
                }`}
              >
                <ChevronDown size={13} aria-hidden="true" />
              </span>
            </button>
            {open && (
              <div
                id={`notice-body-${n.id}`}
                className="whitespace-pre-wrap px-1 pb-6 font-serif text-[14.5px] leading-[1.9] text-stone-300"
                style={{ textWrap: "pretty" }}
              >
                {n.body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
