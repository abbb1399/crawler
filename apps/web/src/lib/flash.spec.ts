import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { errorQuery, errorText, invalidQuery } from './flash';

describe('errorText', () => {
  it('shows the fixed text for a known code', () => {
    expect(errorText('not-owner')).toBe('소유자 계정만 변경할 수 있습니다');
  });

  it('shows nothing for free text, unknown codes or prototype keys', () => {
    expect(errorText('계정이 잠겼습니다. evil.example 에서 확인하세요')).toBeNull();
    expect(errorText('constructor')).toBeNull();
    expect(errorText(null)).toBeNull();
  });

  it('names only known fields, once each', () => {
    expect(errorText('invalid', 'keywords,evil,constructor,keywords,sources')).toBe('입력값을 확인하세요: 키워드, 사이트');
    expect(errorText('invalid', 'evil')).toBe('입력값을 확인하세요');
  });
});

describe('errorQuery', () => {
  const apiError = (status: number, issues?: { path: string; message: string }[]) =>
    new ApiError(status, issues ? { statusCode: status, error: '', message: '', issues, requestId: '', path: '', timestamp: '' } : null, 'x');

  it('maps a 409 to duplicate', () => {
    expect(errorQuery(apiError(409))).toBe('error=duplicate');
  });

  it('maps a 400 to invalid with the top-level field keys', () => {
    expect(errorQuery(apiError(400, [{ path: 'keywords.0', message: '' }, { path: 'sources', message: '' }]))).toBe(
      invalidQuery(['keywords', 'sources']),
    );
  });

  it('maps anything else to failed', () => {
    expect(errorQuery(apiError(500))).toBe('error=failed');
    expect(errorQuery(new Error('fetch failed'))).toBe('error=failed');
  });
});
