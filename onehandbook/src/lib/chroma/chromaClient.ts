import { ChromaClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";
import type { EmbeddingFunction } from "chromadb";
import { TRENDS_COLLECTION_NAME } from "./constants";

export function getChromaHost(): string {
  return process.env.CHROMA_HOST ?? "localhost";
}

export function getChromaPort(): number {
  const p = process.env.CHROMA_PORT;
  return p ? Number.parseInt(p, 10) || 8000 : 8000;
}

export function createChromaClient(): ChromaClient {
  return new ChromaClient({
    host: getChromaHost(),
    port: getChromaPort(),
    ssl: process.env.CHROMA_SSL === "1" || process.env.CHROMA_SSL === "true",
  });
}

let cachedEmbed: DefaultEmbeddingFunction | null = null;

/**
 * 인제스트·검색 모두 동일 임베딩을 써야 합니다 (@chroma-core/default-embed, MiniLM 계열).
 */
export function getTrendsEmbeddingFunction(): EmbeddingFunction {
  if (!cachedEmbed) {
    cachedEmbed = new DefaultEmbeddingFunction();
  }
  return cachedEmbed as unknown as EmbeddingFunction;
}

export async function getTrendsCollection(client: ChromaClient) {
  return client.getCollection({
    name: TRENDS_COLLECTION_NAME,
    embeddingFunction: getTrendsEmbeddingFunction(),
  });
}

export async function getOrCreateTrendsCollection(client: ChromaClient) {
  return client.getOrCreateCollection({
    name: TRENDS_COLLECTION_NAME,
    metadata: { description: "웹소설 트렌드 텍스트 RAG" },
    embeddingFunction: getTrendsEmbeddingFunction(),
  });
}
