import dotenv from "dotenv";
import { ingestData } from "../src/lib/trends/ingestData";

// Next.js 런타임이 아니라서 .env.local을 자동 로드하지 않습니다.
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback: .env

async function runTest() {
  console.log("데이터 인제스트 테스트 시작...");

  const sampleData = {
    title: "오늘의 웹소설 트렌드 테스트",
    content:
      "최근 판타지 시장에서는 #회귀물 보다는 #상태창 없는 정통 판타지가 다시 고개를 들고 있습니다.",
    tags: ["판타지", "트렌드", "테스트"],
    platform: "문피아",
  };

  try {
    const genre = sampleData.tags[0] ?? "전체";
    const targetDate = new Date().toISOString().slice(0, 10);

    const res = await ingestData({
      title: sampleData.title,
      body: sampleData.content,
      genre,
      platform: sampleData.platform,
      targetDate,
      citationSource: `test-ingest:${sampleData.platform}`,
      extra: {
        tags: sampleData.tags,
        platform: sampleData.platform,
      },
    });

    console.log("인제스트 성공:", res);
    console.log("이제 Supabase(trends)와 Chroma(webnovel-trends)를 확인하세요.");
  } catch (error) {
    console.error("인제스트 실패:", error);
    process.exitCode = 1;
  }
}

void runTest();
