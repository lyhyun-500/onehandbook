"use client";

import type { SidePanelTab } from "./useSidePanelState";

export function SidePanelTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
}) {
  const tabs: { id: SidePanelTab; label: string }[] = [
    { id: "worldview", label: "세계관" },
    { id: "characters", label: "인물" },
    { id: "memo", label: "메모" },
  ];

  return (
    <div className="flex shrink-0 border-b border-zinc-800">
      {tabs.map(({ id, label }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-b-2 border-cyan-500/80 bg-zinc-900 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
