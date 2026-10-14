import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

const JOB_NAME = 'enqueue-crawls';

/**
 * On every cron tick, enqueue one crawl job per (enabled profile × queued source).
 * The job id embeds the minute, so a tick that fires twice cannot double-enqueue.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly cronExpr: string;
  private readonly runOnBoot: boolean;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly queues: QueueService,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.cronExpr = config.get('CRAWL_CRON', { infer: true });
    this.runOnBoot = config.get('CRAWL_ON_BOOT', { infer: true });
  }

  onModuleInit() {
    const job = new CronJob(this.cronExpr, () => void this.tick('cron'));
    this.registry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`cron "${this.cronExpr}" registered, next run ${job.nextDate().toISO()}`);

    if (this.runOnBoot) {
      setTimeout(() => void this.tick('boot'), 2_000);
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
}
