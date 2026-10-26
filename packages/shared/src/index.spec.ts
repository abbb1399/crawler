import { describe, expect, it } from 'vitest';
import { PostingListQuery, PostingPatch, RawPosting, SearchProfileInput, SearchProfilePatch } from './index';

describe('PostingPatch', () => {
  it('rejects an empty patch but accepts either flag, including false', () => {
    expect(PostingPatch.safeParse({}).success).toBe(false);
    expect(PostingPatch.safeParse({ hidden: false }).success).toBe(true);
    expect(PostingPatch.safeParse({ starred: true }).success).toBe(true);
    expect(PostingPatch.safeParse({ hidden: 'true' }).success).toBe(false);
  });
});

describe('PostingListQuery', () => {
  it('coerces query-string values and applies paging defaults', () => {
    expect(PostingListQuery.parse({})).toEqual({ page: 1, limit: 30 });
    expect(PostingListQuery.parse({ hidden: 'true', starred: 'false', page: '2', limit: '10' })).toEqual({
      hidden: true,
      starred: false,
      page: 2,
      limit: 10,
    });
  });

  it('accepts status "all" and bounds limit', () => {
    expect(PostingListQuery.parse({ status: 'all' }).status).toBe('all');
    expect(PostingListQuery.safeParse({ limit: '500' }).success).toBe(false);
    expect(PostingListQuery.safeParse({ page: '0' }).success).toBe(false);
    expect(PostingListQuery.safeParse({ source: 'LINKEDIN' }).success).toBe(false);
  });

  it('trims the search term and drops a blank one', () => {
    expect(PostingListQuery.parse({ q: '  nest  ' }).q).toBe('nest');
    expect(PostingListQuery.safeParse({ q: '   ' }).success).toBe(false);
  });
});

describe('SearchProfile schemas', () => {
  it('Input fills defaults for optional lists and enabled', () => {
    expect(SearchProfileInput.parse({ name: 'p', keywords: ['nest'], sources: ['WANTED'] })).toEqual({
      name: 'p',
      keywords: ['nest'],
      includeTitle: [],
      excludeTitle: [],
      sources: ['WANTED'],
      regions: [],
      enabled: true,
    });
  });

  it('Patch leaves absent keys undefined so a partial update cannot wipe other fields', () => {
    // Regression: `.partial()` on defaulted fields used to refill includeTitle=[] and enabled=true.
    const patch = SearchProfilePatch.parse({ excludeTitle: ['인턴'] });
    expect(patch).toEqual({ excludeTitle: ['인턴'] });
    expect(Object.keys(patch)).toEqual(['excludeTitle']);
  });

  it('requires at least one keyword and one source on create', () => {
    expect(SearchProfileInput.safeParse({ name: 'p', keywords: [], sources: ['WANTED'] }).success).toBe(false);
    expect(SearchProfileInput.safeParse({ name: 'p', keywords: ['x'], sources: [] }).success).toBe(false);
  });
});

describe('RawPosting', () => {
  const ok = {
    source: 'SARAMIN',
    externalId: '1',
    title: 't',
    company: 'c',
    location: null,
    url: 'https://example.com/1',
    dueDate: '2026-11-05',
    raw: {},
  };

  it('accepts a normalized posting', () => {
    expect(RawPosting.safeParse(ok).success).toBe(true);
    expect(RawPosting.safeParse({ ...ok, dueDate: null }).success).toBe(true);
  });

  it('enforces the YYYY-MM-DD due date and a real URL', () => {
    expect(RawPosting.safeParse({ ...ok, dueDate: '2026-11-5' }).success).toBe(false);
    expect(RawPosting.safeParse({ ...ok, dueDate: '11/05' }).success).toBe(false);
    expect(RawPosting.safeParse({ ...ok, url: '/relative' }).success).toBe(false);
    expect(RawPosting.safeParse({ ...ok, externalId: '' }).success).toBe(false);
  });
});
