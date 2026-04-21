"use client";

import { SidePanelTabs } from "./SidePanelTabs";
import { SidePanelContent } from "./SidePanelContent";
import type { SidePanelTab } from "./useSidePanelState";
import type { CharacterSettings, WorldSetting } from "./types";

export function SidePanel({
  workId,
  episodeId,
  episodeNumber,
  worldSetting,
  characterSettings,
  activeTab,
  onTabChange,
  onClose,
}: {
  workId: number;
  episodeId: number;
  episodeNumber: number;
  worldSetting: WorldSetting;
  characterSettings: CharacterSettings;
  activeTab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  onClose: () => void;
}) {
  return (
    <aside className="flex h-full min-h-0 w-[400px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      <SidePanelTabs activeTab={activeTab} onTabChange={onTabChange} />
      <SidePanelContent
        activeTab={activeTab}
        workId={workId}
        episodeId={episodeId}
        episodeNumber={episodeNumber}
        worldSetting={worldSetting}
        characterSettings={characterSettings}
      />
      <div className="shrink-0 border-t border-zinc-800 p-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          ◀ 접기
        </button>
      </div>
    </aside>
  );
}
