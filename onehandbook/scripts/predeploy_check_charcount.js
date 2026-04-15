/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

/**
 * 배포 전 "글자 수/스키마 꼬임" 회귀를 막는 최소 스모크 체크.
 * - analysis-data route가 char_count 컬럼 부재 폴백을 갖는지
 * - 통합 분석 500자 미만 오탐(0을 미만으로 취급)을 피하는지
 */
function main() {
  const root = path.resolve(__dirname, "..");
  const analysisDataRoute = path.join(
    root,
    "src/app/api/works/[workId]/analysis-data/route.ts"
  );
  const hub = path.join(root, "src/app/works/[id]/analysis/WorkAnalysisHub.tsx");

  const routeSrc = read(analysisDataRoute);
  assert(
    routeSrc.includes("column analysis_runs.char_count does not exist"),
    "analysis-data/route.ts: char_count 컬럼 부재 폴백이 없습니다."
  );
  assert(
    routeSrc.includes("loadRuns"),
    "analysis-data/route.ts: loadRuns() 폴백 로직이 없습니다."
  );

  const hubSrc = read(hub);
  assert(
    hubSrc.includes('0은 "아직 글자 수를 모름"'),
    "WorkAnalysisHub.tsx: 통합 분석 500자 미만 오탐 방지 로직(0 처리)이 없습니다."
  );
  assert(
    hubSrc.includes(".filter((r) => Number(r.episode_id) === panelEpisodeId)"),
    "WorkAnalysisHub.tsx: panelAnalyses 필터가 Number 캐스팅을 하지 않습니다."
  );

  console.info("predeploy_check_charcount: OK");
}

main();

