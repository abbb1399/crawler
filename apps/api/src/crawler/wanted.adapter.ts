import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawPosting, type Region } from '@trawler/shared';
import { z } from 'zod';
import type { Env } from '../config/env';
import { sleep, USER_AGENT } from './scrape';
import type { FetchOptions, SourceAdapter } from './source-adapter';

/**
 * Wanted exposes the same JSON API its SPA uses. Verified 2026-10-14:
 *   GET https://www.wanted.co.kr/api/v4/search?query=<kw>&country=kr&limit=<n>&offset=<n>
 * Returns `data.jobs[]`, newest first, with limit/offset pagination.
 * (`/api/v4/jobs?query=` only matches titles and returned far fewer results.)
 * Region filter: repeat `locations=<slug>.all` (verified 2026-10-19).
 *
 * Keyword search does not return every posting: on 2026-10-28 three "Product Engineer" postings were
 * listed under 개발 › 프론트엔드 개발자 but missing from search, in our crawler and in Wanted's own app.
 * So `browse()` also reads that 직군 list, newest first, the way the wdlist page does:
 *   GET /api/chaos/navigation/v1/results?job_group_id=518&job_ids=669&country=all
 *     &job_sort=job.latest_order&years=0&years=10&limit=<n>&offset=<n>
 * Returns `data[]` of the same job cards as search.
 */
const WantedJob = z.looseObject({
  id: z.number(),
  position: z.string(),
  company: z.looseObject({ id: z.number().optional(), name: z.string() }),
  address: z.looseObject({ location: z.string().nullable().optional() }).nullable().optional(),
  due_time: z.string().nullable().optional(),
  status: z.string().optional(),
});

type WantedJob = z.infer<typeof WantedJob>;

const WantedSearchResponse = z.object({
  data: z.looseObject({ jobs: z.array(WantedJob) }),
});
const WantedListResponse = z.object({ data: z.array(WantedJob) });

/** 개발(518) › 프론트엔드 개발자(669). shortcut: fixed for the one profile; move to SearchProfile if a second one needs another 직군. */
const CATEGORY = { jobGroupId: '518', jobId: '669' };

const PAGE_SIZE = 20;
const LOCATION_SLUG: Record<Region, string> = {
  SEOUL: 'seoul.all',
  GYEONGGI: 'gyeonggi.all',
  INCHEON: 'incheon.all',
};
const BASE_URL = 'https://www.wanted.co.kr';

@Injectable()
export class WantedAdapter implements SourceAdapter {
  readonly source = 'WANTED' as const;
  private readonly logger = new Logger(WantedAdapter.name);
  private readonly defaultMaxPages: number;

  constructor(config: ConfigService<Env, true>) {
    this.defaultMaxPages = config.get('WANTED_MAX_PAGES', { infer: true });
  }

  fetch(keyword: string, opts: FetchOptions = {}): Promise<RawPosting[]> {
    return this.collect(`"${keyword}"`, opts.maxPages, async (offset) => {
      const url = new URL('/api/v4/search', BASE_URL);
      url.searchParams.set('query', keyword);
      url.searchParams.set('country', 'kr');
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      for (const r of opts.regions ?? []) url.searchParams.append('locations', LOCATION_SLUG[r]);
      return (await this.get(url, WantedSearchResponse)).data.jobs;
    });
  }

  /** The 직군 list, newest first. Region is not sent: the crawler's location filter applies afterwards. */
  browse(opts: FetchOptions = {}): Promise<RawPosting[]> {
    return this.collect(`직군 ${CATEGORY.jobGroupId}/${CATEGORY.jobId}`, opts.maxPages, async (offset) => {
      const url = new URL('/api/chaos/navigation/v1/results', BASE_URL);
      url.searchParams.set('job_group_id', CATEGORY.jobGroupId);
      url.searchParams.set('job_ids', CATEGORY.jobId);
      url.searchParams.set('country', 'all');
      url.searchParams.set('job_sort', 'job.latest_order');
      url.searchParams.append('years', '0');
      url.searchParams.append('years', '10');
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      return (await this.get(url, WantedListResponse)).data;
    });
  }

  /** Walks pages until a short page or the page limit, keeping active postings. */
  private async collect(
    label: string,
    maxPagesOpt: number | undefined,
    fetchPage: (offset: number) => Promise<WantedJob[]>,
  ): Promise<RawPosting[]> {
    const maxPages = maxPagesOpt ?? this.defaultMaxPages;
    const out: RawPosting[] = [];
    for (let page = 0; page < maxPages; page++) {
      const jobs = await fetchPage(page * PAGE_SIZE);
      for (const job of jobs) {
        if (job.status && job.status !== 'active') continue;
        out.push(this.toRawPosting(job));
      }
      if (jobs.length < PAGE_SIZE) break;
      if (page < maxPages - 1) await sleep(1000);
    }
    this.logger.debug(`wanted ${label}: ${out.length} postings`);
    return out;
  }

  private async get<T>(url: URL, schema: z.ZodType<T>): Promise<T> {
    const res = await globalThis.fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `${BASE_URL}/`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`wanted request failed: HTTP ${res.status} (${url})`);
    }
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error(`wanted response shape changed (${url.pathname}): ${parsed.error.issues[0]?.message}`);
    }
    return parsed.data;
  }

  private toRawPosting(job: WantedJob): RawPosting {
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
