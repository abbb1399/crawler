import type { JobSource } from '@trawler/shared';

/** One crawl queue per source so Playwright-backed sources can be throttled independently. */
export function crawlQueueName(source: JobSource): string {
  return `crawl-${source.toLowerCase()}`;
}

export interface CrawlJobData {
  source: JobSource;
  profileId: number;
  /** Who enqueued it; informational. */
  trigger: 'cron' | 'manual' | 'boot';
}

/**
 * BullMQ custom job ids must not contain ':'.
 * Same (source, profile, minute) collapses to one job, so overlapping cron ticks or
 * repeated manual clicks within a minute cannot enqueue duplicates.
 */
export function crawlJobId(source: JobSource, profileId: number, at = new Date()): string {
  const slot = at.toISOString().slice(0, 16).replace(/[-T:]/g, '');
  return `${source.toLowerCase()}-${profileId}-${slot}`;
}
