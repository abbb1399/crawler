import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CrawlSummary } from '@trawler/shared';
import { Job, UnrecoverableError } from 'bullmq';
import { CrawlerService } from '../crawler/crawler.service';
import { crawlQueueName, type CrawlJobData } from './queue.constants';

/**
 * Shared body for every per-source crawl worker. Subclasses only pin the queue name.
 *
 * `@Injectable()` on the abstract base is required: TypeScript only emits constructor
 * parameter metadata for decorated classes, and the subclasses declare no constructor.
 *
 * lockDuration: a crawl can take minutes; BullMQ's 30s default would mark it stalled
 * and start a duplicate. Progress updates also extend the lock.
 */
@Injectable()
export abstract class BaseCrawlProcessor extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly crawler: CrawlerService,
  ) {
    super();
  }

  async process(job: Job<CrawlJobData, CrawlSummary>): Promise<CrawlSummary> {
    const { source, profileId, trigger } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    this.logger.log({ jobId: job.id, trigger, attempt, maxAttempts, source, profileId }, 'crawl job start');
    await job.updateProgress(5);

    let summary: CrawlSummary;
    try {
      summary = await this.crawler.run(source, profileId);
    } catch (err) {
      // A profile deleted while its job was queued will never succeed; skip the retries.
      if (err instanceof NotFoundException) throw new UnrecoverableError(err.message);
      if (attempt >= maxAttempts) {
        // Final failure usually means the site changed its layout or blocked us; it also shows up as FAILED in /runs.
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error({ jobId: job.id, source, profileId, attempts: maxAttempts, err: message }, 'crawl failed on every attempt');
      }
      throw err;
    }
    await job.updateProgress(100);
    this.logger.log(
      { jobId: job.id, runId: summary.runId, inserted: summary.inserted, updated: summary.updated, durationMs: summary.durationMs },
      'crawl job done',
    );
    return summary;
  }
}

export const CRAWL_WORKER_OPTIONS = { concurrency: 1, lockDuration: 300_000 } as const;

@Processor(crawlQueueName('WANTED'), CRAWL_WORKER_OPTIONS)
export class WantedCrawlProcessor extends BaseCrawlProcessor {}

/** Playwright-backed; concurrency 1 keeps it to one browser at a time. */
@Processor(crawlQueueName('SARAMIN'), CRAWL_WORKER_OPTIONS)
export class SaraminCrawlProcessor extends BaseCrawlProcessor {}
