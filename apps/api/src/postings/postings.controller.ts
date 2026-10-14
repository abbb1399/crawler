import { Controller, Get, Query } from '@nestjs/common';
import { JobSource } from '@devilray/shared';
import { PostingsService } from './postings.service';

@Controller('postings')
export class PostingsController {
  constructor(private readonly postings: PostingsService) {}

  /** Quick look at what was collected. The real list API comes with the web UI (Phase 5). */
  @Get()
  recent(@Query('limit') limit?: string, @Query('source') source?: string) {
    const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const parsed = source ? JobSource.safeParse(source.toUpperCase()) : undefined;
    return this.postings.findRecent(n, parsed?.success ? parsed.data : undefined);
  }
}
