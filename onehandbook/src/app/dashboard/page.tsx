import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import Link from "next/link";
import { AppShellHeader } from "@/components/AppShellHeader";
import {
  agentScoresByWorkFromRuns,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";
import { AddWorkButton } from "./AddWorkButton";
import { DashboardWorkCard } from "./DashboardWorkCard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { id: userId, email: userEmail, nat_balance, phone_verified } =
    await requireAppUser(supabase);

  // 1. 내 작품 목록
  const { data: works } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes, created_at")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });

  // 3. Agent Score — 작품별 분석이 있는 회차 종합 점수 평균
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

  const natBalance = nat_balance ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppShellHeader email={userEmail} natBalance={natBalance} />

      <main className="mx-auto max-w-4xl px-6 py-10 sm:py-12">
        {!phone_verified && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95">
            <CopyWithBreaks as="span">
              휴대폰 인증 후 AI 분석을 이용할 수 있습니다.
            </CopyWithBreaks>{" "}
            <Link
              href="/verify-phone"
              className="font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline"
            >
              휴대폰 인증하기
            </Link>
          </div>
        )}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-cyan-400/90">
              작가 스튜디오
            </p>
            <h1 className="text-2xl font-bold text-zinc-100">작가 대시보드</h1>
            <p className="mt-1 text-sm text-zinc-400 sm:text-base">
              내 작품 현황과 Agent Score(분석 회차 평균)를 확인하세요
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
              <DashboardWorkCard
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
