import { describe, expect, it, vi } from 'vitest';
import { stubConfig } from '../test/db';
import type { BrowserService } from './browser.service';
import { parseDueDate, SaraminAdapter } from './saramin.adapter';
import type { SaraminItem } from './saramin.extract';

// TZ is pinned to Asia/Seoul in vitest.config.ts, so "today" below is 2026-10-26.
const now = new Date('2026-10-26T10:00:00+09:00');

describe('parseDueDate', () => {
  it('reads "~ MM/DD(요일)" as a date in the current year', () => {
    expect(parseDueDate('~ 11/15(일)', now)).toBe('2026-11-15');
    expect(parseDueDate('~ 10/28(수)', now)).toBe('2026-10-28');
  });

  it('rolls over to next year when the month would be more than six months in the past', () => {
    expect(parseDueDate('~ 03/15(일)', now)).toBe('2027-03-15');
    expect(parseDueDate('~ 01/10(토)', now)).toBe('2027-01-10');
    // Exactly six months back is still this year.
    expect(parseDueDate('~ 05/01(금)', now)).toBe('2026-05-01');
  });

  it('zero-pads single-digit months and days', () => {
    expect(parseDueDate('~ 9/5', now)).toBe('2026-09-05');
  });

  it('maps 오늘/내일 to today/tomorrow in local time', () => {
    expect(parseDueDate('오늘마감', now)).toBe('2026-10-26');
    expect(parseDueDate('내일마감', now)).toBe('2026-10-27');
  });

  it('returns null for open-ended postings', () => {
    expect(parseDueDate('채용시', now)).toBeNull();
    expect(parseDueDate('상시채용', now)).toBeNull();
    expect(parseDueDate('', now)).toBeNull();
  });
});

describe('SaraminAdapter.fetch', () => {
  const card = (over: Partial<SaraminItem> = {}): SaraminItem => ({
    recIdx: '123',
    title: 'Node.js 백엔드',
    company: '모던랩스',
    location: '서울 강남구',
    dateText: '~ 11/15(일)',
    conditions: [],
    sector: null,
    registeredText: null,
    ...over,
  });

  /** One result page with the given cards, behind a fake browser. */
  function adapterWith(cards: SaraminItem[]) {
    const page = {
      goto: async () => ({ status: () => 200 }),
      $$eval: async () => cards,
      $: async () => ({}), // the result counter is present
      close: async () => undefined,
    };
    const snapshot = vi.fn(async () => null);
    const browser = {
      withContext: (fn: (ctx: unknown) => Promise<unknown>) => fn({ newPage: async () => page }),
      snapshot,
    } as unknown as BrowserService;
    return { adapter: new SaraminAdapter(browser, stubConfig({ SARAMIN_MAX_PAGES: 1 })), snapshot };
  }

  it('returns the cards that have an id and a title', async () => {
    const { adapter } = adapterWith([card(), card({ recIdx: '', title: '' })]);
    const out = await adapter.fetch('node');
    expect(out.map((p) => p.externalId)).toEqual(['123']);
  });

  it('fails when cards exist but none could be read (inner markup changed)', async () => {
    const { adapter, snapshot } = adapterWith([card({ recIdx: '', title: '' }), card({ title: '' })]);
    await expect(adapter.fetch('node')).rejects.toThrow(/layout changed/);
    expect(snapshot).toHaveBeenCalledWith(expect.anything(), 'saramin-emptyfields');
  });
});
