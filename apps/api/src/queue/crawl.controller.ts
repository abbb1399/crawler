import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JobSource } from '@devilray/shared';
import { CrawlerService } from '../crawler/crawler.service';
import { NotificationsService } from '../notifier/notifications.service';
import { QueueService } from './queue.service';

@Controller()
export class CrawlController {
  constructor(
    private readonly queues: QueueService,
    private readonly crawler: CrawlerService,
    private readonly notifications: NotificationsService,
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

  /** Run inline and wait for the result. Debugging aid; bypasses the queue. */
  @Post('crawl/:source/sync')
  async runSync(@Param('source') sourceParam: string, @Query('profileId') profileIdParam?: string) {
    const { source, profileId } = parse(sourceParam, profileIdParam);
    const summary = await this.crawler.run(source, profileId);
    const notify = summary.inserted > 0 ? await this.notifications.dispatchPending() : null;
    return { ...summary, notify };
  }

  @Get('queues')
  counts() {
    return this.queues.counts();
  }
}

function parse(sourceParam: string, profileIdParam?: string) {
  const source = JobSource.safeParse(sourceParam.toUpperCase());
  if (!source.success) {
    throw new BadRequestException(`source must be one of ${JobSource.options.join(', ')}`);
  }
  const profileId = Number(profileIdParam ?? 1);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    throw new BadRequestException('profileId must be a positive integer');
  }
  return { source: source.data, profileId };
}
