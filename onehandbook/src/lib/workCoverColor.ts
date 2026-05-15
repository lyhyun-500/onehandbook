/**
 * 작품 표지 색상 — works 테이블에 `cover` 컬럼이 부재하므로
 * 시안 atoms.jsx 의 색상 스트립을 장르 기반 결정으로 채운다.
 */
const GENRE_COVER_COLORS: Record<string, string> = {
  로맨스: "#fb7185", // rose-400
  판타지: "#a78bfa", // violet-400
  무협: "#fbbf24", // amber-400
  현대물: "#38bdf8", // sky-400
  스포츠: "#34d399", // emerald-400
};

const FALLBACK_COVER = "#a8a29e"; // stone-400

export function getWorkCoverColor(genre: string): string {
  return GENRE_COVER_COLORS[genre] ?? FALLBACK_COVER;
}
