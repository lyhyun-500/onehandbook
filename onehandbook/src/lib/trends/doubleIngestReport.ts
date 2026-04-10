import { ingestData } from "@/lib/trends/ingestData";

export type TrendReportIngestInput = {
  /** 본문(임베딩·청크 대상) */
  body: string;
  /** 선택 제목 */
  title?: string | null;
  /** 장르(미입력 시 전체) */
  genre?: string;
  /** 플랫폼 (예: 문피아, 카카오) */
  platform: string;
  /** 분석 기준일(타겟 날짜). YYYY-MM-DD 또는 파싱 가능한 날짜 문자열 */
  targetDate: string;
  /** (호환) 표시용 날짜 — 미지정 시 targetDate로 저장 */
  reportDate?: string;
  /** 출처 한 줄 */
  citationSource?: string | null;
  /** Supabase `trends.extra`에 그대로 합쳐 저장 */
  extra?: Record<string, unknown>;
};

export type DoubleIngestOptions = {
  /** Chroma 연결(미지정 시 환경 변수 → 시드니 기본 호스트) */
  chroma?: Parameters<typeof ingestData>[1] extends { chroma?: infer C } ? C : never;
};

/**
 * 트렌드 원문을 Supabase `trends`에 저장하고, 본문 청크를 임베딩해 Chroma `webnovel-trends` 컬렉션에 넣습니다.
 * 두 저장이 모두 성공하면 터미널에 `Double Ingest Success`를 출력합니다.
 */
export async function doubleIngestTrendReport(
  input: TrendReportIngestInput,
  options?: DoubleIngestOptions
): Promise<{ trendId: string; dedupId: string; chromaChunks: number }> {
  const res = await ingestData(
    {
      title: input.title ?? null,
      body: input.body,
      genre: input.genre,
      platform: input.platform,
      targetDate: input.targetDate,
      trendDate: input.reportDate ?? input.targetDate,
      citationSource: input.citationSource ?? null,
      extra: input.extra,
    },
    { chroma: options?.chroma }
  );

  console.log("Double Ingest Success");
  return { trendId: res.trendId, dedupId: res.dedupId, chromaChunks: res.chromaChunks };
}
