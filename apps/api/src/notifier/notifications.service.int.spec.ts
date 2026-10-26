import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../config/env';
import { HOUR_MS, makePrisma, rawPosting, seedPosting, stubConfig, truncateAll } from '../test/db';
import { NotificationsService } from './notifications.service';
import type { NotifiablePosting, Notifier } from './notifier';

const prisma = makePrisma();

/** Records every batch; `failOnCall` makes the n-th send (1-based) throw. */
function fakeNotifier(opts: { enabled?: boolean; failOnCall?: number } = {}) {
  const batches: NotifiablePosting[][] = [];
  let calls = 0;
  const notifier: Notifier = {
    channel: 'SLACK',
    enabled: opts.enabled ?? true,
    async send(postings) {
      calls++;
      if (calls === opts.failOnCall) throw new Error('webhook down');
      batches.push(postings);
    },
    async sendText() {},
  };
  return { notifier, batches };
}

function makeService(notifier: Notifier, env: Partial<Env> = {}) {
  return new NotificationsService(
    [notifier],
    prisma,
    stubConfig({ NOTIFY_MAX_PER_RUN: 50, NOTIFY_LOOKBACK_HOURS: 24, NOTIFY_REPOSTS: false, ALERT_MIN_INTERVAL_MIN: 360, ...env }),
  );
}

const ago = (hours: number) => new Date(Date.now() - hours * HOUR_MS);
const seedMany = (n: number) =>
  Promise.all(
    Array.from({ length: n }, (_, i) =>
      // Spread over the last ~12h (well inside the 24h lookback), oldest first so batch order is deterministic.
      seedPosting(prisma, rawPosting({ externalId: `n${i}`, title: `공고 ${i}` }), { firstSeenAt: ago((n - i) / 2) }),
    ),
  );
const logs = () => prisma.notificationLog.findMany({ orderBy: { postingId: 'asc' } });

beforeEach(() => truncateAll(prisma));
afterAll(() => prisma.$disconnect());

describe('dispatchPending', () => {
  it('selects ACTIVE postings first seen inside the lookback that have no successful log, oldest first', async () => {
    const fresh = await seedPosting(prisma, rawPosting({ externalId: 'fresh' }), { firstSeenAt: ago(2) });
    const retry = await seedPosting(prisma, rawPosting({ externalId: 'retry' }), { firstSeenAt: ago(5) });
    await prisma.notificationLog.create({ data: { postingId: retry.id, channel: 'SLACK', kind: 'NEW', ok: false, error: 'earlier failure' } });
    const done = await seedPosting(prisma, rawPosting({ externalId: 'done' }), { firstSeenAt: ago(1) });
    await prisma.notificationLog.create({ data: { postingId: done.id, channel: 'SLACK', kind: 'NEW', ok: true } });
    await seedPosting(prisma, rawPosting({ externalId: 'old' }), { firstSeenAt: ago(25) });
    await seedPosting(prisma, rawPosting({ externalId: 'expired' }), { firstSeenAt: ago(1), status: 'EXPIRED' });
    await seedPosting(prisma, rawPosting({ externalId: 'repost' }), { firstSeenAt: ago(1), repostOfId: fresh.id });

    const { notifier, batches } = fakeNotifier();
    expect(await makeService(notifier).dispatchPending()).toEqual({ delivered: 2, failed: 0 });
    expect(batches).toHaveLength(1);
    expect(batches[0].map((p) => p.id)).toEqual([retry.id, fresh.id]);

    const byId = new Map((await logs()).map((l) => [l.postingId, l]));
    expect(byId.get(retry.id)).toMatchObject({ ok: true, error: null });
    expect(byId.get(fresh.id)).toMatchObject({ ok: true });
    expect(byId.size).toBe(3); // retry, fresh, done — nothing for old/expired/repost
  });

  it('includes reposts when NOTIFY_REPOSTS is on', async () => {
    const orig = await seedPosting(prisma, rawPosting({ externalId: 'o' }), { firstSeenAt: ago(1) });
    await seedPosting(prisma, rawPosting({ externalId: 'r' }), { firstSeenAt: ago(1), repostOfId: orig.id });
    const { notifier, batches } = fakeNotifier();
    await makeService(notifier, { NOTIFY_REPOSTS: true }).dispatchPending();
    expect(batches[0]).toHaveLength(2);
  });

  it('sends in batches of 10 and caps at NOTIFY_MAX_PER_RUN', async () => {
    await seedMany(25);
    const { notifier, batches } = fakeNotifier();
    expect(await makeService(notifier).dispatchPending()).toEqual({ delivered: 25, failed: 0 });
    expect(batches.map((b) => b.length)).toEqual([10, 10, 5]);
    expect((await logs()).filter((l) => l.ok)).toHaveLength(25);

    await truncateAll(prisma);
    await seedMany(25);
    const capped = fakeNotifier();
    expect(await makeService(capped.notifier, { NOTIFY_MAX_PER_RUN: 12 }).dispatchPending()).toEqual({ delivered: 12, failed: 0 });
    expect(capped.batches.map((b) => b.length)).toEqual([10, 2]);
  });

  it('a failing batch stops the channel, records the failure, and is retried next run', async () => {
    await seedMany(25);
    const first = fakeNotifier({ failOnCall: 2 });
    expect(await makeService(first.notifier).dispatchPending()).toEqual({ delivered: 10, failed: 15 });
    expect(first.batches).toHaveLength(1);

    const after = await logs();
    expect(after.filter((l) => l.ok)).toHaveLength(10);
    expect(after.filter((l) => !l.ok)).toHaveLength(10);
    expect(after.find((l) => !l.ok)?.error).toBe('webhook down');
    expect(after).toHaveLength(20); // the last 5 were never attempted, so no log yet

    const second = fakeNotifier();
    expect(await makeService(second.notifier).dispatchPending()).toEqual({ delivered: 15, failed: 0 });
    expect(second.batches.map((b) => b.length)).toEqual([10, 5]);
    expect((await logs()).filter((l) => l.ok)).toHaveLength(25);
  });

  it('does nothing for a disabled channel', async () => {
    await seedMany(3);
    const { notifier, batches } = fakeNotifier({ enabled: false });
    expect(await makeService(notifier).dispatchPending()).toEqual({ delivered: 0, failed: 0 });
    expect(batches).toHaveLength(0);
    expect(await logs()).toHaveLength(0);
  });
});
