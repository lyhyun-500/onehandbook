import { ChromaClient } from "chromadb";

async function check() {
  const client = new ChromaClient({ path: "http://54.252.238.168:8000" });
  try {
    const collection = await client.getCollection({ name: "webnovel-trends" });
    const count = await collection.count();
    console.log(`\n🔥 [시드니 기지 보고] 현재 저장된 데이터 총 개수: ${count}개`);
  } catch {
    console.error("❌ 컬렉션을 찾을 수 없거나 연결 오류입니다.");
    process.exitCode = 1;
  }
}

void check();
