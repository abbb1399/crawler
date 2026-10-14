import { Module } from '@nestjs/common';
import { PostingsModule } from '../postings/postings.module';
import { CrawlerController } from './crawler.controller';
import { CrawlerService } from './crawler.service';
import { SOURCE_ADAPTERS } from './source-adapter';
import { WantedAdapter } from './wanted.adapter';

@Module({
  imports: [PostingsModule],
  controllers: [CrawlerController],
  providers: [
    WantedAdapter,
    {
      provide: SOURCE_ADAPTERS,
      // JobKoreaAdapter joins this list in Phase 4.
      useFactory: (wanted: WantedAdapter) => [wanted],
      inject: [WantedAdapter],
    },
    CrawlerService,
  ],
  exports: [CrawlerService],
})
export class CrawlerModule {}
