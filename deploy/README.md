# 서버 배포

AWS Lightsail(서울, Ubuntu 24.04, 2GB) 한 대에 `docker-compose.prod.yml`로 전부 올린다.

```
인터넷 ─► Caddy :443 (HTTPS 자동 + Basic Auth)
            ├─ /admin/queues* ─► api:3000 (Bull Board)
            └─ 그 외          ─► web:3001 ─► api:3000
api ─► postgres, redis   (Caddy 외에는 포트를 열지 않음)
```

## 서버 .env (`~/trawler/.env`, 커밋하지 않음)

```
POSTGRES_PASSWORD=<openssl rand -hex 24>
SITE_ADDRESS=<도메인 또는 1-2-3-4.sslip.io>
BASIC_AUTH_USER=trawler
BASIC_AUTH_HASH='<docker run --rm caddy:2 caddy hash-password --plaintext 비밀번호>'   # 작은따옴표 필수($ 포함)
# 이하 선택. api 컨테이너로 그대로 전달됨
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

`.env`를 바꾼 뒤에는 `docker compose -f docker-compose.prod.yml up -d`로 반영.

## 재배포

```bash
scripts/deploy.sh ubuntu@<서버 IP>     # 작업 트리를 올리고 이미지 재빌드
```

## 운영 명령 (서버에서, `cd ~/trawler`)

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml exec -T api curl -s -X POST "localhost:3000/crawl?profileId=1"   # 지금 수집
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U trawler trawler | gzip > backup.sql.gz  # 백업
```

## 처음 세팅할 때 한 것

- Lightsail 인스턴스 + 고정 IP, 방화벽 22/80/443(tcp, udp).
- user-data: 스왑 2GB, 타임존 Asia/Seoul, Docker 설치(get.docker.com). Docker가 부팅 시 켜지고 컨테이너는 `restart: unless-stopped`라 재부팅해도 다시 뜬다.
- 로컬 DB를 `pg_dump`로 떠서 api를 띄우기 전에 서버 postgres에 복원(마이그레이션 이력 포함이라 `migrate deploy`는 no-op).
