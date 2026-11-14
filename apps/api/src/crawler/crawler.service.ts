import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CrawlSummary, JobSource, RawPosting } from '@trawler/shared';
import { PostingsService } from '../postings/postings.service';
import { PrismaService } from '../prisma/prisma.service';
import { sleep } from './scrape';
import { SOURCE_ADAPTERS, type SourceAdapter } from './source-adapter';
import { matchesRegion, matchesTitle } from './title-filter';

/** Upper bound on detail requests per nightly pass; a normal day has only a handful of candidates. */
const CLOSE_CHECKS_PER_RUN = 30;

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly adapters: Map<JobSource, SourceAdapter>;

  constructor(
    @Inject(SOURCE_ADAPTERS) adapters: SourceAdapter[],
    private readonly prisma: PrismaService,
    private readonly postings: PostingsService,
  ) {
    this.adapters = new Map(adapters.map((a) => [a.source, a]));
  }

  availableSources(): JobSource[] {
    return [...this.adapters.keys()];
  }

  /**
   * Crawl every keyword of a profile on one source, filter by title, upsert, record a CrawlRun.
   */
  async run(source: JobSource, profileId: number): Promise<CrawlSummary> {
    const adapter = this.adapters.get(source);
    if (!adapter) throw new NotFoundException(`No adapter for source ${source} yet`);

    const profile = await this.prisma.searchProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException(`SearchProfile ${profileId} not found`);

    const run = await this.prisma.crawlRun.create({ data: { source, profileId } });
    const started = Date.now();
    this.logger.log(
      { runId: run.id, source, profileId, profile: profile.name, keywords: profile.keywords, regions: profile.regions },
      'run start',
    );

    try {
      const collected: RawPosting[] = [];
      for (const keyword of profile.keywords) {
        collected.push(...(await adapter.fetch(keyword, { regions: profile.regions })));
      }
      if (adapter.browse) collected.push(...(await adapter.browse()));
      const relevant = collected.filter(
        (p) =>
          matchesTitle(p.title, profile.includeTitle, profile.excludeTitle) &&
          matchesRegion(p.location, profile.regions),
      );
      const result = await this.postings.upsertMany(relevant);

      await this.prisma.crawlRun.update({
        where: { id: run.id },
        data: {
          status: 'OK',
          finishedAt: new Date(),
          fetched: collected.length,
          found: result.found,
          inserted: result.insertedIds.length,
          updated: result.updated,
        },
      });
      const summary: CrawlSummary = {
        runId: run.id,
        source,
        profileId,
        keywords: profile.keywords,
        fetched: collected.length,
        found: result.found,
        inserted: result.insertedIds.length,
        updated: result.updated,
        insertedIds: result.insertedIds,
        durationMs: Date.now() - started,
      };
      this.logger.log(
        {
          runId: run.id,
          source,
          fetched: summary.fetched,
          found: summary.found,
          inserted: summary.inserted,
          updated: summary.updated,
          durationMs: summary.durationMs,
        },
        'run done',
      );
      return summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.crawlRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', finishedAt: new Date(), error: message },
      });
      this.logger.error(`run#${run.id} failed: ${message}`);
      throw err;
    }
  }

  /**
   * A posting closed early drops out of search, and STALE_DAYS only expires it a week later. So ask
   * the site directly about ACTIVE postings that the latest successful crawl of their source no longer
   * returned, once per disappearance (not re-asked until seen again and gone again). Those are either
   * closed or merely pushed past the pages we read; the detail check tells which. Measuring against
   * the last crawl rather than the clock keeps weekends and outages from flagging everything.
   * A failed check is skipped and retried on a later pass.
   */
  async checkClosed(limit = CLOSE_CHECKS_PER_RUN): Promise<{ checked: number; closed: number; failed: number }> {
    const rows: { id: number; source: JobSource; externalId: string }[] = [];
    for (const adapter of this.adapters.values()) {
      if (!adapter.isClosed) continue;
      // shortcut: any profile's run counts, so with several profiles a posting only another profile
      // finds also gets checked (a wasted request, not a wrong result); key runs by profile if that grows.
      const lastRun = await this.prisma.crawlRun.findFirst({
        where: { source: adapter.source, status: 'OK' },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });
      if (!lastRun) continue;
      rows.push(
        ...(await this.prisma.jobPosting.findMany({
          where: {
            source: adapter.source,
            status: 'ACTIVE',
            lastSeenAt: { lt: lastRun.startedAt },
            OR: [{ checkedAt: null }, { checkedAt: { lt: this.prisma.jobPosting.fields.lastSeenAt } }],
          },
          orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }],
          take: limit - rows.length,
          select: { id: true, source: true, externalId: true },
        })),
      );
    }

    const result = { checked: 0, closed: 0, failed: 0 };
    for (const [i, row] of rows.entries()) {
      if (i > 0) await sleep(1000);
      try {
        const closed = await this.adapters.get(row.source)!.isClosed!(row.externalId);
        const now = new Date();
        await this.prisma.jobPosting.update({
          where: { id: row.id },
          data: closed ? { checkedAt: now, closedAt: now, status: 'EXPIRED' } : { checkedAt: now },
        });
        result.checked++;
        if (closed) result.closed++;
      } catch (err) {
        const message = (err as Error).message;
        result.failed++;
        this.logger.warn(`close check ${row.source}/${row.externalId} failed: ${message}`);
        // Blocked or rate-limited: more requests would only make it worse (and the crawl shares this IP).
        if (/HTTP (403|429)\b/.test(message)) break;
      }
    }
    this.logger.log(result, 'close check done');
    return result;
  }
}
