import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { stubConfig } from '../test/db';
import { chunk, NotificationsService } from './notifications.service';
import type { Notifier } from './notifier';

function makeNotifier(overrides: Partial<Notifier> = {}): Notifier {
  return {
    channel: 'SLACK',
    enabled: true,
    send: vi.fn(async () => undefined),
    sendText: vi.fn(async () => undefined),
    ...overrides,
  };
}

function makeService(notifiers: Notifier[]) {
  // alert() never touches the DB, so an empty object is enough for PrismaService here.
  return new NotificationsService(
    notifiers,
    {} as PrismaService,
    stubConfig({ NOTIFY_MAX_PER_RUN: 50, NOTIFY_LOOKBACK_HOURS: 24, NOTIFY_REPOSTS: false, ALERT_MIN_INTERVAL_MIN: 60 }),
  );
}

describe('NotificationsService.alert', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('sends once per key within the interval, then again after it', async () => {
    const n = makeNotifier();
    const svc = makeService([n]);

    expect(await svc.alert('saramin', 'blocked')).toBe(true);
    expect(n.sendText).toHaveBeenCalledWith('⚠️ trawler: blocked');
    expect(await svc.alert('saramin', 'blocked again')).toBe(false);
    expect(n.sendText).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-10-26T01:00:01Z'));
    expect(await svc.alert('saramin', 'still blocked')).toBe(true);
    expect(n.sendText).toHaveBeenCalledTimes(2);
  });

  it('throttles per key, not globally', async () => {
    const n = makeNotifier();
    const svc = makeService([n]);
    expect(await svc.alert('saramin', 'a')).toBe(true);
    expect(await svc.alert('wanted', 'b')).toBe(true);
  });

  it('never throws and does not start the throttle when the channel fails', async () => {
    const n = makeNotifier({ sendText: vi.fn(async () => { throw new Error('webhook down'); }) });
    const svc = makeService([n]);
    expect(await svc.alert('k', 'x')).toBe(false);
    // Not recorded as sent, so the next attempt goes out as soon as the channel recovers.
    (n.sendText as ReturnType<typeof vi.fn>).mockImplementation(async () => undefined);
    expect(await svc.alert('k', 'x')).toBe(true);
  });

  it('skips disabled channels', async () => {
    const n = makeNotifier({ enabled: false });
    const svc = makeService([n]);
    expect(await svc.alert('k', 'x')).toBe(false);
    expect(n.sendText).not.toHaveBeenCalled();
    expect(svc.enabledChannels()).toEqual([]);
  });
});

describe('chunk', () => {
  it('splits into fixed-size batches with a short tail', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 10)).toEqual([]);
    expect(chunk([1], 10)).toEqual([[1]]);
  });
});
