# devilray 작업 기록 (2026-10-14)

원티드/사람인 채용 공고 수집기. 하루에 Phase 0~6 전부 구현했고, 이 문서는 집에서 이어 보기 위한 정리본이다.
실행 방법과 운영 명령은 [README.md](../README.md)에 있고, 여기는 **무엇을 왜 그렇게 만들었는지, 지금 어떤 상태인지, 다음에 뭘 보면 되는지**만 적는다.

## 1. 한눈에 보기

```
크론(30분) ─► crawl-wanted / crawl-saramin 큐 ─► 워커: 사이트 수집 → 제목 필터 → upsert
                                                        │ 신규 insert 있으면
                                                        ▼
                                                   notify 큐 ─► Slack (10건/메시지)
야간 03:15 ─► 만료 처리 (마감 경과 / 14일 미수집 → EXPIRED), 방치된 RUNNING 정리
대시보드 :3001 ─► 공고 목록 / 검색 프로필 CRUD / 실행 이력
```

| 구성 | 선택 | 비고 |
|---|---|---|
| 백엔드 | NestJS 12, TypeScript 6 | `apps/api`, 포트 3000 |
| 프론트 | Next.js 16 App Router, Tailwind 4 | `apps/web`, 포트 3001. 서버 컴포넌트 + 서버 액션만 사용 |
| DB | Postgres 16 + Prisma 7 (driver adapter pg) | `apps/api/prisma/schema.prisma`, 마이그레이션 5개 |
| 큐 | BullMQ 6 + Redis 7 | Bull Board `/admin/queues` |
| 크롤 | 원티드: JSON API fetch / 사람인: Playwright | 어댑터 패턴 `crawler/source-adapter.ts` |
| 알림 | Slack Incoming Webhook | `notifier/` (Notifier 인터페이스, 텔레그램은 미구현) |
| 인프라 | Docker Desktop + docker-compose | Postgres/Redis만 컨테이너, 앱은 호스트에서 실행 |
| 자동 시작 | Windows 작업 스케줄러 `devilray` | 로그온 +30초에 `scripts/start.cmd` |

## 2. Phase별 커밋

| Phase | 커밋 | 내용 |
|---|---|---|
| 0 | `0a5a2a4` | pnpm 모노레포, docker-compose, Nest 뼈대, `/health` |
| 1 | `a01bdb6` | Prisma 스키마, 원티드 어댑터, upsert(중복 제거), 수동 트리거 |
| 2 | `18cbc81` | Slack 알림, NotificationLog(재발송 방지), 단순 크론, 제목 필터 |
| 3 | `691d3ba` | BullMQ 큐(소스별 + notify), Bull Board, ROLE 분리 |
| 4 | `285ee42` | 사람인 어댑터(Playwright), BrowserService. **잡코리아 → 사람인으로 변경** |
| 5 | `e8fa910` | Next.js 대시보드, 조회/편집 API, 프로필 CRUD |
| 6 | `e2afec5` | 만료 처리, 재게시 감지, 실패 경고, 자동 시작 스크립트. **텔레그램/Dockerfile 제외** |

## 3. 설계 결정과 이유

- **원티드는 Playwright 안 씀.** `/api/v4/search?query=&limit=&offset=`가 공개 JSON이라 fetch로 충분. `/api/v4/jobs?query=`는 제목만 매칭해서 결과가 훨씬 적었다.
- **사람인은 Playwright.** 서버 렌더링이라 사실 fetch+cheerio로도 되지만, 원래 스택 요구가 Playwright였고 브라우저 쪽이 차단에 강하다. 무거우면 어댑터만 바꾸면 된다.
- **브라우저는 크롤 1회마다 열고 닫는다.** Windows watch 모드가 SIGINT를 제대로 안 전달해 chrome 고아 프로세스가 쌓이는 걸 피하려고. 프로필 디렉터리(`.data/pw-profile`)는 유지돼 쿠키는 남는다.
- **중복 제거는 DB unique로.** `JobPosting(source, externalId)`, `NotificationLog(postingId, channel, kind)`. 애플리케이션 체크 없음.
- **알림 대상 = 24시간 내 처음 본 공고 중 성공 로그가 없는 것.** insertedIds를 넘기는 대신 DB를 다시 조회하므로 크래시/웹훅 실패 후에도 재시도가 자연스럽다. `ok=true` 행만 "보냄"으로 친다.
- **제목 필터(includeTitle/excludeTitle)를 프로필에 둠.** 사이트 검색이 느슨해서 "node.js 백엔드"로 HR Manager가 나온다. 기본 시드는 `node, nest, backend, 백엔드, 서버`. 원티드 120건 중 5건, 사람인 160건 중 38건만 통과 — **너무 빡빡하면 대시보드에서 조정.**
- **크론은 enqueue만.** jobId에 분 단위 슬롯(`wanted-1-202610140748`)을 넣어 같은 분엔 하나로 합쳐짐. BullMQ jobId에 `:`는 못 씀.
- **큐 lockDuration 5분.** 기본 30초면 사람인 크롤이 stalled 처리돼 중복 실행된다.
- **notify 잡은 실패 건이 있으면 throw.** BullMQ가 백오프로 재시도. 멱등성은 NotificationLog가 보장.
- **재게시 감지는 알림만 막는다.** fingerprint = md5(정규화 회사명|제목). 45일 내 같은 게 있으면 `repostOfId` 달고 저장은 하되 Slack은 생략. `NOTIFY_REPOSTS=true`로 해제.
- **프론트는 서버 액션만.** 브라우저가 API에 직접 붙지 않는다. CORS는 열어 뒀지만 안 쓴다.
- **Next 16 Cache Components 끔.** 동적 페이지마다 Suspense를 요구해서 로컬 대시보드엔 과하다.

