import type { JobSource, RawPosting } from '@devilray/shared';

export interface FetchOptions {
  /** Upper bound on result pages to walk for this keyword. */
  maxPages?: number;
}

/**
 * One implementation per job site. Must be stateless across calls so that
 * BullMQ workers (Phase 3) can run them concurrently.
 */
export interface SourceAdapter {
  readonly source: JobSource;
  fetch(keyword: string, opts?: FetchOptions): Promise<RawPosting[]>;
}

export const SOURCE_ADAPTERS = Symbol('SOURCE_ADAPTERS');
