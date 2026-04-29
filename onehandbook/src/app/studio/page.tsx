import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PHONE_SIGNUP_REWARD_COINS } from "@/config/phoneSignupReward";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { StudioPhoneVerifySuccessModal } from "@/components/StudioPhoneVerifySuccessModal";
import Link from "next/link";
import { AppShellHeader } from "@/components/AppShellHeader";
import {
  agentScoresByWorkFromRuns,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";
import { AddWorkButton } from "./AddWorkButton";
import { StudioWorkCard } from "./StudioWorkCard";

export default async function StudioPage() {
  const supabase = await createClient();
  const { id: userId, email: userEmail, coin_balance, phone_verified } =
    await requireAppUser(supabase);

  // 로그인 콜백에서는 DB 조회를 기다리지 않고 /studio로 보내므로,
  // 최초 진입 시 여기서 약관 동의 여부를 확인해 /auth/welcome로 이동시킵니다.
  const { data: consentRow } = await supabase
    .from("users")
    .select("terms_agreed_at")
    .eq("id", userId)
    .maybeSingle();
  if (!consentRow?.terms_agreed_at) {
    redirect("/auth/welcome");
  }

  const { data: works } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes, created_at")
    .eq("author_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const workIds = (works ?? []).map((w) => w.id);
  let agentScores: Record<number, number | null> = {};

  if (workIds.length > 0) {
    const { data: analysisRuns } = await supabase
      .from("analysis_runs")
      .select("id, episode_id, work_id, agent_version, result_json, created_at")
      .in("work_id", workIds)
      .order("created_at", { ascending: false });
    const runs = (analysisRuns ?? []) as Array<
      AnalysisRunRow & { work_id: number }
    >;
    agentScores = agentScoresByWorkFromRuns(runs);
  }

  const natBalance = coin_balance ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Suspense fallback={null}>
        <StudioPhoneVerifySuccessModal />
      </Suspense>
      <AppShellHeader email={userEmail} natBalance={natBalance} />

      <main className="mx-auto max-w-4xl px-6 py-10 sm:py-12">
        {!phone_verified && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95">
            <CopyWithBreaks as="span">
              {`🎉 베타 오픈 기념! 휴대폰 인증하면 ${PHONE_SIGNUP_REWARD_COINS}코인 즉시 지급
인증 한 번이면 AI 분석 바로 시작할 수 있어요`}
            </CopyWithBreaks>{" "}
            <Link
              href="/verify-phone"
              className="font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline"
            >
              휴대폰 인증하고 받기
            </Link>
          </div>
        )}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-cyan-400/90">
              작가 도구
            </p>
            <h1 className="text-2xl font-bold text-zinc-100">스튜디오</h1>
            <p className="mt-1 text-sm text-zinc-400 sm:text-base">
              내 작품 현황과 Agent Score(분석 회차 평균)를 확인하세요
            </p>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              🔒 등록하신 원고는 작가님만 볼 수 있습니다
            </p>
          </div>
          <AddWorkButton userId={userId} />
        </div>

        {!works || works.length === 0 ? (
          <div className="rounded-xl border border-cyan-500/10 bg-zinc-900/50 p-12 text-center shadow-lg shadow-black/20">
            <p className="mb-4 text-zinc-300">등록된 작품이 없습니다</p>
            <p className="text-sm text-zinc-500">
              작품 등록 버튼을 눌러 첫 작품을 등록해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {works.map((work) => (
              <StudioWorkCard
                key={work.id}
                work={{
                  id: work.id,
                  title: work.title,
                  genre: work.genre,
                  status: work.status,
                  total_episodes: work.total_episodes,
                }}
                agentScore={agentScores[work.id] ?? null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
