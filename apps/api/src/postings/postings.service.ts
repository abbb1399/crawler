import { createHash } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ExpireResult,
  PostingList,
  PostingListQuery,
  PostingPatch,
  RawPosting,
} from '@devilray/shared';
import type { Env } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertResult {
  found: number;
  insertedIds: number[];
  updated: number;
  /** Subset of insertedIds that were flagged as reposts of an earlier posting. */
  repostIds: number[];
}

const LIST_SELECT = {
  id: true,
  source: true,
  externalId: true,
  title: true,
  company: true,
  location: true,
  url: true,
  dueDate: true,
  status: true,
  seen: true,
  starred: true,
  repostOfId: true,
  firstSeenAt: true,
  lastSeenAt: true,
} satisfies Prisma.JobPostingSelect;

@Injectable()
export class PostingsService {
  private readonly logger = new Logger(PostingsService.name);
  private readonly repostWindowDays: number;
  private readonly staleDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.repostWindowDays = config.get('REPOST_WINDOW_DAYS', { infer: true });
    this.staleDays = config.get('STALE_DAYS', { infer: true });
  }

  /**
   * Insert new postings, refresh existing ones. Dedup key is (source, externalId).
   * New rows whose fingerprint matches a posting seen within the repost window get
   * `repostOfId` so the notifier can skip them.
   */
  async upsertMany(postings: RawPosting[]): Promise<UpsertResult> {
    const unique = dedupeByKey(postings);
    if (unique.length === 0) return { found: 0, insertedIds: [], updated: 0, repostIds: [] };

    const now = new Date();
    const repostSince = new Date(now.getTime() - this.repostWindowDays * 86_400_000);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.jobPosting.findMany({
        where: {
          OR: unique.map((p) => ({ source: p.source, externalId: p.externalId })),
        },
        select: { id: true, source: true, externalId: true, contentHash: true },
      });
      const existingByKey = new Map(existing.map((e) => [key(e.source, e.externalId), e]));

      const toInsert = unique.filter((p) => !existingByKey.has(key(p.source, p.externalId)));
      const rows = toInsert.map((p) => ({ ...toRow(p), lastSeenAt: now }));

      // Repost lookup: earliest prior posting per fingerprint inside the window.
      const priorByFp = new Map<string, number>();
      if (rows.length) {
        const prior = await tx.jobPosting.findMany({
          where: {
            fingerprint: { in: [...new Set(rows.map((r) => r.fingerprint))] },
            firstSeenAt: { gte: repostSince },
          },
          select: { id: true, fingerprint: true },
          orderBy: { id: 'asc' },
        });
        for (const p of prior) if (!priorByFp.has(p.fingerprint)) priorByFp.set(p.fingerprint, p.id);
      }

      const inserted = rows.length
        ? await tx.jobPosting.createManyAndReturn({
            data: rows.map((r) => ({ ...r, repostOfId: priorByFp.get(r.fingerprint) ?? null })),
            select: { id: true, repostOfId: true },
          })
        : [];

      let updated = 0;
      const unchangedIds: number[] = [];
      for (const p of unique) {
        const prev = existingByKey.get(key(p.source, p.externalId));
        if (!prev) continue;
        const row = toRow(p);
        if (prev.contentHash === row.contentHash) {
          unchangedIds.push(prev.id);
          continue;
        }
        await tx.jobPosting.update({
          where: { id: prev.id },
          data: { ...row, lastSeenAt: now, status: 'ACTIVE' },
        });
        updated++;
      }
      if (unchangedIds.length) {
        await tx.jobPosting.updateMany({
          where: { id: { in: unchangedIds } },
          data: { lastSeenAt: now, status: 'ACTIVE' },
        });
      }

      return {
        found: unique.length,
        insertedIds: inserted.map((r) => r.id),
        updated,
        repostIds: inserted.filter((r) => r.repostOfId !== null).map((r) => r.id),
      };
    });
  }

  /**
   * Expiry pass: past due date, or not seen by any crawl for STALE_DAYS.
   * Rows are never deleted; a posting that reappears is flipped back to ACTIVE by upsertMany.
   */
  async expireStale(now = new Date()): Promise<ExpireResult> {
    const today = new Date(now.toISOString().slice(0, 10));
    const staleBefore = new Date(now.getTime() - this.staleDays * 86_400_000);

    const byDueDate = await this.prisma.jobPosting.updateMany({
      where: { status: 'ACTIVE', dueDate: { lt: today } },
      data: { status: 'EXPIRED' },
    });
    const byStale = await this.prisma.jobPosting.updateMany({
      where: { status: 'ACTIVE', lastSeenAt: { lt: staleBefore } },
      data: { status: 'EXPIRED' },
    });
    const result = { byDueDate: byDueDate.count, byStale: byStale.count };
    this.logger.log(`expire pass: dueDate=${result.byDueDate} stale=${result.byStale}`);
    return result;
  }

  /** Cursor-paginated list, newest first (id desc). ACTIVE only unless status is given. */
  async list(q: PostingListQuery): Promise<PostingList> {
    const where: Prisma.JobPostingWhereInput = {
      source: q.source,
      status: q.status === 'all' ? undefined : (q.status ?? 'ACTIVE'),
      seen: q.unseen ? false : undefined,
      starred: q.starred ? true : undefined,
      id: q.cursor ? { lt: q.cursor } : undefined,
      OR: q.q
        ? [
            { title: { contains: q.q, mode: 'insensitive' } },
            { company: { contains: q.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const rows = await this.prisma.jobPosting.findMany({
      where,
      orderBy: { id: 'desc' },
      take: q.limit + 1,
      select: LIST_SELECT,
    });
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    return {
      items: page.map(serialize),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  async patch(id: number, patch: PostingPatch) {
    const exists = await this.prisma.jobPosting.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`posting ${id} not found`);
    const row = await this.prisma.jobPosting.update({ where: { id }, data: patch, select: LIST_SELECT });
    return serialize(row);
  }

  async markAllSeen(): Promise<number> {
    const r = await this.prisma.jobPosting.updateMany({ where: { seen: false }, data: { seen: true } });
    return r.count;
  }
}

type ListRow = Prisma.JobPostingGetPayload<{ select: typeof LIST_SELECT }>;

function serialize(r: ListRow) {
  return {
    ...r,
    dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  };
}

function key(source: string, externalId: string) {
  return `${source}:${externalId}`;
}

function dedupeByKey(postings: RawPosting[]): RawPosting[] {
  const seen = new Map<string, RawPosting>();
  for (const p of postings) seen.set(key(p.source, p.externalId), p);
  return [...seen.values()];
}

function contentHash(p: RawPosting): string {
  return createHash('sha1')
    .update([p.title, p.company, p.dueDate ?? ''].join('|'))
    .digest('hex');
}

/** Must stay in sync with the SQL backfill in the phase6 migration. */
export function normalizeForFingerprint(company: string, title: string): string {
  const c = company
    .replace(/주식회사|㈜|\(주\)|\(유\)/g, '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, '');
  const t = title.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  return `${c}|${t}`;
}

export function fingerprint(company: string, title: string): string {
  return createHash('md5').update(normalizeForFingerprint(company, title)).digest('hex');
}

function toRow(p: RawPosting) {
  return {
    source: p.source,
    externalId: p.externalId,
    title: p.title,
    company: p.company,
    location: p.location,
    url: p.url,
    dueDate: p.dueDate ? new Date(p.dueDate) : null,
    contentHash: contentHash(p),
    fingerprint: fingerprint(p.company, p.title),
    raw: p.raw as object,
  };
}
