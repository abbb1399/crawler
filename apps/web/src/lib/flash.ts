import { ApiError } from './api';

/**
 * Server actions report failures through the URL (`?error=<code>&fields=<keys>`). Anyone can put
 * anything in a URL, so only these fixed codes and field keys are ever shown; the text comes from here.
 */
const MESSAGES: Record<string, string> = {
  'not-owner': '소유자 계정만 변경할 수 있습니다',
  'no-auth': '인증이 설정되지 않아 변경할 수 없습니다 (Clerk 키 없음)',
  duplicate: '같은 이름의 프로필이 이미 있습니다',
  invalid: '입력값을 확인하세요',
  failed: '저장하지 못했습니다. 잠시 후 다시 시도하세요',
};

const FIELD_LABEL: Record<string, string> = {
  name: '이름',
  keywords: '키워드',
  includeTitle: '제목 포함어',
  excludeTitle: '제목 제외어',
  sources: '사이트',
  regions: '지역',
  enabled: '활성',
};

/** Banner text for a code from the URL, or null for anything unknown. */
export function errorText(code?: string | null, fields?: string | null): string | null {
  if (!code || !Object.hasOwn(MESSAGES, code)) return null;
  const labels = (fields ?? '')
    .split(',')
    .filter((f) => Object.hasOwn(FIELD_LABEL, f))
    .map((f) => FIELD_LABEL[f]);
  return labels.length ? `${MESSAGES[code]}: ${[...new Set(labels)].join(', ')}` : MESSAGES[code];
}

/** `error=invalid&fields=…` from the top-level keys that failed validation. */
export function invalidQuery(fields: string[]): string {
  return `error=invalid&fields=${encodeURIComponent([...new Set(fields)].join(','))}`;
}

/** Query string for a failed API call. */
export function errorQuery(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return 'error=duplicate';
  if (e instanceof ApiError && e.status === 400) {
    return invalidQuery((e.body?.issues ?? []).map((i) => i.path.split('.')[0]));
  }
  return 'error=failed';
}
