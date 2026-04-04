"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  SITE_NAME,
  CONTACT_EMAIL,
  SUPPORT_HOURS_LINE,
  buildInquiryMailtoHref,
} from "@/config/site";

export function FloatingInquiryButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onClose = useCallback(() => {
    setOpen(false);
    setSubmitError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!title.trim() || !content.trim()) {
      setSubmitError("제목과 내용을 입력해 주세요.");
      return;
    }
    if (!consent) {
      setSubmitError("문의 저장·상담을 위해 수집·이용에 동의해 주세요.");
      return;
    }
    const href = buildInquiryMailtoHref(title.trim(), content.trim());
    if (!href) {
      setSubmitError("문의 메일 주소가 설정되지 않았습니다. 이용약관의 문의 안내를 확인해 주세요.");
      return;
    }
    window.location.href = href;
  };

  /** z-50: AppShellHeaderClient 스튜디오 메뉴(z-[55]) 아래에 두어 메뉴 열릴 때 FAB가 위로 튀지 않게 */
  const fabClassName =
    "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-500/35 bg-zinc-900/95 text-cyan-300 shadow-lg shadow-cyan-500/10 backdrop-blur-md transition-colors hover:border-cyan-400/55 hover:bg-cyan-950/60 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 md:bottom-8 md:right-8";

  const icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-7 w-7"
      aria-hidden
    >
      <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
      <path d="M22.5 6.908V5.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v1.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
    </svg>
  );

  return (
    <>
      <button
        type="button"
        className={fabClassName}
        onClick={() => setOpen(true)}
        aria-label="1:1 문의 열기"
        aria-expanded={open}
        title="문의하기"
      >
        {icon}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            aria-label="문의 창 닫기"
            onClick={onClose}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="inquiry-panel-title"
            className="relative flex h-full w-full max-w-md flex-col border-l border-cyan-500/15 bg-zinc-900 shadow-2xl shadow-black/50 animate-in slide-in-from-right duration-200"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h2
                  id="inquiry-panel-title"
                  className="text-lg font-semibold text-zinc-100"
                >
                  1:1 문의
                </h2>
                <p className="mt-1 text-xs text-cyan-400/90">{SITE_NAME}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="닫기"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="border-b border-zinc-800/80 bg-cyan-950/25 px-5 py-3">
              <p className="text-xs font-medium text-cyan-200/95">운영 시간</p>
              <p className="mt-0.5 text-sm text-zinc-300">{SUPPORT_HOURS_LINE}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                영업일 기준 순차적으로 답변 드립니다. 메일 클라이언트가 열리면
                발송만 완료해 주세요.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col overflow-y-auto px-5 pb-8 pt-5"
            >
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">제목</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="문의 제목을 입력하세요"
                  maxLength={200}
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                />
              </label>

              <label className="mt-4 block flex-1">
                <span className="text-sm font-medium text-zinc-300">내용</span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="문의 내용을 자세히 적어 주세요"
                  rows={10}
                  maxLength={8000}
                  className="mt-1.5 min-h-[200px] w-full flex-1 resize-y rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                />
              </label>

              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 text-cyan-600"
                  />
                  <span className="text-zinc-400">
                    <span className="font-medium text-cyan-400/90">[필수]</span>{" "}
                    상담을 위해 문의 내용이 메일로 전송·저장되는 것에
                    동의합니다. (수집·이용 동의)
                  </span>
                </label>
                <p className="mt-2 pl-7 text-xs leading-relaxed text-zinc-600">
                  문의 처리 목적으로 제목·내용·회신용 메일 주소가 운영 측에
                  전달됩니다. 자세한 내용은{" "}
                  <Link
                    href="/terms"
                    className="text-cyan-500/90 underline-offset-2 hover:underline"
                    onClick={onClose}
                  >
                    이용약관
                  </Link>
                  을 참고해 주세요.
                </p>
              </div>

              {!CONTACT_EMAIL && (
                <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
                  <code className="text-amber-100/80">
                    NEXT_PUBLIC_CONTACT_EMAIL
                  </code>
                  이 비어 있으면 메일 전송 단계로 넘어가지 않습니다. 설정 후
                  다시 시도해 주세요.
                </p>
              )}

              {submitError && (
                <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {submitError}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-zinc-600 bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/80"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 hover:bg-cyan-400 disabled:opacity-50"
                  disabled={!CONTACT_EMAIL}
                >
                  문의하기
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
