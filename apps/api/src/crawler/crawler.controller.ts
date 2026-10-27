import { Controller, Get, Query } from '@nestjs/common';
import { type CrawlRun, RunsQuery } from '@trawler/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

/** Read-only lookups. Crawl triggers live in queue/crawl.controller.ts. */
@Controller()
export class CrawlerController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /runs?limit=&source= — newest first. */
  @Get('runs')
  async runs(@Query(new ZodValidationPipe(RunsQuery)) q: RunsQuery): Promise<CrawlRun[]> {
    const rows = await this.prisma.crawlRun.findMany({
      where: q.source ? { source: q.source } : undefined,
      orderBy: { id: 'desc' },
      take: q.limit,
      include: { profile: { select: { name: true } } },
    });
    return rows.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    }));
  }
}
