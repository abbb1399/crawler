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
| 1 | Prisma + 원티드 수집기 (수동 트리거) | |
| 2 | Slack 알림 + 크론 | |
| 3 | BullMQ 큐 | |
| 4 | 잡코리아 (Playwright) | |
| 5 | Next.js 프론트 | |
| 6 | 텔레그램 + 중복 강화 + 운영 | |
