# 문피아 크롤링·트렌드 파이프라인 정리

Novel Agent 트렌드 RAG용으로 **문피아**에서 데이터를 가져오는 경로를 한곳에 모았습니다.  
상세 구현은 코드 주석·환경변수 예시가 원본입니다.

---

## 1. 무엇이 “문피아 크롤링”인가

크게 두 갈래입니다.

| 구분 | 설명 | 진입점 |
|------|------|--------|
| **데일리 랭킹 스냅샷** | Playwright로 모바일/PC 투데이 등 **랭킹 페이지**를 읽어 Serper+Claude 리포트에 반영 | `scripts/automate_trends.ts` (기본 실행 / `--dry-run` / `--cron`) |
| **문피아 독자뷰 심층** | 로그인 세션으로 **뷰어 본문** + 회차별 **조회·추천 등 UI 지표**(가능 시) 수집 → 요약·인제스트 | `scripts/automate_trends.ts --munpia-scrape` |

---

## 2. 문피아 독자뷰 심층 (상세)

### 2.1 한 줄 요약·수집 목적

**유료 뷰어에 들어가서** 여러 회차 본문을 사람처럼 읽는 패턴(대기·스크롤·가끔 목차 복귀)으로 모은 뒤, Claude로 **독자 관점 마크다운 요약**을 만들고 `data/trends/*.md`에 저장한 다음 **`ingestData`로 Supabase `trends` + Chroma**에 넣습니다.

**회차별 조회·추천(등) 표기**는 뷰어 상단·툴바 등에서 `extractMunpiaReaderEpisodeEngagement` 로 읽어, 코퍼스 상단에 한 줄 메타로 붙입니다. 목적은 **연독률**(회차 간 이탈·재방문·몰입) **알고리즘**을 설계·검증할 때, 순수 본문만으로는 보기 어려운 **플랫폼 노출 참여 신호**를 같은 시점·같은 회차 단위로 남기기 위함입니다. (절대값만으로 작품 가치를 단정하지 않고, 시계열·회차 간 비율·베스트 대비 상대 등 후단 분석에서 쓰는 **외생 변수**로 취급하는 전제입니다.)

### 2.2 실행 조건·락

- **진입:** `npm run trends:munpia-scrape` 또는 `trends:munpia-scrape:dry`
- **동시 실행 방지:** 시작 시 `data/trends/locks/munpia-reader.lock.json` 을 exclusive 생성. 이미 있으면 **전체 스킵**. 비정상 종료 시 `npm run munpia:unlock`
- **필수:** 유효한 쿠키 JSON (`PLAYWRIGHT_COOKIES_PATH` 또는 `data/cookies.json`). 없으면 즉시 에러 — `npm run cookies:munpia` 로 갱신
- **로그인 페이지 리다이렉트**(`nssl.munpia.com/login` 등) 감지 시: 설정돼 있으면 `COMMANDER_ALERT_WEBHOOK_URL` 로 알림 후 실패

### 2.3 자동 vs 수동 모드

| 모드 | 조건 | 동작 |
|------|------|------|
| **자동** | `MUNPIA_READER_WORKS_JSON` 비움 · 작품 파일 미지정 | 모바일 베스트 페이지에서 상위 **40위**까지 파싱 → 아래 **선정 로직**으로 최대 `MUNPIA_READER_MAX_WORKS_PER_RUN`(기본 10)건까지 큐 구성 |
| **수동** | JSON(환경변수·파일) | 항목당 `title` 필수. **`urls`** 에 뷰어 URL 나열(최대 30) **또는** `urls` 비우고 **`novelKey`(숫자)** / **`detailUrl`** 만 주면 목차에서 회차 **자동 선정**(자동 모드와 동일한 `munpiaReaderDiscoverEpisodeUrls`). 최대 10작(`MUNPIA_READER_MAX_WORKS` 상한) |

**수동 JSON을 넣는 방법(택일, 아래로 갈수록 우선)**

1. **`MUNPIA_READER_WORKS_JSON`** — 한 줄 JSON 문자열(쉘 이스케이프 주의)  
2. **`MUNPIA_READER_WORKS_PATH`** — 프로젝트 루트 기준 상대 경로의 `.json` 파일  
3. **CLI** — `npm run trends:munpia-scrape -- --munpia-works-file=./scripts/my-works.json` 또는 `--munpia-works-file ./path`(다음 인자)  
   - 파일이 있으면 **`.env` 의 `MUNPIA_READER_WORKS_JSON` 보다 우선**해 내용을 주입합니다.

