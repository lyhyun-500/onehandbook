"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TagInput } from "@/components/TagInput";
import { Checkbox, Field, SelectInput, Textarea, TextInput } from "@/components/forms";
import { GENRES, isKnownGenre } from "@/lib/constants/genres";
import { EmptyState } from "@/components/atoms/EmptyState";
import {
  emptyCharacter,
  type CharacterSetting,
  type WorldSetting,
} from "@/lib/works/loreTypes";

const STATUSES = ["연재중", "완결", "휴재"] as const;
const CONTRACT_STATUSES = ["미계약", "계약"] as const;
/** 시안 ROLE_OPTIONS — D-12 결정: 4개 + "기타" fallback (기존 "기타" 인물 편집 시 disabled option 노출). */
const ROLE_OPTIONS = ["주인공", "조연", "악역", "단역"] as const;

function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-stone-800/70 bg-stone-900/30 px-7 py-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[18px] font-medium text-stone-100">
            {title}
          </h2>
          {description && (
            <p className="mt-1 font-serif text-[12px] leading-relaxed text-stone-500">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

interface WorkSettingsFormProps {
  workId: number;
  workTitle: string;
  initialTitle: string;
  initialGenre: string;
  initialStatus: string;
  initialSynopsis: string;
  initialContractStatus: "미계약" | "계약";
  initialManagementOfferOptIn: boolean;
  initialTags: string[];
  initialWorld: WorldSetting;
  initialCharacters: CharacterSetting[];
}

type StatusValue = (typeof STATUSES)[number];
type ContractValue = (typeof CONTRACT_STATUSES)[number];

export function WorkSettingsForm({
  workId,
  workTitle,
  initialTitle,
  initialGenre,
  initialStatus,
  initialSynopsis,
  initialContractStatus,
  initialManagementOfferOptIn,
  initialTags,
  initialWorld,
  initialCharacters,
}: WorkSettingsFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState(initialTitle);
  const [genre, setGenre] = useState(initialGenre);
  const [status, setStatus] = useState<StatusValue>(initialStatus as StatusValue);
  const [synopsis, setSynopsis] = useState(initialSynopsis);
  const [contractStatus, setContractStatus] =
    useState<ContractValue>(initialContractStatus);
  const [managementOfferOptIn, setManagementOfferOptIn] = useState(
    Boolean(initialManagementOfferOptIn),
  );
  const [tags, setTags] = useState<string[]>(
    Array.isArray(initialTags) ? initialTags.filter((t) => typeof t === "string") : [],
  );
  const [worldBackground, setWorldBackground] = useState(initialWorld.background);
  const [worldEra, setWorldEra] = useState(initialWorld.era);
  const [worldRules, setWorldRules] = useState(initialWorld.rules);
  const [characters, setCharacters] = useState<CharacterSetting[]>(
    initialCharacters.length > 0 ? initialCharacters : [],
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialSnapshot = useRef({
    title: initialTitle,
    genre: initialGenre,
    status: initialStatus,
    synopsis: initialSynopsis,
    contractStatus: initialContractStatus,
    managementOfferOptIn: Boolean(initialManagementOfferOptIn),
    tags: [...(initialTags ?? [])],
    world: { ...initialWorld },
    characters: initialCharacters.map((c) => ({ ...c })),
  });

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

  const isDirty = useMemo(() => {
    const s = initialSnapshot.current;
    if (title !== s.title) return true;
    if (genre !== s.genre) return true;
    if (status !== s.status) return true;
    if (synopsis !== s.synopsis) return true;
    if (contractStatus !== s.contractStatus) return true;
    if (managementOfferOptIn !== s.managementOfferOptIn) return true;
    if (JSON.stringify(tagsNormalized) !== JSON.stringify(s.tags)) return true;
    if (
      worldBackground !== s.world.background ||
      worldEra !== s.world.era ||
      worldRules !== s.world.rules
    )
      return true;
    if (JSON.stringify(characters) !== JSON.stringify(s.characters)) return true;
    return false;
  }, [
    title,
    genre,
    status,
    synopsis,
    contractStatus,
    managementOfferOptIn,
    tagsNormalized,
    worldBackground,
    worldEra,
    worldRules,
    characters,
  ]);

  const addCharacter = () => {
    setCharacters((prev) => {
      const next = [...prev, emptyCharacter()];
      setExpandedIndex(next.length - 1);
      return next;
    });
  };
  const removeCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
    setExpandedIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };
  const updateCharacter = (index: number, patch: Partial<CharacterSetting>) => {
    setCharacters((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
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
      const { error: updateError } = await supabase
        .from("works")
        .update({
          title,
          genre,
          status,
          synopsis: synopsis.trim() || null,
          contract_status: contractStatus,
          management_offer_opt_in: managementOfferOptIn,
          tags: tagsNormalized,
          world_setting,
          character_settings,
        })
        .eq("id", workId);

      if (updateError) throw updateError;

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
      className="mx-auto flex max-w-4xl flex-col gap-6 px-8 py-9"
    >
      <header className="mb-1">
        <button
          type="button"
          onClick={() => router.push(`/works/${workId}`)}
          className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-widest text-stone-400 hover:text-sky-200"
        >
          ← 작품 상세로
        </button>
        <h1 className="mt-3 font-serif text-[34px] font-medium leading-tight tracking-tight text-stone-100">
          작품 설정
        </h1>
        <p className="mt-1.5 font-serif text-[13.5px] leading-relaxed text-stone-400">
          {workTitle}
        </p>
      </header>

      <SettingsSection
        title="기본 정보"
        description="작품 식별과 분류에 사용되는 메타 정보입니다."
      >
        <Field label="제목">
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="작품 제목"
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Field label="장르">
            <SelectInput value={genre} onChange={setGenre}>
              {GENRES.map((g) => (
                <option key={g} value={g} className="bg-stone-900">
                  {g}
                </option>
              ))}
              {/* D-6 fallback: 새 GENRES 외 값(예: 미스터리/SF/일상) 가진 작품 편집 시 disabled option 노출. */}
              {!isKnownGenre(genre) && (
                <option value={genre} disabled className="bg-stone-900 text-stone-500">
                  {genre} (사용 중단)
                </option>
              )}
            </SelectInput>
          </Field>
          <Field label="연재 상태">
            <SelectInput
              value={status}
              onChange={(v) => setStatus(v as StatusValue)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="bg-stone-900">
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="계약 여부">
            <SelectInput
              value={contractStatus}
              onChange={(v) => setContractStatus(v as ContractValue)}
            >
              {CONTRACT_STATUSES.map((c) => (
                <option key={c} value={c} className="bg-stone-900">
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {/*
          contract_status='미계약' AND management_offer_opt_in=true 조합이
          향후 B2B(매니지먼트·플랫폼) 노출 판정 기준 — 단일 플래그 아님.
          작가 통제권·커뮤니티 신뢰 우선 이중 게이트. 노출 로직 자체는 다음 페이즈.
        */}
        <div className="rounded-md border border-stone-800/70 bg-stone-900/40 px-4 py-3">
          <Checkbox
            checked={managementOfferOptIn}
            onChange={setManagementOfferOptIn}
            label="매니지먼트 계약 제의를 받겠습니다"
            hint="현재 서비스 개발 중"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="태그"
        description="엔터로 추가하고, 칩의 × 로 삭제합니다. 예: #회귀물 #먼치킨 #전문직"
      >
        <TagInput value={tags} onChange={setTags} />
      </SettingsSection>

      <SettingsSection
        title="시놉시스"
        description="작품 상세 페이지에 노출되는 소개입니다. AI 분석에는 사용되지 않으며, 독자·외부에 보여줄 한 줄~한 단락 요약입니다."
      >
        <Field label="시놉시스 본문">
          <Textarea
            rows={4}
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            placeholder="작품을 한 단락 안에 소개해 주세요."
          />
        </Field>
      </SettingsSection>

      <SettingsSection
        title="세계관 설정"
        description="AI 분석 시 원고와 함께 전달됩니다. 배경·시대·규칙을 자유롭게 적어 주세요."
      >
        <Field label="배경">
          <Textarea
            rows={3}
            value={worldBackground}
            onChange={(e) => setWorldBackground(e.target.value)}
            placeholder="지역, 무대, 세계의 큰 그림 등"
          />
        </Field>
        <Field label="시대">
          <Textarea
            rows={2}
            value={worldEra}
            onChange={(e) => setWorldEra(e.target.value)}
            placeholder="현대, 조선, 다른 차원의 연도 체계 등"
          />
        </Field>
        <Field label="세계관 규칙">
          <Textarea
            rows={4}
            value={worldRules}
            onChange={(e) => setWorldRules(e.target.value)}
            placeholder="마법, 시스템, 금지 사항, 사회 구조 등"
          />
        </Field>
      </SettingsSection>

      <SettingsSection
        title="인물 설정"
        description="이름이 있는 행만 저장됩니다. 분석 시 캐릭터 일관성·관계 활용도에 반영됩니다."
        action={
          <button
            type="button"
            onClick={addCharacter}
            className="flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/60 px-3.5 py-2 font-serif text-[13px] text-stone-200 hover:border-sky-400/40 hover:text-sky-200"
          >
            <Plus size={12} aria-hidden="true" />
            인물 추가
          </button>
        }
      >
        {characters.length === 0 ? (
          <EmptyState
            variant="sky"
            icon={<Plus size={18} aria-hidden="true" />}
            title="아직 등록된 인물이 없습니다"
            body="주요 인물의 이름·역할·배경을 추가하면 분석 정확도가 올라갑니다."
            cta={{
              label: "첫 인물 추가",
              onClick: addCharacter,
              variant: "primary",
            }}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {characters.map((ch, index) => (
              <CharacterEditCard
                key={index}
                index={index}
                ch={ch}
                expanded={expandedIndex === index}
                onToggle={() =>
                  setExpandedIndex((prev) => (prev === index ? null : index))
                }
                onChange={(patch) => updateCharacter(index, patch)}
                onDelete={() => removeCharacter(index)}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <footer className="mt-2 flex items-center justify-between gap-3 border-t border-stone-800/60 pt-6">
        <div className="font-mono text-[10.5px] tracking-wide">
          {isDirty ? (
            <span className="text-amber-300/85">· 미저장 변경 있음</span>
          ) : (
            <span className="text-stone-600">· 모든 변경 사항 저장됨</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-stone-800/80 bg-stone-900/40 px-5 py-2.5 font-serif text-[13px] text-stone-300 hover:border-stone-700 hover:text-stone-100"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-6 py-2.5 font-serif text-[13.5px] font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-50"
            style={{
              boxShadow:
                "0 0 0 1px oklch(0.66 0.16 60 / 0.4), 0 8px 24px -12px oklch(0.78 0.16 60 / 0.5)",
            }}
          >
            <Check size={12} aria-hidden="true" />
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </footer>
    </form>
  );
}

function CharacterEditCard({
  index,
  ch,
  expanded,
  onToggle,
  onChange,
  onDelete,
}: {
  index: number;
  ch: CharacterSetting;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<CharacterSetting>) => void;
  onDelete: () => void;
}) {
  const isKnownRole = ROLE_OPTIONS.some((r) => r === ch.role);
  return (
    <article className="rounded-lg border border-stone-800/70 bg-stone-900/40 transition-colors hover:border-stone-700/80">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-500 transition-colors hover:bg-stone-800/60 hover:text-stone-200 ${expanded ? "rotate-90 text-sky-300" : ""}`}
          aria-label={expanded ? "접기" : "펼치기"}
        >
          <ChevronRight size={11} aria-hidden="true" />
        </button>
        <input
          type="text"
          value={ch.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={`인물 ${index + 1} 이름`}
          className="flex-1 bg-transparent font-serif text-[14.5px] text-stone-100 placeholder:text-stone-600 focus:outline-none"
        />
        <span className="font-mono text-[10px] text-stone-600">·</span>
        <select
          value={ch.role}
          onChange={(e) => onChange({ role: e.target.value })}
          className="appearance-none rounded-sm bg-transparent font-mono text-[10.5px] uppercase tracking-widest text-stone-400 focus:outline-none"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r} className="bg-stone-900">
              {r}
            </option>
          ))}
          {/* D-12 fallback: 운영 데이터에 "기타" 등 ROLE_OPTIONS 외 값이 들어있는 경우 disabled option 으로 노출. */}
          {!isKnownRole && ch.role && (
            <option value={ch.role} disabled className="bg-stone-900 text-stone-500">
              {ch.role} (사용 중단)
            </option>
          )}
        </select>
        <button
          type="button"
          onClick={onDelete}
          className="ml-2 inline-flex items-center gap-1 rounded border border-rose-400/30 bg-rose-400/[0.06] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-rose-300/90 hover:bg-rose-400/[0.14] hover:text-rose-200"
        >
          <Trash2 size={10} aria-hidden="true" />
          삭제
        </button>
      </header>
      {expanded && (
        <div className="space-y-3 border-t border-stone-800/60 px-4 py-3">
          <Field label="성격">
            <Textarea
              rows={2}
              value={ch.personality}
              onChange={(e) => onChange({ personality: e.target.value })}
            />
          </Field>
          <Field label="능력">
            <Textarea
              rows={2}
              value={ch.abilities}
              onChange={(e) => onChange({ abilities: e.target.value })}
            />
          </Field>
          <Field label="목표">
            <Textarea
              rows={2}
              value={ch.goals}
              onChange={(e) => onChange({ goals: e.target.value })}
            />
          </Field>
          <Field label="인물 간 관계">
            <Textarea
              rows={2}
              value={ch.relationships}
              onChange={(e) => onChange({ relationships: e.target.value })}
              placeholder="타 인물과의 관계, 갈등 구조 등"
            />
          </Field>
        </div>
      )}
    </article>
  );
}