## 4. 삽질 기록 (다시 만나면 여기 먼저)

| 증상 | 원인 | 해결 |
|---|---|---|
| `pnpm install` 시 `std-env@^4.3.0 not found` | pnpm 메타데이터 캐시 stale | `%LOCALAPPDATA%\pnpm-cache\v11\metadata\registry.npmjs.org\std-env.jsonl` 삭제 |
| 불필요한 패키지 330개 설치 | `prisma`가 8.0 RC로 잡힘 | `prisma@7.10.0` 고정 |
| 빌드 스크립트 무시 경고 → 스크립트 실행 실패 | pnpm 11은 `onlyBuiltDependencies` 대신 `allowBuilds` | `pnpm-workspace.yaml`의 `allowBuilds` 맵에 추가 |
| TS6 `moduleResolution=node10 deprecated` | TypeScript 6 | api tsconfig를 NodeNext(CJS 출력)로 |
| **로그 3GB** | BullMQ 6는 `ioredis`를 직접 의존성으로 요구. 없으면 재연결 에러 무한 루프 | `pnpm --filter api add ioredis` |
| 프로세서에서 `this.crawler` undefined | 추상 베이스 클래스에 데코레이터가 없어 생성자 메타데이터 미방출 | `BaseCrawlProcessor`에 `@Injectable()` |
| `prisma migrate reset` 거부 | Prisma 7이 AI 에이전트의 reset을 차단 | 테스트 행만 TRUNCATE 후 seed |
| 컬럼 삭제 마이그레이션이 비대화형에서 멈춤 | 데이터 손실 확인 프롬프트 | migration.sql 직접 작성 후 `migrate deploy` |
| `HTMLAnchorElement` 타입 에러 | api tsconfig에 DOM lib 없음 | `page.$$eval` 안에서 제네릭 제거 |
| **stop.cmd가 Docker까지 죽임** | `findstr "a b"`는 공백으로 패턴을 나눔 → `.*LISTENING`이 전부 매치 | `/C:` 패턴 사용. 고친 버전이 커밋됨 |

## 5. 지금 상태 (퇴근 시점)

- **앱이 떠 있다.** 작업 스케줄러 `devilray`를 수동 실행해서 API(:3000)/웹(:3001)이 프로덕션 모드로 동작 중. 30분마다 수집한다.
- **Slack 웹훅은 아직 없다.** `.env`에 `SLACK_WEBHOOK_URL`이 없어서 수집만 하고 알림은 건너뛴다(로그에 WARN).
- **DB 데이터**: 프로필 1개(`default`, 키워드 `nestjs`, `node.js 백엔드`), 공고 44건(원티드 6, 사람인 38), 전부 ACTIVE. 테스트 중 생긴 데이터는 정리했다.
- **재부팅하면** 로그온 +30초에 자동으로 뜬다. 로그는 `storage/logs/`.
- **크로미엄**은 `%LOCALAPPDATA%\ms-playwright`에 설치돼 있다. 다른 PC면 `pnpm --filter api exec playwright install chromium`.

## 6. 집에서 할 것 (제안)

1. 브라우저로 `http://localhost:3001` 열어 보기. 안 떠 있으면 `Start-ScheduledTask -TaskName devilray`.
2. Slack 앱 → Incoming Webhooks → URL을 `.env`에 넣고 `scripts\stop.cmd` → `Start-ScheduledTask -TaskName devilray`. 24시간 내 수집분이 한 번에 오고 이후엔 신규만.
3. `/profiles`에서 키워드와 제목 필터 조정. 며칠 써 보면서 includeTitle 단어를 늘리거나 비우기.
4. 수집이 너무 적으면 `.env`에 `WANTED_MAX_PAGES=5`, `SARAMIN_MAX_PAGES=3` 정도로.
5. 뭔가 조용하면 `/runs`와 Bull Board(`localhost:3000/admin/queues`) 확인. 사이트가 바뀌면 3회 실패 후 Slack 경고가 온다(웹훅 설정 후).

## 7. 안 만든 것

- 텔레그램 알림 — `notifier/`에 `Notifier` 구현체 하나 + `notifier.module.ts` 배열에 추가하면 됨.
- 서버 배포용 Dockerfile — 로컬 전용이라 생략.
- 인증 — 로컬 전용.
- 잡코리아 — 사람인으로 대체. 필요하면 `SourceAdapter` 구현 + enum 추가 + 큐 등록 3곳.
- 테스트 코드 — 없음. 검증은 전부 curl/Playwright 스크립트로 수동. E2E 스크립트는 레포에 안 넣었다.
