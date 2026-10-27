import { JobSource, type RunsDaily } from '@trawler/shared';
import { kstDateString, startOfTodayKst } from '../common/time';

export const DAY_MS = 86_400_000;

export interface RunRow {
  source: JobSource;
  status: 'RUNNING' | 'OK' | 'FAILED';
  startedAt: Date;
  finishedAt: Date | null;
  inserted: number;
}

/**
 * Buckets crawl runs by (Asia/Seoul calendar day, source) over the last `days` days ending today.
 * Every day × source appears, zero-filled, so a chart can draw a continuous axis. Duration is the
 * mean of finished runs only (RUNNING rows have no end yet). Pure: no clock access beyond `now`.
 */
export function aggregateRuns(rows: RunRow[], days: number, now = new Date()): RunsDaily {
  const start = startOfTodayKst(now).getTime() - (days - 1) * DAY_MS;
  const dayKeys = Array.from({ length: days }, (_, i) => kstDateString(new Date(start + i * DAY_MS)));
  const sources = JobSource.options;

  type Bucket = { runs: number; failed: number; inserted: number; durSum: number; durN: number };
  const buckets = new Map<string, Bucket>();
  for (const day of dayKeys) for (const s of sources) buckets.set(`${day}|${s}`, { runs: 0, failed: 0, inserted: 0, durSum: 0, durN: 0 });

  for (const r of rows) {
    if (r.startedAt.getTime() < start) continue;
    const b = buckets.get(`${kstDateString(r.startedAt)}|${r.source}`);
    if (!b) continue; // future-dated or unknown source
    b.runs++;
    if (r.status === 'FAILED') b.failed++;
    b.inserted += r.inserted;
    if (r.finishedAt) {
      b.durSum += r.finishedAt.getTime() - r.startedAt.getTime();
      b.durN++;
    }
  }

  return dayKeys.flatMap((day) =>
    sources.map((source) => {
      const b = buckets.get(`${day}|${source}`)!;
      return {
        day,
        source,
        runs: b.runs,
        failed: b.failed,
        inserted: b.inserted,
        avgDurationMs: b.durN ? Math.round(b.durSum / b.durN) : null,
      };
    }),
  );
}
