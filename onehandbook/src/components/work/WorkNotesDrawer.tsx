"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpenText,
  ChevronDown,
  Edit3,
  Users,
  X,
} from "lucide-react";
import { Drawer } from "@/components/atoms/Drawer";
import { RoleBadge } from "@/components/atoms/RoleBadge";
import type {
  Character,
  CharacterSettings,
  WorldSetting,
} from "@/components/side-panel/types";

export interface WorkNoteMemo {
  episodeNumber: number;
  content: string;
  updatedAt: string;
}

interface WorkNotesDrawerProps {
  open: boolean;
  onClose: () => void;
  workId: string;
  worldSetting: WorldSetting;
  characterSettings: CharacterSettings;
  recentMemos: WorkNoteMemo[];
}

type Tab = "world" | "characters" | "memo";

/**
 * 작품 노트 Drawer — 시안 work.jsx WorkNotesDrawer 정합 (읽기 전용 참조 패널).
 *
 * 회차 작성 중 작가가 펼쳐서 세계관/인물/메모를 확인하는 단방향 표시 영역.
 * 편집은 작품 설정에서. Drawer 안의 `작품 설정 →` 링크가 단일 편집 진입점.
 */
export function WorkNotesDrawer({
  open,
  onClose,
  workId,
  worldSetting,
  characterSettings,
  recentMemos,
}: WorkNotesDrawerProps) {
  const [tab, setTab] = useState<Tab>("characters");

  return (
    <Drawer open={open} onClose={onClose} width={420} ariaLabel="작품 노트">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
            작품 자료
          </div>
          <div className="mt-0.5 font-serif text-[16px] text-stone-100">
            작품 노트
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-100"
          aria-label="작품 노트 닫기"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      <div className="mx-5 mb-1 flex items-center justify-between gap-3 rounded-md border border-stone-800/70 bg-stone-900/40 px-3 py-2 text-[11px] text-stone-400">
        <span>
          <span className="font-mono text-[9.5px] uppercase tracking-widest text-stone-500">
            읽기 전용
          </span>{" "}
          · 회차 작성 중 참조용
        </span>
        <Link
          href={`/works/${workId}/settings`}
          className="font-mono text-[10px] uppercase tracking-widest text-sky-300/85 hover:text-sky-200"
        >
          작품 설정 →
        </Link>
      </div>

      <div className="flex border-b border-stone-800/60">
        {(
          [
            { id: "world", label: "세계관", Icon: BookOpenText },
            { id: "characters", label: "인물", Icon: Users },
            { id: "memo", label: "메모", Icon: Edit3 },
          ] as const
        ).map(({ id, label, Icon }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[13.5px] transition-colors ${
                isActive ? "text-stone-100" : "text-stone-500 hover:text-stone-300"
              }`}
            >
              <Icon
                size={12}
                aria-hidden="true"
                className={isActive ? "text-sky-300" : ""}
              />
              <span className="font-serif">{label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-px bg-sky-400" />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === "world" && <WorldviewBody world={worldSetting} />}
        {tab === "characters" && (
          <CharactersBody characters={characterSettings ?? []} />
        )}
        {tab === "memo" && <MemoBody memos={recentMemos} />}
      </div>
    </Drawer>
  );
}

function WorldviewBody({ world }: { world: WorldSetting }) {
  if (!world || (!world.era && !world.background && !world.rules)) {
    return (
      <p className="font-serif text-[12.5px] leading-relaxed text-stone-500">
        세계관 설정이 비어 있습니다. 작품 설정에서 배경·시대·규칙을 추가할 수 있습니다.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">세계관</h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-stone-600">
          read only
        </span>
      </div>
      {world.background && (
        <div className="rounded-lg border border-stone-800/70 bg-stone-900/50 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
            배경
          </div>
          <p className="mt-2 whitespace-pre-wrap font-serif text-[12.5px] leading-relaxed text-stone-300">
            {world.background}
          </p>
        </div>
      )}
      {world.era && (
        <div className="rounded-lg border border-stone-800/70 bg-stone-900/50 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
            시대
          </div>
          <p className="mt-2 whitespace-pre-wrap font-serif text-[12.5px] leading-relaxed text-stone-300">
            {world.era}
          </p>
        </div>
      )}
      {world.rules && (
        <div className="rounded-lg border border-stone-800/70 bg-stone-900/50 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
            세계관 규칙
          </div>
          <p className="mt-2 whitespace-pre-wrap font-serif text-[12.5px] leading-relaxed text-stone-300">
            {world.rules}
          </p>
        </div>
      )}
    </div>
  );
}

function CharactersBody({ characters }: { characters: Character[] }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  if (characters.length === 0) {
    return (
      <p className="font-serif text-[12.5px] leading-relaxed text-stone-500">
        등록된 인물이 없습니다. 작품 설정에서 인물을 추가할 수 있습니다.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">
          인물{" "}
          <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
            {characters.length}
          </span>
        </h3>
        <button
          type="button"
          disabled
          className="flex items-center gap-1 rounded-md border border-stone-800/60 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-stone-600 opacity-60"
          title="편집은 작품 설정에서"
        >
          + 추가
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {characters.map((ch, i) => {
          const isOpen = expanded === i;
          const role = ch.role ?? "조연";
          return (
            <article
              key={`${ch.name}-${i}`}
              className="rounded-lg border border-stone-800/70 bg-stone-900/50 transition-colors hover:border-stone-700/80"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                aria-expanded={isOpen}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-[14px] text-stone-100">
                      {ch.name}
                    </span>
                    <RoleBadge role={role} />
                  </div>
                  {!isOpen && ch.summary && (
                    <div className="mt-0.5 line-clamp-1 text-[11.5px] text-stone-500">
                      {ch.summary}
                    </div>
                  )}
                </div>
                <ChevronDown
                  size={12}
                  aria-hidden="true"
                  className={`shrink-0 text-stone-500 transition-transform ${
                    isOpen ? "rotate-180 text-sky-300" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="border-t border-stone-800/60 px-4 py-3">
                  {ch.summary && (
                    <p className="font-serif text-[12.5px] leading-relaxed text-stone-300">
                      {ch.summary}
                    </p>
                  )}
                  <dl className="mt-3 grid grid-cols-[64px_1fr] gap-x-3 gap-y-2 text-[12px]">
                    {(
                      [
                        ["목표", ch.goals],
                        ["성격", ch.personality],
                        ["능력", ch.abilities],
                        ["관계", ch.relationships],
                      ] as const
                    )
                      .filter(([, v]) => Boolean(v))
                      .map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
                            {k}
                          </dt>
                          <dd className="whitespace-pre-wrap font-serif text-[12.5px] leading-relaxed text-stone-300">
                            {v}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MemoBody({ memos }: { memos: WorkNoteMemo[] }) {
  if (memos.length === 0) {
    return (
      <p className="font-serif text-[12.5px] leading-relaxed text-stone-500">
        등록된 회차 메모가 없습니다. 회차 편집 화면에서 메모를 작성할 수 있습니다.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">메모</h3>
        <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
          {memos.length}건
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {memos.map((m, i) => (
          <li
            key={`${m.episodeNumber}-${i}`}
            className="rounded-lg border border-stone-800/70 bg-stone-900/50 p-4"
          >
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-stone-500">
              <span>{m.episodeNumber}화 메모</span>
              <span>{m.updatedAt}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap font-serif text-[12.5px] leading-relaxed text-stone-300">
              {m.content}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
