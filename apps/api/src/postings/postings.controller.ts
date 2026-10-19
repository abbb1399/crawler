import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PostingListQuery, PostingPatch } from '@devilray/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PostingsService } from './postings.service';

@Controller('postings')
export class PostingsController {
  constructor(private readonly postings: PostingsService) {}

  /** GET /postings?source=&status=&q=&unseen=true&starred=true&cursor=&limit= */
  @Get()
  list(@Query(new ZodValidationPipe(PostingListQuery)) query: PostingListQuery) {
    return this.postings.list(query);
  }

  @Patch(':id')
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(PostingPatch)) body: PostingPatch,
  ) {
    return this.postings.patch(id, body);
  }

  @Post('mark-all-seen')
  async markAllSeen() {
    return { updated: await this.postings.markAllSeen() };
  }
}
