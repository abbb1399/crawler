import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { Env } from '../config/env';
import { CrawlerService } from '../crawler/crawler.service';
import { PrismaService } from '../prisma/prisma.service';

const JOB_NAME = 'crawl-all';

/**
 * Phase 2: runs every enabled profile × source sequentially on a cron.
 * Phase 3 replaces the body of `tick()` with BullMQ enqueues.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly cronExpr: string;
  private readonly runOnBoot: boolean;
  private running = false;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly crawler: CrawlerService,
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

  /** Run every enabled profile against every source that has an adapter. */
  async tick(trigger: string): Promise<void> {
    if (this.running) {
      this.logger.warn(`tick(${trigger}) skipped: previous run still in progress`);
      return;
    }
    this.running = true;
    const started = Date.now();
    try {
      const profiles = await this.prisma.searchProfile.findMany({ where: { enabled: true } });
      const available = new Set(this.crawler.availableSources());
      let runs = 0;
      for (const profile of profiles) {
        for (const source of profile.sources) {
          if (!available.has(source)) continue;
          try {
            await this.crawler.run(source, profile.id);
            runs++;
          } catch (err) {
            // Already logged + recorded as FAILED CrawlRun by CrawlerService.
          }
        }
      }
      this.logger.log(`tick(${trigger}) done: ${runs} run(s) in ${Date.now() - started}ms`);
    } finally {
      this.running = false;
    }
  }
}
