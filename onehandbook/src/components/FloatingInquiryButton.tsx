"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SITE_NAME, SUPPORT_HOURS_LINE } from "@/config/site";
import { createClient } from "@/lib/supabase/client";
import {
  isLikelyNonRoutableAuthEmail,
  isValidReplyRecipientEmail,
} from "@/lib/inquiryReplyEmail";
import {
  INQUIRY_CATEGORIES,
  type InquiryCategory,
} from "@/lib/inquiry/categories";

type ToastState = { kind: "ok" | "err"; message: string };

export function FloatingInquiryButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<InquiryCategory>("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [replyEmail, setReplyEmail] = useState("");

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

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (cancelled || !user?.email) return;
      if (!isLikelyNonRoutableAuthEmail(user.email)) {
        setReplyEmail((prev) => (prev.trim() === "" ? user.email! : prev));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
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

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError("문의를 보내려면 로그인해 주세요.");
      return;
    }

    const replyTrim = replyEmail.trim();
    const sessionEmailOk =
      !!user.email && !isLikelyNonRoutableAuthEmail(user.email);

    if (replyTrim) {
      if (!isValidReplyRecipientEmail(replyTrim)) {
        setSubmitError("답변 받을 이메일 형식을 확인해 주세요.");
        return;
      }
    } else if (!sessionEmailOk) {
      setSubmitError(
        "답변 받을 이메일을 입력해 주세요. SNS 로그인만 사용 중이면 실제로 받는 주소를 적어 주세요."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          content: content.trim(),
          replyEmail: replyTrim,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        const msg =
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : "전송에 실패했습니다.";
        setToast({ kind: "err", message: msg });
        return;
      }

      setTitle("");
      setContent("");
      setReplyEmail("");
      setConsent(false);
      setCategory("general");
      setToast({
        kind: "ok",
        message: "문의가 접수됐습니다. 답변은 사이트 알림으로 안내드립니다.",
      });
      onClose();
    } catch {
      setToast({
        kind: "err",
        message: "네트워크 오류로 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setSubmitting(false);
    }
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
      {toast ? (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[80] max-w-[min(calc(100vw-2rem),20rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-lg ${
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-100"
              : "border-red-500/35 bg-red-950/95 text-red-100"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

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
                답변은 헤더의 알림 종으로 안내드리며,{" "}
                <Link
                  href="/account/inquiries"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                  onClick={onClose}
                >
                  내 문의 페이지
                </Link>
                에서 다시 확인할 수 있습니다.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col overflow-y-auto px-5 pb-8 pt-5"
            >
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">분류</span>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as InquiryCategory)
                  }
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                >
                  {INQUIRY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block">
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

              <label className="mt-4 block">
                <span className="text-sm font-medium text-zinc-300">
                  답변 받을 이메일 <span className="text-zinc-500">(백업용)</span>
                </span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={replyEmail}
                  onChange={(e) => setReplyEmail(e.target.value)}
                  placeholder="실제로 받을 수 있는 주소"
                  maxLength={320}
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                />
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                  답변은 사이트 알림으로 보내드립니다. 이 이메일은 알림이 닿지
                  않을 경우 운영팀이 별도 연락할 때만 사용합니다. SNS 로그인만
                  사용 중이면 <span className="text-zinc-400">꼭 받을 수 있는 주소</span>
                  를 적어 주세요.
                </p>
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
                    상담을 위해 문의 내용이 운영팀에 전달·저장되는 것에
                    동의합니다. (수집·이용 동의)
                  </span>
                </label>
                <p className="mt-2 pl-7 text-xs leading-relaxed text-zinc-600">
                  문의 처리 목적으로 분류·제목·내용·회신용 이메일이 운영 측에
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
                  disabled={submitting}
                >
                  {submitting ? "전송 중…" : "문의하기"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
