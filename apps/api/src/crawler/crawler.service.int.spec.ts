import type { RawPosting } from '@trawler/shared';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostingsService } from '../postings/postings.service';
import { DAY_MS, makePrisma, rawPosting, seedPosting, stubConfig, truncateAll } from '../test/db';
import { CrawlerService } from './crawler.service';
import type { SourceAdapter } from './source-adapter';

vi.mock('./scrape', () => ({ sleep: () => Promise.resolve() }));

const prisma = makePrisma();
const postings = new PostingsService(prisma, stubConfig({ REPOST_WINDOW_DAYS: 45, STALE_DAYS: 7 }));

/** Wanted-like adapter whose detail check answers from `closedIds`; Saramin-like one has no detail check. */
function crawler(closedIds: string[], failIds: string[] = [], failWith = 'HTTP 500') {
  const isClosed = vi.fn(async (id: string) => {
    if (failIds.includes(id)) throw new Error(`wanted request failed: ${failWith} (url)`);
    return closedIds.includes(id);
  });
  const wanted: SourceAdapter = { source: 'WANTED', fetch: async () => [], isClosed };
  const saramin: SourceAdapter = { source: 'SARAMIN', fetch: async () => [] };
  return { svc: new CrawlerService([wanted, saramin], prisma, postings), isClosed };
}

const seed = (p: Partial<RawPosting>, extra: Parameters<typeof seedPosting>[2] = {}) =>
  seedPosting(prisma, rawPosting(p), extra);
const row = (id: number) => prisma.jobPosting.findUniqueOrThrow({ where: { id } });

beforeEach(() => truncateAll(prisma));
afterAll(() => prisma.$disconnect());

describe('checkClosed', () => {
  it('checks never-checked, then least recently checked ACTIVE postings, up to the limit', async () => {
    const recent = await seed({ externalId: 'recent' }, { checkedAt: new Date() });
    const old = await seed({ externalId: 'old' }, { checkedAt: new Date(Date.now() - 3 * DAY_MS) });
    const never = await seed({ externalId: 'never' });
    await seed({ externalId: 'expired' }, { status: 'EXPIRED' });
    await seed({ source: 'SARAMIN', externalId: 's1' });
    const { svc, isClosed } = crawler(['old']);

    expect(await svc.checkClosed(2)).toEqual({ checked: 2, closed: 1, failed: 0 });
    expect(isClosed.mock.calls.map(([id]) => id)).toEqual(['never', 'old']);

    expect(await row(old.id)).toMatchObject({ status: 'EXPIRED', closedAt: expect.any(Date) });
    expect(await row(never.id)).toMatchObject({ status: 'ACTIVE', closedAt: null, checkedAt: expect.any(Date) });
    expect((await row(recent.id)).status).toBe('ACTIVE');
  });

  it('skips a failed check and leaves the posting as it was', async () => {
    const broken = await seed({ externalId: 'broken' });
    const { svc } = crawler([], ['broken']);

    expect(await svc.checkClosed()).toEqual({ checked: 0, closed: 0, failed: 1 });
    expect(await row(broken.id)).toMatchObject({ status: 'ACTIVE', checkedAt: null });
  });

  it('keeps going after an ordinary failure but stops the pass when blocked (403/429)', async () => {
    await seed({ externalId: 'a' });
    await seed({ externalId: 'b' });
    await seed({ externalId: 'c' });

    const ordinary = crawler([], ['a'], 'HTTP 404');
    expect(await ordinary.svc.checkClosed()).toEqual({ checked: 2, closed: 0, failed: 1 });

    await prisma.jobPosting.updateMany({ data: { checkedAt: null } });
    const blocked = crawler([], ['a'], 'HTTP 429');
    expect(await blocked.svc.checkClosed()).toEqual({ checked: 0, closed: 0, failed: 1 });
    expect(blocked.isClosed).toHaveBeenCalledTimes(1);
  });

  it('a posting confirmed closed stays EXPIRED when search keeps returning it', async () => {
    const [id] = (await postings.upsertMany([rawPosting({ externalId: 'c' })])).insertedIds;
    await crawler(['c']).svc.checkClosed();

    await postings.upsertMany([rawPosting({ externalId: 'c' })]); // unchanged
    expect((await row(id)).status).toBe('EXPIRED');
    await postings.upsertMany([rawPosting({ externalId: 'c', title: '제목 수정됨' })]); // edited
    expect(await row(id)).toMatchObject({ status: 'EXPIRED', title: '제목 수정됨' });
  });
});
