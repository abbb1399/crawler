import { Module } from '@nestjs/common';
import { PostingsController } from './postings.controller';
import { PostingsService } from './postings.service';

@Module({
  controllers: [PostingsController],
  providers: [PostingsService],
  exports: [PostingsService],
})
export class PostingsModule {}
