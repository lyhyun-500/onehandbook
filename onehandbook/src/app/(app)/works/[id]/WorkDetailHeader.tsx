"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Settings, Sparkles } from "lucide-react";
import { WorkSelector, type WorkOption } from "@/components/atoms/WorkSelector";
import { GenreTag } from "@/components/atoms/GenreTag";
import { StatusDot } from "@/components/atoms/StatusDot";
import {
  BatchAnalyzeModal,
  type BatchAnalyzeEpisode,
} from "@/components/work/BatchAnalyzeModal";
import {
  WorkNotesDrawer,
  type WorkNoteMemo,
} from "@/components/work/WorkNotesDrawer";
import type {
  CharacterSettings,
  WorldSetting,
} from "@/components/side-panel/types";

interface WorkDetailHeaderProps {
  workId: string;
  works: WorkOption[];
  genre: string;
  status: string;
  totalEpisodes: number;
  synopsis: string | null;
  /** 일괄 통합 분석 모달용 — 작품 회차 전체. */
  batchEpisodes: BatchAnalyzeEpisode[];
  natBalance: number;
  agentVersion: string;
  /** 작품 노트 Drawer 용 (F-A 정정: 헤더 액션 라인 최우측 통합). */
  worldSetting: WorldSetting;
  characterSettings: CharacterSettings;
  recentMemos: WorkNoteMemo[];
}

/**
 * 작품 상세 헤더 — WorkSelector md + 메타 + 시놉시스 + 4액션 (+ Modal/Drawer 통합).
 *
 * F-A 정정 (LEE 묶음1 1-6/1-7): 작품 노트 버튼이 TopBar actions 가 아닌 본 헤더의
 * 4번째 액션(작품 설정 옆 최우측)에 박힘. Drawer 모달 패턴 (Drawer atom `if(!open) return null`).
 */
export function WorkDetailHeader({
  workId,
  works,
  genre,
  status,
  totalEpisodes,
  synopsis,
  batchEpisodes,
  natBalance,
  agentVersion,
  worldSetting,
  characterSettings,
  recentMemos,
}: WorkDetailHeaderProps) {
  const router = useRouter();
  const [batchOpen, setBatchOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  return (
    <>
      <header className="mb-8">
        <WorkSelector
          works={works}
          currentId={workId}
          size="md"
          onChange={(id) => router.push(`/works/${id}`)}
        />
        <div className="mt-3 flex items-center gap-2">
          <GenreTag genre={genre} />
          <span className="flex items-center gap-1.5 text-[11.5px] text-stone-400">
            <StatusDot status={status} />
            {status}
          </span>
          <span className="text-[11.5px] text-stone-500">
            · {totalEpisodes}화
          </span>
        </div>
        {synopsis && (
          <p className="mt-2 max-w-2xl whitespace-pre-wrap font-serif text-[13.5px] leading-relaxed text-stone-400">
            {synopsis}
          </p>
        )}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBatchOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/[0.10] px-3.5 py-2 text-[12.5px] font-medium text-sky-100 hover:bg-sky-400/[0.16]"
          >
            <Sparkles size={13} aria-hidden="true" />
            일괄 통합 분석
          </button>
          <button
            type="button"
            onClick={() => router.push(`/works/${workId}/episodes/new`)}
            className="flex items-center gap-1.5 rounded-md border border-stone-800/80 bg-stone-900/40 px-3.5 py-2 text-[12.5px] text-stone-300 hover:border-stone-700 hover:text-stone-100"
          >
            <Plus size={13} aria-hidden="true" />
            새 회차
          </button>
          <button
            type="button"
            onClick={() => router.push(`/works/${workId}/settings`)}
            className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12.5px] text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-200"
          >
            <Settings size={13} aria-hidden="true" />
            작품 설정
          </button>
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12.5px] text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-200"
            aria-label="작품 노트 열기"
          >
            <FileText size={13} aria-hidden="true" />
            작품 노트
          </button>
        </div>
      </header>

      <BatchAnalyzeModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        workId={Number(workId)}
        episodes={batchEpisodes}
        natBalance={natBalance}
        agentVersion={agentVersion}
      />

      <WorkNotesDrawer
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        workId={workId}
        worldSetting={worldSetting}
        characterSettings={characterSettings}
        recentMemos={recentMemos}
      />
    </>
  );
}
