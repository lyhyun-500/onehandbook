"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * 본문 내 헤딩 element id — `aria-labelledby` 박음 (스크린 리더 다이얼로그 제목).
   */
  labelledBy?: string;
}

/**
 * Modal — 0 dep (createPortal + 직접 구현). ADR-0024 정책:
 * - ESC 닫기 / backdrop click 닫기 / body scroll lock / 포커스 복원 / aria.
 * - 포커스 트랩은 미박음 (페이즈 2~3 도입 트리거: 포커스 이탈 사례 누적 시).
 * - createPortal 로 document.body 에 렌더 — 부모 z-index/overflow 영향 0.
 * - SSR 호환: mounted state 가드.
 *
 * imperative API (`open` / `onClose`) 라 root 는 forwardRef 박지 않음 — ADR-0024 결정 3 의 예외.
 */
export function Modal({ open, onClose, children, labelledBy }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative w-full max-w-lg rounded-lg border border-border bg-card text-card-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export type ModalSubProps = HTMLAttributes<HTMLDivElement>;

export const ModalHeader = forwardRef<HTMLDivElement, ModalSubProps>(function ModalHeader(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  );
});
ModalHeader.displayName = "ModalHeader";

export const ModalContent = forwardRef<HTMLDivElement, ModalSubProps>(function ModalContent(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("p-6 pt-0", className)}
      {...props}
    />
  );
});
ModalContent.displayName = "ModalContent";

export const ModalFooter = forwardRef<HTMLDivElement, ModalSubProps>(function ModalFooter(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-end gap-2 p-6 pt-0", className)}
      {...props}
    />
  );
});
ModalFooter.displayName = "ModalFooter";
