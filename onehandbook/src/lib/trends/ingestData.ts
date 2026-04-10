import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChromaClient } from "chromadb";
import { chunkTrendsText } from "@/lib/chroma/chunkText";
import {
  getOrCreateTrendsCollection,
  type ChromaConnectionOverrides,
} from "@/lib/chroma/chromaClient";
import { TRENDS_COLLECTION_NAME } from "@/lib/chroma/constants";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import {
  normalizeTrendsDateYmd,
  normalizeTrendsGenre,
  TRENDS_GENRE_ALL,
} from "@/lib/chroma/trendsMetadata";

/** 시드니 Chroma 기본 — `CHROMA_*` 환경 변수로 덮어쓰기 */
const DEFAULT_CHROMA_INGEST_HOST = "54.252.238.168";
const DEFAULT_CHROMA_INGEST_PORT = 8000;

const DEFAULT_PENDING_DIR = join(
  process.cwd(),
  "data",
  "trends-ingest-pending"
);

export type TrendIngestInput = {
  body: string;
  title?: string | null;
  genre?: string;
  /** 플랫폼 (예: 문피아, 카카오) */
  platform: string;
  /** 분석 기준일(타겟 날짜). YYYY-MM-DD 또는 파싱 가능한 날짜 문자열 */
  targetDate: string;
  /** (호환) 기존 트렌드 날짜 — 미지정 시 targetDate로 대체 */
  trendDate?: string;
  citationSource?: string | null;
  extra?: Record<string, unknown>;
};

export type IngestDataOptions = {
  /** 미지정 시 서비스 롤(서버·스크립트용) */
  supabase?: SupabaseClient;
  chroma?: ChromaConnectionOverrides;
  /** 실패 시 JSON 백업 디렉터리 (기본: `data/trends-ingest-pending`) */
  pendingDir?: string;
};

export type IngestPendingFileV1 = {
  version: 1;
  reason: "supabase_failed" | "chroma_failed";
  savedAt: string;
  input: {
    body: string;
    title: string | null;
    genre: string;
    platform: string;
    targetDateYmd: string;
    trendDateYmd: string;
    dedupId: string;
    citationSource: string | null;
    extra: Record<string, unknown>;
  };
  trendId?: string;
  chroma?: {
    collection: string;
    batches: {
      ids: string[];
      documents: string[];
      metadatas: Record<string, string | number>[];
    }[];
  };
};

export type IngestDataResult = {
  trendId: string;
  dedupId: string;
  chromaChunks: number;
};

function resolveChromaConnection(
  options?: IngestDataOptions
): ChromaConnectionOverrides {
  const envHost = process.env.CHROMA_SERVER_HOST ?? process.env.CHROMA_HOST;
  const envPortRaw = process.env.CHROMA_SERVER_PORT ?? process.env.CHROMA_PORT;
  const envPort = envPortRaw
    ? Number.parseInt(envPortRaw, 10) || DEFAULT_CHROMA_INGEST_PORT
    : undefined;
  return {
    host: options?.chroma?.host ?? envHost ?? DEFAULT_CHROMA_INGEST_HOST,
    port: options?.chroma?.port ?? envPort ?? DEFAULT_CHROMA_INGEST_PORT,
    ssl: options?.chroma?.ssl,
  };
}

function chromaUrlFromConnection(conn: ChromaConnectionOverrides): string {
  const host = conn.host ?? "localhost";
  const port = conn.port ?? 8000;
  const scheme = conn.ssl ? "https" : "http";
  return `${scheme}://${host}:${port}`;
}

function stableTrendChunkId(
  dedupId: string,
  index: number,
  doc: string
): string {
  const h = createHash("sha256")
    .update(`${dedupId}\0${index}\0${doc}`)
    .digest("hex")
    .slice(0, 40);
  return `trd_${dedupId}_${index}_${h}`;
}

function normalizePlatform(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  return s || "unknown";
}

function computeDedupId(
  title: string | null,
  platform: string,
  targetDateYmd: string
): string {
  const t = title ?? "";
  return createHash("sha256")
    // SQL 마이그레이션과 동일 규칙: `${title}|${platform}|${target_date}`
    .update(`${t}|${platform}|${targetDateYmd}`)
    .digest("hex");
}

