import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PHONE_SIGNUP_REWARD_COINS } from "@/config/phoneSignupReward";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { StudioPhoneVerifySuccessModal } from "@/components/StudioPhoneVerifySuccessModal";
import { AppShellHeader } from "@/components/AppShellHeader";
import {
  agentScoresByWorkFromRuns,
  recentScoresByWorkFromRuns,
  lastAnalyzedAtByWorkFromRuns,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";
import {
  type StudioWorkData,
} from "@/components/studio/StudioWorkCard";
import { type StudioStats } from "@/components/studio/StudioStatsStrip";
import { StudioEmptyState } from "@/components/studio/StudioEmptyState";
import { StudioPageClient } from "./StudioPageClient";

function computeStats(works: StudioWorkData[]): StudioStats {
  const totalWorks = works.length;
  const totalEpisodes = works.reduce((s, w) => s + (w.totalEpisodes ?? 0), 0);
  const ongoingCount = works.filter((w) => w.status === "연재중").length;
  const analyzed = works.filter((w) => w.agentScore != null);
  const totalAnalyzed = analyzed.length;
  const avgScore =
    analyzed.length > 0
      ? Math.round(
          analyzed.reduce((s, w) => s + (w.agentScore ?? 0), 0) /
            analyzed.length,
        )
      : null;
  return { totalWorks, totalEpisodes, totalAnalyzed, avgScore, ongoingCount };
}

function formatLastAnalyzedAt(iso: string | null): string | null {
  if (!iso) return null;
  // ISO → YYYY-MM-DD 박음 (시안 정합 — "마지막 분석 · 2026-05-04")
  return iso.slice(0, 10);
}

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
  let recentScores: Record<number, number[] | null> = {};
  let lastAnalyzedAt: Record<number, string | null> = {};

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
    recentScores = recentScoresByWorkFromRuns(runs);
    lastAnalyzedAt = lastAnalyzedAtByWorkFromRuns(runs);
  }

  const transformedWorks: StudioWorkData[] = (works ?? []).map((w) => ({
    id: w.id,
    title: w.title,
    genre: w.genre,
    status: w.status,
    totalEpisodes: w.total_episodes,
    agentScore: agentScores[w.id] ?? null,
    lastAnalyzedAt: formatLastAnalyzedAt(lastAnalyzedAt[w.id] ?? null),
    recentScores: recentScores[w.id] ?? null,
  }));

  const stats = computeStats(transformedWorks);
  const natBalance = coin_balance ?? 0;
  const isEmpty = transformedWorks.length === 0;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <Suspense fallback={null}>
        <StudioPhoneVerifySuccessModal />
      </Suspense>
      <AppShellHeader email={userEmail} natBalance={natBalance} />

      {!phone_verified && (
        <div className="mx-auto max-w-6xl px-6 pt-6 sm:px-8">
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95">
            <CopyWithBreaks as="span">
              {`🎉 베타 오픈 기념! 휴대폰 인증하면 ${PHONE_SIGNUP_REWARD_COINS}코인 즉시 지급
인증 한 번이면 AI 분석 바로 시작할 수 있어요`}
            </CopyWithBreaks>{" "}
            <Link
              href="/verify-phone"
              className="font-medium text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
            >
              휴대폰 인증하고 받기
            </Link>
          </div>
        </div>
      )}

      {isEmpty ? (
        <StudioEmptyState />
      ) : (
        <StudioPageClient
          userId={userId}
          works={transformedWorks}
          stats={stats}
        />
      )}
    </div>
  );
}
