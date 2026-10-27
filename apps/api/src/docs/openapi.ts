import {
  CrawlRun,
  CrawlSyncResult,
  CrawlTriggerQuery,
  DeleteResult,
  DispatchResult,
  EnqueueResult,
  ErrorBody,
  ExpireResult,
  HealthResponse,
  JobSource,
  Posting,
  PostingList,
  PostingListQuery,
  PostingPatch,
  QueueCounts,
  RunsDaily,
  RunsQuery,
  RunsStatsQuery,
  SearchProfile,
  SearchProfileInput,
  SearchProfilePatch,
  Stats,
  TestAlertResult,
} from '@trawler/shared';
import { z } from 'zod';
import { createDocument, type ZodOpenApiOperationObject, type ZodOpenApiResponsesObject } from 'zod-openapi';

/**
 * The OpenAPI document is assembled here, by hand, from the same zod schemas the controllers
 * validate with (packages/shared). No decorators: adding a route means adding an entry below,
 * and docs/openapi.spec.ts fails if a controller route is missing from this list.
 */

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const error = (description: string) => json(ErrorBody, description);

const COMMON_ERRORS: ZodOpenApiResponsesObject = {
  429: error('요청 한도 초과 (전역 120/분, 크롤·유지보수 10/분)'),
  500: error('내부 오류 (상세는 서버 로그, requestId로 추적)'),
};
const NOT_FOUND = error('대상 없음');
const VALIDATION = error('검증 실패 (issues[] 참고)');

const IdParam = z.object({ id: z.coerce.number().int().positive().meta({ description: '행 id' }) });
const SourceParam = z.object({ source: JobSource.meta({ description: '소스 (대소문자 무관)' }) });

const op = (
  tag: string,
  summary: string,
  rest: Omit<ZodOpenApiOperationObject, 'tags' | 'summary' | 'responses'> & { responses: ZodOpenApiResponsesObject },
): ZodOpenApiOperationObject => ({ tags: [tag], summary, ...rest, responses: { ...rest.responses, ...COMMON_ERRORS } });

