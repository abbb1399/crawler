# trawler — 원티드/사람인 공고 수집기

키워드 기반으로 채용 공고를 수집해 DB에 쌓고 대시보드에서 봅니다. 새 공고 슬랙 알림은 코드만 있고 아직 연동 전입니다.

**Live:** https://3-39-184-37.sslip.io  ·  AWS Lightsail(서울)에서 08~22시 2시간마다 수집. 

배포 구성과 재배포 방법은 [deploy/README.md](deploy/README.md).

## 구조

```
apps/api          NestJS API + 크롤러 + 스케줄러 (BullMQ)
apps/web          Next.js 대시보드 (공고 목록 / 프로필 관리 / 실행 이력)
packages/shared   zod 스키마 / 타입 공유
deploy/           Lightsail 배포 (Docker Compose + Caddy)
docker-compose    로컬용 Postgres 16 + Redis 7
```

## 로컬 실행

```bash
pnpm install
pnpm infra:up                  # Docker Desktop 필요
cp .env.example .env
pnpm dev                       # API http://localhost:3000, 대시보드 http://localhost:3001
```

`pnpm dev:api` / `pnpm dev:web`으로 따로 띄울 수 있습니다. 사람인 수집에는 크로미엄이 필요합니다: `pnpm --filter api exec playwright install chromium` (최초 1회).

### 테스트

```bash
pnpm test          # 단위 테스트 (api · shared · web, vitest)
pnpm test:int      # 통합 테스트 — 로컬 Postgres에 trawler_test DB를 만들고 마이그레이션 후 실행
```

CI(`.github/workflows/deploy.yml`)는 PR과 main 푸시에서 타입체크·린트·단위·통합 테스트를 Postgres 서비스 컨테이너로 돌리고, 통과해야 이미지를 빌드·배포합니다.

### DB / 크롤 명령 (로컬)

```bash
pnpm --filter api db:migrate   # 스키마 변경 후 마이그레이션 생성+적용
pnpm --filter api db:seed      # 기본 SearchProfile 시드
pnpm --filter api db:studio    # Prisma Studio

curl -X POST "localhost:3000/crawl/wanted?profileId=1"        # 큐에 넣고 바로 반환
curl -X POST "localhost:3000/crawl/wanted/sync?profileId=1"   # 인라인 실행 후 결과 반환 (디버깅용)
curl -X POST "localhost:3000/crawl/saramin?profileId=1"
curl "localhost:3000/queues"                                  # 큐별 카운트
# Bull Board: http://localhost:3000/admin/queues
```

## 설정 (.env)

```
CRAWL_CRON=*/30 * * * *        # 수집 주기. 운영은 0 8-22/2 * * *
CRAWL_ON_BOOT=true             # 기동 직후 1회 실행 (개발용)
LOG_LEVEL=info                 # 기본: production=info, 그 외=debug
SLACK_WEBHOOK_URL=...          # 넣으면 새 공고 알림 (미연동, 아래 참고)
```

- 제목 필터: 사이트 검색이 느슨해서 `SearchProfile.includeTitle`(하나라도 포함) / `excludeTitle`(포함 시 제외)로 걸러서 저장합니다. 둘 다 비우면 전부 저장.
- 지역: `SearchProfile.regions`(서울/경기/인천, 비우면 전국)로 사이트 검색 자체를 좁힙니다. 사람인은 지역 필터가 느슨해서 위치 문자열로 한 번 더 거릅니다.

## API 문서 · 오류 형식

- `/docs`에 Scalar UI, `/openapi.json`에 OpenAPI 3.1 문서. `packages/shared`의 zod 스키마에서 `zod-openapi`로 생성하므로 코드와 문서가 같은 계약을 본다(`apps/api/src/docs/openapi.ts`). 운영: https://3-39-184-37.sslip.io/docs
- 모든 오류 응답은 `ErrorBody` 한 형식: `{ statusCode, error, message, issues?, requestId, path, timestamp }`. 검증 실패(400)는 `issues[]`, Prisma unique/not-found는 409/404, 그 외는 500에 일반 메시지(상세는 서버 로그에 `requestId`와 함께). 요청마다 `x-request-id` 헤더를 돌려준다.

## 큐 (BullMQ)

```
크론 tick ─► crawl-wanted / crawl-saramin 큐 ─► 크롤 프로세서 ─► 신규 insert 있으면 ─► notify 큐
```

