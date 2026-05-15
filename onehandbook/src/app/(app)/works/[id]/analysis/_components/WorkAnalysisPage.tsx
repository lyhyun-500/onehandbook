import { formatDimensionLabel } from "@/lib/analysis/dimensionLabel";
import { getAgentPlatformLabel } from "@/lib/agentPlatform";
import {
  averageOverallScore,
  latestAnalysisPerEpisode,
  type AnalysisRunRow,
  type HolisticRunRow,
} from "@/lib/analysisSummary";
import { computeHolisticNatCost } from "@/lib/nat";
import type { WorkOption } from "@/components/atoms/WorkSelector";
import { TabSegment, type AnalysisTab } from "./TabSegment";
import { WorkHeader } from "./WorkHeader";
import {
  IndividualTab,
  type EpisodeRef,
} from "./IndividualTab";
import {
  HolisticTab,
  type HolisticRunView,
  type HolisticTabMode,
} from "./HolisticTab";
import {
  BatchAnalyzeCTA,
  type BatchAnalyzeCTAState,
} from "./BatchAnalyzeCTA";
import type { RangeSelectorEpisode } from "./HolisticRangeSelector";

interface WorkAnalysisPageProps {
  workId: string;
  work: {
    title: string;
    genre: string;
    status: string;
    total_episodes: number;
  };
  workOptions: WorkOption[];
  episodes: EpisodeRef[];
  runs: AnalysisRunRow[];
  holisticRuns: HolisticRunRow[];
  activeTab: AnalysisTab;
  currentRunId: string | null;
  holisticMode: HolisticTabMode;
  preselect: "missing" | "all" | null;
  natBalance: number;
}

function buildHolisticRunView(row: HolisticRunRow): HolisticRunView {
  const r = row.result_json;
  const platform = getAgentPlatformLabel(row.agent_version) ?? "범용";

  const episodeIds = row.episode_ids;
  const minEp = episodeIds.length > 0 ? Math.min(...episodeIds) : null;
  const maxEp = episodeIds.length > 0 ? Math.max(...episodeIds) : null;
  const label =
    minEp != null && maxEp != null
      ? minEp === maxEp
        ? `${minEp}화`
        : `${minEp}~${maxEp}화 통합`
      : "선택 회차 통합";

  type RawEpisodeScore = { episode_number: number; score: number };
  type RawDimension = { key: string; label?: string; score: number; comment: string };
  const rawResult = r as unknown as {
    overall_score: number;
    score_basis?: string;
    executive_summary?: string;
    episode_scores?: RawEpisodeScore[];
    dimensions?: RawDimension[] | Record<string, { score: number; comment: string }>;
    strengths?: string[];
    improvements?: string[];
  };

  let dimensions: HolisticRunView["dimensions"] = [];
  if (Array.isArray(rawResult.dimensions)) {
    dimensions = rawResult.dimensions.map((d) => ({
      key: d.key,
      label: d.label ?? formatDimensionLabel(d.key),
      score: d.score,
      comment: d.comment,
    }));
  } else if (rawResult.dimensions && typeof rawResult.dimensions === "object") {
    dimensions = Object.entries(rawResult.dimensions).map(([k, v]) => ({
      key: k,
      label: formatDimensionLabel(k),
      score: v.score,
      comment: v.comment,
    }));
  }

  return {
    id: String(row.id),
    label,
    createdAt: row.created_at,
    natCost: row.nat_cost,
    platform,
    episodeIds,
    overallScore: rawResult.overall_score,
    scoreBasis: rawResult.score_basis ?? "선택 회차 통합 분석 결과입니다.",
    executiveSummary: rawResult.executive_summary ?? "",
    episodeScores: (rawResult.episode_scores ?? []).map((e) => ({
      episode_number: e.episode_number,
      score: e.score,
    })),
    dimensions,
    strengths: rawResult.strengths ?? [],
    improvements: rawResult.improvements ?? [],
  };
}