function chunksForBody(body: string): string[] {
  const parts = chunkTrendsText(body);
  const t = body.replace(/\r\n/g, "\n").trim();
  if (parts.length > 0) return parts;
  if (t.length > 0) return [t];
  return [];
}

function buildNormalizedInput(
  input: TrendIngestInput,
  platform: string,
  targetDateYmd: string,
  trendDateYmd: string,
  dedupId: string,
  genre: string,
  citation: string | null,
  title: string | null
): IngestPendingFileV1["input"] {
  return {
    body: input.body.replace(/^\uFEFF/, "").trim(),
    title,
    genre,
    platform,
    targetDateYmd,
    trendDateYmd,
    dedupId,
    citationSource: citation,
    extra: { ...(input.extra ?? {}) },
  };
}

async function writePendingJson(
  dir: string,
  payload: IngestPendingFileV1
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const name = `ingest-pending-${Date.now()}-${randomBytes(6).toString("hex")}.json`;
  const fullPath = join(dir, name);
  await writeFile(fullPath, JSON.stringify(payload, null, 2), "utf8");
  console.warn(`[ingestData] 원격 저장 실패 → 로컬 백업: ${fullPath}`);
  return fullPath;
}

function buildChromaBatches(
  trendId: string,
  dedupId: string,
  chunks: string[],
  genre: string,
  platform: string,
  targetDateYmd: string,
  trendDateYmd: string,
  displaySource: string,
  maxBatch: number
): IngestPendingFileV1["chroma"] {
  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Record<string, string | number>[] = [];

  chunks.forEach((doc, index) => {
    ids.push(stableTrendChunkId(dedupId, index, doc));
    documents.push(doc);
    metadatas.push({
      trend_id: trendId,
      dedup_id: dedupId,
      source: displaySource,
      file_path: `supabase:trends/${trendId}`,
      chunk_index: index,
      genre,
      platform,
      target_date: targetDateYmd,
      date: trendDateYmd,
    });
  });

  const batches: NonNullable<IngestPendingFileV1["chroma"]>["batches"] = [];
  for (let i = 0; i < ids.length; i += maxBatch) {
    batches.push({
      ids: ids.slice(i, i + maxBatch),
      documents: documents.slice(i, i + maxBatch),
      metadatas: metadatas.slice(i, i + maxBatch),
    });
  }

  return { collection: TRENDS_COLLECTION_NAME, batches };
}

/**
 * 트렌드 데이터를 Supabase `trends`에 저장하고, 동일 본문 청크를 시드니 Chroma `webnovel-trends`에 `add` 합니다.
 * Supabase 또는 Chroma 단계에서 네트워크 등으로 실패하면 `data/trends-ingest-pending`(또는 `pendingDir`)에 JSON으로 백업해 데이터를 잃지 않습니다.
 * (Chroma만 실패한 경우 DB 행은 유지되며, 백업 파일로 벡터만 재시도할 수 있습니다.)
 */
