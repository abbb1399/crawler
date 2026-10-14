import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { CrawlerModule } from './crawler/crawler.module';
import { HealthController } from './health/health.controller';
import { PostingsModule } from './postings/postings.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Resolved relative to process.cwd(); `pnpm dev` runs from apps/api.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    PostingsModule,
    CrawlerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