function deriveCTAState(
  totalEpisodes: number,
  analyzedEpisodes: number,
): BatchAnalyzeCTAState | null {
  if (totalEpisodes === 0) return null;
  if (analyzedEpisodes === 0) return "none";
  if (analyzedEpisodes >= totalEpisodes) return "all_analyzed";
  return "partial";
}

/**
 * `/works/[id]/analysis` 의 메인 orchestrator — WorkHeader + BatchAnalyzeCTA + TabSegment + (Individual | Holistic).
 *
 * BatchAnalyzeCTA 위치: WorkHeader 와 TabSegment 사이 (tab 무관, 작품 단위 전역 노출).
 */
export function WorkAnalysisPage({
  workId,
  work,
  workOptions,
  episodes,
  runs,
  holisticRuns,
  activeTab,
  currentRunId,
  holisticMode,
  preselect,
  natBalance,
}: WorkAnalysisPageProps) {
  const latest = latestAnalysisPerEpisode(runs);
  const analyzedEpisodes = latest.size;
  const workAvgScore = averageOverallScore(latest);
  const lastAnalyzedAt =
    runs.length > 0 ? runs[0].created_at : null;

  const holisticViews = holisticRuns.map(buildHolisticRunView);

  const analyzedIdSet = new Set<number>(latest.keys());
  // 통합 일괄 분석 본질 = 통합 run 에 포함된 회차도 "분석됨" 으로 표시.
  for (const h of holisticRuns) {
    for (const eid of h.episode_ids) analyzedIdSet.add(eid);
  }

  const rangeSelectorEpisodes: RangeSelectorEpisode[] = episodes.map((e) => ({
    id: e.id,
    episode_number: e.episode_number,
    title: e.title,
    analyzed: analyzedIdSet.has(e.id),
  }));

  const ctaState = deriveCTAState(work.total_episodes, analyzedEpisodes);

  // CTA NAT 비용 — 옵션 기본 ON (lore + platform) 시점의 산식.
  const totalNatCost = computeHolisticNatCost(work.total_episodes, {
    includeLore: true,
    includePlatformOptimization: true,
  });
  const unanalyzedCount = Math.max(
    0,
    work.total_episodes - analyzedEpisodes,
  );
  const partialNatCost = computeHolisticNatCost(unanalyzedCount, {
    includeLore: true,
    includePlatformOptimization: true,
  });

  return (
    <>
      <WorkHeader
        workId={workId}
        works={workOptions}
        genre={work.genre}
        status={work.status}
        totalEpisodes={work.total_episodes}
        analyzedEpisodes={analyzedEpisodes}
        lastAnalyzedAt={lastAnalyzedAt}
        avgScore={workAvgScore}
      />

      <div className="mx-auto max-w-6xl px-6 pb-8 pt-6">
        {/* BatchAnalyzeCTA — select 모드 외 시점에만 노출 (선택 영역 진입 후엔 중복 회피) */}
        {ctaState && !(activeTab === "holistic" && holisticMode === "select") && (
          <BatchAnalyzeCTA
            workId={workId}
            state={ctaState}
            totalEpisodes={work.total_episodes}
            analyzedEpisodes={analyzedEpisodes}
            partialNatCost={partialNatCost}
            totalNatCost={totalNatCost}
            lastAnalyzedAt={lastAnalyzedAt}
          />
        )}

        <TabSegment workId={workId} activeTab={activeTab} />

        {activeTab === "individual" ? (
          <IndividualTab
            workId={workId}
            workTitle={work.title}
            episodes={episodes}
            runs={runs}
            workAvgScore={workAvgScore}
          />
        ) : (
          <HolisticTab
            workId={workId}
            workTitle={work.title}
            runs={holisticViews}
            currentRunId={currentRunId}
            mode={holisticMode}
            episodes={rangeSelectorEpisodes}
            preselect={preselect}
            natBalance={natBalance}
          />
        )}
      </div>
    </>
  );
}