export async function ingestData(
  input: TrendIngestInput,
  options?: IngestDataOptions
): Promise<IngestDataResult> {
  const normalizedBody = input.body.replace(/^\uFEFF/, "").trim();
  if (!normalizedBody) {
    throw new Error("ingestData: body가 비어 있습니다.");
  }

  const fallbackDate = new Date().toISOString().slice(0, 10);
  const platform = normalizePlatform(input.platform);
  const targetDateYmd = normalizeTrendsDateYmd(input.targetDate, fallbackDate);
  const trendDateYmd = normalizeTrendsDateYmd(
    input.trendDate ?? input.targetDate,
    fallbackDate
  );
  const genre = normalizeTrendsGenre(input.genre ?? TRENDS_GENRE_ALL);
  const citation =
    typeof input.citationSource === "string" && input.citationSource.trim()
      ? input.citationSource.trim()
      : null;
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim()
      : null;

  const dedupId = computeDedupId(title, platform, targetDateYmd);

  const extraPayload = { ...(input.extra ?? {}) };
  const pendingDir = options?.pendingDir ?? DEFAULT_PENDING_DIR;
  const snapshot = buildNormalizedInput(
    input,
    platform,
    targetDateYmd,
    trendDateYmd,
    dedupId,
    genre,
    citation,
    title
  );

  const supabase = options?.supabase ?? createSupabaseServiceRole();

  const { data: inserted, error: insertError } = await supabase
    .from("trends")
    .upsert(
      {
        dedup_id: dedupId,
        platform,
        target_date: targetDateYmd,
      title,
      body: normalizedBody,
      genre,
      trend_date: trendDateYmd,
      citation_source: citation,
      extra: extraPayload,
      },
      { onConflict: "dedup_id" }
    )
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    const path = await writePendingJson(pendingDir, {
      version: 1,
      reason: "supabase_failed",
      savedAt: new Date().toISOString(),
      input: snapshot,
    });
    throw new Error(
      `${insertError?.message ?? "trends 삽입 실패"} (백업: ${path})`
    );
  }

  const trendId = inserted.id as string;
  const chunks = chunksForBody(normalizedBody);
  const displaySource = citation ?? title ?? `trend:${trendId}`;

  const chromaConn = resolveChromaConnection(options);

  try {
    const url = chromaUrlFromConnection(chromaConn);
    console.log("📍 연결 시도 주소:", url);
    console.log("🧷 ingest meta:", {
      platform,
      target_date: targetDateYmd,
      dedup_id: dedupId,
      title: title ?? "",
    });

    const client = new ChromaClient({ path: url });
    const collection = await getOrCreateTrendsCollection(client);
    const preflight = await client.getPreflightChecks();
    const batchSize = Math.min(64, preflight.max_batch_size || 64);

    const ids: string[] = [];
    const documents: string[] = [];
    const metadatas: Record<string, string | number>[] = [];

    chunks.forEach((doc, index) => {
      ids.push(stableTrendChunkId(dedupId, index, doc));
      documents.push(doc);
      metadatas.push({
        trend_id: trendId,
        dedup_id: dedupId,
        source: displaySource,
        file_path: `supabase:trends/${trendId}`,
        chunk_index: index,
        genre,
        platform,
        target_date: targetDateYmd,
        date: trendDateYmd,
      });
    });

    // 재실행(동일 dedup_id) 시에도 안전하게 동작하도록 upsert 우선.
    // Chroma 버전에 따라 upsert 미지원이면 add 시도 후 "already exists"류는 무시합니다.
    const doUpsert =
      typeof (collection as unknown as { upsert?: unknown }).upsert ===
      "function";

    for (let i = 0; i < ids.length; i += batchSize) {
      const payload = {
        ids: ids.slice(i, i + batchSize),
        documents: documents.slice(i, i + batchSize),
        metadatas: metadatas.slice(i, i + batchSize),
      };
      if (doUpsert) {
        await (collection as unknown as { upsert: (x: typeof payload) => Promise<void> }).upsert(
          payload
        );
        continue;
      }
      try {
        await collection.add(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/already exists|duplicate|UniqueConstraint|exists/i.test(msg)) {
          console.warn(
            "[ingestData] Chroma add: 이미 존재하는 ids 감지 → 무시:",
            msg.slice(0, 200)
          );
          continue;
        }
        throw e;
      }
    }

    return { trendId, dedupId, chromaChunks: chunks.length };
  } catch (chromaErr) {
    const chromaPayload = buildChromaBatches(
      trendId,
      dedupId,
      chunks,
      genre,
      platform,
      targetDateYmd,
      trendDateYmd,
      displaySource,
      64
    );
    const path = await writePendingJson(pendingDir, {
      version: 1,
      reason: "chroma_failed",
      savedAt: new Date().toISOString(),
      input: snapshot,
      trendId,
      chroma: chromaPayload,
    });
    const msg =
      chromaErr instanceof Error ? chromaErr.message : String(chromaErr);
    throw new Error(
      `Chroma 인제스트 실패: ${msg} (trends 행은 유지됨, 백업: ${path})`
    );
  }
}