- 소스별 크롤 큐. concurrency 1, lockDuration 5분, 3회 재시도(지수 백오프 10s).
- 크롤 jobId = `{source}-{profileId}-{YYYYMMDDHHmm}`. 같은 분에 중복 enqueue 돼도 하나로 합쳐집니다.
- `ROLE=api`로 띄우면 HTTP + enqueue만 하고 워커/크론은 돌지 않습니다(기본 `all`).
- `QUEUE_DRAIN_ON_BOOT=true`면 기동 시 waiting/delayed 잡을 비웁니다.
- BullMQ 6는 `ioredis`를 직접 의존성으로 요구합니다. 없으면 재연결 에러가 무한 로그로 찍힙니다.

## 사람인 (Playwright)

- 검색 결과 페이지는 서버 렌더링이라 Playwright로 `.item_recruit`를 파싱합니다. 키워드당 `SARAMIN_MAX_PAGES`(기본 2, 40건/페이지).
- 브라우저는 크롤 1회마다 열고 닫습니다. 프로필(`.data/pw-profile`)은 유지돼 쿠키가 남습니다.
- 차단/레이아웃 변경으로 결과가 안 잡히면 `storage/debug/`에 스크린샷을 남기고 실패합니다. `PW_HEADLESS=false`로 창을 띄워 보면서 디버깅.

## 대시보드 (apps/web)

- Next.js 16 App Router + Tailwind v4. 페이지는 서버 컴포넌트가 API를 직접 읽고, 버튼은 서버 액션으로 API를 호출합니다. 브라우저는 API에 직접 붙지 않습니다.
- `/` 공고 목록: 소스·검색어·오늘 신규만·숨김만·별표·만료 포함 필터(바꾸는 즉시 적용, 검색어는 debounce, URL 상태는 nuqs), 30건씩 페이지네이션, 숨김/별표 토글. 오늘 처음 잡힌 공고에는 NEW 배지와 헤더 집계. 숨긴 공고는 기본 목록과 통계에서 빠지고, 클릭한 링크는 브라우저 `:visited`로 흐려집니다.
- `/profiles` 검색 프로필 CRUD, 활성 토글, "지금 수집"(모든 소스 enqueue).
- `/runs` 최근 14일 일별 추이 차트(소스별 신규 공고·평균 소요)와 최근 50회 실행 이력.
- API 주소는 `API_URL`(로컬 기본 `http://localhost:3000`), Bull Board 링크는 `NEXT_PUBLIC_BULL_BOARD_URL`.
- 조회는 로그인 없이 공개. 숨김·별표·프로필 변경·지금 수집은 버튼을 누를 때 Clerk 로그인을 요구하고, `OWNER_EMAILS`의 계정만 통과. 키가 없으면 로컬은 열린 모드, 운영은 변경 거부. Bull Board는 Basic Auth.

## 운영 동작

- **로그:** pino JSON 한 줄(개발은 pretty). 요청 중 찍힌 모든 줄에 `req.id`가 붙고 오류 응답의 `requestId`·`x-request-id` 헤더와 같은 값이다. 추적: `docker compose -f docker-compose.prod.yml logs api | grep <requestId>`.
- **헬스:** `GET /health`는 Postgres·Redis(큐 카운트)를 1.5초 안에 확인해 둘 다 정상이면 200 `ok`, 아니면 503 `degraded`(본문에 어느 쪽이 down인지). 운영 compose의 api healthcheck가 이걸 본다.

- **만료:** 매일 `MAINTENANCE_CRON`(기본 03:15)에 마감일이 지났거나 `STALE_DAYS`(14일) 동안 어떤 수집에도 안 잡힌 공고를 EXPIRED로 바꿉니다. 삭제하지 않고, 다시 잡히면 ACTIVE로 복귀. 수동 실행: `POST /maintenance/expire`
- **재게시:** 회사명+제목을 정규화한 `fingerprint`가 `REPOST_WINDOW_DAYS`(45일) 안에 이미 있으면 새 공고에 `repostOfId`를 달고 알림 대상에서 뺍니다(저장은 됨, 목록에 "재게시" 표시). `NOTIFY_REPOSTS=true`면 알림에 포함.
- **알림 (슬랙, 미연동):** `SLACK_WEBHOOK_URL`이 있으면 최근 `NOTIFY_LOOKBACK_HOURS`(기본 24h) 안에 처음 본 공고를 10건씩 묶어 보냅니다. `NotificationLog(postingId, channel, kind)` unique라 같은 공고가 두 번 가지 않고, 실패는 다음 실행에서 재시도. 밀린 알림 재발송: `POST /maintenance/notify`. 크롤 잡이 3회 재시도 후 최종 실패하면 같은 웹훅으로 경고를 보냅니다(`ALERT_MIN_INTERVAL_MIN`, 기본 6시간에 한 번). 운영 서버에는 아직 웹훅을 넣지 않았습니다.
