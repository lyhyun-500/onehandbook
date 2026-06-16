"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Trash2, X } from "lucide-react";
import { Drawer } from "@/components/atoms/Drawer";
import { RoleBadge } from "@/components/atoms/RoleBadge";
import { createClient } from "@/lib/supabase/client";
import {
  emptyCharacterRow,
  makeCharactersWithKeys,
  stripCharacterKey,
} from "@/components/side-panel/characterModel";
import type {
  CharacterSettings,
  CharacterWithKey,
  WorldSetting,
} from "@/components/side-panel/types";

const MEMO_DEBOUNCE_MS = 1000;
const SAVE_FLASH_MS = 3000;
const ROLE_OPTIONS = ["주인공", "조연", "악역", "단역"] as const;

type Tab = "world" | "characters" | "memo";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  workId: number;
  /**
   * 단계 D-fixup-4 (분기 X-5-α + δ 통합): 새 회차 mode 시 null 정합.
   * memo tab = episodeId null 시 비활성 + 안내 (MemoBody UPSERT 사양 정합).
   * world / characters tab = episodeId 무관 (works UPDATE 사양 영속화 정합).
   */
  episodeId: number | null;
  episodeNumber: number;
  initialWorld: WorldSetting;
  initialCharacters: CharacterSettings;
  /** dirty 상태 변경 알림 — 에디터의 floating 설정 버튼이 amber ping dot 표시용. */
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}

interface CharacterCardStatus {
  invalid: boolean;
  dirty: boolean;
}

/**
 * 회차 편집 우측 호출형 Drawer — 시안 episode-edit.jsx SettingsDrawer 정합.
 *
 * D-16 통합 저장:
 * - `전체 저장` 푸터 1버튼 → works.update({world_setting, character_settings}) 1회 원자 저장
 * - invalid 인물(이름 비어있음) 1+ 시 저장 전체 차단 — 부분 저장 금지 (원자성 유지)
 * - 차단 시 입력 상태 그대로 보존, 어떤 카드가 문제인지 카드·푸터에 명시
 *
 * D-17 memo:
 * - episode_memos 운영 단일 메모 유지 (시안 다건 mock 폐기)
 * - 자동저장(1초 debounce). 통합 저장에 미포함 — 독립 동작
 */
