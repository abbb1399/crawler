import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { CrawlerModule } from './crawler/crawler.module';
import { HealthController } from './health/health.controller';
import { NotifierModule } from './notifier/notifier.module';
import { PostingsModule } from './postings/postings.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    // Must come first: forRoot() loads .env into process.env synchronously, and
    // QueueModule.register() below reads ROLE from process.env.
    ConfigModule.forRoot({
      isGlobal: true,
      // Resolved relative to process.cwd(); `pnpm dev` runs from apps/api.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    PostingsModule,
    ProfilesModule,
    NotifierModule,
    CrawlerModule,
    QueueModule.register(),
  ],
  controllers: [HealthController],
})
export class AppModule {}
