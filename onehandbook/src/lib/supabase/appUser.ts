import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type AppUser = {
  id: number;
  /** `users.nat_balance` 컬럼이 없거나 조회 실패 시 null — UI는 `?? 0` 처리 */
  nat_balance: number | null;
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

async function loadAppUserRow(
  supabase: SupabaseClient,
  userId: number,
  email: string
): Promise<AppUser> {
  const { data, error } = await supabase
    .from("users")
    .select("nat_balance, phone_verified_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      id: userId,
      nat_balance: null,
      email,
      phone_verified: false,
    };
  }

  return {
    id: userId,
    nat_balance: data?.nat_balance ?? null,
    email,
    phone_verified: data?.phone_verified_at != null,
  };
}

/**
 * auth.users 와 public.users 를 맞춥니다. 대시보드를 거치지 않고 /works 등으로 들어와도
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

  const email = resolveAuthEmail(authUser);

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (existingUser) {
    return loadAppUserRow(supabase, existingUser.id, email);
  }

  const nickname = email.split("@")[0]?.slice(0, 50) || "user";

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      auth_id: authUser.id,
      email,
      nickname,
    })
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

/** 서버 컴포넌트에서 사용 — 동기화 실패 시 로그인으로 */
export async function requireAppUser(supabase: SupabaseClient): Promise<AppUser> {
  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    redirect("/login");
  }
  return appUser;
}
