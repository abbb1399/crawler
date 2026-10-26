import { createHash } from 'node:crypto';
import type { RawPosting } from '@trawler/shared';

/**
 * Pure helpers that decide what "the same posting" means. Kept free of Prisma/Nest so they
 * can be unit-tested and so the SQL backfill in the phase6 migration has a single source of truth.
 */

/** Dedup key: one row per (source, externalId). */
export function key(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

/** Collapses duplicates within one crawl batch; the last occurrence wins. */
export function dedupeByKey(postings: RawPosting[]): RawPosting[] {
  const seen = new Map<string, RawPosting>();
  for (const p of postings) seen.set(key(p.source, p.externalId), p);
  return [...seen.values()];
}

/** sha1(title|company|dueDate). A change means the posting was edited, not re-posted. */
export function contentHash(p: RawPosting): string {
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

/** md5(normalized company|title). The same job re-registered under a new externalId shares it. */
export function fingerprint(company: string, title: string): string {
  return createHash('md5').update(normalizeForFingerprint(company, title)).digest('hex');
}

/** RawPosting → JobPosting columns (minus timestamps/flags). */
export function toRow(p: RawPosting) {
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
