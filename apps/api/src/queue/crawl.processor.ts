import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SOURCE_LABEL, type CrawlSummary } from '@trawler/shared';
import { Job, UnrecoverableError } from 'bullmq';
import { CrawlerService } from '../crawler/crawler.service';
import { NotificationsService } from '../notifier/notifications.service';
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
    protected readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<CrawlJobData, CrawlSummary>): Promise<CrawlSummary> {
    const { source, profileId, trigger } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    this.logger.log(`job ${job.id} (${trigger}) attempt ${attempt}/${maxAttempts}: ${source} profile=${profileId}`);
    await job.updateProgress(5);

    let summary: CrawlSummary;
    try {
      summary = await this.crawler.run(source, profileId);
    } catch (err) {
      // A profile deleted while its job was queued will never succeed; skip the retries.
      if (err instanceof NotFoundException) throw new UnrecoverableError(err.message);
      if (attempt >= maxAttempts) {
        // Final failure: this is the only signal that a site changed its layout or blocked us.
        const message = err instanceof Error ? err.message : String(err);
        await this.notifications.alert(
          `crawl-failed:${source}`,
          `${SOURCE_LABEL[source]} 수집이 ${maxAttempts}회 연속 실패했습니다 (profile #${profileId}).\n${message}`,
        );
      }
      throw err;
    }
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
