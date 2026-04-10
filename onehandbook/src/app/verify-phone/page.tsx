import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PHONE_SIGNUP_REWARD_COINS } from "@/config/phoneSignupReward";
import { SITE_NAME } from "@/config/site";
import { VerifyPhoneForm } from "./VerifyPhoneForm";

export default async function VerifyPhonePage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  if (appUser.phone_verified) {
    redirect("/studio");
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="mx-auto max-w-md">
        <Link
          href="/studio"
          className="mb-6 block text-center text-lg font-bold text-zinc-100"
        >
          {SITE_NAME}
        </Link>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-xl">
          <h1 className="text-xl font-semibold text-zinc-100">
            휴대폰 인증
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            <CopyWithBreaks as="span" className="block">
              {`휴대폰 인증하면 ${PHONE_SIGNUP_REWARD_COINS}코인을 드립니다. AI 분석·NAT 이용 전에 번호를 인증해 주세요(번호당 계정 1개).`}
            </CopyWithBreaks>
          </p>
          <div className="mt-8">
            <VerifyPhoneForm />
          </div>
        </div>
      </div>
    </div>
  );
}
