"use client";

import { useEffect, type ReactNode } from "react";

/**
 * 우측 슬라이드 Drawer atom — WorkNotesDrawer / SettingsDrawer 공유 shell.
 *
 * 시안 work.jsx WorkNotesDrawer + episode-edit.jsx SettingsDrawer 공통 패턴:
 * - scrim (bg-stone-950/55 + backdrop-blur-[1px])
 * - 우→좌 slide 200ms ease-out
 * - ESC 닫기
 * - scroll-trap 없음 (명세 — body scroll lock 미적용)
 */
export function Drawer({
  open,
  onClose,
  width = 420,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  ariaLabel?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // F-A 정정 (LEE 묶음1 1-6/1-7): 닫혔을 때 DOM 미존재 — sidebar 환각 차단.
  // slide-out 애니메이션은 손실되나 (open=false 시 즉시 unmount), slide-in 은 정상.
  // 모달 본질 = scrim 클릭 닫기 정합 (overlay 영역만 존재).
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-stone-950/55 backdrop-blur-[1px] transition-opacity duration-200"
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full translate-x-0 flex-col border-l border-stone-800/80 bg-stone-950/95 shadow-[-24px_0_48px_-12px_rgba(0,0,0,0.6)] backdrop-blur transition-transform duration-200 ease-out"
        style={{ width }}
        role="dialog"
        aria-label={ariaLabel}
      >
        {children}
      </aside>
    </>
  );
}
