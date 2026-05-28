import { formatDimensionLabel } from "@/lib/analysis/dimensionLabel";
import { getAgentPlatformLabel } from "@/lib/agentPlatform";
import {
  averageOverallScore,
  latestAnalysisPerEpisode,
  type AnalysisRunRow,
  type HolisticRunRow,
} from "@/lib/analysisSummary";
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
import { LoreFeedback } from "@/components/analysis/LoreFeedback";

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
  /** 단계 C-5: 추출 진행 작품 + 기 피드백 부재 시 true (결정 30 옵션 F-1 server fetch). */
  shouldShowLoreFeedback: boolean;
}

function buildHolisticRunView(
  row: HolisticRunRow,
  episodes: EpisodeRef[],
): HolisticRunView {
  const r = row.result_json;
  const platform = getAgentPlatformLabel(row.agent_version) ?? "범용";

  // episode_ids = episodes.id 배열 → 실제 회차(episode_number)로 매핑·정렬 후 라벨 생성
  const episodeIds = row.episode_ids ?? [];
  const epNums = episodeIds
    .map((eid) => episodes.find((e) => e.id === eid)?.episode_number)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const minEp = epNums.length > 0 ? epNums[0] : null;
  const maxEp = epNums.length > 0 ? epNums[epNums.length - 1] : null;
  const label =
    minEp != null && maxEp != null
      ? minEp === maxEp
        ? `${minEp}화`
        : `${minEp}~${maxEp}화 (${epNums.length}개 회차)`
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

/**
 * `/works/[id]/analysis` — 리포트 보관함 (조회 전용).
 *
 * IA 재정비 (B-2): 분석 실행 UI 제거 (BatchAnalyzeCTA / 일괄 select 영역).
 * 분석 실행 진입점은 **작품 상세 BatchAnalyzeModal** 단일. 본 페이지는 누적 조회 전용.
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
  shouldShowLoreFeedback,
}: WorkAnalysisPageProps) {
  const latest = latestAnalysisPerEpisode(runs);
  const analyzedEpisodes = latest.size;
  const workAvgScore = averageOverallScore(latest);
  const lastAnalyzedAt = runs.length > 0 ? runs[0].created_at : null;

  const holisticViews = holisticRuns.map((r) =>
    buildHolisticRunView(r, episodes),
  );

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
            mode={holisticMode}
          />
        )}
      </div>

      {/* 단계 C-5 (옵션 M-2): 페이지 하단 inline 피드백 (결정 11 옵션 F-4). */}
      <div className="mx-auto max-w-6xl px-6 pb-12">
        <LoreFeedback
          workId={workId}
          shouldShow={shouldShowLoreFeedback}
        />
      </div>
    </>
  );
}
