import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnqueueResult, JobSource } from '@trawler/shared';
import { Queue } from 'bullmq';
import type { Env } from '../config/env';
import {
  crawlJobId,
  crawlQueueName,
  NOTIFY_QUEUE,
  QUEUED_SOURCES,
  type CrawlJobData,
  type NotifyJobData,
} from './queue.constants';

/** Producer side: everything that puts jobs on a queue goes through here. */
@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private readonly crawlQueues: Map<JobSource, Queue<CrawlJobData>>;
  private readonly drainOnBoot: boolean;

  constructor(
    @InjectQueue(crawlQueueName('WANTED')) wanted: Queue<CrawlJobData>,
    @InjectQueue(crawlQueueName('SARAMIN')) saramin: Queue<CrawlJobData>,
    @InjectQueue(NOTIFY_QUEUE) private readonly notifyQueue: Queue<NotifyJobData>,
    config: ConfigService<Env, true>,
  ) {
    this.crawlQueues = new Map([
      ['WANTED', wanted],
      ['SARAMIN', saramin],
    ]);
    this.drainOnBoot = config.get('QUEUE_DRAIN_ON_BOOT', { infer: true });
  }

  async onModuleInit() {
    for (const q of this.allQueues()) {
      // Without a listener, BullMQ/ioredis print connection errors raw to stderr (not JSON, no context).
      q.on('error', (err: Error) => this.logger.warn({ queue: q.name, err: err.message }, 'queue connection error'));
    }
    if (!this.drainOnBoot) return;
    for (const q of this.allQueues()) {
      await q.drain(); // removes waiting + delayed; active jobs finish or get stalled-retried
      this.logger.warn(`drained queue "${q.name}" (QUEUE_DRAIN_ON_BOOT)`);
    }
  }

  hasQueue(source: JobSource): boolean {
    return this.crawlQueues.has(source);
  }

  queuedSources(): JobSource[] {
    return QUEUED_SOURCES.filter((s) => this.crawlQueues.has(s));
  }

  async enqueueCrawl(
    source: JobSource,
    profileId: number,
    trigger: CrawlJobData['trigger'],
  ): Promise<EnqueueResult> {
    const queue = this.crawlQueues.get(source);
    if (!queue) throw new Error(`No crawl queue for source ${source}`);
    const job = await queue.add(
      'crawl',
      { source, profileId, trigger },
      { jobId: crawlJobId(source, profileId) },
    );
    return { queue: queue.name, jobId: String(job.id) };
  }

  /** Multiple notify jobs are harmless: concurrency is 1 and a run with nothing pending is a no-op. */
  async enqueueNotify(data: NotifyJobData = {}): Promise<EnqueueResult> {
    const job = await this.notifyQueue.add('dispatch', data);
    return { queue: this.notifyQueue.name, jobId: String(job.id) };
  }

  async counts() {
    const out: Record<string, Record<string, number>> = {};
    for (const q of this.allQueues()) {
      out[q.name] = await q.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
    }
    return out;
  }

  private allQueues(): Queue[] {
    return [...this.crawlQueues.values(), this.notifyQueue];
  }
}
