// 1:1 문의함 — 우측 composer (Phase 2-D-9 commit 2).
// 시안 design_novel/novel-agent/inquiries.jsx L238-375 정합.
//
// LEE 결정 영속화:
//   - 옵션 P (「추가 질문」 진입 시 category prefill): initialCategory prop
//   - POST /api/contact/inquiry (기존 endpoint 재사용)

"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import {
  INQUIRY_CATEGORIES,
  type InquiryCategory,
} from "@/lib/inquiry/categories";
import { createClient } from "@/lib/supabase/client";
import {
  isLikelyNonRoutableAuthEmail,
  isValidReplyRecipientEmail,
} from "@/lib/inquiryReplyEmail";

interface InquiryComposerProps {
  initialCategory?: InquiryCategory;
  onCancel: () => void;
  onSubmitted: () => void;
  onToast: (kind: "ok" | "err", message: string) => void;
}

export function InquiryComposer({
  initialCategory,
  onCancel,
  onSubmitted,
  onToast,
}: InquiryComposerProps) {
  const [category, setCategory] = useState<InquiryCategory>(
    initialCategory ?? "etc",
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 세션 이메일 자동 prefill (라우팅 가능한 경우만 — naver synthetic email 등은 제외)
  useEffect(() => {
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
  }, []);

  const canSubmit =
    consent && title.trim().length > 0 && content.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
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
    const replyTrim = replyEmail.trim();
    if (replyTrim && !isValidReplyRecipientEmail(replyTrim)) {
      setSubmitError("답변 받을 이메일 형식을 확인해 주세요.");
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
        onToast("err", msg);
        return;
      }

      onToast(
        "ok",
        "문의가 접수됐습니다. 답변은 사이트 알림으로 안내드립니다.",
      );
      onSubmitted();
    } catch {
      onToast(
        "err",
        "네트워크 오류로 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-stone-950/60">
      <header className="flex items-start justify-between gap-3 border-b border-stone-800/60 px-7 py-5">
        <div>
          <h2 className="font-serif text-[22px] font-medium tracking-tight text-stone-100">
            1:1 문의
          </h2>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-sky-300/85">
            Novel Agent
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-100"
          aria-label="닫기"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      <section className="border-b border-sky-400/20 bg-sky-400/[0.04] px-7 py-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-sky-300/90">
          운영 시간
        </div>
        <div className="mt-1 font-serif text-[14.5px] text-stone-100">
          평일 10:00 ~ 18:00 · 점심시간·공휴일 제외{" "}
          <span className="text-stone-400">(순차 답변)</span>
        </div>
        <p className="mt-2 font-serif text-[12px] leading-relaxed text-stone-400">
          답변은 사이트 알림으로 안내드리며, 내 문의 페이지에서 다시 확인할 수
          있습니다.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col overflow-y-auto px-7 py-6"
      >
        <div className="mb-5">
          <label
            htmlFor="inquiry-category"
            className="mb-2 block font-serif text-[13.5px] text-stone-100"
          >
            분류
          </label>
          <div className="relative">
            <select
              id="inquiry-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as InquiryCategory)}
              className="w-full appearance-none rounded-md border border-stone-800 bg-stone-900/60 px-4 py-3 font-serif text-[14px] text-stone-100 focus:border-sky-400/40 focus:outline-none"
            >
              {INQUIRY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value} className="bg-stone-900">
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-500"
            />
          </div>
        </div>

        <div className="mb-5">
          <label
            htmlFor="inquiry-title"
            className="mb-2 block font-serif text-[13.5px] text-stone-100"
          >
            제목
          </label>
          <input
            id="inquiry-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문의 제목을 입력하세요"
            maxLength={200}
            className="w-full rounded-md border border-stone-800 bg-stone-900/60 px-4 py-3 font-serif text-[14px] text-stone-100 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
          />
        </div>

        <div className="mb-5">
          <label
            htmlFor="inquiry-email"
            className="mb-2 block font-serif text-[13.5px] text-stone-100"
          >
            답변 받을 이메일{" "}
            <span className="font-normal text-stone-500">(선택)</span>
          </label>
          <input
            id="inquiry-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={replyEmail}
            onChange={(e) => setReplyEmail(e.target.value)}
            placeholder="필요시 입력"
            maxLength={320}
            className="w-full rounded-md border border-stone-800 bg-stone-900/60 px-4 py-3 font-serif text-[14px] text-stone-100 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
          />
          <p className="mt-2 font-serif text-[11.5px] leading-relaxed text-stone-500">
            답변은 사이트 알림으로 안내됩니다. 별도 메일 연락이 필요한 경우만
            입력하세요.
          </p>
        </div>

        <div className="mb-5">
          <label
            htmlFor="inquiry-content"
            className="mb-2 block font-serif text-[13.5px] text-stone-100"
          >
            내용
          </label>
          <textarea
            id="inquiry-content"
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="문의 내용을 자세히 적어 주세요"
            maxLength={8000}
            className="w-full resize-y rounded-md border border-stone-800 bg-stone-900/60 px-4 py-3 font-serif text-[13.5px] leading-relaxed text-stone-100 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
          />
        </div>

        <div className="rounded-md border border-stone-800/80 bg-stone-900/40 px-4 py-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-400"
            />
            <div className="min-w-0 flex-1">
              <div className="font-serif text-[13.5px] text-stone-100">
                <span className="font-medium text-sky-300/90">[필수]</span>{" "}
                상담을 위해 문의 내용이 운영팀에 전달·저장되는 것에 동의합니다.
                <span className="ml-1 text-stone-400">(수집·이용 동의)</span>
              </div>
              <p className="mt-2 font-serif text-[11.5px] leading-relaxed text-stone-500">
                문의 처리 목적으로 분류·제목·내용·회신용 이메일이 운영 측에
                전달됩니다. 자세한 내용은{" "}
                <Link
                  href="/terms"
                  className="text-sky-300/90 underline-offset-2 hover:text-sky-200 hover:underline"
                >
                  이용약관
                </Link>
                을 참고해 주세요.
              </p>
            </div>
          </label>
        </div>

        {submitError && (
          <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
            {submitError}
          </p>
        )}

        <footer className="mt-auto flex items-center justify-end gap-2 border-t border-stone-800/60 bg-stone-950/90 px-7 py-4 -mx-7 -mb-6 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-stone-800/80 bg-stone-900/40 px-5 py-2.5 font-serif text-[13px] text-stone-300 hover:border-stone-700 hover:text-stone-100"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-400 px-6 py-2.5 font-serif text-[13.5px] font-medium text-stone-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500"
          >
            {submitting ? "전송 중…" : "문의하기"}
          </button>
        </footer>
      </form>
    </div>
  );
}
