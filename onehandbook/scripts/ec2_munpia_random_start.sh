#!/usr/bin/env bash
# EC2 cron용: 데일리 완료 마커 → 04:10~06:00 KST 구간 의도에 맞춰 랜덤 지연 → 문피아 심층 실행.
# crontab: CRON_TZ=Asia/Seoul → 10 4 * * * /path/to/ec2_munpia_random_start.sh
# .env.local 에 MUNPIA_READER_CRON_ENABLED=1 일 때만 실제 실행(미설정·0 = 즉시 종료)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! node -e "
try {
  require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
} catch (e) {}
const v = String(process.env.MUNPIA_READER_CRON_ENABLED || '').trim().toLowerCase();
process.exit(['1','true','yes','on'].includes(v) ? 0 : 1);
" 2>/dev/null; then
  echo "[ec2_munpia_random_start] MUNPIA_READER_CRON_ENABLED 비활성 — 스킵"
  exit 0
fi

YMD="$(TZ=Asia/Seoul date +%F)"
MARKER="$ROOT/data/trends/cron-markers/daily-done-${YMD}.json"
POLL_SEC="${MUNPIA_EC2_MARKER_POLL_SEC:-30}"
# 데일리가 늦게 끝나도 기다림 (기본 2시간)
MARKER_WAIT_MAX_SEC="${MUNPIA_EC2_MARKER_WAIT_MAX_SEC:-7200}"
MAX_DELAY_MIN="${MUNPIA_EC2_RANDOM_DELAY_MAX_MIN:-110}"

echo "[ec2_munpia_random_start] KST=${YMD} 마커 대기: ${MARKER}"
now="$(date +%s)"
deadline=$((now + MARKER_WAIT_MAX_SEC))
while [[ ! -f "$MARKER" ]]; do
  if (( $(date +%s) >= deadline )); then
    echo "[ec2_munpia_random_start] 타임아웃: 데일리 마커 없음 — 종료" >&2
    exit 1
  fi
  sleep "$POLL_SEC"
done

DELAY_MIN=$((RANDOM % (MAX_DELAY_MIN + 1)))
echo "[ec2_munpia_random_start] 마커 확인됨 → ${DELAY_MIN}분 추가 대기 후 trends:munpia-scrape"
sleep $((DELAY_MIN * 60))
exec npm run trends:munpia-scrape
