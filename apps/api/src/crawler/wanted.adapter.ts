import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawPosting, type Region } from '@devilray/shared';
import { z } from 'zod';
import type { Env } from '../config/env';
import type { FetchOptions, SourceAdapter } from './source-adapter';

/**
 * Wanted exposes the same JSON API its SPA uses. Verified 2026-10-14:
 *   GET https://www.wanted.co.kr/api/v4/search?query=<kw>&country=kr&limit=<n>&offset=<n>
 * Returns `data.jobs[]`, newest first, with limit/offset pagination.
 * (`/api/v4/jobs?query=` only matches titles and returned far fewer results.)
 * Region filter: repeat `locations=<slug>.all` (verified 2026-10-19).
 */
const WantedJob = z.looseObject({
  id: z.number(),
  position: z.string(),
  company: z.looseObject({ id: z.number().optional(), name: z.string() }),
  address: z.looseObject({ location: z.string().nullable().optional() }).nullable().optional(),
  due_time: z.string().nullable().optional(),
  status: z.string().optional(),
});

const WantedSearchResponse = z.object({
  data: z.looseObject({ jobs: z.array(WantedJob) }),
});

const PAGE_SIZE = 20;
const LOCATION_SLUG: Record<Region, string> = {
  SEOUL: 'seoul.all',
  GYEONGGI: 'gyeonggi.all',
  INCHEON: 'incheon.all',
};
const BASE_URL = 'https://www.wanted.co.kr';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

@Injectable()
export class WantedAdapter implements SourceAdapter {
  readonly source = 'WANTED' as const;
  private readonly logger = new Logger(WantedAdapter.name);
  private readonly defaultMaxPages: number;

  constructor(config: ConfigService<Env, true>) {
    this.defaultMaxPages = config.get('WANTED_MAX_PAGES', { infer: true });
  }

  async fetch(keyword: string, opts: FetchOptions = {}): Promise<RawPosting[]> {
    const maxPages = opts.maxPages ?? this.defaultMaxPages;
    const out: RawPosting[] = [];

    for (let page = 0; page < maxPages; page++) {
      const jobs = await this.fetchPage(keyword, page * PAGE_SIZE, opts.regions ?? []);
      for (const job of jobs) {
        if (job.status && job.status !== 'active') continue;
        out.push(this.toRawPosting(job));
      }
      if (jobs.length < PAGE_SIZE) break;
      if (page < maxPages - 1) await sleep(1000);
    }

    this.logger.debug(`wanted "${keyword}": ${out.length} postings`);
    return out;
  }

  private async fetchPage(keyword: string, offset: number, regions: Region[]) {
    const url = new URL('/api/v4/search', BASE_URL);
    url.searchParams.set('query', keyword);
    url.searchParams.set('country', 'kr');
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));
    for (const r of regions) url.searchParams.append('locations', LOCATION_SLUG[r]);

    const res = await globalThis.fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `${BASE_URL}/`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`wanted search failed: HTTP ${res.status} (${url})`);
    }
    const parsed = WantedSearchResponse.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error(`wanted response shape changed: ${parsed.error.issues[0]?.message}`);
    }
    return parsed.data.data.jobs;
  }

  private toRawPosting(job: z.infer<typeof WantedJob>): RawPosting {
    return RawPosting.parse({
      source: this.source,
      externalId: String(job.id),
      title: job.position.trim(),
      company: job.company.name.trim(),
      location: job.address?.location ?? null,
      url: `${BASE_URL}/wd/${job.id}`,
      dueDate: job.due_time ?? null,
      raw: job,
    });
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
