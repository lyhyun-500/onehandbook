"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";

export type LoginProvider = "google" | "naver";

export interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLogin?: (provider: LoginProvider) => void;
}

const TITLE_ID = "login-modal-title";
const DESC_ID = "login-modal-desc";

export function LoginModal({ open, onClose, onLogin }: LoginModalProps) {
  const [mounted, setMounted] = useState(false);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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

    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-stone-950/70 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={DESC_ID}
        className="relative w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-stone-800/80 bg-stone-900/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-200"
          aria-label="모달 닫기"
        >
          <X size={14} />
        </button>

        <div className="px-8 pb-6 pt-9 text-center">
          <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-sky-300/90 to-sky-500/80 text-stone-950">
            <BookOpen size={16} aria-hidden="true" />
          </div>
          <div className="text-[11px] tracking-widest text-sky-300/85">
            NOVEL AGENT
          </div>
          <h2
            id={TITLE_ID}
            className="mt-2 font-serif text-[22px] leading-tight text-stone-100"
          >
            계정에 들어와
            <br />
            <span className="italic text-stone-400">분석을 이어가세요.</span>
          </h2>
          <p id={DESC_ID} className="mt-2 text-[11.5px] text-stone-400">
            신규 가입 시 30 NAT가 무료로 지급됩니다.
          </p>
        </div>

        <div className="space-y-2 px-8 pb-8">
          <button
            type="button"
            onClick={() => onLogin?.("google")}
            className="flex w-full items-center justify-center gap-2.5 rounded-md border border-stone-700 bg-stone-100 px-4 py-2.5 text-[13px] font-medium text-stone-900 hover:bg-white"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
              />
              <path
                fill="#34A853"
                d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
              />
              <path
                fill="#FBBC05"
                d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
              />
              <path
                fill="#EA4335"
                d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.12l7.35 5.7C13.42 13.62 18.27 9.75 24 9.75z"
              />
            </svg>
            Google로 시작하기
          </button>

          <button
            type="button"
            onClick={() => onLogin?.("naver")}
            className="flex w-full items-center justify-center gap-2.5 rounded-md bg-[#03C75A] px-4 py-2.5 text-[13px] font-medium text-white hover:brightness-95"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z" />
            </svg>
            네이버로 시작하기
          </button>
        </div>

        <div className="border-t border-stone-800/60 bg-stone-950/40 px-8 py-3.5 text-center text-[10.5px] leading-relaxed text-stone-400">
          계속 진행하면{" "}
          <Link
            href="/terms"
            className="text-stone-300 hover:text-sky-200 hover:underline"
          >
            이용약관
          </Link>{" "}
          ·{" "}
          <Link
            href="/privacy"
            className="text-stone-300 hover:text-sky-200 hover:underline"
          >
            개인정보처리방침
          </Link>
          에 동의하는 것으로 간주됩니다.
        </div>
      </div>
    </div>,
    document.body,
  );
}
