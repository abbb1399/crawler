import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type CrawlSyncResult,
  CrawlTriggerQuery,
  type DispatchResult,
  type EnqueueResult,
  type ExpireResult,
  JobSource,
  type QueueCounts,
  type Stats,
  type TestAlertResult,
} from '@trawler/shared';
import { startOfTodayKst } from '../common/time';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CrawlerService } from '../crawler/crawler.service';
import { NotificationsService } from '../notifier/notifications.service';
import { PostingsService } from '../postings/postings.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from './queue.service';

/** Crawls and maintenance passes are expensive (Playwright, full-table updates): 10/min on top of the global limit. */
const EXPENSIVE = { default: { limit: 10, ttl: 60_000 } };

const TriggerQuery = new ZodValidationPipe(CrawlTriggerQuery);

@Controller()
export class CrawlController {
  constructor(
    private readonly queues: QueueService,
    private readonly crawler: CrawlerService,
    private readonly notifications: NotificationsService,
    private readonly postings: PostingsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Enqueue a crawl: POST /crawl/wanted?profileId=1 → { queue, jobId } */
  @Post('crawl/:source')
  @Throttle(EXPENSIVE)
  enqueue(@Param('source') sourceParam: string, @Query(TriggerQuery) q: CrawlTriggerQuery): Promise<EnqueueResult> {
    return this.queues.enqueueCrawl(parseSource(sourceParam), q.profileId, 'manual');
  }

  /** Enqueue every source of one profile: POST /crawl?profileId=1 */
  @Post('crawl')
  @Throttle(EXPENSIVE)
  async enqueueAll(@Query(TriggerQuery) q: CrawlTriggerQuery): Promise<EnqueueResult[]> {
    const profile = await this.prisma.searchProfile.findUnique({ where: { id: q.profileId } });
    if (!profile) throw new NotFoundException(`profile ${q.profileId} not found`);
    const results: EnqueueResult[] = [];
    for (const source of profile.sources) {
      results.push(await this.queues.enqueueCrawl(source, q.profileId, 'manual'));
    }
    return results;
  }

  /** Run inline and wait for the result. Debugging aid; bypasses the queue. */
  @Post('crawl/:source/sync')
  @Throttle(EXPENSIVE)
  async runSync(@Param('source') sourceParam: string, @Query(TriggerQuery) q: CrawlTriggerQuery): Promise<CrawlSyncResult> {
    const source = parseSource(sourceParam);
    const summary = await this.crawler.run(source, q.profileId);
    const notify = summary.inserted > 0 ? await this.notifications.dispatchPending() : null;
    return { ...summary, notify };
  }

  /** Expiry pass on demand (the nightly cron does the same). */
  @Post('maintenance/expire')
  @Throttle(EXPENSIVE)
  expire(): Promise<ExpireResult> {
    return this.postings.expireStale();
  }

  /** Re-dispatch anything still pending (normally the notify queue does this after a crawl). */
  @Post('maintenance/notify')
  @Throttle(EXPENSIVE)
  notify(): Promise<DispatchResult> {
    return this.notifications.dispatchPending();
  }

  /** Sends a test alert through every enabled channel. */
  @Post('maintenance/test-alert')
  @Throttle(EXPENSIVE)
  async testAlert(): Promise<TestAlertResult> {
    const sent = await this.notifications.alert(`test:${Date.now()}`, '테스트 경고입니다. 알림 채널이 동작합니다.');
    return { sent, channels: this.notifications.enabledChannels() };
  }

  @Get('queues')
  counts(): Promise<QueueCounts> {
    return this.queues.counts();
  }

  @Get('stats')
  async stats(): Promise<Stats> {
    const [total, active, hidden, starred, newToday, bySource, lastRun, queues] = await Promise.all([
      this.prisma.jobPosting.count(),
      this.prisma.jobPosting.count({ where: { status: 'ACTIVE', hidden: false } }),
      this.prisma.jobPosting.count({ where: { status: 'ACTIVE', hidden: true } }),
      this.prisma.jobPosting.count({ where: { starred: true } }),
      this.prisma.jobPosting.count({ where: { status: 'ACTIVE', hidden: false, firstSeenAt: { gte: startOfTodayKst() } } }),
      this.prisma.jobPosting.groupBy({ by: ['source'], where: { status: 'ACTIVE', hidden: false }, _count: { _all: true } }),
      this.prisma.crawlRun.findFirst({ orderBy: { id: 'desc' }, select: { finishedAt: true, startedAt: true } }),
      this.queues.counts(),
    ]);
    return {
      postings: {
        total,
        active,
        hidden,
        starred,
        newToday,
        bySource: bySource.map((g) => ({ source: g.source, count: g._count._all })),
      },
      lastRunAt: lastRun ? (lastRun.finishedAt ?? lastRun.startedAt).toISOString() : null,
      queues,
    };
  }
}

function parseSource(raw: string): JobSource {
  const source = JobSource.safeParse(raw.toUpperCase());
  if (!source.success) {
    throw new BadRequestException(`source must be one of ${JobSource.options.join(', ')}`);
  }
  return source.data;
}
