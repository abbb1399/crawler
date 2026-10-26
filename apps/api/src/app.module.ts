import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
    // Rate limit. The dashboard server is the only client (one IP), so these limits are shared by
    // everyone using the public dashboard — deliberate: this is a single-user app, and the point is
    // to keep an anonymous visitor from hammering the crawl/maintenance endpoints.
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] }),
    PrismaModule,
    PostingsModule,
    ProfilesModule,
    NotifierModule,
    CrawlerModule,
    QueueModule.register(),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
