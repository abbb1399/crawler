import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  // bufferLogs: hold Nest's startup lines until the pino logger below takes over, so they are JSON too.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  // Needed so OnModuleDestroy hooks (browser/queue cleanup in later phases) run on Ctrl+C / watch restarts.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Env, true>);
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), methods: ['GET', 'POST', 'PATCH', 'DELETE'] });

  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
