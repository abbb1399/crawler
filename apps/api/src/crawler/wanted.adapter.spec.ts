import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubConfig } from '../test/db';
import { WantedAdapter } from './wanted.adapter';

type Job = Record<string, unknown>;

function job(id: number, extra: Job = {}): Job {
  return {
    id,
    position: ` 포지션 ${id} `,
    company: { id: 100 + id, name: ` 회사 ${id} ` },
    address: { location: '서울' },
    due_time: null,
    status: 'active',
    ...extra,
  };
}

const page = (n: number, from = 1): Job[] => Array.from({ length: n }, (_, i) => job(from + i));

/** Stubs fetch with one JSON body per call (or a Response for error cases). */
function stubFetch(bodies: (Job[] | Response | object)[]) {
  const fetchMock = vi.fn(async () => {
    const next = bodies.shift();
    if (next instanceof Response) return next;
    const body = Array.isArray(next) ? { data: { jobs: next } } : next;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const requestedUrl = (fetchMock: ReturnType<typeof vi.fn>, call: number) =>
  new URL(String((fetchMock.mock.calls[call] as unknown[])[0]));

/** fetch() sleeps 1s between pages; fake timers let a multi-page run finish instantly. */
async function run(adapter: WantedAdapter, keyword: string, opts?: Parameters<WantedAdapter['fetch']>[1]) {
  const p = adapter.fetch(keyword, opts);
  p.catch(() => undefined); // a rejection may land while timers are flushed; the caller still awaits p
  await vi.runAllTimersAsync();
  return p;
}

describe('WantedAdapter', () => {
  let adapter: WantedAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    adapter = new WantedAdapter(stubConfig({ WANTED_MAX_PAGES: 3 }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calls the search API with the keyword, paging params and one locations entry per region', async () => {
    const fetchMock = stubFetch([page(2)]);
    await run(adapter, 'node.js 백엔드', { regions: ['SEOUL', 'GYEONGGI'] });

    const url = requestedUrl(fetchMock, 0);
    expect(url.origin + url.pathname).toBe('https://www.wanted.co.kr/api/v4/search');
    expect(url.searchParams.get('query')).toBe('node.js 백엔드');
    expect(url.searchParams.get('country')).toBe('kr');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(url.searchParams.getAll('locations')).toEqual(['seoul.all', 'gyeonggi.all']);
  });

  it('maps jobs to RawPosting with trimmed text and the public job URL', async () => {
    stubFetch([[job(7, { due_time: '2026-11-30', address: null })]]);
    const [p] = await run(adapter, 'x');
    expect(p).toEqual({
      source: 'WANTED',
      externalId: '7',
      title: '포지션 7',
      company: '회사 7',
      location: null,
      url: 'https://www.wanted.co.kr/wd/7',
      dueDate: '2026-11-30',
      raw: expect.objectContaining({ id: 7 }),
    });
  });

  it('stops after a short page', async () => {
    const fetchMock = stubFetch([page(5)]);
    const out = await run(adapter, 'x');
    expect(out).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps paging with offset while pages are full', async () => {
    const fetchMock = stubFetch([page(20, 1), page(3, 21)]);
    const out = await run(adapter, 'x');
    expect(out).toHaveLength(23);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(fetchMock, 1).searchParams.get('offset')).toBe('20');
  });

  it('never exceeds maxPages even when every page is full', async () => {
    const fetchMock = stubFetch([page(20, 1), page(20, 21), page(20, 41), page(20, 61)]);
    const out = await run(adapter, 'x', { maxPages: 2 });
    expect(out).toHaveLength(40);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips jobs whose status is not active', async () => {
    stubFetch([[job(1), job(2, { status: 'closed' }), job(3, { status: undefined })]]);
    const out = await run(adapter, 'x');
    expect(out.map((p) => p.externalId)).toEqual(['1', '3']);
  });

  it('throws on a non-OK response', async () => {
    stubFetch([new Response('nope', { status: 500 })]);
    await expect(run(adapter, 'x')).rejects.toThrow(/HTTP 500/);
  });

  it('throws when the response shape changed', async () => {
    stubFetch([{ data: { items: [] } }]);
    await expect(run(adapter, 'x')).rejects.toThrow(/shape changed/);
  });
});