export function SettingsDrawer({
  open,
  onClose,
  workId,
  episodeId,
  episodeNumber,
  initialWorld,
  initialCharacters,
  onUnsavedChange,
}: SettingsDrawerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("characters");
  const supabase = useMemo(() => createClient(), []);

  // 세계관 상태
  // F-D 정정 (LEE 묶음2): useRef → useState 로 변경.
  // useRef 였을 때 저장 성공 후 ref.current 갱신해도 useMemo deps 가 [era,rules,background] 만이라
  // dirty 가 stale 비교로 true 잔존하던 버그. useState 로 변경 + useMemo deps 에 포함.
  const [worldInitial, setWorldInitial] = useState({
    era: initialWorld?.era ?? "",
    rules: initialWorld?.rules ?? "",
    background: initialWorld?.background ?? "",
  });
  const [era, setEra] = useState(worldInitial.era);
  const [rules, setRules] = useState(worldInitial.rules);
  const [background, setBackground] = useState(worldInitial.background);

  // 인물 상태
  // J-C 정정 (LEE 라운드2): useEffect 채움 패턴이 첫 렌더 시점 initialCharsByKey 비어있게 만들어
  // characterStatuses 가 모든 카드 dirty=true 계산 → 사용자 미수정 상태에서 amber 잔존.
  // useMemo lazy init 으로 characters + initialCharsByKey 둘 다 첫 렌더 시점 동기.
  const initialCharsBundle = useMemo(() => {
    const list = makeCharactersWithKeys(initialCharacters);
    const map = new Map<string, string>();
    list.forEach((c) => {
      map.set(c._key, JSON.stringify(stripCharacterKey(c)));
    });
    return { list, map };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount 시 1회 — props 변경 시에는 Drawer atom 이 unmount/remount 처리
  const [characters, setCharacters] = useState<CharacterWithKey[]>(
    initialCharsBundle.list,
  );
  const initialCharsByKey = useRef<Map<string, string>>(initialCharsBundle.map);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const characterStatuses = useMemo<Map<string, CharacterCardStatus>>(() => {
    const map = new Map<string, CharacterCardStatus>();
    characters.forEach((c) => {
      const invalid = !c.name.trim();
      const snapshot = initialCharsByKey.current.get(c._key);
      const current = JSON.stringify(stripCharacterKey(c));
      const dirty = snapshot === undefined || snapshot !== current;
      map.set(c._key, { invalid, dirty });
    });
    return map;
  }, [characters]);

  const invalidCount = useMemo(
    () =>
      [...characterStatuses.values()].filter((s) => s.invalid).length,
    [characterStatuses],
  );

  const worldDirty = useMemo(
    () =>
      era !== worldInitial.era ||
      rules !== worldInitial.rules ||
      background !== worldInitial.background,
    [era, rules, background, worldInitial],
  );

  const charactersDirty = useMemo(() => {
    if (characters.length !== initialCharsByKey.current.size) return true;
    return [...characterStatuses.values()].some((s) => s.dirty);
  }, [characters, characterStatuses]);

  const hasUnsaved = worldDirty || charactersDirty;

  useEffect(() => {
    onUnsavedChange?.(hasUnsaved);
  }, [hasUnsaved, onUnsavedChange]);

  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; at: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const saveFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveFlashRef.current) clearTimeout(saveFlashRef.current);
    };
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (invalidCount > 0) return; // D-16: invalid 시 차단
    setSaveState({ kind: "saving" });
    try {
      const valid = characters
        .filter((c) => c.name.trim())
        .map(stripCharacterKey);
      const payload = {
        world_setting: {
          era: era.trim() || undefined,
          rules: rules.trim() || undefined,
          background: background.trim() || undefined,
        },
        character_settings: valid,
      };
      const { error } = await supabase
        .from("works")
        .update(payload)
        .eq("id", workId);
      if (error) throw error;

      // 세계관·인물 저장 후 server component props 갱신 (lore 추출 stale 판정 방지)
      router.refresh();

      setWorldInitial({ era, rules, background });
      initialCharsByKey.current.clear();
      characters.forEach((c) => {
        initialCharsByKey.current.set(
          c._key,
          JSON.stringify(stripCharacterKey(c)),
        );
      });
      // 상태 재계산 트리거
      setCharacters((prev) => [...prev]);
      const at = Date.now();
      setSaveState({ kind: "saved", at });
      if (saveFlashRef.current) clearTimeout(saveFlashRef.current);
      saveFlashRef.current = setTimeout(() => {
        setSaveState((s) =>
          s.kind === "saved" && s.at === at ? { kind: "idle" } : s,
        );
      }, SAVE_FLASH_MS);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "저장 실패";
      setSaveState({ kind: "error", message });
    }
  }, [supabase, workId, era, rules, background, characters, invalidCount]);

  // 인물 조작
  const updateCharacter = (key: string, patch: Partial<CharacterWithKey>) => {
    setCharacters((prev) =>
      prev.map((c) => (c._key === key ? { ...c, ...patch } : c)),
    );
  };
  const addCharacter = () => {
    const row = emptyCharacterRow();
    setCharacters((prev) => [...prev, row]);
    setExpandedKey(row._key);
  };
  const removeCharacter = (key: string) => {
    setCharacters((prev) => prev.filter((c) => c._key !== key));
    setExpandedKey((prev) => (prev === key ? null : prev));
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={420}
      ariaLabel="회차 설정"
    >
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
            회차 설정
          </div>
          <div className="mt-0.5 font-serif text-[16px] text-stone-100">
            세계관·인물·메모
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-100"
          aria-label="설정 패널 닫기"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      <div className="flex border-b border-stone-800/60">
        {(
          [
            { id: "world", label: "세계관" },
            { id: "characters", label: "인물" },
            { id: "memo", label: "메모" },
          ] as const
        ).map(({ id, label }) => {
          const isActive = tab === id;
          // 단계 D-fixup-4: memo tab = episodeId null 시 비활성 (MemoBody UPSERT 정합).
          const isMemoDisabled = id === "memo" && episodeId == null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (isMemoDisabled) return;
                setTab(id);
              }}
              disabled={isMemoDisabled}
              title={
                isMemoDisabled
                  ? "회차 등록 후 메모를 사용할 수 있습니다."
                  : undefined
              }
              className={`relative flex-1 py-3.5 text-center font-serif text-[14px] transition-colors ${
                isMemoDisabled
                  ? "cursor-not-allowed text-stone-700"
                  : isActive
                    ? "text-stone-100"
                    : "text-stone-500 hover:text-stone-300"
              }`}
            >
              {label}
              {isActive && !isMemoDisabled && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-px bg-sky-400" />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className={tab === "world" ? "flex flex-col gap-4" : "hidden"}>
          <WorldBody
            era={era}
            setEra={setEra}
            rules={rules}
            setRules={setRules}
            background={background}
            setBackground={setBackground}
          />
        </div>
        <div className={tab === "characters" ? "flex flex-col gap-3" : "hidden"}>
          <CharactersBody
            characters={characters}
            statuses={characterStatuses}
            expandedKey={expandedKey}
            onToggle={(k) =>
              setExpandedKey((prev) => (prev === k ? null : k))
            }
            onPatch={updateCharacter}
            onAdd={addCharacter}
            onDelete={removeCharacter}
          />
        </div>
        {tab === "memo" && episodeId != null && (
          <MemoBody episodeId={episodeId} episodeNumber={episodeNumber} />
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-stone-800/70 bg-stone-950/90 px-5 py-3.5">
        <div className="font-mono text-[10.5px] tracking-wide">
          {invalidCount > 0 ? (
            <span className="text-rose-300/90">
              · {invalidCount}개 인물 카드 수정 필요(이름)
            </span>
          ) : hasUnsaved ? (
            <span className="text-amber-300/80">· 미저장 변경 있음</span>
          ) : saveState.kind === "saved" ? (
            <span className="text-stone-500">· 저장됨</span>
          ) : saveState.kind === "error" ? (
            <span className="text-rose-300/90">· 저장 실패</span>
          ) : (
            <span className="text-stone-600">&nbsp;</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-[12px] text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-200"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={
              invalidCount > 0 ||
              !hasUnsaved ||
              saveState.kind === "saving"
            }
            onClick={() => void handleSaveAll()}
            className="rounded-md bg-sky-500 px-3.5 py-2 text-[12px] font-medium text-stone-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveState.kind === "saving" ? "저장 중..." : "전체 저장"}
          </button>
        </div>
      </footer>

      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9.5px] uppercase tracking-widest text-stone-700">
        ESC 또는 바깥 클릭으로 닫기
      </div>
    </Drawer>
  );
}

function WorldBody({
  era,
  setEra,
  rules,
  setRules,
  background,
  setBackground,
}: {
  era: string;
  setEra: (s: string) => void;
  rules: string;
  setRules: (s: string) => void;
  background: string;
  setBackground: (s: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">세계관</h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
          global
        </span>
      </div>
      <Section label="배경">
        <textarea
          rows={3}
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          placeholder="지역, 무대, 세계의 큰 그림"
          className="w-full resize-none bg-transparent font-serif text-[13px] leading-relaxed text-stone-200 placeholder:text-stone-600 focus:outline-none"
        />
      </Section>
      <Section label="시대">
        <textarea
          rows={2}
          value={era}
          onChange={(e) => setEra(e.target.value)}
          placeholder="현대, 조선, 다른 차원의 연도 체계 등"
          className="w-full resize-none bg-transparent font-serif text-[13px] leading-relaxed text-stone-200 placeholder:text-stone-600 focus:outline-none"
        />
      </Section>
      <Section label="세계관 규칙">
        <textarea
          rows={4}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder="마법, 시스템, 금지 사항, 사회 구조 등"
          className="w-full resize-none bg-transparent font-serif text-[13px] leading-relaxed text-stone-200 placeholder:text-stone-600 focus:outline-none"
        />
      </Section>
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-stone-800/70 bg-stone-900/50 p-4">
      <label className="block font-mono text-[10px] uppercase tracking-widest text-stone-500">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function CharactersBody({
  characters,
  statuses,
  expandedKey,
  onToggle,
  onPatch,
  onAdd,
  onDelete,
}: {
  characters: CharacterWithKey[];
  statuses: Map<string, CharacterCardStatus>;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onPatch: (key: string, patch: Partial<CharacterWithKey>) => void;
  onAdd: () => void;
  onDelete: (key: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">인물</h3>
        <span className="font-mono text-[10px] tabular-nums text-stone-500">
          {characters.length}건
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {characters.map((c) => {
          const status = statuses.get(c._key);
          const expanded = expandedKey === c._key;
          const role = c.role || "조연";
          const isKnownRole = ROLE_OPTIONS.some((r) => r === role);
          return (
            <article
              key={c._key}
              className={`rounded-lg border bg-stone-900/50 transition-colors ${
                status?.invalid
                  ? "border-rose-500/40"
                  : "border-stone-800/70 hover:border-stone-700/80"
              }`}
            >
              <header className="flex min-w-0 items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => onToggle(c._key)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-500 transition-colors hover:bg-stone-800/60 hover:text-stone-200 ${expanded ? "rotate-90 text-sky-300" : ""}`}
                  aria-label={expanded ? "접기" : "펼치기"}
                >
                  <ChevronRight size={11} aria-hidden="true" />
                </button>
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => onPatch(c._key, { name: e.target.value })}
                  placeholder="이름"
                  className="min-w-0 flex-1 bg-transparent font-serif text-[14px] text-stone-100 placeholder:text-rose-400/70 focus:outline-none"
                />
                <RoleBadge role={role} />
                <select
                  value={role}
                  onChange={(e) => onPatch(c._key, { role: e.target.value })}
                  className="max-w-[80px] shrink-0 appearance-none rounded-sm bg-transparent font-mono text-[10px] uppercase tracking-widest text-stone-500 focus:outline-none"
                  aria-label={`${c.name || "인물"} 역할 선택`}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r} className="bg-stone-900">
                      {r}
                    </option>
                  ))}
                  {!isKnownRole && (
                    <option
                      value={role}
                      disabled
                      className="bg-stone-900 text-stone-500"
                    >
                      {role} (사용 중단)
                    </option>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => onDelete(c._key)}
                  className="ml-1 inline-flex shrink-0 items-center gap-1 rounded border border-rose-400/30 bg-rose-400/[0.06] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-rose-300/90 hover:bg-rose-400/[0.14] hover:text-rose-200"
                  aria-label="인물 삭제"
                >
                  <Trash2 size={10} aria-hidden="true" />
                  삭제
                </button>
              </header>
              {status?.invalid && (
                <div className="px-4 pb-2 -mt-1 font-mono text-[10.5px] tracking-wide text-rose-300/85">
                  · 이름이 비어 있어 저장되지 않습니다
                </div>
              )}
              {expanded && (
                <div className="space-y-3 border-t border-stone-800/60 px-4 py-3">
                  <SubField
                    label="요약"
                    value={c.summary ?? ""}
                    onChange={(v) => onPatch(c._key, { summary: v })}
                    rows={2}
                  />
                  <SubField
                    label="목표"
                    value={c.goals ?? ""}
                    onChange={(v) => onPatch(c._key, { goals: v })}
                    rows={2}
                  />
                  <SubField
                    label="성격"
                    value={c.personality ?? ""}
                    onChange={(v) => onPatch(c._key, { personality: v })}
                    rows={2}
                  />
                  <SubField
                    label="능력"
                    value={c.abilities ?? ""}
                    onChange={(v) => onPatch(c._key, { abilities: v })}
                    rows={2}
                  />
                  <SubField
                    label="관계"
                    value={c.relationships ?? ""}
                    onChange={(v) => onPatch(c._key, { relationships: v })}
                    rows={2}
                  />
                </div>
              )}
            </article>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-700 bg-stone-900/30 px-4 py-3 text-[12.5px] text-stone-400 hover:border-sky-400/40 hover:text-sky-200"
        >
          <Plus size={11} aria-hidden="true" />
          인물 추가
        </button>
      </div>
    </>
  );
}

function SubField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-stone-500">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full resize-none bg-transparent font-serif text-[12.5px] leading-relaxed text-stone-200 placeholder:text-stone-600 focus:outline-none"
      />
    </div>
  );
}

function MemoBody({
  episodeId,
  episodeNumber,
}: {
  episodeId: number;
  episodeNumber: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; at: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("episode_memos")
          .select("content")
          .eq("episode_id", episodeId)
          .maybeSingle();
        if (cancelled) return;
        setContent(typeof data?.content === "string" ? data.content : "");
      } catch {
        if (!cancelled) {
          setSaveState({ kind: "error", message: "메모 로드 실패" });
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episodeId, supabase]);

  const persist = useCallback(async () => {
    const text = contentRef.current;
    setSaveState({ kind: "saving" });
    try {
      const { error } = await supabase
        .from("episode_memos")
        .upsert(
          {
            episode_id: episodeId,
            content: text,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "episode_id" },
        );
      if (error) throw error;
      const at = Date.now();
      setSaveState({ kind: "saved", at });
      if (successHideRef.current) clearTimeout(successHideRef.current);
      successHideRef.current = setTimeout(() => {
        setSaveState((s) =>
          s.kind === "saved" && s.at === at ? { kind: "idle" } : s,
        );
      }, SAVE_FLASH_MS);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "저장 실패";
      setSaveState({ kind: "error", message });
    }
  }, [episodeId, supabase]);

  const onChange = (next: string) => {
    setContent(next);
    if (!loaded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void persist();
    }, MEMO_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (successHideRef.current) clearTimeout(successHideRef.current);
    };
  }, []);

  let statusLine: string | null = null;
  if (saveState.kind === "saving") statusLine = "자동 저장 중...";
  else if (saveState.kind === "saved") statusLine = "자동 저장됨 · 방금 전";
  else if (saveState.kind === "error")
    statusLine = `저장 실패: ${saveState.message}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">
          {episodeNumber === 0 ? "프롤로그 메모" : `${episodeNumber}화 메모`}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
          자동 저장
        </span>
      </div>
      <div className="rounded-lg border border-stone-800/70 bg-stone-900/50 p-4">
        <textarea
          rows={10}
          value={content}
          disabled={!loaded}
          onChange={(e) => onChange(e.target.value)}
          placeholder="이 회차에 대한 메모를 자유롭게 적어보세요."
          className="w-full resize-none bg-transparent font-serif text-[13px] leading-relaxed text-stone-200 placeholder:text-stone-600 focus:outline-none disabled:opacity-60"
        />
      </div>
      {statusLine && (
        <p
          className={`font-mono text-[10.5px] tracking-wide ${
            saveState.kind === "error"
              ? "text-rose-300/90"
              : "text-stone-500"
          }`}
        >
          · {statusLine}
        </p>
      )}
    </div>
  );
}
