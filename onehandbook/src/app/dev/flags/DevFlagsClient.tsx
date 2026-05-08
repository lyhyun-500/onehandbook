"use client";

/**
 * /dev/flags client 본체 — 토글 UI + 평가 디버깅.
 * page.tsx 의 Suspense fallback 안에서 mount 됨.
 *
 * production 차단됨 (`src/proxy.ts` 의 /dev/* 분기).
 * UI 자체는 redesign 대상 아니므로 atoms 사용 X. 단순 표 + 토글 버튼.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  REDESIGN_FLAGS,
  NEWUI_COOKIE_NAME,
  NEWUI_COOKIE_MAX_AGE_DAYS,
  evaluateRedesignFlag,
  type RedesignFlag,
  type FlagEvaluation,
} from "@/lib/feature-flags";

type CookieFlag = RedesignFlag | "all";

export function DevFlagsClient() {
  const searchParams = useSearchParams();
  const [cookieFlags, setCookieFlags] = useState<Set<CookieFlag>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCookieFlags(parseFlagsCookie(getCookie(NEWUI_COOKIE_NAME) ?? ""));
  }, []);

  const writeCookie = (flags: Set<CookieFlag>) => {
    const value = Array.from(flags).join(",");
    const maxAge = NEWUI_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
    document.cookie = `${NEWUI_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
    setCookieFlags(new Set(flags));
  };

  const toggleFlag = (flag: RedesignFlag) => {
    const next = new Set(cookieFlags);
    if (next.has(flag)) next.delete(flag);
    else next.add(flag);
    next.delete("all");
    writeCookie(next);
  };

  const allOn = () => writeCookie(new Set(["all"]));
  const allOff = () => writeCookie(new Set());

  const newuiQuery = searchParams?.get("newui") ?? null;
  const cookieRaw = mounted
    ? Array.from(cookieFlags).join(",") || "(empty)"
    : "(loading)";

  return (
    <div className="min-h-screen bg-zinc-900 p-8 text-zinc-100 font-mono text-sm">
      <h1 className="mb-2 text-xl font-bold">/dev/flags</h1>
      <p className="mb-6 text-zinc-400">
        디자인 개편 feature flag 디버깅 + 쿠키 토글. production 차단됨.
      </p>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={allOn}
          className="rounded border border-zinc-600 px-3 py-1 hover:bg-zinc-800"
        >
          전체 ON (cookie="all")
        </button>
        <button
          type="button"
          onClick={allOff}
          className="rounded border border-zinc-600 px-3 py-1 hover:bg-zinc-800"
        >
          전체 OFF (cookie clear)
        </button>
      </div>

      <div className="mb-6 rounded border border-zinc-700 p-3 text-xs">
        <div>NODE_ENV: {process.env.NODE_ENV}</div>
        <div>쿼리(?newui=): {newuiQuery ?? "(none)"}</div>
        <div>
          쿠키({NEWUI_COOKIE_NAME}): {cookieRaw}
        </div>
        <div>쿠키 만료: {NEWUI_COOKIE_MAX_AGE_DAYS}일 (max-age)</div>
        <div className="mt-2 text-zinc-500">
          우선순위: query &gt; cookie &gt; env &gt; off
        </div>
      </div>

      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-zinc-700">
            <th className="pb-2">flag</th>
            <th className="pb-2">평가 결과</th>
            <th className="pb-2">출처</th>
            <th className="pb-2">쿠키 토글</th>
          </tr>
        </thead>
        <tbody>
          {REDESIGN_FLAGS.map((flag) => {
            const evalResult: FlagEvaluation = mounted
              ? evaluateRedesignFlag(flag, {
                  newuiQuery,
                  newuiCookie: Array.from(cookieFlags).join(","),
                })
              : { enabled: false, source: "off" };
            const inCookie = cookieFlags.has(flag) || cookieFlags.has("all");
            return (
              <tr key={flag} className="border-b border-zinc-800">
                <td className="py-2">{flag}</td>
                <td className="py-2">
                  {evalResult.enabled ? (
                    <span className="text-emerald-400">ON</span>
                  ) : (
                    <span className="text-zinc-500">OFF</span>
                  )}
                </td>
                <td className="py-2 text-zinc-400">{evalResult.source}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => toggleFlag(flag)}
                    className="rounded border border-zinc-600 px-2 py-0.5 text-xs hover:bg-zinc-800"
                  >
                    {inCookie ? "remove from cookie" : "add to cookie"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-8 text-xs text-zinc-500">
        검증 방법:
        <ul className="ml-4 mt-1 list-disc space-y-0.5">
          <li>
            쿼리: <code>?newui=landing</code>, <code>?newui=all</code>,{" "}
            <code>?newui=off</code>
          </li>
          <li>
            쿠키: 위 토글 버튼 또는{" "}
            <code>document.cookie = &quot;newui_flags=landing; path=/&quot;</code>
          </li>
          <li>
            env: <code>NEXT_PUBLIC_REDESIGN_LANDING=true</code> + 재빌드
          </li>
        </ul>
      </div>
    </div>
  );
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + escaped + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function parseFlagsCookie(cookie: string): Set<CookieFlag> {
  return new Set(
    cookie
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as CookieFlag[]
  );
}
