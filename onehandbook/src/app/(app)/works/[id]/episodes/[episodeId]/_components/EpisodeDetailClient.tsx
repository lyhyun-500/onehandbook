"use client";

import { useRouter } from "next/navigation";
import {
  AnalyzePanel,
  type AnalysisRow,
  type VersionOption,
} from "@/components/AnalyzePanel";
import { EpisodeBody } from "@/components/atoms/EpisodeBody";
import {
  EpisodeSelector,
  type EpisodeOption,
} from "@/components/atoms/EpisodeSelector";
import { WorkSelector, type WorkOption } from "@/components/atoms/WorkSelector";
import { formatEpisodeLabel } from "@/lib/episodeLabel";

interface EpisodeDetailClientProps {
  workId: number;
  workTitle: string;
  episodeId: number;
  episodeNumber: number;
  episodeTitle: string;
  body: string;
  charCount: number;
  workOptions: WorkOption[];
  episodeOptions: EpisodeOption[];
  versions: VersionOption[];
  initialAnalyses: AnalysisRow[];
  natBalance: number;
  phoneVerified: boolean;
}

export function EpisodeDetailClient({
  workId,
  workTitle,
  episodeId,
  episodeNumber,
  episodeTitle,
  body,
  charCount,
  workOptions,
  episodeOptions,
  versions,
  initialAnalyses,
  natBalance,
  phoneVerified,
}: EpisodeDetailClientProps) {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-[1280px] gap-6 px-6 py-6">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <WorkSelector
            works={workOptions}
            currentId={String(workId)}
            onChange={(id) => router.push(`/works/${id}`)}
            size="md"
          />
          <EpisodeSelector
            workId={workId}
            currentEpisodeId={episodeId}
            episodes={episodeOptions}
            size="md"
          />
        </div>

        <AnalyzePanel
          workId={workId}
          episodeId={episodeId}
          episodeLabel={formatEpisodeLabel({
            episode_number: episodeNumber,
            title: episodeTitle,
          })}
          episodeTitle={episodeTitle}
          episodeNumber={episodeNumber}
          workTitle={workTitle}
          versions={versions}
          initialAnalyses={initialAnalyses}
          natBalance={natBalance}
          charCount={charCount}
          phoneVerified={phoneVerified}
        />

        <EpisodeBody body={body} charCount={charCount} />
      </div>
    </div>
  );
}
