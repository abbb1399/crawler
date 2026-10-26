import { describe, expect, it } from 'vitest';
import { isOwner } from './owner';

describe('isOwner', () => {
  it('matches case-insensitively and ignores whitespace around entries', () => {
    expect(isOwner(['Me@Example.com'], ' me@example.com , other@example.com ')).toBe(true);
    expect(isOwner(['other@example.com'], 'me@example.com,other@example.com')).toBe(true);
  });

  it('rejects when none of the user emails is listed', () => {
    expect(isOwner(['stranger@example.com'], 'me@example.com')).toBe(false);
    expect(isOwner([], 'me@example.com')).toBe(false);
  });

  it('fails closed when the owner list is empty or unset', () => {
    expect(isOwner(['me@example.com'], undefined)).toBe(false);
    expect(isOwner(['me@example.com'], '')).toBe(false);
    expect(isOwner(['me@example.com'], ' , ')).toBe(false);
  });
});
