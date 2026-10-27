import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawPosting, type Region } from '@trawler/shared';
import type { Page } from 'playwright';
import type { Env } from '../config/env';
import { BrowserService } from './browser.service';
import { extractSaraminItems, type SaraminItem } from './saramin.extract';
import type { FetchOptions, SourceAdapter } from './source-adapter';

/**
 * Saramin search results are server-rendered. Verified 2026-10-14:
 *   https://www.saramin.co.kr/zf_user/search/recruit?searchType=search&searchword=<kw>
 *     &recruitSort=reg_dt&recruitPageCount=40&recruitPage=<n>
 * Each result is `.item_recruit[value=<rec_idx>]` with `.job_tit a`, `.corp_name a`,
 * `.job_condition span` (first = location) and `.job_date .date`.
 * Region filter: `loc_mcd=101000,102000` (verified 2026-10-19). It is loose (other regions leak in),
 * so CrawlerService also filters on the location text.
 */
const BASE_URL = 'https://www.saramin.co.kr';
const PAGE_SIZE = 40;
const LOC_MCD: Record<Region, string> = {
  SEOUL: '101000',
  GYEONGGI: '102000',
  INCHEON: '108000',
};

@Injectable()
export class SaraminAdapter implements SourceAdapter {
  readonly source = 'SARAMIN' as const;
  private readonly logger = new Logger(SaraminAdapter.name);
  private readonly defaultMaxPages: number;

  constructor(
    private readonly browser: BrowserService,
    config: ConfigService<Env, true>,
  ) {
    this.defaultMaxPages = config.get('SARAMIN_MAX_PAGES', { infer: true });
  }

  async fetch(keyword: string, opts: FetchOptions = {}): Promise<RawPosting[]> {
    const maxPages = opts.maxPages ?? this.defaultMaxPages;

    return this.browser.withContext(async (ctx) => {
      const page = await ctx.newPage();
      const out: RawPosting[] = [];
      try {
        for (let n = 1; n <= maxPages; n++) {
          const items = await this.fetchPage(page, keyword, n, opts.regions ?? []);
          for (const item of items) out.push(this.toRawPosting(item));
          if (items.length < PAGE_SIZE) break;
          if (n < maxPages) await sleep(2000 + Math.random() * 2000);
        }
      } finally {
        await page.close().catch(() => undefined);
      }
      this.logger.debug(`saramin "${keyword}": ${out.length} postings`);
      return out;
    });
  }

  private async fetchPage(page: Page, keyword: string, pageNo: number, regions: Region[]): Promise<SaraminItem[]> {
    const url = new URL('/zf_user/search/recruit', BASE_URL);
    url.searchParams.set('searchType', 'search');
    url.searchParams.set('searchword', keyword);
    url.searchParams.set('recruitSort', 'reg_dt');
    url.searchParams.set('recruitPageCount', String(PAGE_SIZE));
    url.searchParams.set('recruitPage', String(pageNo));
    if (regions.length) url.searchParams.set('loc_mcd', regions.map((r) => LOC_MCD[r]).join(','));

    const res = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const status = res?.status() ?? 0;
    if (status >= 400) {
      await this.browser.snapshot(page, `saramin-http${status}`);
      throw new Error(`saramin search failed: HTTP ${status} (${url})`);
    }

    const items = await page.$$eval('.item_recruit', extractSaraminItems);

    if (items.length === 0) {
      // Either a genuine empty result or a block/captcha page; tell them apart by the result counter.
      const hasCounter = (await page.$('.cnt_result')) !== null;
      if (!hasCounter) {
        await this.browser.snapshot(page, 'saramin-noresults');
        throw new Error(`saramin: no result list on page ${pageNo} (blocked or layout changed)`);
      }
    }
    const valid = items.filter((i) => i.recIdx && i.title);
    if (items.length > 0 && valid.length === 0) {
      // The cards are there but their inner markup moved: without this it looks like a quiet 0-result run.
      await this.browser.snapshot(page, 'saramin-emptyfields');
      throw new Error(`saramin: ${items.length} result cards but none had an id and title (layout changed)`);
    }
    return valid;
  }

  private toRawPosting(item: SaraminItem): RawPosting {
    return RawPosting.parse({
      source: this.source,
      externalId: item.recIdx,
      title: item.title,
      company: item.company || '(회사명 없음)',
      location: item.location,
      url: `${BASE_URL}/zf_user/jobs/relay/view?rec_idx=${item.recIdx}`,
      dueDate: parseDueDate(item.dateText),
      raw: item,
    });
  }
}

/**
 * "~ 10/28(수)" → ISO date in the current year (next year if that would be months in the past).
 * "내일마감" / "오늘마감" → tomorrow / today. "채용시", "상시채용", anything else → null.
 */
export function parseDueDate(text: string, now = new Date()): string | null {
  const t = text.trim();
  const m = /(\d{1,2})\/(\d{1,2})/.exec(t);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    let year = now.getFullYear();
    if (month < now.getMonth() + 1 - 6) year += 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (t.includes('오늘')) return toISODate(now);
  if (t.includes('내일')) return toISODate(new Date(now.getTime() + 86_400_000));
  return null;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
