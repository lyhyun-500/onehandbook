import { formatDimensionLabel } from "@/lib/analysis/dimensionLabel";
import {
  averageOverallScore,
  latestAnalysisPerEpisode,
  type AnalysisRunRow,
  type HolisticRunRow,
} from "@/lib/analysisSummary";
import { TabSegment, type AnalysisTab } from "./TabSegment";
import { WorkHeader } from "./WorkHeader";
import {
  IndividualTab,
  type EpisodeRef,
} from "./IndividualTab";
import { HolisticTab, type HolisticRunView } from "./HolisticTab";

interface WorkAnalysisPageProps {
  workId: string;
  work: {
    title: string;
    genre: string;
    status: string;
    total_episodes: number;
  };
  episodes: EpisodeRef[];
  runs: AnalysisRunRow[];
  holisticRuns: HolisticRunRow[];
  activeTab: AnalysisTab;
  currentRunId: string | null;
}

function buildHolisticRunView(row: HolisticRunRow): HolisticRunView {
  const r = row.result_json;
  // options_json 컬럼은 DB schema 본질이나 HolisticRunRow 타입에 부재 — runtime 안전 캐스트
  const optsRaw = (row as unknown as { options_json?: unknown }).options_json;
  const platformRaw =
    optsRaw && typeof optsRaw === "object"
      ? (optsRaw as { platform?: unknown }).platform
      : null;
  const platform =
    typeof platformRaw === "string" && platformRaw.trim().length > 0
      ? platformRaw
      : "Novel Agent";

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

  // dimensions 는 array 또는 record — array 우선
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

/**
 * /works/[id]/analysis 의 메인 orchestrator — 시안 정합 tab shell.
 *
 * 분석 실행 영역 (BatchAnalyzeCTA + HolisticRangeSelector) 부재 — Phase 2-D-8-5 후보.
 */
export function WorkAnalysisPage({
  workId,
  work,
  episodes,
  runs,
  holisticRuns,
  activeTab,
  currentRunId,
}: WorkAnalysisPageProps) {
  const latest = latestAnalysisPerEpisode(runs);
  const analyzedEpisodes = latest.size;
  const workAvgScore = averageOverallScore(latest);
  const lastAnalyzedAt =
    runs.length > 0 ? runs[0].created_at : null;

  const holisticViews = holisticRuns.map(buildHolisticRunView);

  return (
    <>
      <WorkHeader
        title={work.title}
        genre={work.genre}
        status={work.status}
        totalEpisodes={work.total_episodes}
        analyzedEpisodes={analyzedEpisodes}
        lastAnalyzedAt={lastAnalyzedAt}
        avgScore={workAvgScore}
      />

      <div className="mx-auto max-w-6xl px-6 pb-8 pt-6">
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
            runs={holisticViews}
            currentRunId={currentRunId}
          />
        )}
      </div>
    </>
  );
}
