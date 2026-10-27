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
| 수집 주기 | 평일 08~22시 2시간마다 (KST, 하루 8회, 주말 없음) |
| 서버 설정 | 스왑 2GB (크로미엄 + Next 빌드 대비), 타임존 Asia/Seoul, Docker 엔진 |
| 배포 | `main` 푸시 → GitHub Actions(타입 체크 → 이미지 빌드 → GHCR → 서버 pull) 자동 배포 |
| 인프라 생성 권한 | Lightsail 권한(`lightsail:*`)만 가진 전용 IAM 사용자로 CLI에서 생성 |

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
CRAWL_CRON=0 8-22/2 * * 1-5   # 월~금 08~22시 2시간마다(주 40회). 주말·새벽엔 공고가 거의 없어서 수집 안 함. 기본값은 30분마다
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
# 대시보드 변경 권한 (Clerk). 없으면 운영에서는 모든 변경이 거부된다(조회는 됨)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
OWNER_EMAILS=you@example.com            # 쉼표로 여러 명
```

### Clerk 설정

1. clerk.com에서 앱 생성. `*.sslip.io`에는 프로덕션 인스턴스(자체 도메인 DNS 필요)를 붙일 수 없으니 **개발 인스턴스 키(pk_test/sk_test)**를 그대로 쓴다. 로그인 모달에 "Development mode"가 표시되고 사용자 100명 제한이 있지만 소유자 1명에는 충분하다.
2. Clerk 대시보드 → Restrictions에서 **가입 제한**을 켜고 본인 계정만 가입한다. 코드 쪽 `OWNER_EMAILS` 검사는 이중 안전망.
3. 공개 키는 이미지 빌드 때 인라인되므로 GitHub 저장소 Settings → Secrets and variables → **Variables**에 `CLERK_PUBLISHABLE_KEY`(pk_test…)를 넣는다. 시크릿과 소유자 이메일은 위 `.env`.
4. 조회는 로그인 없이 되고, 숨김·별표·프로필 변경·지금 수집 버튼을 누르는 순간 로그인 모달이 뜬다.

`.env`를 바꾼 뒤에는 `docker compose -f docker-compose.prod.yml up -d`로 반영.

## 배포 (GitHub Actions, 자동)

`main`에 푸시하면 `.github/workflows/deploy.yml`이 돈다. 문서(`*.md`, `docs/`)만 바뀐 푸시는 건너뛴다.

```
check   pnpm install → shared 빌드 → pnpm -r typecheck
build   api, web 이미지를 병렬 빌드 → ghcr.io/abbb1399/trawler-{api,web}:{latest,<sha>} 푸시 (레이어 캐시: GHA)
deploy  서버에 SSH → deploy/server-deploy.sh 실행 → 사이트 200 확인
```

- 서버는 빌드하지 않는다. `git reset --hard origin/main`(compose·Caddyfile 갱신) → `docker compose pull` → `up -d`만 한다. Dockerfile이 의존성 레이어를 먼저 만들어서, 잠금 파일이 그대로면 서버가 받는 건 소스 레이어뿐이다.
- 배포용 SSH 키는 `authorized_keys`에 `command="…/deploy/server-deploy.sh"`로 묶여 있어 이 스크립트 말고는 실행할 수 없다.
- GHCR 인증은 워크플로 실행마다 발급되는 `GITHUB_TOKEN`을 SSH stdin으로 넘겨서 그 자리에서 로그인하고 로그아웃한다. 서버에 장기 토큰을 두지 않는다.
- Secrets: `DEPLOY_SSH_KEY`(배포 키 개인키), `DEPLOY_HOST`(`ubuntu@<ip>`), `DEPLOY_KNOWN_HOSTS`(서버 호스트 키, 고정).
- 롤백: 서버에서 `IMAGE_TAG=<커밋 sha> docker compose -f docker-compose.prod.yml up -d`.
- 수동 배포(서버에서 직접 빌드): `scripts/deploy.sh ubuntu@<서버 IP>`. Actions가 막혔을 때만 쓴다.

## API 문서

Caddy가 `/docs*`와 `/openapi.json`을 api 컨테이너로 넘긴다(공개, 읽기 전용). https://3-39-184-37.sslip.io/docs

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
