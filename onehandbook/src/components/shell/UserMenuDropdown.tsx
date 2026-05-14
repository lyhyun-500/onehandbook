"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  User,
  Headphones,
  BookOpen,
  Bell,
  Coins,
  FileText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Divider } from "./Divider";

interface UserMenuDropdownProps {
  open: boolean;
  onClose: () => void;
  /** 표시용 사용자 이름 (시안 hardcoded "작가님" 자리). */
  displayName: string;
  /** users.coin_balance — 베타 chip 옆 "· NAT X" 표기에 사용. null 이면 0 표시. */
  natBalance: number;
}

interface MenuItem {
  icon: typeof User;
  label: string;
  href: string;
  badge?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { icon: User, label: "계정", href: "/account" },
  { icon: Headphones, label: "문의함", href: "/account/inquiries" },
  { icon: BookOpen, label: "스튜디오", href: "/studio" },
  { icon: Bell, label: "공지사항", href: "/notices" },
  { icon: Coins, label: "NAT 충전", href: "/pricing", badge: "+" },
  { icon: FileText, label: "이용약관", href: "/terms" },
];

/**
 * LeftRail 안 settings 아이콘 클릭 시 펼침 dropdown panel.
 *
 * 시안 정합 (`design_novel/novel-agent/user-menu.jsx`):
 * - panel = 유저 칩 위로 펼침 (absolute bottom-[68px])
 * - 헤더 = 로그인 중 / displayName / 베타 chip + NAT
 * - MENU 6 항목 (회원 탈퇴는 시안 본질 제외 — /account 페이지에서 처리)
 * - DANGER = 로그아웃 (시각만 LogOut icon + rose 톤, 실 동작 = /auth/signout POST form)
 *
 * 닫기 = 외부 클릭 / ESC / settings 버튼 재클릭 (재클릭은 부모 토글 책임).
 */
export function UserMenuDropdown({
  open,
  onClose,
  displayName,
  natBalance,
}: UserMenuDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!panelRef.current || !target) return;
      if (panelRef.current.contains(target)) return;
      // settings 버튼 자체 클릭은 부모 토글로 처리되므로 여기서 닫지 않는다.
      // settings 버튼은 data-user-menu-trigger 속성으로 식별.
      if (
        target instanceof HTMLElement &&
        target.closest("[data-user-menu-trigger]")
      ) {
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    // mousedown 사용 — click 보다 빠른 시점에 닫혀 사용자 의도 정합.
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="사용자 메뉴"
      className="absolute bottom-[68px] left-3 right-3 z-20 rounded-lg border border-stone-800/80 bg-stone-900/95 py-1.5 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)] backdrop-blur"
    >
      <div className="border-b border-stone-800/70 px-3 pb-2 pt-1.5">
        <div className="text-[10px] text-stone-500">로그인 중</div>
        <div className="mt-0.5 truncate text-[12.5px] font-medium text-stone-100">
          {displayName}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-stone-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/[0.08] px-1.5 py-px text-sky-200">
            <span className="h-1 w-1 rounded-full bg-sky-300" />
            베타
          </span>
          <span>· NAT {natBalance.toLocaleString("ko-KR")}</span>
        </div>
      </div>

      <div className="py-1">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              role="menuitem"
              onClick={onClose}
              className="group flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-stone-200 hover:bg-stone-800/60 hover:text-stone-100"
            >
              <Icon
                size={14}
                className="text-stone-500 group-hover:text-stone-400"
                aria-hidden="true"
              />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="rounded-sm bg-sky-400/15 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-sky-200">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <Divider className="my-1 h-px" />

      <div className="py-1">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            role="menuitem"
            className={cn(
              "group flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium",
              "text-rose-400/80 hover:bg-rose-500/[0.08] hover:text-rose-300/90",
            )}
          >
            <LogOut
              size={14}
              className="text-rose-400/60 group-hover:text-rose-300/80"
              aria-hidden="true"
            />
            <span className="flex-1">로그아웃</span>
          </button>
        </form>
      </div>
    </div>
  );
}
