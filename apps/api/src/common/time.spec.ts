import { describe, expect, it } from 'vitest';
import { startOfTodayKst } from './time';

describe('startOfTodayKst', () => {
  it('returns KST midnight of the KST calendar day, around the UTC/KST date boundary', () => {
    // 23:59 KST on Oct 26 → still Oct 26 in Seoul
    expect(startOfTodayKst(new Date('2026-10-26T14:59:00Z')).toISOString()).toBe('2026-10-25T15:00:00.000Z');
    // 00:01 KST on Oct 27 (still Oct 26 in UTC) → Oct 27 in Seoul
    expect(startOfTodayKst(new Date('2026-10-26T15:01:00Z')).toISOString()).toBe('2026-10-26T15:00:00.000Z');
  });

  it('is idempotent for any instant within the same KST day', () => {
    const a = startOfTodayKst(new Date('2026-10-26T15:00:00Z'));
    const b = startOfTodayKst(new Date('2026-10-27T14:59:59Z'));
    expect(a.getTime()).toBe(b.getTime());
  });
});
