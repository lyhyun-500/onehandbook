import { ingestTrendsFromDisk } from "../src/lib/chroma/ingestTrends";

const noReset = process.argv.includes("--no-reset");

async function main() {
  console.info(
    "[trends:ingest] Chroma 서버가 떠 있는지 확인하세요 (npm run chroma:run)."
  );
  const { files, chunks } = await ingestTrendsFromDisk({
    reset: !noReset,
  });
  console.info(`[trends:ingest] 완료 — 파일 ${files}개, 청크 ${chunks}건`);
  if (chunks === 0) {
    console.warn(
      "[trends:ingest] 청크가 0입니다. data/trends 에 .txt / .md 를 넣었는지 확인하세요."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
