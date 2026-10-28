import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CrawlSummary, JobSource, RawPosting } from '@trawler/shared';
import { PostingsService } from '../postings/postings.service';
import { PrismaService } from '../prisma/prisma.service';
import { SOURCE_ADAPTERS, type SourceAdapter } from './source-adapter';
import { matchesRegion, matchesTitle } from './title-filter';

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
   * Notification is the caller's job (the notify queue in normal operation).
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
}
