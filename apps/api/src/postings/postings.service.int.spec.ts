import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, makePrisma, rawPosting, seedPosting, stubConfig, truncateAll } from '../test/db';
import { PostingsService } from './postings.service';

const prisma = makePrisma();
const svc = new PostingsService(prisma, stubConfig({ REPOST_WINDOW_DAYS: 45, STALE_DAYS: 14 }));
const listDefaults = { page: 1, limit: 30 };

beforeEach(() => truncateAll(prisma));
afterAll(() => prisma.$disconnect());

describe('upsertMany', () => {
  it('inserts new postings and reports their ids', async () => {
    const r = await svc.upsertMany([rawPosting({ externalId: 'w1' }), rawPosting({ source: 'SARAMIN', externalId: 's1' })]);
    expect(r).toMatchObject({ found: 2, updated: 0, repostIds: [] });
    expect(r.insertedIds).toHaveLength(2);
    expect(await prisma.jobPosting.count()).toBe(2);
  });

  it('re-crawling an unchanged posting only refreshes lastSeenAt', async () => {
    const [id] = (await svc.upsertMany([rawPosting()])).insertedIds;
    const old = new Date(Date.now() - 3 * DAY_MS);
    await prisma.jobPosting.update({ where: { id }, data: { lastSeenAt: old } });

    const r = await svc.upsertMany([rawPosting()]);
    expect(r).toMatchObject({ found: 1, insertedIds: [], updated: 0 });
    const row = await prisma.jobPosting.findUniqueOrThrow({ where: { id } });
    expect(row.lastSeenAt.getTime()).toBeGreaterThan(old.getTime());
    expect(await prisma.jobPosting.count()).toBe(1);
  });

  it('an edited posting (new content hash) counts as updated and is overwritten', async () => {
    const [id] = (await svc.upsertMany([rawPosting({ dueDate: '2026-11-01' })])).insertedIds;
    const before = await prisma.jobPosting.findUniqueOrThrow({ where: { id } });

    const r = await svc.upsertMany([rawPosting({ title: '시니어 백엔드 개발자', dueDate: '2026-12-01' })]);
    expect(r).toMatchObject({ insertedIds: [], updated: 1 });
    const after = await prisma.jobPosting.findUniqueOrThrow({ where: { id } });
    expect(after.title).toBe('시니어 백엔드 개발자');
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it('an EXPIRED posting that reappears becomes ACTIVE again', async () => {
    const [id] = (await svc.upsertMany([rawPosting()])).insertedIds;
    await prisma.jobPosting.update({ where: { id }, data: { status: 'EXPIRED' } });
    await svc.upsertMany([rawPosting()]);
    expect((await prisma.jobPosting.findUniqueOrThrow({ where: { id } })).status).toBe('ACTIVE');
  });

  it('keeps hidden and starred across re-crawls, whether or not the content changed', async () => {
    const [id] = (await svc.upsertMany([rawPosting()])).insertedIds;
    await prisma.jobPosting.update({ where: { id }, data: { hidden: true, starred: true } });

    await svc.upsertMany([rawPosting()]); // unchanged path
    expect(await prisma.jobPosting.findUniqueOrThrow({ where: { id } })).toMatchObject({ hidden: true, starred: true });

    await svc.upsertMany([rawPosting({ title: '바뀐 제목' })]); // changed path
    expect(await prisma.jobPosting.findUniqueOrThrow({ where: { id } })).toMatchObject({ hidden: true, starred: true });
  });

  it('collapses duplicate keys inside one batch, last one wins', async () => {
    const r = await svc.upsertMany([rawPosting({ title: '첫 번째' }), rawPosting({ title: '두 번째' })]);
    expect(r.found).toBe(1);
    expect(r.insertedIds).toHaveLength(1);
    expect((await prisma.jobPosting.findMany()).map((p) => p.title)).toEqual(['두 번째']);
  });

  describe('reposts', () => {
    it('flags a new externalId with the same company+title inside the window', async () => {
      const [origId] = (await svc.upsertMany([rawPosting({ externalId: 'w1' })])).insertedIds;
      const r = await svc.upsertMany([rawPosting({ externalId: 'w2', url: 'https://example.com/w2' })]);
      expect(r.insertedIds).toHaveLength(1);
      expect(r.repostIds).toEqual(r.insertedIds);
      const repost = await prisma.jobPosting.findUniqueOrThrow({ where: { id: r.insertedIds[0] } });
      expect(repost.repostOfId).toBe(origId);
    });

    it('matches across sources and across company-name spellings', async () => {
      const [origId] = (await svc.upsertMany([rawPosting({ company: '주식회사 네이블' })])).insertedIds;
      const r = await svc.upsertMany([
        rawPosting({ source: 'SARAMIN', externalId: 's9', company: '(주)네이블', title: 'node.js 백엔드 개발자' }),
      ]);
      expect(r.repostIds).toHaveLength(1);
      expect((await prisma.jobPosting.findUniqueOrThrow({ where: { id: r.insertedIds[0] } })).repostOfId).toBe(origId);
    });

    it('does not flag when the earlier posting is older than the window', async () => {
      const [origId] = (await svc.upsertMany([rawPosting({ externalId: 'w1' })])).insertedIds;
      await prisma.jobPosting.update({ where: { id: origId }, data: { firstSeenAt: new Date(Date.now() - 46 * DAY_MS) } });
      const r = await svc.upsertMany([rawPosting({ externalId: 'w2' })]);
      expect(r.repostIds).toEqual([]);
      expect((await prisma.jobPosting.findUniqueOrThrow({ where: { id: r.insertedIds[0] } })).repostOfId).toBeNull();
    });

    it('points at the earliest prior posting when several share a fingerprint', async () => {
      const [first] = (await svc.upsertMany([rawPosting({ externalId: 'w1' })])).insertedIds;
      await svc.upsertMany([rawPosting({ externalId: 'w2' })]);
      const r = await svc.upsertMany([rawPosting({ externalId: 'w3' })]);
      expect((await prisma.jobPosting.findUniqueOrThrow({ where: { id: r.insertedIds[0] } })).repostOfId).toBe(first);
    });
  });
});

describe('expireStale', () => {
  const now = new Date('2026-10-26T03:00:00Z');

  it('expires past due dates and postings no crawl has seen for STALE_DAYS, leaves the rest', async () => {
    const dueYesterday = await seedPosting(prisma, rawPosting({ externalId: 'a', dueDate: '2026-10-25' }), { lastSeenAt: now });
    const dueToday = await seedPosting(prisma, rawPosting({ externalId: 'b', dueDate: '2026-10-26' }), { lastSeenAt: now });
    const stale = await seedPosting(prisma, rawPosting({ externalId: 'c' }), { lastSeenAt: new Date(now.getTime() - 15 * DAY_MS) });
    const fresh = await seedPosting(prisma, rawPosting({ externalId: 'd' }), { lastSeenAt: new Date(now.getTime() - 13 * DAY_MS) });

    expect(await svc.expireStale(now)).toEqual({ byDueDate: 1, byStale: 1 });

    const status = async (id: number) => (await prisma.jobPosting.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(dueYesterday.id)).toBe('EXPIRED');
    expect(await status(dueToday.id)).toBe('ACTIVE');
    expect(await status(stale.id)).toBe('EXPIRED');
    expect(await status(fresh.id)).toBe('ACTIVE');
  });

  it('is idempotent', async () => {
    await seedPosting(prisma, rawPosting({ dueDate: '2026-01-01' }));
    await svc.expireStale(now);
    expect(await svc.expireStale(now)).toEqual({ byDueDate: 0, byStale: 0 });
  });
});

describe('list', () => {
  let a: number, b: number, hidden: number, expired: number;

  beforeEach(async () => {
    a = (await seedPosting(prisma, rawPosting({ externalId: 'a', title: 'Node.js 백엔드', company: 'Alpha' }))).id;
    b = (await seedPosting(prisma, rawPosting({ source: 'SARAMIN', externalId: 'b', title: '프론트엔드', company: 'Beta' }), { starred: true })).id;
    hidden = (await seedPosting(prisma, rawPosting({ externalId: 'h', title: '숨긴 공고' }), { hidden: true })).id;
    expired = (await seedPosting(prisma, rawPosting({ externalId: 'e', title: '만료 공고' }), { status: 'EXPIRED' })).id;
  });

  const ids = async (q: Partial<Parameters<typeof svc.list>[0]>) => (await svc.list({ ...listDefaults, ...q })).items.map((p) => p.id);

  it('shows ACTIVE, non-hidden postings newest first by default', async () => {
    expect(await ids({})).toEqual([b, a]);
  });

  it('hidden=true shows only hidden postings', async () => {
    expect(await ids({ hidden: true })).toEqual([hidden]);
  });

  it('starred and source narrow the list', async () => {
    expect(await ids({ starred: true })).toEqual([b]);
    expect(await ids({ source: 'WANTED' })).toEqual([a]);
  });

  it('q matches title or company, case-insensitively', async () => {
    expect(await ids({ q: 'node.JS' })).toEqual([a]);
    expect(await ids({ q: 'beta' })).toEqual([b]);
    expect(await ids({ q: '없는검색어' })).toEqual([]);
  });

  it("status 'all' includes expired postings", async () => {
    expect(await ids({ status: 'all' })).toEqual([expired, b, a]);
    expect(await ids({ status: 'EXPIRED' })).toEqual([expired]);
  });

  it('paginates with a correct pageCount and serialized dates', async () => {
    const page1 = await svc.list({ page: 1, limit: 1 });
    expect(page1).toMatchObject({ total: 2, page: 1, pageCount: 2 });
    expect(page1.items.map((p) => p.id)).toEqual([b]);
    expect(typeof page1.items[0].firstSeenAt).toBe('string');
    expect(await ids({ page: 2, limit: 1 })).toEqual([a]);
    expect((await svc.list({ ...listDefaults, q: '없음' })).pageCount).toBe(1);
  });
});

describe('patch', () => {
  it('rejects unknown ids with NotFoundException', async () => {
    await expect(svc.patch(999_999, { hidden: true })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates flags and returns the serialized row', async () => {
    const { id } = await seedPosting(prisma, rawPosting({ dueDate: '2026-11-30' }));
    const out = await svc.patch(id, { hidden: true });
    expect(out).toMatchObject({ id, hidden: true, starred: false, dueDate: '2026-11-30' });
    expect((await prisma.jobPosting.findUniqueOrThrow({ where: { id } })).hidden).toBe(true);
  });
});
