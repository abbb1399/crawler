import { z } from 'zod';

/** Job sources supported by the crawler. */
export const JobSource = z.enum(['WANTED', 'SARAMIN']);
export type JobSource = z.infer<typeof JobSource>;

export const SOURCE_LABEL: Record<JobSource, string> = {
  WANTED: '원티드',
  SARAMIN: '사람인',
};

/** Search regions a profile can be limited to. Empty list on a profile = nationwide. */
export const Region = z.enum(['SEOUL', 'GYEONGGI', 'INCHEON']);
export type Region = z.infer<typeof Region>;

/** Also the prefix the sites put in a posting's location ("서울 강남구", "경기전체, 서울전체"). */
export const REGION_LABEL: Record<Region, string> = {
  SEOUL: '서울',
  GYEONGGI: '경기',
  INCHEON: '인천',
};

/** BullMQ job counts per queue: { "crawl-wanted": { waiting, active, delayed, completed, failed }, ... } */
export const QueueCounts = z.record(z.string(), z.record(z.string(), z.number()));
export type QueueCounts = z.infer<typeof QueueCounts>;

/** Shape returned by GET /health — 200 when `ok`, 503 when `degraded` (body is the same). */
export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['ok', 'down']),
  /** Probed through BullMQ job counts. */
  redis: z.enum(['ok', 'down']),
  /** null when Redis is down. */
  queues: QueueCounts.nullable(),
  uptimeSec: z.number(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

/** Normalized posting produced by a source adapter, before it touches the DB. */
export const RawPosting = z.object({
  source: JobSource,
  externalId: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullable(),
  url: z.string().url(),
  /** ISO date (YYYY-MM-DD) or null when open-ended. */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  raw: z.unknown(),
});
export type RawPosting = z.infer<typeof RawPosting>;

/** Result of one crawl execution, returned by POST /crawl/:source/sync. */
export const CrawlSummary = z.object({
  runId: z.number(),
  source: JobSource,
  profileId: z.number(),
  keywords: z.array(z.string()),
  /** Items returned by the site before the title filter. */
  fetched: z.number(),
  found: z.number(),
  inserted: z.number(),
  updated: z.number(),
  insertedIds: z.array(z.number()),
  durationMs: z.number(),
});
export type CrawlSummary = z.infer<typeof CrawlSummary>;

/** Returned when a crawl is put on the queue (POST /crawl/:source). */
export const EnqueueResult = z.object({
  queue: z.string(),
  jobId: z.string(),
});
export type EnqueueResult = z.infer<typeof EnqueueResult>;

/** Query for POST /crawl and POST /crawl/:source[/sync]. */
export const CrawlTriggerQuery = z.object({
  profileId: z.coerce.number().int().positive().default(1),
});
export type CrawlTriggerQuery = z.infer<typeof CrawlTriggerQuery>;

export const NotifyChannel = z.enum(['SLACK']);
export type NotifyChannel = z.infer<typeof NotifyChannel>;

/** Result of a notification pass (POST /maintenance/notify, and inside CrawlSyncResult). */
export const DispatchResult = z.object({
  delivered: z.number(),
  /** Postings whose batch failed on some channel; they stay pending for the next attempt. */
  failed: z.number(),
});
export type DispatchResult = z.infer<typeof DispatchResult>;

/** POST /crawl/:source/sync: the crawl summary plus the notification pass it triggered (null when nothing was new). */
export const CrawlSyncResult = CrawlSummary.extend({ notify: DispatchResult.nullable() });
export type CrawlSyncResult = z.infer<typeof CrawlSyncResult>;

export const TestAlertResult = z.object({
  sent: z.boolean(),
  channels: z.array(NotifyChannel),
});
export type TestAlertResult = z.infer<typeof TestAlertResult>;

// ---------------------------------------------------------------------------
// Read API (consumed by apps/web)
// ---------------------------------------------------------------------------

export const PostingStatus = z.enum(['ACTIVE', 'EXPIRED']);
export type PostingStatus = z.infer<typeof PostingStatus>;

export const Posting = z.object({
  id: z.number(),
  source: JobSource,
  externalId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  url: z.string(),
  dueDate: z.string().nullable(),
  status: PostingStatus,
  hidden: z.boolean(),
  starred: z.boolean(),
  /** Set when this looks like a re-registration of an earlier posting. */
  repostOfId: z.number().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  /** First seen today (Asia/Seoul calendar day). */
  isNew: z.boolean(),
});
export type Posting = z.infer<typeof Posting>;

/** Query string for GET /postings. All optional; page is 1-based. */
export const PostingListQuery = z.object({
  source: JobSource.optional(),
  /** Omit for ACTIVE only; "all" for everything. */
  status: z.union([PostingStatus, z.literal('all')]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  /** Omit to exclude hidden postings; true for hidden ones only. */
  hidden: z.stringbool().optional(),
  starred: z.stringbool().optional(),
  /** Only postings first seen today (Asia/Seoul). */
  newToday: z.stringbool().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type PostingListQuery = z.infer<typeof PostingListQuery>;

export const PostingList = z.object({
  items: z.array(Posting),
  total: z.number(),
  page: z.number(),
  pageCount: z.number(),
});
export type PostingList = z.infer<typeof PostingList>;

export const PostingPatch = z
  .object({
    hidden: z.boolean().optional(),
    starred: z.boolean().optional(),
  })
  .refine((v) => v.hidden !== undefined || v.starred !== undefined, 'nothing to update');
export type PostingPatch = z.infer<typeof PostingPatch>;

export const SearchProfile = z.object({
  id: z.number(),
  name: z.string(),
  keywords: z.array(z.string()),
  includeTitle: z.array(z.string()),
  excludeTitle: z.array(z.string()),
  sources: z.array(JobSource),
  regions: z.array(Region),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SearchProfile = z.infer<typeof SearchProfile>;

const termList = z.array(z.string().trim().min(1).max(50)).max(30);

const SearchProfileFields = z.object({
  name: z.string().trim().min(1).max(50),
  keywords: termList.min(1),
  includeTitle: termList,
  excludeTitle: termList,
  sources: z.array(JobSource).min(1),
  regions: z.array(Region),
  enabled: z.boolean(),
});

export const SearchProfileInput = SearchProfileFields.extend({
  includeTitle: termList.default([]),
  excludeTitle: termList.default([]),
  regions: z.array(Region).default([]),
  enabled: z.boolean().default(true),
});
export type SearchProfileInput = z.infer<typeof SearchProfileInput>;

// Built from the field schemas WITHOUT defaults: `.partial()` on a defaulted field still fills the
// default when the key is absent, so a PATCH of only excludeTitle used to wipe includeTitle to []
// and re-enable the profile. Absent keys must stay undefined so Prisma leaves them untouched.
export const SearchProfilePatch = SearchProfileFields.partial();
export type SearchProfilePatch = z.infer<typeof SearchProfilePatch>;

export const CrawlRunStatus = z.enum(['RUNNING', 'OK', 'FAILED']);

export const CrawlRun = z.object({
  id: z.number(),
  source: JobSource,
  profileId: z.number(),
  profile: z.object({ name: z.string() }).optional(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: CrawlRunStatus,
  fetched: z.number(),
  found: z.number(),
  inserted: z.number(),
  updated: z.number(),
  error: z.string().nullable(),
});
export type CrawlRun = z.infer<typeof CrawlRun>;

/** Query for GET /runs. */
export const RunsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  source: JobSource.optional(),
});
export type RunsQuery = z.infer<typeof RunsQuery>;

/** Query for GET /runs/stats. */
export const RunsStatsQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});
export type RunsStatsQuery = z.infer<typeof RunsStatsQuery>;

/** One (KST day, source) bucket of crawl runs; every day in the range is present, zero-filled. */
export const RunsDailyPoint = z.object({
  /** YYYY-MM-DD in Asia/Seoul. */
  day: z.string(),
  source: JobSource,
  runs: z.number(),
  failed: z.number(),
  inserted: z.number(),
  /** Mean of finished runs; null when none finished that day. */
  avgDurationMs: z.number().nullable(),
});
export const RunsDaily = z.array(RunsDailyPoint);
export type RunsDailyPoint = z.infer<typeof RunsDailyPoint>;
export type RunsDaily = z.infer<typeof RunsDaily>;

export const ExpireResult = z.object({
  byDueDate: z.number(),
  byStale: z.number(),
});
export type ExpireResult = z.infer<typeof ExpireResult>;

export const DeleteResult = z.object({ deleted: z.number() });
export type DeleteResult = z.infer<typeof DeleteResult>;

export const Stats = z.object({
  postings: z.object({
    total: z.number(),
    active: z.number(),
    hidden: z.number(),
    starred: z.number(),
    /** ACTIVE, non-hidden postings first seen today (Asia/Seoul). */
    newToday: z.number(),
    bySource: z.array(z.object({ source: JobSource, count: z.number() })),
  }),
  lastRunAt: z.string().nullable(),
  queues: QueueCounts,
});
export type Stats = z.infer<typeof Stats>;

// ---------------------------------------------------------------------------
// Errors — every non-2xx response from the API has this shape (AllExceptionsFilter)
// ---------------------------------------------------------------------------

export const ErrorIssue = z.object({
  /** Dotted path into the request body/query, e.g. "keywords.0". */
  path: z.string(),
  message: z.string(),
});

export const ErrorBody = z.object({
  statusCode: z.number(),
  /** HTTP reason phrase, e.g. "Not Found". */
  error: z.string(),
  message: z.string(),
  /** Present for 400 validation failures only. */
  issues: z.array(ErrorIssue).optional(),
  /** Echo of the x-request-id header (generated when the caller sent none); also returned as a response header. */
  requestId: z.string(),
  path: z.string(),
  timestamp: z.string(),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
