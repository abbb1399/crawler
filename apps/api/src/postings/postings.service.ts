import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { JobSource, RawPosting } from '@devilray/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertResult {
  found: number;
  insertedIds: number[];
  updated: number;
}

@Injectable()
export class PostingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Insert new postings, refresh existing ones. Dedup key is (source, externalId).
   * Returns ids of rows that were newly inserted; those are what Phase 2 notifies on.
   */
  async upsertMany(postings: RawPosting[]): Promise<UpsertResult> {
    const unique = dedupeByKey(postings);
    if (unique.length === 0) return { found: 0, insertedIds: [], updated: 0 };

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.jobPosting.findMany({
        where: {
          OR: unique.map((p) => ({ source: p.source, externalId: p.externalId })),
        },
        select: { id: true, source: true, externalId: true, contentHash: true },
      });
      const existingByKey = new Map(existing.map((e) => [key(e.source, e.externalId), e]));

      const toInsert = unique.filter((p) => !existingByKey.has(key(p.source, p.externalId)));
      const inserted = toInsert.length
        ? await tx.jobPosting.createManyAndReturn({
            data: toInsert.map((p) => ({ ...toRow(p), lastSeenAt: now })),
            select: { id: true },
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

      return { found: unique.length, insertedIds: inserted.map((r) => r.id), updated };
    });
  }

  findRecent(limit = 20, source?: JobSource) {
    return this.prisma.jobPosting.findMany({
      where: source ? { source } : undefined,
      orderBy: { firstSeenAt: 'desc' },
      take: limit,
      select: {
        id: true,
        source: true,
        externalId: true,
        title: true,
        company: true,
        location: true,
        url: true,
        dueDate: true,
        status: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });
  }
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
    raw: p.raw as object,
  };
}
