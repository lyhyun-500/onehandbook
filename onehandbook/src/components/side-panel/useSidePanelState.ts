"use client";

import { useCallback, useEffect, useState } from "react";

export type SidePanelTab = "worldview" | "characters" | "memo";

const STORAGE_OPEN = "side-panel-open";
const STORAGE_TAB = "side-panel-tab";

function readStoredOpen(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_OPEN);
  if (v === null) return true;
  return v === "true";
}

function readStoredTab(): SidePanelTab {
  if (typeof window === "undefined") return "worldview";
  const v = localStorage.getItem(STORAGE_TAB);
  if (v === "worldview" || v === "characters" || v === "memo") return v;
  return "worldview";
}

export function useSidePanelState(): {
  isOpen: boolean;
  activeTab: SidePanelTab;
  toggle: () => void;
  setTab: (tab: SidePanelTab) => void;
} {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidePanelTab>("worldview");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsOpen(readStoredOpen());
    setActiveTab(readStoredTab());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    localStorage.setItem(STORAGE_OPEN, String(isOpen));
  }, [isOpen, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    localStorage.setItem(STORAGE_TAB, activeTab);
  }, [activeTab, hydrated]);

  const toggle = useCallback(() => {
    setIsOpen((o) => !o);
  }, []);

  const setTab = useCallback((tab: SidePanelTab) => {
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { isOpen, activeTab, toggle, setTab };
}
