import type { RawPosting } from '@trawler/shared';
import { describe, expect, it } from 'vitest';
import { contentHash, dedupeByKey, fingerprint, normalizeForFingerprint, toRow } from './identity';

const base: RawPosting = {
  source: 'WANTED',
  externalId: '1',
  title: 'Node.js 백엔드 개발자',
  company: '주식회사 네이블',
  location: '서울 강남구',
  url: 'https://example.com/1',
  dueDate: '2026-11-30',
  raw: { any: 'thing' },
};

describe('normalizeForFingerprint', () => {
  it('drops corporate suffixes, case, whitespace and symbols but keeps hangul and digits', () => {
    expect(normalizeForFingerprint('주식회사 네이블', 'Node.js 백엔드 개발자')).toBe('네이블|nodejs백엔드개발자');
    expect(normalizeForFingerprint('(주)네이블', 'NODE.JS 백엔드 개발자')).toBe('네이블|nodejs백엔드개발자');
    expect(normalizeForFingerprint('㈜네이블', 'node.js  백엔드-개발자!')).toBe('네이블|nodejs백엔드개발자');
    expect(normalizeForFingerprint('(유)네이블', '백엔드 개발자 3년')).toBe('네이블|백엔드개발자3년');
  });
});

describe('fingerprint', () => {
  it('is identical across company-name and title spelling variants', () => {
    const a = fingerprint('주식회사 네이블', 'Node.js 백엔드 개발자');
    expect(fingerprint('(주)네이블', 'node.js 백엔드 개발자')).toBe(a);
    expect(fingerprint('네이블', 'NodeJS 백엔드 개발자')).toBe(a);
  });

  it('differs when the title really differs', () => {
    expect(fingerprint('네이블', '백엔드 개발자')).not.toBe(fingerprint('네이블', '프론트엔드 개발자'));
  });
});

describe('contentHash', () => {
  it('changes with title, company or due date', () => {
    const h = contentHash(base);
    expect(contentHash({ ...base, title: '다른 제목' })).not.toBe(h);
    expect(contentHash({ ...base, company: '다른 회사' })).not.toBe(h);
    expect(contentHash({ ...base, dueDate: '2026-12-01' })).not.toBe(h);
    expect(contentHash({ ...base, dueDate: null })).not.toBe(h);
  });

  it('ignores fields that do not mean an edit (location, url, raw)', () => {
    const h = contentHash(base);
    expect(contentHash({ ...base, location: '부산' })).toBe(h);
    expect(contentHash({ ...base, url: 'https://example.com/other' })).toBe(h);
    expect(contentHash({ ...base, raw: { other: true } })).toBe(h);
  });
});

describe('dedupeByKey', () => {
  it('keeps the last occurrence of a (source, externalId) pair', () => {
    const out = dedupeByKey([base, { ...base, title: '두 번째' }, { ...base, externalId: '2' }]);
    expect(out.map((p) => [p.externalId, p.title])).toEqual([
      ['1', '두 번째'],
      ['2', 'Node.js 백엔드 개발자'],
    ]);
  });

  it('treats the same externalId on different sources as different postings', () => {
    expect(dedupeByKey([base, { ...base, source: 'SARAMIN' }])).toHaveLength(2);
  });
});

describe('toRow', () => {
  it('maps a RawPosting to JobPosting columns with hashes and a Date due date', () => {
    const row = toRow(base);
    expect(row).toMatchObject({
      source: 'WANTED',
      externalId: '1',
      title: base.title,
      company: base.company,
      location: base.location,
      url: base.url,
      contentHash: contentHash(base),
      fingerprint: fingerprint(base.company, base.title),
      raw: base.raw,
    });
    expect(row.dueDate).toEqual(new Date('2026-11-30'));
  });

  it('keeps a null due date', () => {
    expect(toRow({ ...base, dueDate: null }).dueDate).toBeNull();
  });
});
