import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { PostingListQuery, PostingPatch } from '@trawler/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PostingsService } from './postings.service';

@Controller('postings')
export class PostingsController {
  constructor(private readonly postings: PostingsService) {}

  /** GET /postings?source=&status=&q=&hidden=true&starred=true&page=&limit= */
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
}
