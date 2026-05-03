import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type AppUser = {
  id: number;
  /** `users.coin_balance` 컬럼이 없거나 조회 실패 시 null — UI는 `?? 0` 처리 */
  coin_balance: number | null;
  email: string;
  /** 휴대폰 인증 완료 여부 — 미인증 시 AI 분석 불가 */
  phone_verified: boolean;
};

function resolveAuthEmail(authUser: User): string {
  if (authUser.email) return authUser.email;
  const prov = String(authUser.app_metadata?.provider ?? "oauth");
  const suffix = authUser.id.replace(/-/g, "").slice(0, 24);
  return `${prov}_${suffix}@oauth.novelagent.local`;
}

function resolvePreferredProfileEmail(authUser: User): string {
  const maybe = authUser.user_metadata?.naver_email;
  if (typeof maybe === "string") {
    const t = maybe.trim();
    if (t && t.includes("@")) return t;
  }
  return resolveAuthEmail(authUser);
}

async function loadAppUserRow(
  supabase: SupabaseClient,
  userId: number,
  email: string
): Promise<AppUser> {
  const { data, error } = await supabase
    .from("users")
    .select("coin_balance, phone_verified_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      id: userId,
      coin_balance: null,
      email,
      phone_verified: false,
    };
  }

  return {
    id: userId,
    coin_balance: data?.coin_balance ?? null,
    email,
    phone_verified: data?.phone_verified_at != null,
  };
}

/**
 * auth.users 와 public.users 를 맞춥니다. 스튜디오를 거치지 않고 /works 등으로 들어와도
 * 행이 없으면 여기서 생성합니다.
 */
export async function syncAppUser(
  supabase: SupabaseClient
): Promise<AppUser | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const email = resolvePreferredProfileEmail(authUser);

  const { data: existingUser } = await supabase
    .from("users")
    .select("id, email")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (existingUser) {
    // 표시용 이메일이 바뀐 경우에만 UPDATE (폴링·syncAppUser 반복 호출 시 불필요한 쓰기 방지)
    const prevEmail = existingUser.email?.trim() ?? "";
    const nextEmail = email.trim();
    if (prevEmail !== nextEmail) {
      const { error: updErr } = await supabase
        .from("users")
        .update({ email })
        .eq("id", existingUser.id);
      if (updErr) {
        // ignore: 표시용 이메일 업데이트 실패는 치명적이지 않음
      }
    }
    return loadAppUserRow(supabase, existingUser.id, email);
  }

  const nickname = email.split("@")[0]?.slice(0, 50) || "user";

  const { data: newUser, error } = await supabase
    .from("users")
    .upsert(
      {
        auth_id: authUser.id,
        email,
        nickname,
      },
      { onConflict: "auth_id" }
    )
    .select("id")
    .single();

  if (!error && newUser) {
    return loadAppUserRow(supabase, newUser.id, email);
  }

  const { data: userByEmail } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (userByEmail) {
    await supabase
      .from("users")
      .update({ auth_id: authUser.id })
      .eq("id", userByEmail.id);
    return loadAppUserRow(supabase, userByEmail.id, email);
  }

  console.error("syncAppUser:", error?.message ?? "unknown");
  return null;
}

/** 소셜 로그인 콜백에서 `users.login_provider` 기록 */
export async function setUserLoginProvider(
  supabase: SupabaseClient,
  provider: "google" | "naver"
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("users")
    .update({ login_provider: provider })
    .eq("auth_id", user.id);
  if (error) {
    console.error("setUserLoginProvider:", error.message);
  }
}

/** 서버 컴포넌트에서 사용 — 동기화 실패 시 로그인으로 */
export async function requireAppUser(supabase: SupabaseClient): Promise<AppUser> {
  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    redirect("/login");
  }
  return appUser;
}
