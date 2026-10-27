import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { QueueService } from '../queue/queue.service';
import { HealthController } from './health.controller';

const COUNTS = { 'crawl-wanted': { waiting: 0, active: 0 }, notify: { waiting: 1, active: 0 } };

function make(opts: { db?: 'ok' | 'down' | 'hang'; redis?: 'ok' | 'down' | 'hang' } = {}) {
  const never = () => new Promise<never>(() => undefined);
  const prisma = {
    $queryRaw: vi.fn(() => (opts.db === 'down' ? Promise.reject(new Error('ECONNREFUSED')) : opts.db === 'hang' ? never() : Promise.resolve([{ 1: 1 }]))),
  } as unknown as PrismaService;
  const queues = {
    counts: vi.fn(() => (opts.redis === 'down' ? Promise.reject(new Error('ECONNRESET')) : opts.redis === 'hang' ? never() : Promise.resolve(COUNTS))),
  } as unknown as QueueService;
  const res = { status: vi.fn() };
  return { controller: new HealthController(prisma, queues), res };
}

describe('HealthController', () => {
  it('reports ok with queue counts when both dependencies answer', async () => {
    const { controller, res } = make();
    const body = await controller.check(res);
    expect(body).toMatchObject({ status: 'ok', db: 'ok', redis: 'ok', queues: COUNTS });
    expect(body.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('is degraded (503) when Postgres fails', async () => {
    const { controller, res } = make({ db: 'down' });
    const body = await controller.check(res);
    expect(body).toMatchObject({ status: 'degraded', db: 'down', redis: 'ok' });
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('is degraded (503) with queues=null when Redis fails or hangs', async () => {
    vi.useFakeTimers();
    try {
      const { controller, res } = make({ redis: 'hang' });
      const pending = controller.check(res);
      await vi.advanceTimersByTimeAsync(2000);
      const body = await pending;
      expect(body).toMatchObject({ status: 'degraded', db: 'ok', redis: 'down', queues: null });
      expect(res.status).toHaveBeenCalledWith(503);
    } finally {
      vi.useRealTimers();
    }
    const down = make({ redis: 'down' });
    expect(await down.controller.check(down.res)).toMatchObject({ redis: 'down', queues: null });
  });
});
