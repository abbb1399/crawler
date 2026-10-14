import { Module } from '@nestjs/common';
import { PostingsModule } from '../postings/postings.module';
import { BrowserService } from './browser.service';
import { CrawlerController } from './crawler.controller';
import { CrawlerService } from './crawler.service';
import { SaraminAdapter } from './saramin.adapter';
import { SOURCE_ADAPTERS } from './source-adapter';
import { WantedAdapter } from './wanted.adapter';

@Module({
  imports: [PostingsModule],
  controllers: [CrawlerController],
  providers: [
    BrowserService,
    WantedAdapter,
    SaraminAdapter,
    {
      provide: SOURCE_ADAPTERS,
      useFactory: (wanted: WantedAdapter, saramin: SaraminAdapter) => [wanted, saramin],
      inject: [WantedAdapter, SaraminAdapter],
    },
    CrawlerService,
  ],
  exports: [CrawlerService],
})
export class CrawlerModule {}
