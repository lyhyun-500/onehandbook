"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Pencil,
  LineChart,
  Sparkles,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GenreTag } from "@/components/atoms/GenreTag";
import { Divider } from "./Divider";
import { UserMenuDropdown } from "./UserMenuDropdown";

export interface LeftRailWork {
  id: number;
  title: string;
  genre: string;
  totalEpisodes: number;
  agentScore: number | null;
}

export interface LeftRailProps {
  /** 사용자 표시 이름 (현재는 hardcoded "작가님" 정책 — 베타 기간 정합). */
  displayName: string;
  /** users.coin_balance — UserMenuDropdown 헤더 표시용. */
  natBalance: number;
  /** 작품 4건 — analysis_runs 최신 DISTINCT work_id 우선 + works.created_at DESC fallback. */
  recentWorks: LeftRailWork[];
  /**
   * URL 부재 시 "현재 작품" 결정용 fallback id.
   * 옵션 C 정책: 최근 분석 작품 1건. 분석 0 사용자는 가장 최근 생성 작품. 작품 0건이면 null.
   */
  currentWorkFallbackId: number | null;
  /**
   * 회차 분석 메뉴 fallback episode id — workId 별 최근 analysis_run 의 episode_id.
   * URL 이 `/works/[id]/episodes/[id]` 형식이면 그 id 우선, 아니면 본 fallback 사용.
   * fallback 도 부재이면 회차 분석 메뉴 disabled.
   */
  currentEpisodeFallbackByWorkId: Record<number, number>;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** URL resolver — currentWorkId/Episode 의존 항목은 null 반환 시 disabled 처리. */
  resolveHref: (
    currentWorkId: number | null,
    currentEpisodeId: number | null,
  ) => string | null;
  /** active 판정 — pathname 기반. */
  isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "studio",
    label: "스튜디오",
    icon: BookOpen,
    resolveHref: () => "/studio",
    isActive: (p) => p === "/studio" || p.startsWith("/studio/"),
  },
  {
    id: "work",
    label: "작품 상세",
    icon: Pencil,
    resolveHref: (id) => (id != null ? `/works/${id}` : null),
    isActive: (p) => /^\/works\/\d+$/.test(p),
  },
  {
    id: "analysis",
    label: "분석 리포트",
    icon: LineChart,
    resolveHref: (id) => (id != null ? `/works/${id}/analysis` : null),
    isActive: (p) => /^\/works\/\d+\/analysis$/.test(p),
  },
  {
    id: "episode",
    label: "회차 분석",
    icon: Sparkles,
    resolveHref: (workId, episodeId) =>
      workId != null && episodeId != null
        ? `/works/${workId}/episodes/${episodeId}`
        : null,
    isActive: (p) => /^\/works\/\d+\/episodes\/\d+$/.test(p),
  },
];

