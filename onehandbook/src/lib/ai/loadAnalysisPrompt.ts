import fs from "fs";
import path from "path";
import type { AnalysisProfileConfig } from "@/config/analysis-profiles";

const PROMPTS_DIR = path.join(process.cwd(), "prompts", "analysis");

function readIfExists(relativeFromAnalysisDir: string): string | null {
  const full = path.join(PROMPTS_DIR, relativeFromAnalysisDir);
  try {
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, "utf8");
  } catch {
    return null;
  }
}

/** 공용 베이스 (장르 플레이스홀더 {{genre}} 포함) */
export function loadBaseSystem(): string {
  const primary = readIfExists("base-system.md");
  if (primary) return primary.trim();
  const fallback = readIfExists("default-system.md");
  if (fallback) return fallback.trim();
  throw new Error(
    `공용 베이스 프롬프트가 없습니다. ${PROMPTS_DIR}/base-system.md 를 만드세요.`
  );
}

/**
 * 프로필별 플랫폼 가이드 — `prompts/analysis/platforms/{id}.md`
 * `systemPromptFile`이 있으면 `prompts/analysis/` 기준 해당 파일 전체로 대체.
 */
export function loadPlatformSnippet(profile: AnalysisProfileConfig): string {
  if (profile.systemPromptFile) {
    const custom = readIfExists(profile.systemPromptFile);
    if (custom) return custom.trim();
  }
  const platform = readIfExists(path.join("platforms", `${profile.id}.md`));
  if (platform) return platform.trim();
  return "";
}
