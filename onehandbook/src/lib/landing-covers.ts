import { readdir } from "fs/promises";
import path from "path";

export type LandingCoverItem =
  | { src: string; alt: string }
  | { src: null; alt: string };

export type LandingCoverRows = {
  top: LandingCoverItem[];
  bottom: LandingCoverItem[];
};

const COVER_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const MIN_PER_ROW = 6;

function placeholderRows(): LandingCoverRows {
  const ph = () => ({ src: null, alt: "" } as LandingCoverItem);
  return {
    top: Array.from({ length: MIN_PER_ROW }, ph),
    bottom: Array.from({ length: MIN_PER_ROW }, ph),
  };
}

/** 한 줄이 너무 짧으면 같은 줄 안에서 순환해 채움 */
function padRow(row: LandingCoverItem[], min: number): LandingCoverItem[] {
  if (row.length === 0) return row;
  const out = [...row];
  let k = 0;
  while (out.length < min) {
    out.push(out[k % out.length]!);
    k++;
  }
  return out;
}

function splitIntoTwoRows(pool: LandingCoverItem[]): LandingCoverRows {
  const top: LandingCoverItem[] = [];
  const bottom: LandingCoverItem[] = [];
  pool.forEach((item, i) => {
    (i % 2 === 0 ? top : bottom).push(item);
  });

  if (top.length === 0 && bottom.length > 0) {
    if (bottom.length === 1) {
      return {
        top: padRow(bottom, MIN_PER_ROW),
        bottom: padRow(bottom, MIN_PER_ROW),
      };
    }
    const half = Math.ceil(bottom.length / 2);
    return {
      top: padRow(bottom.slice(0, half), MIN_PER_ROW),
      bottom: padRow(bottom.slice(half), MIN_PER_ROW),
    };
  }
  if (bottom.length === 0 && top.length > 0) {
    if (top.length === 1) {
      return {
        top: padRow(top, MIN_PER_ROW),
        bottom: padRow(top, MIN_PER_ROW),
      };
    }
    const mid = Math.ceil(top.length / 2);
    return {
      top: padRow(top.slice(mid), MIN_PER_ROW),
      bottom: padRow(top.slice(0, mid), MIN_PER_ROW),
    };
  }

  return {
    top: padRow(top, MIN_PER_ROW),
    bottom: padRow(bottom, MIN_PER_ROW),
  };
}

/**
 * 메인 히어로 배경 — `public/images/covers/` 이미지.
 * 상·하 두 줄로 나눔(짝수 인덱스 위, 홀수 아래). 없으면 플레이스홀더.
 */
export async function getLandingCoverRows(): Promise<LandingCoverRows> {
  const dir = path.join(process.cwd(), "public", "images", "covers");
  let names: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    names = entries
      .filter((e) => e.isFile() && COVER_EXT.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? (e as NodeJS.ErrnoException).code
        : undefined;
    if (code !== "ENOENT" && process.env.NODE_ENV === "development") {
      console.warn("[landing-covers] public/images/covers 읽기 실패:", e);
    }
    return placeholderRows();
  }

  if (names.length === 0) {
    return placeholderRows();
  }

  const pool: LandingCoverItem[] = names.map((name) => ({
    src: `/images/covers/${encodeURIComponent(name)}`,
    alt: "",
  }));

  return splitIntoTwoRows(pool);
}
