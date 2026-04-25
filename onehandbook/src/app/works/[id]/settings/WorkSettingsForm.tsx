"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TagInput } from "@/components/TagInput";
import {
  CHARACTER_ROLES,
  emptyCharacter,
  type CharacterSetting,
  type WorldSetting,
} from "@/lib/works/loreTypes";
import {
  SIDEPANEL_CHARACTER_ROLES,
  normalizeRoleForSidePanel,
} from "@/components/side-panel/types";

const GENRES = [
  "로맨스",
  "판타지",
  "현대",
  "무협",
  "스포츠",
  "미스터리",
  "SF",
  "일상",
  "기타",
];

const STATUSES = ["연재중", "완결", "휴재"] as const;

type CardStatus = "clean" | "dirty" | "invalid";

function getCardStatus(
  current: CharacterSetting,
  initial: CharacterSetting | undefined
): CardStatus {
  if (!current.name.trim()) return "invalid";
  if (initial === undefined) return "dirty";

  const changed =
    current.name !== initial.name ||
    current.role !== initial.role ||
    current.personality !== initial.personality ||
    current.abilities !== initial.abilities ||
    current.goals !== initial.goals ||
    current.relationships !== initial.relationships;

  return changed ? "dirty" : "clean";
}

function cardBorderClass(status: CardStatus): string {
  if (status === "dirty") return "border-blue-500";
  if (status === "invalid") return "border-yellow-500";
  return "border-zinc-800";
}

