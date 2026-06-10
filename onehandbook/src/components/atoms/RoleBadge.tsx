type RoleStyle = { color: string; bg: string; border: string };

const ROLE_STYLE: Record<string, RoleStyle> = {
  "주인공": {
    color: "oklch(0.82 0.11 60)",
    bg: "oklch(0.32 0.07 60 / 0.35)",
    border: "oklch(0.55 0.10 60 / 0.4)",
  },
  "조연": {
    color: "oklch(0.78 0.08 200)",
    bg: "oklch(0.30 0.05 200 / 0.30)",
    border: "oklch(0.52 0.08 200 / 0.4)",
  },
  "악역": {
    color: "oklch(0.78 0.10 20)",
    bg: "oklch(0.30 0.06 20 / 0.30)",
    border: "oklch(0.55 0.10 20 / 0.4)",
  },
  "단역": {
    color: "oklch(0.70 0.04 60)",
    bg: "oklch(0.26 0.02 60 / 0.30)",
    border: "oklch(0.45 0.04 60 / 0.4)",
  },
  "기타": {
    color: "oklch(0.70 0.04 200)",
    bg: "oklch(0.26 0.02 200 / 0.30)",
    border: "oklch(0.45 0.04 200 / 0.4)",
  },
};

/** 시안 episode-edit.jsx RoleBadge — 인물 역할 색상 칩 (주인공 amber / 악역 rose / 조연 sky / 단역·기타 stone). */
export function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLE[role] ?? ROLE_STYLE["조연"]!;
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-widest"
      style={{
        color: style.color,
        backgroundColor: style.bg,
        borderColor: style.border,
      }}
    >
      {role}
    </span>
  );
}
