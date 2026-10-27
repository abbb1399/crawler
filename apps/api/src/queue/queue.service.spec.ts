import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { stubConfig } from '../test/db';
import { QueueService } from './queue.service';

/** add() answers like BullMQ: the new job, or the existing one when the deduplication id is taken. */
function fakeQueue(name: string, existingId?: string) {
  const add = vi.fn(async (_name: string, _data: unknown, opts: { jobId: string }) => ({ id: existingId ?? opts.jobId }));
  return { queue: { name, add, on: () => undefined } as unknown as Queue, add };
}

function service(wanted: Queue) {
  const other = fakeQueue('other').queue;
  return new QueueService(wanted, other, other, stubConfig({ QUEUE_DRAIN_ON_BOOT: false }));
}

describe('QueueService.enqueueCrawl', () => {
  it('queues a crawl keyed by profile and source for deduplication', async () => {
    const { queue, add } = fakeQueue('crawl-wanted');
    const r = await service(queue).enqueueCrawl('WANTED', 1, 'manual');
    expect(add.mock.calls[0][2]).toMatchObject({ deduplication: { id: 'wanted-1' } });
    expect(r).toMatchObject({ queue: 'crawl-wanted', deduplicated: false });
  });

  it('reports a crawl already waiting or running as deduplicated, with its job id', async () => {
    const { queue } = fakeQueue('crawl-wanted', 'wanted-1-202610271800');
    const r = await service(queue).enqueueCrawl('WANTED', 1, 'manual');
    expect(r).toEqual({ queue: 'crawl-wanted', jobId: 'wanted-1-202610271800', deduplicated: true });
  });
});