스키마 예시는 `scripts/munpia-reader-works.example.json` 참고. 드라이런 샘플:  
`npm run trends:munpia-scrape:example` (예시 1작 — 부하 줄이려면 `MUNPIA_READER_MAX_WORKS_PER_RUN`·`EPISODES_*` 를 함께 지정).

자동 모드에서는 당일 베스트를 **`data/trends/munpia-snapshots/best-{YYYY-MM-DD}.json`** 에 저장(드라이런은 파일 생략). **어제** 같은 형식의 스냅샷이 있어야 `new_in_top20`(베스트 20 신규 진입) 태깅이 동작합니다. 없으면 **순위 10계단 이상 상승(`rank_jump_10`)** 만 급상승으로 잡힙니다.

### 2.4 자동 선정 우선순위 (`planMunpiaReaderTargets`)

`munpiaReaderSelection.ts` 기준:

1. **급상승 풀:** `isRisingStar` 이고 아직 인제스트 안 된 작품, 순위 오름차순, 상한까지 채움  
   - `new_in_top20`: 오늘 20위 안인데 **어제 스냅샷의 상위 20에 없던** novel_key  
   - `rank_jump_10`: 어제 대비 순위가 **10칸 이상** 올라온 경우
2. **일반 풀:** 1~20위, 급상승 아님, 미인제스트 — 순위 순으로 나머지 슬롯 채움

이미 `trends` 테이블에서 `platform = '문피아-독자뷰요약'` 인 행의 `extra.munpia_novel_key` 로 수집 이력을 모아 **중복 스킵**합니다. `MUNPIA_READER_IGNORE_DUPLICATE=1` 이거나 **드라이런 + `MUNPIA_READER_FILTER_RANKS`** 조합이면 계획 단계에서 중복 무시.

`MUNPIA_READER_FILTER_RANKS=1` 또는 `1,2,3` 형태면 **자동 모드에서만** 해당 순위만 남깁니다.

### 2.5 오늘 하드캡

드라이런이 아니고 `MUNPIA_READER_IGNORE_DUPLICATE` 가 꺼져 있으면, 시작 시점에 **오늘(서울일) `문피아-독자뷰요약` 건수**가 이미 `maxW` 이상이면 **아무 작품도 돌리지 않고 종료**합니다. 같은 날 과도한 적재를 막는 장치입니다.

### 2.6 브라우저 안에서의 흐름 (작품 1건)

1. **작품 상세** (`detailUrl`) 진입 후 2~2.6초 체류, 짧은 스크롤·휠
2. **회차 URL 수집** (`munpiaReaderDiscoverEpisodeUrls`)  
   - 우선 `novel.munpia.com/{key}/page/9999` 부근을 **최대 `MUNPIA_READER_EPISODE_NO_SCAN_PAGES`(기본 3, 1~6)** 번 탐색해 **화 번호(1화, 2화…)** 와 매칭되는 `/neSrl/` 링크를 모음  
   - 부족하면 `MUNPIA_READER_TOC_MAX_PAGE`(기본 3) 범위 목차에서 **리스트 하단 쪽** 회차를 역순으로 쌓는 폴백  
   - 그래도 없으면 목차 폴백 표현식으로 앞쪽 회차
3. **뷰어 순회** (`scrapeMunpiaWorkEpisodesHumanLike`): 회차마다 진입 → `MUNPIA_READER_EPISODE_WAIT_MS_*` 대기 → 천천히 스크롤(상한 `MUNPIA_READER_SCROLL_MAX_MS`) → `extractMunpiaReaderMainText` 로 본문 추출 → `extractMunpiaReaderEpisodeEngagement` 로 **조회·추천(등)** 을 찾으면 회차 블록 상단에 `*(이 회차 화면에서 추출한 지표 — …)*` 한 줄을 붙임(연독률 분석용; DOM 개편 시 누락 가능)  
   - 회차 사이: `MUNPIA_READER_BETWEEN_EPISODES_MS_*`  
   - 수집 화수가 10화 이상이면 **3화마다** 목차로 나갔다가 다시 들어오는 동작(`exitToTocEvery`)을 섞음
