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

/**
 * Company: drop corporate suffixes. Title: drop bracketed qualifiers ("(신입)", "[판교]") and hiring
 * boilerplate ("경력 3년 이상", "채용", "정규직") so a re-registered posting with a slightly reworded
 * title still matches. Then lower-case and keep only letters/digits/hangul.
 *
 * Must stay in sync with the SQL backfill in prisma/migrations/*_loosen_title_fingerprint —
 * identity.int.spec.ts runs both over the same samples. Note the one syntax difference: JS needs
 * `[^\]]` where POSIX writes `[^]]`.
 */
export function normalizeForFingerprint(company: string, title: string): string {
  const c = company
    .replace(/주식회사|㈜|\(주\)|\(유\)/g, '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, '');
  const t = title
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]|【[^】]*】/g, '')
    .replace(/[0-9]+\s*년\s*(이상|이하|차)?/g, '')
    .replace(/신입|경력|채용|모집|급구|정규직|계약직|인턴|공고/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
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
