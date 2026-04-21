"use client";

import { useEffect, useState } from "react";
import type { SidePanelTab } from "./useSidePanelState";
import type { CharacterSettings, WorldSetting } from "./types";
import { WorldviewTab } from "./WorldviewTab";
import { CharactersTab } from "./CharactersTab";
import { MemoTab } from "./MemoTab";

export function SidePanelContent({
  activeTab,
  workId,
  episodeId,
  episodeNumber,
  worldSetting,
  characterSettings,
}: {
  activeTab: SidePanelTab;
  workId: number;
  episodeId: number;
  episodeNumber: number;
  worldSetting: WorldSetting;
  characterSettings: CharacterSettings;
}) {
  const [worldDirty, setWorldDirty] = useState(false);
  const [charDirty, setCharDirty] = useState(false);

  useEffect(() => {
    if (!worldDirty && !charDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [worldDirty, charDirty]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* 세계관·인물은 탭 전환 시에도 마운트 유지 → 미저장 상태·beforeunload 유지 */}
      <div
        className={
          activeTab === "worldview"
            ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
            : "hidden"
        }
        aria-hidden={activeTab !== "worldview"}
      >
        <WorldviewTab
          workId={workId}
          worldSetting={worldSetting}
          onDirtyChange={setWorldDirty}
        />
      </div>
      <div
        className={
          activeTab === "characters"
            ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
            : "hidden"
        }
        aria-hidden={activeTab !== "characters"}
      >
        <CharactersTab
          workId={workId}
          characterSettings={characterSettings}
          onDirtyChange={setCharDirty}
        />
      </div>
      {activeTab === "memo" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
          <MemoTab episodeId={episodeId} episodeNumber={episodeNumber} />
        </div>
      )}
    </div>
  );
}
