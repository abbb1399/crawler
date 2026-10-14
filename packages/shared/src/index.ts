import { z } from 'zod';

/** Job sources supported by the crawler. */
export const JobSource = z.enum(['WANTED', 'SARAMIN']);
export type JobSource = z.infer<typeof JobSource>;

export const SOURCE_LABEL: Record<JobSource, string> = {
  WANTED: '원티드',
  SARAMIN: '사람인',
};

/** Shape returned by GET /health. */
export const HealthResponse = z.object({
  status: z.literal('ok'),
  db: z.enum(['ok', 'down']),
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
  seen: z.boolean(),
  starred: z.boolean(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});
export type Posting = z.infer<typeof Posting>;

/** Query string for GET /postings. All optional; cursor is the last id of the previous page. */
export const PostingListQuery = z.object({
  source: JobSource.optional(),
  status: PostingStatus.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  unseen: z.stringbool().optional(),
  starred: z.stringbool().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type PostingListQuery = z.infer<typeof PostingListQuery>;

export const PostingList = z.object({
  items: z.array(Posting),
  nextCursor: z.number().nullable(),
});
export type PostingList = z.infer<typeof PostingList>;

export const PostingPatch = z
  .object({
    seen: z.boolean().optional(),
    starred: z.boolean().optional(),
  })
  .refine((v) => v.seen !== undefined || v.starred !== undefined, 'nothing to update');
export type PostingPatch = z.infer<typeof PostingPatch>;

export const SearchProfile = z.object({
  id: z.number(),
  name: z.string(),
  keywords: z.array(z.string()),
  includeTitle: z.array(z.string()),
  excludeTitle: z.array(z.string()),
  sources: z.array(JobSource),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SearchProfile = z.infer<typeof SearchProfile>;

const termList = z.array(z.string().trim().min(1).max(50)).max(30);

export const SearchProfileInput = z.object({
  name: z.string().trim().min(1).max(50),
  keywords: termList.min(1),
  includeTitle: termList.default([]),
  excludeTitle: termList.default([]),
  sources: z.array(JobSource).min(1),
  enabled: z.boolean().default(true),
});
export type SearchProfileInput = z.infer<typeof SearchProfileInput>;

export const SearchProfilePatch = SearchProfileInput.partial();
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

export const Stats = z.object({
  postings: z.object({
    total: z.number(),
    unseen: z.number(),
    starred: z.number(),
    bySource: z.array(z.object({ source: JobSource, count: z.number() })),
  }),
  lastRunAt: z.string().nullable(),
  queues: z.record(z.string(), z.record(z.string(), z.number())),
});
export type Stats = z.infer<typeof Stats>;
