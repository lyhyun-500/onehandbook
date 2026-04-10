"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SITE_NAME } from "@/config/site";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";

export function WelcomeConsentForm() {
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = terms && privacy && marketing;
  const requiredOk = terms && privacy;
  const allCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = allCheckboxRef.current;
    if (!el) return;
    el.indeterminate =
      (terms || privacy || marketing) && !(terms && privacy && marketing);
  }, [terms, privacy, marketing]);

  const setAll = (v: boolean) => {
    setTerms(v);
    setPrivacy(v);
    setMarketing(v);
  };

  const onToggleAll = () => {
    if (allChecked) setAll(false);
    else setAll(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requiredOk) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/users/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: true,
          privacy: true,
          marketing: marketing,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "저장에 실패했습니다."
        );
      }
      router.push("/studio");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const linkClass =
    "font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline";

  const checkRow = (
    id: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    label: React.ReactNode
  ) => (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-200"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 text-amber-600"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="max-h-[min(90vh,36rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <h1
          id="welcome-title"
          className="text-lg font-semibold text-zinc-100 sm:text-xl"
        >
          {SITE_NAME} 서비스 시작하기
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          서비스 이용을 위해 아래 내용을 확인하고 동의해 주세요.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm font-medium text-amber-100/95">
            <input
              ref={allCheckboxRef}
              type="checkbox"
              checked={allChecked}
              onChange={onToggleAll}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 text-amber-600"
            />
            <span>전체 동의</span>
          </label>

          {checkRow(
            "welcome-terms",
            terms,
            setTerms,
            <>
              <span className="text-amber-200/90">(필수)</span> 이용약관 동의{" "}
              <Link href="/terms" target="_blank" rel="noreferrer" className={linkClass}>
                약관 보기
              </Link>
            </>
          )}

          {checkRow(
            "welcome-privacy",
            privacy,
            setPrivacy,
            <>
              <span className="text-amber-200/90">(필수)</span> 개인정보 수집 및
              이용 동의{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                내용 보기
              </Link>
            </>
          )}

          {checkRow(
            "welcome-marketing",
            marketing,
            setMarketing,
            <>(선택) 마케팅 정보 수신 동의</>
          )}

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <CopyWithBreaks as="span">{error}</CopyWithBreaks>
            </p>
          )}

          <button
            type="submit"
            disabled={!requiredOk || submitting}
            className="mt-4 w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? "처리 중…" : "시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
