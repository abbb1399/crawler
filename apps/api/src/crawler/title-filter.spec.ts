import { describe, expect, it } from 'vitest';
import { matchesRegion, matchesTitle } from './title-filter';

describe('matchesTitle', () => {
  const title = 'Node.js 백엔드 개발자 (3년 이상)';

  it('passes everything when both lists are empty', () => {
    expect(matchesTitle(title, [], [])).toBe(true);
  });

  it('requires at least one include term, case-insensitively', () => {
    expect(matchesTitle(title, ['backend', '백엔드'], [])).toBe(true);
    expect(matchesTitle(title, ['NODE.JS'], [])).toBe(true);
    expect(matchesTitle(title, ['frontend', '프론트'], [])).toBe(false);
  });

  it('drops the title when any exclude term matches, even if include matches too', () => {
    expect(matchesTitle(title, ['백엔드'], ['3년'])).toBe(false);
    expect(matchesTitle(title, ['백엔드'], ['SENIOR'])).toBe(true);
  });

  it('ignores empty exclude terms', () => {
    expect(matchesTitle(title, [], [''])).toBe(true);
  });
});

describe('matchesRegion', () => {
  it('keeps unknown locations and applies no filter for an empty region list', () => {
    expect(matchesRegion(null, ['SEOUL'])).toBe(true);
    expect(matchesRegion('부산 해운대구', [])).toBe(true);
  });

  it('matches when any comma-separated part starts with a region label', () => {
    expect(matchesRegion('경기 성남시 분당구', ['GYEONGGI'])).toBe(true);
    expect(matchesRegion('서울전체, 인천전체', ['INCHEON'])).toBe(true);
    expect(matchesRegion('서울 강남구', ['SEOUL', 'GYEONGGI'])).toBe(true);
  });

  it('rejects other regions', () => {
    expect(matchesRegion('부산 해운대구', ['SEOUL'])).toBe(false);
    expect(matchesRegion('경기 성남시', ['SEOUL'])).toBe(false);
    expect(matchesRegion('강서울', ['SEOUL'])).toBe(false);
  });
});
