import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Read-only lookups. Crawl triggers live in queue/crawl.controller.ts. */
@Controller()
export class CrawlerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('profiles')
  profiles() {
    return this.prisma.searchProfile.findMany({ orderBy: { id: 'asc' } });
  }

  @Get('runs')
  runs(@Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.prisma.crawlRun.findMany({
      orderBy: { id: 'desc' },
      take: n,
      include: { profile: { select: { name: true } } },
    });
  }
}
