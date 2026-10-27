import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { pinoHttpOptions } from './common/logger.config';
import { requestId } from './common/request-id.middleware';
import { type Env, validateEnv } from './config/env';
import { DocsModule } from './docs/docs.module';
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
    // Structured JSON logs (pretty in dev); every line inside a request carries req.id.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: pinoHttpOptions({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
        }),
      }),
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
    DocsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestId).forRoutes('{*splat}');
  }
}
