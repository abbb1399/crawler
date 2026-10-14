import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { CrawlSummary } from '@devilray/shared';
import { Job } from 'bullmq';
import { CrawlerService } from '../crawler/crawler.service';
import { crawlQueueName, type CrawlJobData } from './queue.constants';
import { QueueService } from './queue.service';

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
    protected readonly queues: QueueService,
  ) {
    super();
  }

  async process(job: Job<CrawlJobData, CrawlSummary>): Promise<CrawlSummary> {
    const { source, profileId, trigger } = job.data;
    this.logger.log(
      `job ${job.id} (${trigger}) attempt ${job.attemptsMade + 1}: ${source} profile=${profileId}`,
    );
    await job.updateProgress(5);

    const summary = await this.crawler.run(source, profileId);
    await job.updateProgress(90);

    if (summary.inserted > 0) {
      await this.queues.enqueueNotify({ runId: summary.runId });
    }
    await job.updateProgress(100);
    return summary;
  }
}

export const CRAWL_WORKER_OPTIONS = { concurrency: 1, lockDuration: 300_000 } as const;

@Processor(crawlQueueName('WANTED'), CRAWL_WORKER_OPTIONS)
export class WantedCrawlProcessor extends BaseCrawlProcessor {}

/** Playwright-backed; concurrency 1 keeps it to one browser at a time. */
@Processor(crawlQueueName('SARAMIN'), CRAWL_WORKER_OPTIONS)
export class SaraminCrawlProcessor extends BaseCrawlProcessor {}
