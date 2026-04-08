import { createHash } from "crypto";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";
import { chunkTrendsText } from "./chunkText";
import {
  createChromaClient,
  getOrCreateTrendsCollection,
} from "./chromaClient";
import { DEFAULT_TRENDS_DIR, TRENDS_COLLECTION_NAME } from "./constants";
import { parseTrendsFileContent } from "./trendsMetadata";

const TEXT_EXT = new Set([".txt", ".md", ".markdown"]);

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      out.push(...(await walkFiles(p)));
    } else {
      const lower = e.name.toLowerCase();
      const ext = lower.slice(lower.lastIndexOf("."));
      if (TEXT_EXT.has(ext)) out.push(p);
    }
  }
  return out;
}

function stableChunkId(sourceRel: string, index: number, body: string): string {
  const h = createHash("sha256")
    .update(`${sourceRel}\0${index}\0${body}`)
    .digest("hex")
    .slice(0, 40);
  return `${sourceRel.replace(/[^a-zA-Z0-9_-]/g, "_")}_${index}_${h}`;
}

export type IngestTrendsOptions = {
  /** 앱 루트(process.cwd()) 기준 트렌드 폴더 */
  trendsDir?: string;
  /** true면 기존 컬렉션 삭제 후 재생성 */
  reset?: boolean;
};

/**
 * `data/trends` 등의 텍스트를 읽어 Chroma 컬렉션에 넣습니다.
 * 실행 전 로컬에서 `npm run chroma:run` 으로 서버가 떠 있어야 합니다.
 */
export async function ingestTrendsFromDisk(
  options: IngestTrendsOptions = {}
): Promise<{ files: number; chunks: number }> {
  const root = process.cwd();
  const trendsDir = join(root, options.trendsDir ?? DEFAULT_TRENDS_DIR);

  const client = createChromaClient();

  if (options.reset) {
    try {
      await client.deleteCollection({ name: TRENDS_COLLECTION_NAME });
    } catch {
      /* 없으면 무시 */
    }
  }

  const collection = await getOrCreateTrendsCollection(client);

  const paths = await walkFiles(trendsDir);
  const textFiles = paths.filter((p) => {
    const base = p.split(/[/\\]/).pop() ?? "";
    return base !== "README.md";
  });

  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: {
    source: string;
    file_path: string;
    chunk_index: number;
    genre: string;
    date: string;
  }[] = [];

  for (const abs of textFiles) {
    const rel = relative(root, abs).split(/[/\\]/).join("/");
    const raw = await readFile(abs, "utf8");
    const st = await stat(abs);
    const fallbackDate = st.mtime.toISOString().slice(0, 10);
    const parsed = parseTrendsFileContent(raw, fallbackDate);
    const parts = chunkTrendsText(parsed.body);
    const displaySource =
      parsed.citation_source?.trim() || rel;
    parts.forEach((doc, index) => {
      ids.push(stableChunkId(rel, index, doc));
      documents.push(doc);
      metadatas.push({
        source: displaySource,
        file_path: rel,
        chunk_index: index,
        genre: parsed.genre,
        date: parsed.date,
      });
    });
  }

  if (ids.length === 0) {
    return { files: textFiles.length, chunks: 0 };
  }

  const preflight = await client.getPreflightChecks();
  const batchSize = Math.min(64, preflight.max_batch_size || 64);

  for (let i = 0; i < ids.length; i += batchSize) {
    await collection.add({
      ids: ids.slice(i, i + batchSize),
      documents: documents.slice(i, i + batchSize),
      metadatas: metadatas.slice(i, i + batchSize),
    });
  }

  return { files: textFiles.length, chunks: ids.length };
}
