import { Controller, Get, Query } from '@nestjs/common';
import { JobSource } from '@trawler/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Read-only lookups. Crawl triggers live in queue/crawl.controller.ts. */
@Controller()
export class CrawlerController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /runs?limit=&source= */
  @Get('runs')
  runs(@Query('limit') limit?: string, @Query('source') source?: string) {
    const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const parsed = source ? JobSource.safeParse(source.toUpperCase()) : undefined;
    return this.prisma.crawlRun.findMany({
      where: parsed?.success ? { source: parsed.data } : undefined,
      orderBy: { id: 'desc' },
      take: n,
      include: { profile: { select: { name: true } } },
    });
  }
}
