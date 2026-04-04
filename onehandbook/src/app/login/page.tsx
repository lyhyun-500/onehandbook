"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { SITE_NAME } from "@/config/site";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  const oauth = async (provider: "google" | "kakao") => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "소셜 로그인에 실패했습니다."
      );
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("이메일을 확인해 인증을 완료해주세요.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "오류가 발생했습니다. 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 block text-center text-2xl font-bold text-zinc-100"
        >
          {SITE_NAME}
        </Link>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-xl">
          <div className="mb-6 flex gap-2 rounded-lg bg-zinc-800/50 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 placeholder-zinc-500 transition-colors focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 placeholder-zinc-500 transition-colors focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              {mode === "signup" && (
                <p className="mt-1 text-xs text-zinc-500">
                  6자 이상 입력해주세요
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <CopyWithBreaks as="span">{error}</CopyWithBreaks>
              </p>
            )}

            {message && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                <CopyWithBreaks as="span">{message}</CopyWithBreaks>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-amber-600 py-3 font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
            </button>
          </form>

          <div className="mt-6">
            <p className="mb-3 text-center text-xs text-zinc-500">
              또는 소셜 계정으로 계속
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={loading}
                onClick={() => oauth("google")}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {/* Google Sign-In 브랜드: Web (mobile+desktop) / svg / dark / web_dark_sq_na.svg */}
                <Image
                  src="/auth/google-signin-icon.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0"
                  aria-hidden
                />
                Google로 계속
              </button>
              {/* 카카오: 앱·Supabase 설정 후 아래 주석 해제
              <button
                type="button"
                disabled={loading}
                onClick={() => oauth("kakao")}
                className="flex flex-1 items-center justify-center rounded-lg bg-transparent p-0 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <img
                  src="/auth/kakao-login.png"
                  alt="카카오 로그인"
                  width={183}
                  height={45}
                  className="h-10 w-auto max-w-full object-contain sm:h-11"
                  draggable={false}
                />
              </button>
              */}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-400">
          24시간 피드백 가능한 개인 AI 에이전트
        </p>
        <Link
          href="/"
          className="mt-4 block text-center text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← 홈으로
        </Link>
      </div>
    </div>
  );
}
