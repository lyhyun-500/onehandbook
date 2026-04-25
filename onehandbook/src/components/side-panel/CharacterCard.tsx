"use client";

import { useEffect, useRef } from "react";
import {
  SIDEPANEL_CHARACTER_ROLES,
  normalizeRoleForSidePanel,
} from "@/components/side-panel/types";
import {
  FieldLabel,
  SelectField,
  TextAreaField,
  TextField,
} from "./CharacterCardFields";
import type { CharacterWithKey } from "./types";

type CardStatus = "clean" | "dirty" | "invalid";

function roleBadgeTextColor(displayRole: string): string {
  const r = normalizeRoleForSidePanel(displayRole);
  if (r === "주인공") return "var(--color-role-protagonist)";
  if (r === "조연") return "var(--color-role-supporting)";
  if (r === "단역") return "var(--color-role-minor)";
  if (r === "악역") return "var(--color-role-villain)";
  return "var(--color-sidepanel-text-secondary)";
}

type CharacterCardProps = {
  card: CharacterWithKey;
  status: CardStatus;
  open: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<CharacterWithKey>) => void;
  onRequestDelete: () => void;
};

export function CharacterCard({
  card,
  status,
  open,
  onToggle,
  onPatch,
  onRequestDelete,
}: CharacterCardProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // a11y: prevent focus/tab + SR reading when collapsed
    (el as any).inert = !open;
  }, [open]);

  const label = card.name.trim() || "(이름 없음)";
  const displayRole = card.role?.trim() ? normalizeRoleForSidePanel(card.role) : "";
  const summaryPreview = (card.summary ?? "").trim();

  // Avoid mixing `borderColor` (shorthand) with `borderLeftColor` (longhand), which can
  // trigger React dev warnings. Use an inset box-shadow for the left stripe instead.
  const cardSurfaceStyle = {
    background: "var(--color-sidepanel-card)",
    border: "1px solid var(--color-sidepanel-border-subtle)",
    boxShadow:
      status === "invalid"
        ? "inset 4px 0 0 0 var(--color-sidepanel-danger)"
        : "none",
  } as const;

  const longTextFields: Array<{
    label: string;
    value: string;
    patchKey: "goals" | "abilities" | "personality" | "relationships";
  }> = [
    { label: "목표", value: card.goals ?? "", patchKey: "goals" },
    { label: "능력", value: card.abilities ?? "", patchKey: "abilities" },
    { label: "성격", value: card.personality ?? "", patchKey: "personality" },
    { label: "관계", value: card.relationships ?? "", patchKey: "relationships" },
  ];

  return (
    <li
      className="overflow-hidden rounded-lg border transition-colors duration-200 ease-out hover:[background:var(--color-sidepanel-card-hover)]"
      style={{
        background: "var(--color-sidepanel-card)",
        borderColor: "var(--color-sidepanel-border-subtle)",
        boxShadow:
          status === "invalid"
            ? "inset 4px 0 0 0 var(--color-sidepanel-danger)"
            : "none",
      }}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 flex-col gap-1 text-left"
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-sm" style={{ color: "var(--color-sidepanel-text-muted)" }}>
                {open ? "▼" : "▶"}
              </span>{" "}
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-sidepanel-text-primary)" }}
              >
                {label}
              </span>
              {displayRole ? (
                <span
                  className="ml-2 inline-flex max-w-[10rem] items-center rounded border px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    borderColor: "var(--color-sidepanel-border-subtle)",
                    background: "var(--color-sidepanel-bg)",
                    color: roleBadgeTextColor(displayRole),
                  }}
                >
                  {displayRole}
                </span>
              ) : null}
            </div>

            {status === "dirty" ? (
              <span
                className="mt-1 h-2 w-2 rounded-full animate-[sidepanelDirtyAppear_250ms_ease-out_1]"
                style={{ background: "var(--color-sidepanel-border-dirty)" }}
                aria-label="수정됨"
                title="수정됨"
              />
            ) : null}
          </div>

          {summaryPreview ? (
            <p
              className="line-clamp-2 pl-4 text-sm leading-snug"
              style={{ color: "var(--color-sidepanel-text-secondary)" }}
            >
              {summaryPreview}
            </p>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onRequestDelete}
          className="shrink-0 rounded border px-2 py-1 text-xs"
          style={{
            borderColor: "color-mix(in srgb, var(--color-sidepanel-danger) 35%, transparent)",
            color: "color-mix(in srgb, var(--color-sidepanel-danger) 65%, #ffffff)",
            background: "color-mix(in srgb, var(--color-sidepanel-danger) 12%, var(--color-sidepanel-bg))",
          }}
        >
          삭제
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-250 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            ref={contentRef}
            aria-hidden={!open}
            className="space-y-3 border-t px-3 py-3"
            style={{ borderColor: "var(--color-sidepanel-border-subtle)" }}
          >
            {status === "invalid" ? (
              <p
                className="text-xs"
                style={{ color: "var(--color-sidepanel-border-invalid)" }}
              >
                이름을 입력해주세요.
              </p>
            ) : null}

            <div className="space-y-1">
              <FieldLabel>이름</FieldLabel>
              <TextField value={card.name} onChange={(v) => onPatch({ name: v })} />
            </div>

            <div className="space-y-1">
              <FieldLabel>한 줄 요약</FieldLabel>
              <TextAreaField
                value={card.summary ?? ""}
                onChange={(v) => onPatch({ summary: v })}
                rows={2}
                relaxed
              />
            </div>

            <div className="space-y-1">
              <FieldLabel>역할</FieldLabel>
              <SelectField
                value={normalizeRoleForSidePanel(card.role)}
                onChange={(v) => onPatch({ role: v })}
                options={SIDEPANEL_CHARACTER_ROLES}
              />
            </div>

            {longTextFields.map((f) => (
              <div key={f.patchKey} className="space-y-1">
                <FieldLabel>{f.label}</FieldLabel>
                <TextAreaField
                  value={f.value}
                  onChange={(v) => onPatch({ [f.patchKey]: v })}
                  rows={4}
                  relaxed
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}
