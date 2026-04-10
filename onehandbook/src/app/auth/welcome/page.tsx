import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { WelcomeConsentForm } from "./WelcomeConsentForm";
import { after } from "next/server";

export default async function AuthWelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 콜백에서 DB upsert를 기다리지 않으므로, welcome에서도 렌더를 막지 않고 백그라운드로 동기화합니다.
  after(async () => {
    try {
      await syncAppUser(supabase);
    } catch (e) {
      console.warn("welcome syncAppUser(after) failed:", e);
    }
  });

  const { data: row } = await supabase
    .from("users")
    .select("terms_agreed_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (row?.terms_agreed_at) {
    redirect("/studio");
  }

  return <WelcomeConsentForm />;
}
