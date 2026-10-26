import { describe, expect, it } from 'vitest';
import { fmtDateTime, fmtDue, fmtDuration } from './format';

describe('fmtDue', () => {
  const now = new Date('2026-10-26T12:00:00+09:00');

  it('shows MM/DD with a D-n countdown and flags the last three days as urgent', () => {
    expect(fmtDue('2026-10-28', now)).toEqual({ label: '10/28 (D-3)', urgent: true });
    expect(fmtDue('2026-10-29', now)).toEqual({ label: '10/29 (D-4)', urgent: false });
    expect(fmtDue('2026-11-30', now)).toEqual({ label: '11/30 (D-36)', urgent: false });
  });

  it('marks past due dates as closed and never urgent', () => {
    expect(fmtDue('2026-10-20', now)).toEqual({ label: '10/20 마감', urgent: false });
  });

  it('treats null as open-ended', () => {
    expect(fmtDue(null, now)).toEqual({ label: '상시', urgent: false });
  });
});

describe('fmtDateTime', () => {
  it('renders in Asia/Seoul regardless of the host timezone', () => {
    expect(fmtDateTime('2026-10-26T00:30:00Z')).toBe('10/26 09:30');
    expect(fmtDateTime(null)).toBe('-');
  });
});

describe('fmtDuration', () => {
  it('reports in-progress runs, milliseconds under a second, else seconds', () => {
    expect(fmtDuration('2026-10-26T00:00:00Z', null)).toBe('진행 중');
    expect(fmtDuration('2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.500Z')).toBe('500ms');
    expect(fmtDuration('2026-10-26T00:00:00.000Z', '2026-10-26T00:00:01.500Z')).toBe('1.5s');
  });
});