function resolveCurrentWorkIdFromPathname(pathname: string): number | null {
  const match = pathname.match(/^\/works\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

function resolveCurrentEpisodeIdFromPathname(pathname: string): number | null {
  // /works/[id]/episodes/[episodeId] + /edit 영역 매치. /new 는 정수 아니라 null.
  const match = pathname.match(/^\/works\/\d+\/episodes\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

/** 시안 shell.jsx 정합 — 240px 사이드바, brand + 현재 작품 + 네비 + 최근 작품 + 유저 칩. */
export function LeftRail({
  displayName,
  natBalance,
  recentWorks,
  currentWorkFallbackId,
  currentEpisodeFallbackByWorkId,
}: LeftRailProps) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);

  const currentWorkId = useMemo(() => {
    const fromUrl = resolveCurrentWorkIdFromPathname(pathname);
    if (fromUrl != null) return fromUrl;
    return currentWorkFallbackId;
  }, [pathname, currentWorkFallbackId]);

  const currentEpisodeId = useMemo(() => {
    const fromUrl = resolveCurrentEpisodeIdFromPathname(pathname);
    if (fromUrl != null) return fromUrl;
    if (currentWorkId == null) return null;
    return currentEpisodeFallbackByWorkId[currentWorkId] ?? null;
  }, [pathname, currentWorkId, currentEpisodeFallbackByWorkId]);

  const currentWork = useMemo(() => {
    if (currentWorkId == null) return null;
    return recentWorks.find((w) => w.id === currentWorkId) ?? null;
  }, [currentWorkId, recentWorks]);

  return (
    <aside className="relative hidden h-screen w-[240px] shrink-0 flex-col border-r border-stone-800/60 bg-stone-950/60 md:flex">
      {/* Brand */}
      <Link
        href="/studio"
        className="flex h-14 items-center gap-2.5 px-5 hover:bg-stone-100/[0.02]"
      >
        <Image
          src="/logo.svg"
          alt="Novel Agent"
          width={68}
          height={48}
          priority
        />
        <span className="h-5 w-px bg-stone-700" aria-hidden="true" />
        <span className="text-[13px] font-medium tracking-tight text-stone-100">
          스튜디오
        </span>
      </Link>

      <Divider className="h-px" />

      {/* 현재 작품 미니 카드 — 작품 0건 사용자에서는 영역 자체 부재 */}
      {currentWork && (
        <>
          <div className="px-3 py-3">
            <Link
              href={`/works/${currentWork.id}`}
              className="block rounded-md border border-stone-800/80 bg-stone-900/40 p-3 hover:border-stone-700 hover:bg-stone-900/60"
            >
              <div className="text-[10px] text-stone-500">현재 작품</div>
              <div className="mt-1 truncate text-sm font-medium text-stone-100">
                {currentWork.title}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-stone-400">
                <GenreTag genre={currentWork.genre} />
                <span className="text-stone-600">{currentWork.totalEpisodes}화</span>
              </div>
            </Link>
          </div>
          <Divider className="h-px" />
        </>
      )}

      {/* 화면 네비 + 최근 작품 — 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-3 pb-2 text-[10px] text-stone-500">화면</div>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const href = item.resolveHref(currentWorkId, currentEpisodeId);
            const disabled = href == null;
            const active = !disabled && item.isActive(pathname);
            const Icon = item.icon;
            const baseClass = cn(
              "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
              active
                ? "bg-stone-100/[0.04] text-stone-100"
                : "text-stone-400",
              !disabled && !active && "hover:bg-stone-100/[0.025] hover:text-stone-200",
              disabled && "cursor-not-allowed opacity-40",
            );
            const inner = (
              <>
                <Icon
                  size={15}
                  className={active ? "text-sky-300" : ""}
                  aria-hidden="true"
                />
                <span className="flex-1">{item.label}</span>
                {active && (
                  <span
                    className="h-1 w-1 rounded-full bg-sky-300"
                    aria-hidden="true"
                  />
                )}
              </>
            );
            if (disabled) {
              return (
                <span
                  key={item.id}
                  className={baseClass}
                  aria-disabled="true"
                  title="작품을 먼저 등록해주세요"
                >
                  {inner}
                </span>
              );
            }
            return (
              <Link key={item.id} href={href} className={baseClass}>
                {inner}
              </Link>
            );
          })}
        </nav>

        {recentWorks.length > 0 && (
          <>
            <div className="mt-6 px-3 pb-2 text-[10px] text-stone-500">
              최근 작품
            </div>
            <div className="space-y-0.5">
              {recentWorks.map((w) => (
                <Link
                  key={w.id}
                  href={`/works/${w.id}`}
                  className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[12px] text-stone-400 hover:bg-stone-100/[0.025] hover:text-stone-200"
                >
                  <span className="h-4 w-1 shrink-0 rounded-sm bg-sky-400/40" aria-hidden="true" />
                  <span className="truncate flex-1">{w.title}</span>
                  {w.agentScore != null && (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-stone-500">
                      {w.agentScore}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* User chip (시안 shell.jsx 본질 — h-7 평면 stone) + dropdown */}
      <Divider className="h-px" />
      <div className="relative">
        <UserMenuDropdown
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          displayName={displayName}
          natBalance={natBalance}
        />
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-800 text-[11px] font-medium text-stone-300">
            作
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-stone-200">
              {displayName}
            </span>
            <span className="block text-[10px] text-stone-500">베타 회원</span>
          </span>
          <button
            type="button"
            data-user-menu-trigger
            onClick={() => setMenuOpen((v) => !v)}
            className="text-stone-500 hover:text-stone-300"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="사용자 메뉴 열기"
          >
            <Settings size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
