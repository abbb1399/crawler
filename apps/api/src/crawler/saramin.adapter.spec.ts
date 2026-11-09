import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('SaraminAdapter.isClosed (view-ajax)', () => {
  // Trimmed from real responses on 2026-11-09; only the parts the check reads.
  const header = (id: string, button: string) =>
    `<div class="jv_header" data-rec_idx="${id}" data-rec_seq="0"><h1 class="tit_job">풀스택 개발자</h1>` +
    `<div class="btn_apply">${button}</div></div>`;
  const closed = (id: string) =>
    header(id, '<button class="sri_btn_lg" title="접수마감"><span class="sri_btn_expired_apply">접수마감</span></button>') +
    '<div class="jv_cont jv_detail expired"><p class="copy">본 채용정보는 <strong>마감</strong>되었습니다.</p></div>';
  const open = (id: string) =>
    header(id, '<span class="dday">D-7</span><button class="sri_btn_lg"><span class="sri_btn_immediately">입사지원</span></button>') +
    '<div class="info_timer" data-remain-time="650583"></div>';

  const adapter = new SaraminAdapter({} as BrowserService, stubConfig({ SARAMIN_MAX_PAGES: 1 }));
  const stubFetch = (...responses: Response[]) => {
    const fetchMock = vi.fn(async () => responses.shift()!);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };
  afterEach(() => vi.unstubAllGlobals());

  it('posts the rec_idx to view-ajax and reads the expired apply button as closed', async () => {
    const fetchMock = stubFetch(new Response(closed('55376622')));
    expect(await adapter.isClosed('55376622')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe('https://www.saramin.co.kr/zf_user/jobs/relay/view-ajax');
    expect(init.method).toBe('POST');
    expect(new URLSearchParams(init.body as URLSearchParams).get('rec_idx')).toBe('55376622');
  });

  it('reads an open posting as open', async () => {
    stubFetch(new Response(open('1')));
    expect(await adapter.isClosed('1')).toBe(false);
  });

  it('throws on a non-OK response or a body without this posting, instead of guessing', async () => {
    stubFetch(new Response('nope', { status: 429 }), new Response('<html>captcha</html>'), new Response(open('2')));
    await expect(adapter.isClosed('1')).rejects.toThrow(/HTTP 429/);
    await expect(adapter.isClosed('1')).rejects.toThrow(/layout changed/);
    await expect(adapter.isClosed('1')).rejects.toThrow(/layout changed/);
  });
});
