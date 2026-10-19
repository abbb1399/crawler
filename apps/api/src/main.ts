import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Needed so OnModuleDestroy hooks (browser/queue cleanup in later phases) run on Ctrl+C / watch restarts.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Env, true>);
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), methods: ['GET', 'POST', 'PATCH', 'DELETE'] });

  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
