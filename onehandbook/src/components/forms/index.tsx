"use client";

import { ChevronDown } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

/** 폼 필드 wrapper — label(mono uppercase) + 본문 + 선택 hint. 시안 work-settings.jsx Field 정합. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-stone-500">
        {label}
      </label>
      {children}
      {hint && <div className="text-[11px] text-stone-500">{hint}</div>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      {...props}
      className="w-full rounded-md border border-stone-800/80 bg-stone-900/60 px-4 py-3 font-serif text-[14.5px] text-stone-100 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
    />
  );
}

export function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md border border-stone-800/80 bg-stone-900/60 px-4 py-3 font-serif text-[14.5px] text-stone-100 focus:border-sky-400/40 focus:outline-none"
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-500"
      />
    </div>
  );
}

export function Textarea({
  rows = 4,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      {...props}
      className="w-full resize-y rounded-md border border-stone-800/80 bg-stone-900/60 px-4 py-3 font-serif text-[14px] leading-relaxed text-stone-200 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-400"
      />
      <span className="font-serif text-[13.5px] text-stone-200">
        {label}
        {hint && (
          <span className="ml-1.5 font-mono text-[10.5px] uppercase tracking-widest text-stone-500">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
