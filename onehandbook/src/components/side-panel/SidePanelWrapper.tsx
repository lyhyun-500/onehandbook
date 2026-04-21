"use client";

import { SidePanel } from "./SidePanel";
import { useSidePanelState } from "./useSidePanelState";
import type { CharacterSettings, WorldSetting } from "./types";

/** 헤더(대략) + 여백 — sticky 패널 높이·top 정렬용 */
const HEADER_OFFSET_CLASS = "top-[4.75rem] h-[calc(100vh-4.75rem)] max-h-[calc(100vh-4.75rem)]";

export function SidePanelWrapper({
  workId,
  episodeId,
  episodeNumber,
  worldSetting,
  characterSettings,
}: {
  workId: number;
  episodeId: number;
  episodeNumber: number;
  worldSetting: WorldSetting;
  characterSettings: CharacterSettings;
}) {
  const { isOpen, activeTab, toggle, setTab } = useSidePanelState();

  if (!isOpen) {
    return (
      <div
        className={`sticky ${HEADER_OFFSET_CLASS} z-20 flex shrink-0 flex-col items-start overflow-hidden border-r border-zinc-800 bg-zinc-900/90 p-2`}
      >
        <button
          type="button"
          onClick={toggle}
          className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="사이드 패널 열기"
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <div
      className={`sticky ${HEADER_OFFSET_CLASS} z-20 flex shrink-0 flex-col self-start overflow-hidden`}
    >
      <SidePanel
        workId={workId}
        episodeId={episodeId}
        episodeNumber={episodeNumber}
        worldSetting={worldSetting}
        characterSettings={characterSettings}
        activeTab={activeTab}
        onTabChange={setTab}
        onClose={toggle}
      />
    </div>
  );
}
