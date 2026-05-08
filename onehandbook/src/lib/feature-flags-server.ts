/**
 * Feature Flag — Server-only wrapper.
 *
 * `cookies()` 사용으로 RSC / Server Action / Route Handler 에서만 호출 가능.
 * Client Component 에서 import 하면 빌드 에러 (`next/headers` 제약).
 *
 * 사용 예 (RSC):
 *   const enabled = await isRedesignEnabledServer("studio", { newui: searchParams.newui });
 *   return enabled ? <StudioV2 /> : <StudioV1 />;
 */

import { cookies } from "next/headers";
import {
  evaluateRedesignFlag,
  NEWUI_COOKIE_NAME,
  type FlagEvaluation,
  type RedesignFlag,
} from "./feature-flags";

type SearchParamsLike = { newui?: string | string[] };

/** RSC 에서 호출. searchParams 는 page props 에서 받아 전달. */
export async function getRedesignFlagServer(
  flag: RedesignFlag,
  searchParams?: SearchParamsLike
): Promise<FlagEvaluation> {
  const cookieStore = await cookies();
  const newuiQuery = normalizeQuery(searchParams?.newui);
  const newuiCookie = cookieStore.get(NEWUI_COOKIE_NAME)?.value ?? null;

  return evaluateRedesignFlag(flag, { newuiQuery, newuiCookie });
}

/** boolean 반환 단축. */
export async function isRedesignEnabledServer(
  flag: RedesignFlag,
  searchParams?: SearchParamsLike
): Promise<boolean> {
  return (await getRedesignFlagServer(flag, searchParams)).enabled;
}

function normalizeQuery(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? null;
  return null;
}
