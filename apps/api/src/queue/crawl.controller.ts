import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JobSource, type EnqueueResult, type ExpireResult, type Stats } from '@trawler/shared';
import { CrawlerService } from '../crawler/crawler.service';
import { NotificationsService } from '../notifier/notifications.service';
import { PostingsService } from '../postings/postings.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from './queue.service';

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
  enqueue(@Param('source') sourceParam: string, @Query('profileId') profileIdParam?: string) {
    const { source, profileId } = parse(sourceParam, profileIdParam);
    if (!this.queues.hasQueue(source)) {
      throw new BadRequestException(`source ${source} has no crawl queue yet`);
    }
    return this.queues.enqueueCrawl(source, profileId, 'manual');
  }

  /** Enqueue every source of one profile: POST /crawl?profileId=1 */
  @Post('crawl')
  async enqueueAll(@Query('profileId') profileIdParam?: string) {
    const profileId = parseProfileId(profileIdParam);
    const profile = await this.prisma.searchProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new BadRequestException(`profile ${profileId} not found`);
    const results: EnqueueResult[] = [];
    for (const source of profile.sources) {
      if (this.queues.hasQueue(source)) {
        results.push(await this.queues.enqueueCrawl(source, profileId, 'manual'));
      }
    }
    return results;
  }

  /** Run inline and wait for the result. Debugging aid; bypasses the queue. */
  @Post('crawl/:source/sync')
  async runSync(@Param('source') sourceParam: string, @Query('profileId') profileIdParam?: string) {
    const { source, profileId } = parse(sourceParam, profileIdParam);
    const summary = await this.crawler.run(source, profileId);
    const notify = summary.inserted > 0 ? await this.notifications.dispatchPending() : null;
    return { ...summary, notify };
  }

  /** Expiry pass on demand (the nightly cron does the same). */
  @Post('maintenance/expire')
  expire(): Promise<ExpireResult> {
    return this.postings.expireStale();
  }

  /** Re-dispatch anything still pending (normally the notify queue does this after a crawl). */
  @Post('maintenance/notify')
  notify() {
    return this.notifications.dispatchPending();
  }

  /** Sends a test alert through every enabled channel. */
  @Post('maintenance/test-alert')
  async testAlert() {
    const sent = await this.notifications.alert(`test:${Date.now()}`, '테스트 경고입니다. 알림 채널이 동작합니다.');
    return { sent, channels: this.notifications.enabledChannels() };
  }

  @Get('queues')
  counts() {
    return this.queues.counts();
  }

  @Get('stats')
  async stats(): Promise<Stats> {
    const [total, active, hidden, starred, bySource, lastRun, queues] = await Promise.all([
      this.prisma.jobPosting.count(),
      this.prisma.jobPosting.count({ where: { status: 'ACTIVE', hidden: false } }),
      this.prisma.jobPosting.count({ where: { status: 'ACTIVE', hidden: true } }),
      this.prisma.jobPosting.count({ where: { starred: true } }),
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
        bySource: bySource.map((g) => ({ source: g.source, count: g._count._all })),
      },
      lastRunAt: lastRun ? (lastRun.finishedAt ?? lastRun.startedAt).toISOString() : null,
      queues,
    };
  }
}

function parse(sourceParam: string, profileIdParam?: string) {
  const source = JobSource.safeParse(sourceParam.toUpperCase());
  if (!source.success) {
    throw new BadRequestException(`source must be one of ${JobSource.options.join(', ')}`);
  }
  return { source: source.data, profileId: parseProfileId(profileIdParam) };
}

function parseProfileId(raw?: string) {
  const profileId = Number(raw ?? 1);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    throw new BadRequestException('profileId must be a positive integer');
  }
  return profileId;
}
