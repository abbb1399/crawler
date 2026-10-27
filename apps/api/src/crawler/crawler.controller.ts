import { Controller, Get, Query } from '@nestjs/common';
import { type CrawlRun, type RunsDaily, RunsQuery, RunsStatsQuery } from '@trawler/shared';
import { startOfTodayKst } from '../common/time';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { aggregateRuns, DAY_MS } from './runs-stats';

/** Read-only lookups. Crawl triggers live in queue/crawl.controller.ts. */
@Controller()
export class CrawlerController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /runs/stats?days= — per (KST day, source) counts and mean duration for the chart. */
  @Get('runs/stats')
  async runsStats(@Query(new ZodValidationPipe(RunsStatsQuery)) q: RunsStatsQuery): Promise<RunsDaily> {
    const now = new Date();
    const since = new Date(startOfTodayKst(now).getTime() - (q.days - 1) * DAY_MS);
    const rows = await this.prisma.crawlRun.findMany({
      where: { startedAt: { gte: since } },
      select: { source: true, status: true, startedAt: true, finishedAt: true, inserted: true },
    });
    return aggregateRuns(rows, q.days, now);
  }

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
