/**
 * 분석 잡 stale 판정에 쓰는 임계값을 한곳에서 관리한다.
 *
 * 워커 라우트(`/api/analyze/process`) 의 segment maxDuration 과 폴링·조회 시 쓰는
 * cutoff 가 따로 놀면 "워커는 이미 죽었는데 폴링은 한참 봐주는" 좀비 구간이 생긴다.
 * 그래서 worker 한계(env) + heartbeat grace 를 단일 식으로 정의한다.
 */

/** heartbeat 60s 주기 + DB 반영 지연을 흡수하기 위한 마진. */
const HEARTBEAT_GRACE_MS = 120_000;

/** `/api/analyze/process` maxDuration 의 미러. env 미설정 시 default 600s. */
function workerMaxDurationMs(): number {
  const sec = parseInt(process.env.ANALYZE_PROCESS_MAX_DURATION_SEC ?? "600", 10);
  const effective = Number.isFinite(sec) && sec > 0 ? Math.min(sec, 800) : 600;
  return effective * 1000;
}

/**
 * 통합(holistic_batch) 분석이 processing 상태로 박혀있을 때 stale 로 간주할 시간.
 * worker maxDuration + heartbeat grace.
 */
export function holisticProcessingStaleThresholdMs(): number {
  return workerMaxDurationMs() + HEARTBEAT_GRACE_MS;
}

/**
 * 단일 회차(episode) 분석 stale 임계값.
 * 보수적으로 5분 유지 — 정상 episode 워커는 보통 60s 안에 끝남.
 */
export function episodeProcessingStaleThresholdMs(): number {
  return 5 * 60 * 1000;
}
