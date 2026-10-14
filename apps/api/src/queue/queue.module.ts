import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import type { Env } from '../config/env';
import { runsWorkers } from '../config/role';
import { CrawlerModule } from '../crawler/crawler.module';
import { NotifierModule } from '../notifier/notifier.module';
import { SchedulerService } from '../scheduler/scheduler.service';
import { CrawlController } from './crawl.controller';
import { SaraminCrawlProcessor, WantedCrawlProcessor } from './crawl.processor';
import { NotifyProcessor } from './notify.processor';
import { crawlQueueName, NOTIFY_QUEUE, QUEUED_SOURCES } from './queue.constants';
import { QueueService } from './queue.service';

const QUEUE_NAMES = [...QUEUED_SOURCES.map(crawlQueueName), NOTIFY_QUEUE];

@Module({})
export class QueueModule {
  /**
   * Called from AppModule after ConfigModule.forRoot() so ROLE is already in process.env.
   * Queues (producers) and Bull Board are always registered. Workers and the cron
   * scheduler (which only enqueues) are added when the role runs workers.
   */
  static register(): DynamicModule {
    const workerSide = runsWorkers();

    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            connection: {
              host: config.get('REDIS_HOST', { infer: true }),
              port: config.get('REDIS_PORT', { infer: true }),
              // Required by BullMQ; the ioredis default would throw at startup.
              maxRetriesPerRequest: null,
            },
            defaultJobOptions: {
              attempts: 3,
              backoff: { type: 'exponential', delay: 10_000 },
              removeOnComplete: 100,
              removeOnFail: 500,
            },
          }),
        }),
        ...QUEUE_NAMES.map((name) => BullModule.registerQueue({ name })),
        BullBoardModule.forRoot({ route: '/admin/queues', adapter: ExpressAdapter }),
        ...QUEUE_NAMES.map((name) => BullBoardModule.forFeature({ name, adapter: BullMQAdapter })),
        CrawlerModule,
        NotifierModule,
        ...(workerSide ? [ScheduleModule.forRoot()] : []),
      ],
      controllers: [CrawlController],
      providers: [
        QueueService,
        ...(workerSide ? [WantedCrawlProcessor, SaraminCrawlProcessor, NotifyProcessor, SchedulerService] : []),
      ],
      exports: [QueueService],
    };
  }
}
