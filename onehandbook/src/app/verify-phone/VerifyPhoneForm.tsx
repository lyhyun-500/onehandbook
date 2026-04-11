"use client";

import { useState } from "react";
import Link from "next/link";
import { normalizeKrPhone } from "@/lib/phone";

const fetchAuth = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(body),
  });

function isAbortOrNetworkError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("aborted")
  );
}

function networkErrorMessage(): string {
  return "연결이 끊겼거나 요청이 취소되었습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.";
}

export function VerifyPhoneForm() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const normalized = normalizeKrPhone(phone);
    if (!normalized) {
      setError("올바른 휴대폰 번호를 입력해 주세요. (예: 01012345678)");
      setLoading(false);
      return;
    }
    // UX: 버튼을 누르면 즉시 인증번호 입력칸을 노출 (전송 지연/실패 시에도 재시도 가능)
    setSent(true);
    try {
      const res = await fetchAuth("/api/auth/sms/send", { phone: normalized });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "요청에 실패했습니다."
        );
      }
      setMessage(
        "인증번호를 발송했습니다. 문자 전송이 지연될 수 있습니다(최대 5분)."
      );
    } catch (e) {
      setError(
        isAbortOrNetworkError(e)
          ? networkErrorMessage()
          : e instanceof Error
            ? e.message
            : "오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const normalized = normalizeKrPhone(phone);
    if (!normalized) {
      setError("올바른 휴대폰 번호를 입력해 주세요.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetchAuth("/api/auth/sms/verify", {
        phone: normalized,
        code: code.replace(/\D/g, ""),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "인증에 실패했습니다."
        );
      }
      const granted =
        typeof data.natGranted === "number" ? data.natGranted : 0;
      const phoneReward = granted > 0 ? "1" : "0";
      window.location.assign(
        `/studio?phoneVerified=1&phoneReward=${phoneReward}`
      );
    } catch (e) {
      setError(
        isAbortOrNetworkError(e)
          ? networkErrorMessage()
          : e instanceof Error
            ? e.message
            : "오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="phone"
          className="mb-1.5 block text-sm font-medium text-zinc-300"
        >
          휴대폰 번호
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01012345678"
          disabled={loading}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        <p className="mt-1 text-xs text-zinc-500">
          하이픈 없이 입력해도 됩니다. 가입 축하 코인은 번호당 최초 1회입니다. 이미 다른
          계정에서 해당 번호로 혜택을 쓴 경우 인증만 됩니다.
        </p>
      </div>

      {!sent ? (
        <button
          type="button"
          onClick={sendCode}
          disabled={loading || phone.replace(/\D/g, "").length < 10}
          className="w-full rounded-lg bg-cyan-600 py-3 font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "처리 중…" : "인증번호 받기"}
        </button>
      ) : (
        <>
          <div>
            <label
              htmlFor="code"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              인증번호 6자리
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              disabled={loading}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-center text-lg tracking-[0.3em] text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <p className="mt-1 text-xs text-zinc-500">
              문자 전송이 지연될 수 있습니다. 최대 5분까지 기다려 주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg bg-cyan-600 py-3 font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "처리 중…" : "인증 완료"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
              setMessage(null);
            }}
            disabled={loading}
            className="w-full text-sm text-zinc-500 hover:text-zinc-300"
          >
            번호를 바꿔 다시 받기
          </button>
        </>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
          {message}
        </p>
      )}

      <p className="text-center text-xs text-zinc-500">
        <Link href="/studio" className="text-cyan-400 hover:text-cyan-300">
          ← 스튜디오로
        </Link>
      </p>
    </div>
  );
}
