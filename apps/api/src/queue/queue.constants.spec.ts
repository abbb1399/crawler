import { describe, expect, it } from 'vitest';
import { crawlJobId, crawlQueueName } from './queue.constants';

describe('crawlQueueName', () => {
  it('is one lower-cased queue per source', () => {
    expect(crawlQueueName('WANTED')).toBe('crawl-wanted');
    expect(crawlQueueName('SARAMIN')).toBe('crawl-saramin');
  });
});

describe('crawlJobId', () => {
  it('collapses to the minute so repeats within a minute share one id', () => {
    const at = new Date('2026-10-26T05:07:42Z');
    expect(crawlJobId('WANTED', 1, at)).toBe('wanted-1-202610260507');
    expect(crawlJobId('WANTED', 1, new Date('2026-10-26T05:07:59Z'))).toBe(crawlJobId('WANTED', 1, at));
    expect(crawlJobId('WANTED', 1, new Date('2026-10-26T05:08:00Z'))).not.toBe(crawlJobId('WANTED', 1, at));
  });

  it('never contains a colon (BullMQ custom id rule)', () => {
    expect(crawlJobId('SARAMIN', 12)).not.toContain(':');
  });
});
