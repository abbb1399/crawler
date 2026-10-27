import { describe, expect, it } from 'vitest';
import { aggregateRuns, type RunRow } from './runs-stats';

// 2026-10-26 10:00 KST
const now = new Date('2026-10-26T01:00:00Z');
type RunInput = Omit<Partial<RunRow>, 'startedAt' | 'finishedAt'> & { startedAt: string; finishedAt?: string | null };
const run = (over: RunInput): RunRow => ({
  source: 'WANTED',
  status: 'OK',
  inserted: 0,
  ...over,
  startedAt: new Date(over.startedAt),
  finishedAt: over.finishedAt === undefined ? null : over.finishedAt === null ? null : new Date(over.finishedAt),
});

describe('aggregateRuns', () => {
  it('emits every day × source in order, zero-filled', () => {
    const out = aggregateRuns([], 3, now);
    expect(out.map((p) => `${p.day} ${p.source}`)).toEqual([
      '2026-10-24 WANTED',
      '2026-10-24 SARAMIN',
      '2026-10-25 WANTED',
      '2026-10-25 SARAMIN',
      '2026-10-26 WANTED',
      '2026-10-26 SARAMIN',
    ]);
    expect(out.every((p) => p.runs === 0 && p.failed === 0 && p.inserted === 0 && p.avgDurationMs === null)).toBe(true);
  });

  it('buckets by the Asia/Seoul day, not UTC', () => {
    // 2026-10-25 23:30 KST is 14:30Z; 2026-10-26 00:30 KST is 15:30Z on the 25th in UTC.
    const out = aggregateRuns(
      [run({ startedAt: '2026-10-25T14:30:00Z', inserted: 1 }), run({ startedAt: '2026-10-25T15:30:00Z', inserted: 2 })],
      2,
      now,
    );
    const w = (day: string) => out.find((p) => p.day === day && p.source === 'WANTED')!;
    expect(w('2026-10-25')).toMatchObject({ runs: 1, inserted: 1 });
    expect(w('2026-10-26')).toMatchObject({ runs: 1, inserted: 2 });
  });

  it('counts failures, sums inserted, averages finished durations and ignores running rows for duration', () => {
    const out = aggregateRuns(
      [
        run({ startedAt: '2026-10-26T00:00:00Z', finishedAt: '2026-10-26T00:00:10Z', inserted: 3 }),
        run({ startedAt: '2026-10-26T00:10:00Z', finishedAt: '2026-10-26T00:10:30Z', status: 'FAILED' }),
        run({ startedAt: '2026-10-26T00:20:00Z', finishedAt: null, status: 'RUNNING' }),
        run({ startedAt: '2026-10-26T00:30:00Z', finishedAt: '2026-10-26T00:31:00Z', source: 'SARAMIN', inserted: 5 }),
      ],
      1,
      now,
    );
    expect(out).toEqual([
      { day: '2026-10-26', source: 'WANTED', runs: 3, failed: 1, inserted: 3, avgDurationMs: 20_000 },
      { day: '2026-10-26', source: 'SARAMIN', runs: 1, failed: 0, inserted: 5, avgDurationMs: 60_000 },
    ]);
  });

  it('drops rows older than the window', () => {
    const out = aggregateRuns([run({ startedAt: '2026-10-20T00:00:00Z', inserted: 9 })], 3, now);
    expect(out.reduce((n, p) => n + p.inserted, 0)).toBe(0);
  });
});