4. 작품 사이: `MUNPIA_READER_BETWEEN_WORKS_MS_*`

### 2.7 회차 수·10~15화 추가(레거시 증분)

- 기본은 **`MUNPIA_READER_EPISODES_MIN` ~ `MAX` 가 15~15** → 모든 자동·일반 작품에 대해 **최대 15화**까지 동일하게 수집(환경변수로만 하한·상한 변경).

**이미 같은 날·같은 dedup으로 5화 이상 분석이 있고 15화 미만**이면(과거 짧은 수집 데이터), 다음 실행에서 **10~15화 구간만** 추가 스크랩 후 Claude 요약을 **기존 본문 뒤에 append** (`## 추가 분석 (10~15화)`). 메타 `episodes_analyzed_max` 등으로 판별합니다.

### 2.8 Claude 요약·저장·인제스트

- 원문 코퍼스는 Claude 입력 시 **`MUNPIA_READER_CLAUDE_CORPUS_MAX_CHARS`(기본 96,000자, 상한 500,000)** 까지 잘림. 15화·장문이면 env 로 상향  
- 시스템/유저 프롬프트는 **독자·편집자 톤**, 고정 소제목 네 개: `문체 특징` / `주인공의 결핍` / `수집 회차 구간의 터닝포인트` / `조회·추천 지표의 회차 간 변화 (연독률 맥락)` — 마지막 절에서 회차 순 **조회·추천의 상승·하락·정체**를 서술  
- 급상승이면 프롬프트에 `rising_reason`, 당일 순위 힌트 포함  
- 저장 파일명: `data/trends/munpia-reader-{slug}-{YYYY-MM-DD}.md`  
- Front matter: `munpia_novel_key`, `munpia_rank`, `is_rising_star`, `rising_reason`  
- **`ingestData`:** `platform: "문피아-독자뷰요약"`, `extra`에 pipeline·novel_key·rank·회차 수 등. Chroma 호스트는 `CHROMA_SERVER_HOST` / `CHROMA_HOST` 등 환경변수 우선

### 2.9 HTTP 403·429·5xx

`gotoChecked` 에서 위 상태면 예외 → 해당 작품은 스킵하거나, 메시지가 차단 패턴이면 **`MUNPIA_READER_BACKOFF_MS`(기본 20분, 30초~6시간 클램프)** 만큼 sleep 후 **파이프라인 전체 종료**

### 2.10 `--cron` 과의 관계

장기 `trends:automate:cron` 프로세스 안에서 **`MUNPIA_READER_CRON_ENABLED=1`** 일 때만 문피아 심층을 **04:10~ 서울** 윈도우에 별도 스케줄로 등록합니다. EC2 셸 스크립트는 데일리 마커·랜덤 지연 후 **`trends:munpia-scrape`** 를 직접 호출하는 패턴이 별도로 있습니다(문서 §5).

---

## 3. npm 스크립트

`package.json` 기준:

| 명령 | 의미 |
|------|------|
| `npm run trends:automate` | 데일리 파이프라인 1회 (Serper + 랭킹 + Claude + 인제스트) |
| `npm run trends:automate:cron` | node-cron으로 스케줄 등록 (장기 프로세스) |
| `npm run trends:automate:dry` | 저장·인제스트 생략 드라이런 |
| `npm run trends:munpia-scrape` | 문피아 독자뷰 심층 파이프라인 |
| `npm run trends:munpia-scrape:dry` | 위 드라이런 |
| `npm run cookies:munpia` | Playwright로 로그인 후 `storageState` 등 세션 저장 |
| `npm run munpia:unlock` | 독자뷰 락 파일 정리 |

---

## 4. 환경변수 (요약)

전체 예시는 **`onehandbook/.env.local.example`** 의 `트렌드 자동화` / `문피아` 블록을 따릅니다.

**데일리·랭킹 (선택 덮어쓰기)**

- `MUNPIA_RANKING_URL`, `MUNPIA_TODAY_BEST_URL` — DOM 바뀔 때 URL 교체

**문피아 심층 크론 (EC2 등)**

