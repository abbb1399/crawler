import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CrawlerModule } from '../crawler/crawler.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), CrawlerModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
