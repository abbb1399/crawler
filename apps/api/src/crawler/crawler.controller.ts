import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JobSource } from '@devilray/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from './crawler.service';

@Controller()
export class CrawlerController {
  constructor(
    private readonly crawler: CrawlerService,
    private readonly prisma: PrismaService,
  ) {}

  /** Manual trigger: POST /crawl/wanted?profileId=1 */
  @Post('crawl/:source')
  trigger(@Param('source') sourceParam: string, @Query('profileId') profileIdParam?: string) {
    const source = JobSource.safeParse(sourceParam.toUpperCase());
    if (!source.success) {
      throw new BadRequestException(`source must be one of ${JobSource.options.join(', ')}`);
    }
    const profileId = Number(profileIdParam ?? 1);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      throw new BadRequestException('profileId must be a positive integer');
    }
    return this.crawler.run(source.data, profileId);
  }

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
