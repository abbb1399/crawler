import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse } from '@trawler/shared';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

/** How long a dependency may take before it counts as down. */
const DEP_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * GET /health — 200 when Postgres and Redis both answer, 503 (`degraded`) otherwise.
 * Body is always the full HealthResponse so a dashboard can show what is down.
 * Redis is probed through BullMQ's job counts (the same call the stats page makes).
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: { status(code: number): unknown }): Promise<HealthResponse> {
    const [db, queues] = await Promise.all([
      withTimeout(this.prisma.$queryRaw`SELECT 1`, DEP_TIMEOUT_MS).then(
        () => 'ok' as const,
        () => 'down' as const,
      ),
      withTimeout(this.queues.counts(), DEP_TIMEOUT_MS).then(
        (c) => c,
        () => null,
      ),
    ]);
    const redis = queues ? ('ok' as const) : ('down' as const);
    const status = db === 'ok' && redis === 'ok' ? ('ok' as const) : ('degraded' as const);
    if (status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status, db, redis, queues, uptimeSec: Math.round(process.uptime()), timestamp: new Date().toISOString() };
  }
}
