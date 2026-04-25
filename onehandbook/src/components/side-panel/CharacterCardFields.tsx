"use client";

import type { CSSProperties } from "react";

const CONTROL_BASE: CSSProperties = {
  width: "100%",
  borderRadius: "0.5rem",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--color-sidepanel-border-subtle)",
  background: "var(--color-sidepanel-bg)",
  color: "var(--color-sidepanel-text-primary)",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  paddingTop: "0.5rem",
  paddingBottom: "0.5rem",
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  outline: "none",
};

const FOCUS_RING: CSSProperties = {
  boxShadow: "0 0 0 1px rgba(245, 158, 11, 0.35)",
};

function attachFocusRing(el: HTMLElement) {
  Object.assign(el.style, FOCUS_RING);
}

function clearFocusRing(el: HTMLElement) {
  el.style.boxShadow = "none";
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <label className="text-xs font-medium" style={{ color: "var(--color-sidepanel-text-muted)" }}>
      {children}
    </label>
  );
}

export function TextField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm"
      style={CONTROL_BASE}
      onFocus={(e) => attachFocusRing(e.currentTarget)}
      onBlur={(e) => clearFocusRing(e.currentTarget)}
    />
  );
}

export function TextAreaField({
  value,
  onChange,
  rows,
  relaxed,
}: {
  value: string;
  onChange: (next: string) => void;
  rows: number;
  relaxed?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={`resize-y ${relaxed ? "leading-relaxed" : ""}`}
      style={{
        ...CONTROL_BASE,
        minHeight: "4rem",
      }}
      onFocus={(e) => attachFocusRing(e.currentTarget)}
      onBlur={(e) => clearFocusRing(e.currentTarget)}
    />
  );
}

export function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm"
      style={CONTROL_BASE}
      onFocus={(e) => attachFocusRing(e.currentTarget)}
      onBlur={(e) => clearFocusRing(e.currentTarget)}
    >
      {options.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
