"use client";

/**
 * Feature Flag — Client-only wrapper.
 *
 * `useSearchParams()` + `document.cookie` 사용. Client Component 에서만 호출.
 * SSR 시점엔 document 접근 불가하므로 첫 렌더는 query+env 만, mount 후 cookie 반영.
 *
 * 사용 예 (Client Component):
 *   const enabled = useIsRedesignEnabled("landing");
 *   return enabled ? <LandingV2 /> : <LandingV1 />;
 */

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  evaluateRedesignFlag,
  NEWUI_COOKIE_NAME,
  type FlagEvaluation,
  type RedesignFlag,
} from "./feature-flags";

/**
 * Client 측 flag 평가.
 * - SSR/첫 렌더: cookie 미반영 (document undefined)
 * - mount 이후: cookie 반영하여 재평가
 *
 * source 필드로 어디서 결정됐는지 확인 가능.
 */
export function useRedesignFlag(flag: RedesignFlag): FlagEvaluation {
  const searchParams = useSearchParams();
  const [cookieValue, setCookieValue] = useState<string | null>(null);

  useEffect(() => {
    setCookieValue(getCookie(NEWUI_COOKIE_NAME));
  }, []);

  const newuiQuery = searchParams?.get("newui") ?? null;
  return evaluateRedesignFlag(flag, { newuiQuery, newuiCookie: cookieValue });
}

/** boolean 단축. */
export function useIsRedesignEnabled(flag: RedesignFlag): boolean {
  return useRedesignFlag(flag).enabled;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + escaped + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}
