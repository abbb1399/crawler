import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { Env } from '../config/env';
import { PostingsService } from '../postings/postings.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

/**
 * Two crons:
 *  - crawl: enqueue one job per (enabled profile × queued source). The job id embeds the
 *    minute, so a tick that fires twice cannot double-enqueue.
 *  - maintenance: nightly expiry pass + closing abandoned RUNNING runs (cheap DB updates, inline).
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly crawlCron: string;
  private readonly maintenanceCron: string;
  private readonly runOnBoot: boolean;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly queues: QueueService,
    private readonly prisma: PrismaService,
    private readonly postings: PostingsService,
    config: ConfigService<Env, true>,
  ) {
    this.crawlCron = config.get('CRAWL_CRON', { infer: true });
    this.maintenanceCron = config.get('MAINTENANCE_CRON', { infer: true });
    this.runOnBoot = config.get('CRAWL_ON_BOOT', { infer: true });
  }

  onModuleInit() {
    const crawl = new CronJob(this.crawlCron, () => void this.tick('cron'));
    this.registry.addCronJob('enqueue-crawls', crawl);
    crawl.start();
    this.logger.log(`crawl cron "${this.crawlCron}", next ${crawl.nextDate().toISO()}`);

    const maint = new CronJob(this.maintenanceCron, () => void this.maintenance('cron'));
    this.registry.addCronJob('maintenance', maint);
    maint.start();
    this.logger.log(`maintenance cron "${this.maintenanceCron}", next ${maint.nextDate().toISO()}`);

    if (this.runOnBoot) {
      setTimeout(() => void this.maintenance('boot').then(() => this.tick('boot')), 2_000);
    }
  }

  async tick(trigger: 'cron' | 'boot'): Promise<number> {
    const profiles = await this.prisma.searchProfile.findMany({ where: { enabled: true } });
    const queued = new Set(this.queues.queuedSources());
    let n = 0;
    for (const profile of profiles) {
      for (const source of profile.sources) {
        if (!queued.has(source)) continue;
        try {
          const { jobId } = await this.queues.enqueueCrawl(source, profile.id, trigger);
          this.logger.debug(`enqueued ${jobId}`);
          n++;
        } catch (err) {
          this.logger.error(`enqueue ${source}/${profile.id} failed: ${(err as Error).message}`);
        }
      }
    }
    this.logger.log(`tick(${trigger}): enqueued ${n} crawl job(s)`);
    return n;
  }

  async maintenance(trigger: 'cron' | 'boot' | 'manual') {
    try {
      // A run left RUNNING for over an hour means the process died mid-crawl.
      const abandoned = await this.prisma.crawlRun.updateMany({
        where: { status: 'RUNNING', startedAt: { lt: new Date(Date.now() - 3_600_000) } },
        data: { status: 'FAILED', finishedAt: new Date(), error: 'abandoned (process died mid-run)' },
      });
      const r = await this.postings.expireStale();
      this.logger.log(
        `maintenance(${trigger}): expired dueDate=${r.byDueDate} stale=${r.byStale}, abandoned runs=${abandoned.count}`,
      );
      return r;
    } catch (err) {
      this.logger.error(`maintenance(${trigger}) failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
