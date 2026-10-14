import { z } from 'zod';

/** Job sources supported by the crawler. */
export const JobSource = z.enum(['WANTED', 'JOBKOREA']);
export type JobSource = z.infer<typeof JobSource>;

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

/** Result of one crawl execution, returned by POST /crawl/:source. */
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
  /** Postings delivered to notification channels during this run (may include older pending ones). */
  notified: z.number(),
  durationMs: z.number(),
});
export type CrawlSummary = z.infer<typeof CrawlSummary>;
