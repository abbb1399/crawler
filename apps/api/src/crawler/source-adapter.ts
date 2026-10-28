import type { JobSource, RawPosting, Region } from '@trawler/shared';

export interface FetchOptions {
  /** Upper bound on result pages to walk for this keyword. */
  maxPages?: number;
  /** Restrict the site search to these regions. Empty/absent = nationwide. */
  regions?: Region[];
}

/**
 * One implementation per job site. Must be stateless across calls so that
 * BullMQ workers (Phase 3) can run them concurrently.
 */
export interface SourceAdapter {
  readonly source: JobSource;
  fetch(keyword: string, opts?: FetchOptions): Promise<RawPosting[]>;
  /** Optional keyword-free listing (e.g. a 직군 list) for postings the site's search does not return. */
  browse?(opts?: FetchOptions): Promise<RawPosting[]>;
}

export const SOURCE_ADAPTERS = Symbol('SOURCE_ADAPTERS');
