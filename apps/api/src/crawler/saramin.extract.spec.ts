// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { extractSaraminItems, type ElementLike, type SaraminItem } from './saramin.extract';

// Provided by the jsdom environment at runtime; the api tsconfig has no DOM lib, so declare the bit we use.
declare const document: { body: { innerHTML: string }; querySelectorAll(selectors: string): Iterable<ElementLike> };

let items: SaraminItem[];

beforeAll(() => {
  document.body.innerHTML = readFileSync(join(__dirname, '__fixtures__', 'saramin-search.html'), 'utf8');
  items = extractSaraminItems([...document.querySelectorAll('.item_recruit')]);
});

describe('extractSaraminItems', () => {
  it('returns one item per card, in document order', () => {
    expect(items.map((i) => i.recIdx)).toEqual(['50001', '50002', '']);
  });

  it('reads a fully populated card, preferring the title attribute and collapsing whitespace', () => {
    expect(items[0]).toEqual({
      recIdx: '50001',
      title: 'Node.js 백엔드 개발자 (3년 이상)',
      company: '(주)모던랩스',
      location: '서울 강남구',
      dateText: '~ 11/15(일)',
      conditions: ['경력 3년↑', '대졸↑', '정규직'],
      sector: '백엔드/서버개발, Node.js 등록일 26/10/20',
      registeredText: '등록일 26/10/20',
    });
  });

  it('falls back to link text and plain corp_name, and leaves optional parts null', () => {
    expect(items[1]).toEqual({
      recIdx: '50002',
      title: '백엔드 개발자',
      company: '모던랩스',
      location: '경기 성남시 분당구',
      dateText: '오늘마감',
      conditions: [],
      sector: null,
      registeredText: null,
    });
  });

  it('yields an empty recIdx and null location when attributes are missing (adapter drops it)', () => {
    expect(items[2]).toMatchObject({ recIdx: '', title: 'DevOps 엔지니어', company: 'C사', location: null, conditions: [] });
    expect(items.filter((i) => i.recIdx && i.title)).toHaveLength(2);
  });

  it('is self-contained so Playwright can serialize it into the page', () => {
    const src = extractSaraminItems.toString();
    // Nothing from module scope may be referenced; these are the only helpers it is allowed to define inline.
    expect(src).not.toMatch(/\brequire\(|\bimport\b|_\w+\.|exports\./);
    expect(new Function('nodes', `return (${src})(nodes)`)([])).toEqual([]);
  });
});