export function WorkSettingsForm({
  workId,
  initialTitle,
  initialGenre,
  initialStatus,
  initialContractStatus,
  initialManagementOfferOptIn,
  initialTags,
  initialWorld,
  initialCharacters,
}: {
  workId: number;
  initialTitle: string;
  initialGenre: string;
  initialStatus: string;
  initialContractStatus: "미계약" | "계약";
  initialManagementOfferOptIn: boolean;
  initialTags: string[];
  initialWorld: WorldSetting;
  initialCharacters: CharacterSetting[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [genre, setGenre] = useState(initialGenre);
  const [status, setStatus] = useState<"연재중" | "완결" | "휴재">(
    initialStatus as "연재중" | "완결" | "휴재"
  );
  const [contractStatus, setContractStatus] = useState<"미계약" | "계약">(
    initialContractStatus
  );
  const [managementOfferOptIn, setManagementOfferOptIn] = useState<boolean>(
    Boolean(initialManagementOfferOptIn)
  );
  const [tags, setTags] = useState<string[]>(
    Array.isArray(initialTags) ? initialTags.filter((t) => typeof t === "string") : []
  );
  const [worldBackground, setWorldBackground] = useState(
    initialWorld.background
  );
  const [worldEra, setWorldEra] = useState(initialWorld.era);
  const [worldRules, setWorldRules] = useState(initialWorld.rules);
  const [characters, setCharacters] = useState<CharacterSetting[]>(
    initialCharacters.length > 0 ? initialCharacters : []
  );
  const initialCharactersRef = useRef<CharacterSetting[]>(initialCharacters);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const tagsNormalized = useMemo(() => {
    const uniq = new Map<string, string>();
    for (const raw of tags) {
      const t = String(raw ?? "").trim();
      if (!t) continue;
      const noHash = t.replace(/^#+/, "").trim();
      if (!noHash) continue;
      const key = noHash.toLowerCase();
      if (!uniq.has(key)) uniq.set(key, noHash);
    }
    return [...uniq.values()].slice(0, 20);
  }, [tags]);

  const addCharacter = () => {
    setCharacters((prev) => [...prev, emptyCharacter()]);
    setExpandedIndex(characters.length);
  };

  const removeCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
    setExpandedIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };

  const updateCharacter = (
    index: number,
    patch: Partial<CharacterSetting>
  ) => {
    setCharacters((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const world_setting: WorldSetting = {
      background: worldBackground.trim(),
      era: worldEra.trim(),
      rules: worldRules.trim(),
    };

    const character_settings = characters
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        role: c.role.trim() || "주인공",
        personality: c.personality.trim(),
        abilities: c.abilities.trim(),
        goals: c.goals.trim(),
        relationships: c.relationships.trim(),
      }));

    try {
      const { error } = await supabase
        .from("works")
        .update({
          title,
          genre,
          status,
          contract_status: contractStatus,
          management_offer_opt_in: managementOfferOptIn,
          tags: tagsNormalized,
          world_setting,
          character_settings,
        })
        .eq("id", workId);

      if (error) throw error;

      router.push(`/works/${workId}`);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "저장에 실패했습니다. 다시 시도해주세요.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
    >
      <div className="space-y-10">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">기본 정보</h2>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="작품 제목"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              장르
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              연재 상태
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "연재중" | "완결" | "휴재")
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              계약 여부
            </label>
            <select
              value={contractStatus}
              onChange={(e) => setContractStatus(e.target.value as "미계약" | "계약")}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="미계약">미계약</option>
              <option value="계약">계약</option>
            </select>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-4 py-3">
            <label
              className="flex cursor-pointer items-start gap-3 text-sm text-zinc-400"
              aria-disabled="true"
            >
              <input
                type="checkbox"
                checked={managementOfferOptIn}
                onChange={(e) => setManagementOfferOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-amber-600 opacity-80"
              />
              <span className="leading-snug">
                매니지먼트 계약 제의를 받겠습니다 (현재 서비스 개발 중)
              </span>
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              태그
            </label>
            <p className="mb-2 text-sm text-zinc-500">
              엔터로 추가하고, 칩의 ×로 삭제합니다. 예: #회귀물 #먼치킨 #전문직
            </p>
            <TagInput value={tags} onChange={setTags} />
          </div>
        </div>

        <div className="space-y-4 border-t border-zinc-800 pt-8">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              세계관 설정
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              AI 분석 시 원고와 함께 전달됩니다. 배경·시대·규칙을 자유롭게
              적어 주세요.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              배경
            </label>
            <textarea
              value={worldBackground}
              onChange={(e) => setWorldBackground(e.target.value)}
              rows={3}
              placeholder="지역, 무대, 세계의 큰 그림 등"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              시대
            </label>
            <textarea
              value={worldEra}
              onChange={(e) => setWorldEra(e.target.value)}
              rows={2}
              placeholder="현대, 조선, 다른 차원의 연도 체계 등"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              세계관 규칙
            </label>
            <textarea
              value={worldRules}
              onChange={(e) => setWorldRules(e.target.value)}
              rows={4}
              placeholder="마법, 시스템, 금지 사항, 사회 구조 등"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-zinc-800 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                인물 설정
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                이름이 있는 행만 저장됩니다. 분석 시 캐릭터 일관성·관계 활용도에
                반영됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={addCharacter}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              인물 추가
            </button>
          </div>

          {characters.length === 0 ? (
            <p className="text-sm text-zinc-500">
              등록된 인물이 없습니다. 「인물 추가」로 입력해 주세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {characters.map((c, index) => (
                <CharacterAccordionCard
                  key={index}
                  index={index}
                  character={c}
                  initial={initialCharactersRef.current[index]}
                  open={expandedIndex === index}
                  onToggle={() => toggleExpand(index)}
                  onRemove={() => removeCharacter(index)}
                  onPatch={(patch) => updateCharacter(index, patch)}
                />
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3 border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-700 px-6 py-2.5 text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-amber-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </form>
  );
}

function CharacterAccordionCard({
  index,
  character,
  initial,
  open,
  onToggle,
  onRemove,
  onPatch,
}: {
  index: number;
  character: CharacterSetting;
  initial: CharacterSetting | undefined;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onPatch: (patch: Partial<CharacterSetting>) => void;
}) {
  const status = getCardStatus(character, initial);
  const border = cardBorderClass(status);
  const label = character.name.trim() || `인물 ${index + 1}`;
  const sub = character.role ? ` · ${character.role}` : "";

  return (
    <li className={`overflow-hidden rounded-lg border bg-zinc-950/40 ${border}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm text-zinc-200"
        >
          <span className="min-w-0 truncate">
            <span className="text-zinc-500">{open ? "▼" : "▶"}</span>{" "}
            <span className="font-medium">{label}</span>
            <span className="text-zinc-500">{sub}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            {status === "dirty" ? (
              <span className="text-xs text-blue-400">수정됨</span>
            ) : null}
            {status === "invalid" ? (
              <span className="text-xs text-yellow-400">이름 필요</span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
        >
          🗑 삭제
        </button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-zinc-800/80 px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs text-zinc-500">이름</label>
              <input
                type="text"
                value={character.name}
                onChange={(e) => onPatch({ name: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs text-zinc-500">역할</label>
              <select
                value={normalizeRoleForSidePanel(character.role)}
                onChange={(e) => onPatch({ role: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              >
                {SIDEPANEL_CHARACTER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">성격</label>
              <textarea
                value={character.personality}
                onChange={(e) => onPatch({ personality: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">능력</label>
              <textarea
                value={character.abilities}
                onChange={(e) => onPatch({ abilities: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">목표</label>
              <textarea
                value={character.goals}
                onChange={(e) => onPatch({ goals: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">
                인물 간 관계
              </label>
              <textarea
                value={character.relationships}
                onChange={(e) => onPatch({ relationships: e.target.value })}
                rows={2}
                placeholder="타 인물과의 관계, 갈등 구조 등"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
              />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
