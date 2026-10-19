# 서버 배포

AWS Lightsail(서울, Ubuntu 24.04, 2GB) 한 대에 `docker-compose.prod.yml`로 전부 올린다.

```
인터넷 ─► Caddy :443 (HTTPS 자동)
            ├─ /admin/queues* ─► api:3000 (Bull Board, Basic Auth)
            └─ 그 외          ─► web:3001 ─► api:3000
api ─► postgres, redis   (Caddy 외에는 포트를 열지 않음)
```

## 운영 환경

| 항목 | 값 |
|---|---|
| URL | https://3-39-184-37.sslip.io (대시보드 공개, Bull Board `/admin/queues`는 Basic Auth) |
| 클라우드 | AWS Lightsail, 서울 리전 `ap-northeast-2` (가용 영역 `ap-northeast-2a`) |
| 인스턴스 | `trawler`, 번들 `small_3_0` (2 vCPU, RAM 2GB, SSD 60GB, 트래픽 3TB/월), Ubuntu 24.04 LTS |
| 비용 | 월 $12 (고정 IP는 인스턴스에 붙어 있는 동안 무료) |
| 고정 IP | `trawler-ip` = 3.39.184.37 |
| 도메인 / TLS | [sslip.io](https://sslip.io) (IP를 그대로 쓰는 와일드카드 DNS) + Caddy가 Let's Encrypt 인증서를 자동 발급·갱신 |
| 방화벽 | 22/tcp (SSH, 키 인증만), 80/tcp, 443/tcp+udp. DB·Redis·API 포트는 외부에 열지 않음 |
| 서버 설정 | 스왑 2GB (크로미엄 + Next 빌드 대비), 타임존 Asia/Seoul, Docker 엔진 |
| 배포 권한 | Lightsail 권한(`lightsail:*`)만 가진 전용 IAM 사용자로 CLI에서 생성. 이후 재배포는 SSH만 사용 |

### 왜 Lightsail + 한 대인가

- API가 상시 프로세스다. 30분 크론, BullMQ 워커, Playwright 크로미엄(수십 초, 메모리 수백 MB) 때문에 Lambda·Vercel 같은 서버리스에 맞지 않는다.
- 개인용이라 트래픽이 거의 없다. Postgres/Redis를 관리형(RDS, ElastiCache)으로 나누면 비용만 몇 배가 된다.
- 원티드/사람인은 국내 사이트라 서울 IP에서 수집하는 편이 안전하다. Lightsail은 서울 리전이 있고 요금이 고정이다.
- 로컬 개발용 `docker-compose.yml`과 거의 같은 구성을 그대로 올릴 수 있다.

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
