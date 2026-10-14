# devilray — 원티드/사람인 공고 수집기

키워드 기반으로 채용 공고를 수집해 DB에 쌓고, 새 공고가 뜨면 슬랙/텔레그램으로 알림.

## 구조

```
apps/api          NestJS API + 크롤러 + 스케줄러
apps/web          Next.js 대시보드 (Phase 5)
packages/shared   zod 스키마 / 타입 공유
docker-compose    Postgres 16 + Redis 7
```

## 시작하기

```bash
# 1. 의존성
pnpm install

# 2. 인프라 (Docker Desktop 필요)
pnpm infra:up

# 3. 환경변수
cp .env.example .env

# 4. API 실행
pnpm dev
# -> http://localhost:3000/health
```

## 단계별 진행

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 모노레포 + docker-compose + health | ✅ |
| 1 | Prisma + 원티드 수집기 (수동 트리거) | ✅ |
| 2 | Slack 알림 + 크론 + 제목 필터 | ✅ |
| 3 | BullMQ 큐 + Bull Board | ✅ |
| 4 | 사람인 (Playwright) | ✅ |
| 5 | Next.js 프론트 | |
| 6 | 텔레그램 + 중복 강화 + 운영 | |

## DB / 크롤 명령

```bash
pnpm --filter api db:migrate     # 스키마 변경 후 마이그레이션 생성+적용
pnpm --filter api db:seed        # 기본 SearchProfile 시드
pnpm --filter api db:studio      # Prisma Studio

# 수동 크롤 트리거 (profileId 기본 1)
curl -X POST "localhost:3000/crawl/wanted?profileId=1"        # 큐에 넣고 바로 반환 { queue, jobId }
curl -X POST "localhost:3000/crawl/wanted/sync?profileId=1"   # 인라인 실행 후 결과 반환 (디버깅용)
curl -X POST "localhost:3000/crawl/saramin?profileId=1"       # 사람인 (Playwright)
curl "localhost:3000/queues"                                  # 큐별 카운트
# Bull Board UI: http://localhost:3000/admin/queues
curl "localhost:3000/postings?limit=20&source=wanted"
curl "localhost:3000/runs"
```

## 알림 / 스케줄 설정

`.env`에 아래를 넣으면 켜집니다. 없으면 크롤만 하고 알림은 건너뜁니다.

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ   # Slack 앱 > Incoming Webhooks
CRAWL_CRON=*/30 * * * *        # 기본 30분
CRAWL_ON_BOOT=true             # 기동 직후 1회 실행 (개발용)
```

- 알림 대상: 최근 `NOTIFY_LOOKBACK_HOURS`(기본 24h) 안에 처음 본 공고 중 아직 성공 로그가 없는 것. `NotificationLog(postingId, channel, kind)` unique라 같은 공고가 두 번 가지 않고, 웹훅 실패는 다음 실행에서 재시도됩니다.
- Slack 메시지는 10건씩 묶어 1개 메시지로 보냅니다.
- 제목 필터: 사이트 검색이 느슨해서 `SearchProfile.includeTitle`(하나라도 포함) / `excludeTitle`(포함 시 제외)로 걸러서 저장합니다. 둘 다 비우면 전부 저장. 기본 시드는 include = node, nest, backend, 백엔드, 서버.

## 큐 (BullMQ)

```
크론 tick ─► crawl-wanted 큐 ─► WantedCrawlProcessor ─► 신규 insert 있으면 ─► notify 큐 ─► NotifyProcessor ─► Slack
```

- 소스별 크롤 큐(`crawl-wanted`, `crawl-saramin`). concurrency 1, lockDuration 5분, 3회 재시도(지수 백오프 10s).
- 크롤 jobId = `{source}-{profileId}-{YYYYMMDDHHmm}`. 같은 분에 중복 enqueue 돼도 하나로 합쳐집니다.
- notify 잡은 미발송 건이 하나라도 실패하면 throw 해서 BullMQ가 재시도합니다. 발송 자체의 멱등성은 NotificationLog가 보장.
- `ROLE=api`로 띄우면 HTTP + enqueue만 하고 워커/크론은 돌지 않습니다(기본 `all`). 나중에 프로세스를 나눌 때 사용.
- `QUEUE_DRAIN_ON_BOOT=true`면 기동 시 waiting/delayed 잡을 비웁니다.
- 주의: BullMQ 6는 `ioredis`를 직접 의존성으로 요구합니다. 없으면 재연결 에러가 무한 로그로 찍힙니다.

## 사람인 (Playwright)

- 검색 결과 페이지(`/zf_user/search/recruit`)는 서버 렌더링이라 Playwright가 `.item_recruit`를 `page.$$eval`로 파싱합니다. 키워드당 `SARAMIN_MAX_PAGES`(기본 2, 40건/페이지).
- 브라우저는 크롤 1회마다 열고 닫습니다. Windows watch 모드에서 chrome 고아 프로세스가 쌓이는 걸 막기 위한 선택이며, 프로필(`.data/pw-profile`)은 유지돼 쿠키가 남습니다.
- 차단/레이아웃 변경으로 결과가 안 잡히면 `storage/debug/`에 스크린샷을 남기고 실패합니다. `PW_HEADLESS=false`로 창을 띄워 보면서 디버깅.
- 크로미엄 설치: `pnpm --filter api exec playwright install chromium` (최초 1회).
- 고아 프로세스 정리가 필요하면: `taskkill /F /IM chrome-headless-shell.exe`
