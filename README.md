# devilray — 원티드/잡코리아 공고 수집기

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
| 3 | BullMQ 큐 | |
| 4 | 잡코리아 (Playwright) | |
| 5 | Next.js 프론트 | |
| 6 | 텔레그램 + 중복 강화 + 운영 | |

## DB / 크롤 명령

```bash
pnpm --filter api db:migrate     # 스키마 변경 후 마이그레이션 생성+적용
pnpm --filter api db:seed        # 기본 SearchProfile 시드
pnpm --filter api db:studio      # Prisma Studio

# 수동 크롤 트리거 (profileId 기본 1)
curl -X POST "localhost:3000/crawl/wanted?profileId=1"
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