- `MUNPIA_READER_CRON_ENABLED=1` — `trends:automate:cron` 안에서만 문피아 심층 스케줄 등록

**독자뷰 수집 (`trends:munpia-scrape`)**

- `MUNPIA_READER_WORKS_JSON` — 비우면 자동 선정(베스트·급상승 등), 채우면 수동 작품 목록
- `MUNPIA_BEST_MOBILE_URL` — 베스트 목록 URL
- `MUNPIA_READER_MAX_WORKS_PER_RUN`, `MUNPIA_READER_FILTER_RANKS`, `MUNPIA_READER_IGNORE_DUPLICATE`
- `MUNPIA_READER_BETWEEN_WORKS_MS_*`, `MUNPIA_READER_EPISODE_WAIT_MS_*`, `MUNPIA_READER_BETWEEN_EPISODES_MS_*`
- `MUNPIA_READER_EPISODES_MIN`, `MUNPIA_READER_EPISODES_MAX` — 수집 회차 상한 랜덤 구간(기본 15~15)
- `MUNPIA_READER_CLAUDE_CORPUS_MAX_CHARS` — Claude에 넘기는 뷰어 원문 최대 글자수(기본 96,000, 최대 500,000)
- `MUNPIA_READER_EPISODE_NO_SCAN_PAGES` — 목차 끝쪽(`page/9999` 근처) 스캔 페이지 수 (1~6, 기본 3)
- `MUNPIA_READER_SCROLL_MAX_MS`, `MUNPIA_READER_BACKOFF_MS`, `MUNPIA_CRON_RANDOM_DELAY_MAX_MS`
- `MUNPIA_READER_TOC_MAX_PAGE` — 목차 폴백 시 `page/1~N` 범위

**세션(쿠키)**

- `PLAYWRIGHT_COOKIES_PATH` — 기본 `./data/cookies.json` 권장
- `MUNPIA_LOGIN_ID`, `MUNPIA_LOGIN_PASSWORD`, `MUNPIA_LOGIN_PAGE_URL` — `cookies:munpia`용

**Playwright**

- `HEADLESS=0` — 로컬에서 캡차·디버깅 시 권장
- `PLAYWRIGHT_UA_PROFILE`, `PLAYWRIGHT_REQUEST_DELAY_MS_*` — `automate_trends.ts` 상단 주석 참고

---

## 5. EC2 크론: 데일리 후 문피아 심층

`scripts/ec2_munpia_random_start.sh`

- `CRON_TZ=Asia/Seoul` 기준 예: `10 4 * * *` 로 실행
- `data/trends/cron-markers/daily-done-{날짜}.json` 마커를 기다린 뒤 랜덤 지연 → `npm run trends:munpia-scrape`
- `.env.local` 에 `MUNPIA_READER_CRON_ENABLED` 가 켜져 있을 때만 실제 실행

---

## 6. 소스 코드 맵

| 파일 | 역할 |
|------|------|
| `scripts/automate_trends.ts` | `runMunpiaReaderScrapePipeline`, 뷰어 수집·Claude·저장·ingest |
| `src/lib/scraping/munpiaReaderSelection.ts` | 베스트 스냅샷 I/O, `planMunpiaReaderTargets`, 인제스트된 novel_key 조회, 목차/회차 DOM 수집용 `evaluate` 문자열 빌더 |
| `src/lib/scraping/freeEpisodeExtract.ts` | 뷰어 본문 (`extractMunpiaReaderMainText`) · 회차 UI 지표 (`extractMunpiaReaderEpisodeEngagement`) |
| `scripts/save_munpia_storage_state.ts` | 로그인 세션 저장 |
| `scripts/clear_munpia_reader_lock.ts` | 락 해제 |

---

## 7. 운영 시 주의

- 문피아 DOM/정책 변경 시 **셀렉터·URL** 조정이 필요할 수 있음.
- 과도한 요청은 **차단·백오프**로 이어지므로 대기(ms) 환경변수를 함부로 줄이지 말 것.
- `data/cookies.json` 등 **비밀·세션 파일은 커밋 금지**.

---

**원본이 더 길면:** `scripts/automate_trends.ts` 1~25행 주석과 `.env.local.example` 73~130행을 함께 보면 됩니다.