export function buildOpenApiDocument(version: string) {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'trawler API',
      version,
      description: [
        '원티드/사람인 채용 공고 수집기의 내부 API. 대시보드(apps/web)가 서버 측에서 호출한다.',
        '',
        '- 모든 오류 응답은 `ErrorBody` 한 형식이며 `x-request-id` 응답 헤더로 서버 로그와 맞춰볼 수 있다.',
        '- Rate limit: 전역 120회/분, 크롤·유지보수 POST는 10회/분 (429).',
        '- 이 문서는 `packages/shared`의 zod 스키마에서 생성된다 (`apps/api/src/docs/openapi.ts`).',
      ].join('\n'),
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'health', description: '상태 확인' },
      { name: 'postings', description: '수집된 공고 조회·숨김·별표' },
      { name: 'profiles', description: '검색 프로필(키워드·필터·지역)' },
      { name: 'crawl', description: '수집 실행 (큐 또는 인라인)' },
      { name: 'maintenance', description: '만료 처리·알림 재발송·경고 테스트' },
      { name: 'stats', description: '집계·큐·실행 이력' },
    ],
    paths: {
      '/health': {
        get: op('health', 'API·Postgres·Redis 상태', {
          responses: { 200: json(HealthResponse, '모두 정상'), 503: json(HealthResponse, 'degraded — db 또는 redis가 down') },
        }),
      },
      '/postings': {
        get: op('postings', '공고 목록 (숨긴 공고는 hidden=true일 때만)', {
          requestParams: { query: PostingListQuery },
          responses: { 200: json(PostingList, '페이지'), 400: VALIDATION },
        }),
      },
      '/postings/{id}': {
        patch: op('postings', '숨김·별표 변경 (숨김은 재게시 가족 전체에 적용)', {
          requestParams: { path: IdParam },
          requestBody: { content: { 'application/json': { schema: PostingPatch } } },
          responses: { 200: json(Posting, '변경된 공고'), 400: VALIDATION, 404: NOT_FOUND },
        }),
      },
      '/profiles': {
        get: op('profiles', '프로필 목록', { responses: { 200: json(z.array(SearchProfile), '전체') } }),
        post: op('profiles', '프로필 생성', {
          requestBody: { content: { 'application/json': { schema: SearchProfileInput } } },
          responses: { 201: json(SearchProfile, '생성됨'), 400: VALIDATION, 409: error('같은 이름이 이미 있음') },
        }),
      },
      '/profiles/{id}': {
        get: op('profiles', '프로필 하나', {
          requestParams: { path: IdParam },
          responses: { 200: json(SearchProfile, '프로필'), 404: NOT_FOUND },
        }),
        patch: op('profiles', '프로필 부분 수정 (보낸 키만 바뀜)', {
          requestParams: { path: IdParam },
          requestBody: { content: { 'application/json': { schema: SearchProfilePatch } } },
          responses: { 200: json(SearchProfile, '수정됨'), 400: VALIDATION, 404: NOT_FOUND, 409: error('같은 이름이 이미 있음') },
        }),
        delete: op('profiles', '프로필 삭제 (실행 이력도 삭제, 공고는 유지)', {
          requestParams: { path: IdParam },
          responses: { 200: json(DeleteResult, '삭제됨'), 404: NOT_FOUND },
        }),
      },
      '/runs': {
        get: op('stats', '최근 실행 이력 (최신순)', {
          requestParams: { query: RunsQuery },
          responses: { 200: json(z.array(CrawlRun), '실행 목록'), 400: VALIDATION },
        }),
      },
      '/runs/stats': {
        get: op('stats', '일별 실행 추이 (KST 기준, 소스별 건수·실패·신규·평균 소요)', {
          requestParams: { query: RunsStatsQuery },
          responses: { 200: json(RunsDaily, '날짜×소스 버킷, 빈 날은 0'), 400: VALIDATION },
        }),
      },
      '/crawl/{source}': {
        post: op('crawl', '소스 하나를 큐에 넣기 (같은 분의 중복 요청은 하나로 합쳐짐)', {
          requestParams: { path: SourceParam, query: CrawlTriggerQuery },
          responses: { 201: json(EnqueueResult, '큐에 등록됨'), 400: VALIDATION },
        }),
      },
      '/crawl': {
        post: op('crawl', '프로필의 모든 소스를 큐에 넣기', {
          requestParams: { query: CrawlTriggerQuery },
          responses: { 201: json(z.array(EnqueueResult), '소스별 등록 결과'), 400: VALIDATION, 404: NOT_FOUND },
        }),
      },
      '/crawl/{source}/sync': {
        post: op('crawl', '큐를 거치지 않고 바로 수집하고 결과를 기다림 (디버깅용)', {
          requestParams: { path: SourceParam, query: CrawlTriggerQuery },
          responses: { 201: json(CrawlSyncResult, '수집 요약 + 알림 결과'), 400: VALIDATION, 404: NOT_FOUND },
        }),
      },
      '/maintenance/expire': {
        post: op('maintenance', '만료 패스 (마감 지남 / STALE_DAYS 동안 미발견 → EXPIRED)', {
          responses: { 201: json(ExpireResult, '만료 처리 건수') },
        }),
      },
      '/maintenance/notify': {
        post: op('maintenance', '미발송 알림 재발송', { responses: { 201: json(DispatchResult, '발송 결과') } }),
      },
      '/maintenance/test-alert': {
        post: op('maintenance', '모든 활성 채널로 테스트 경고', { responses: { 201: json(TestAlertResult, '발송 여부') } }),
      },
      '/queues': {
        get: op('stats', '큐별 잡 카운트', { responses: { 200: json(QueueCounts, '큐 상태') } }),
      },
      '/stats': {
        get: op('stats', '대시보드 헤더 집계', { responses: { 200: json(Stats, '집계') } }),
      },
    },
    components: {
      schemas: {
        Posting,
        PostingList,
        PostingListQuery,
        PostingPatch,
        SearchProfile,
        SearchProfileInput,
        SearchProfilePatch,
        CrawlRun,
        RunsQuery,
        RunsStatsQuery,
        RunsDaily,
        CrawlTriggerQuery,
        CrawlSyncResult,
        EnqueueResult,
        ExpireResult,
        DispatchResult,
        TestAlertResult,
        QueueCounts,
        Stats,
        HealthResponse,
        DeleteResult,
        ErrorBody,
      },
    },
  }, {
    // Query booleans are z.stringbool(): on the wire they are the strings "true"/"false".
    // zod renders the input side as a bare string; narrow it so the docs (and "try it") are exact.
    override: ({ jsonSchema, zodSchema, io }) => {
      if (io === 'input' && zodSchema._zod.def.type === 'pipe' && jsonSchema.type === 'string' && !jsonSchema.enum) {
        jsonSchema.enum = ['true', 'false'];
        jsonSchema.description ??= '"true" 또는 "false"';
      }
    },
  });
}
