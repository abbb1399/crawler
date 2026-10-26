const dt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "2026-10-26T00:30:00Z" → "10/26 09:30" (Asia/Seoul). Built from parts: ko-KR's literal output ("10. 26. 09:30") varies by ICU version. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const p: Record<string, string> = {};
  for (const part of dt.formatToParts(new Date(iso))) p[part.type] = part.value;
  return `${p['month']}/${p['day']} ${p['hour']}:${p['minute']}`;
}

/** "2026-11-22" → "11/22", with a D-n hint. */
export function fmtDue(due: string | null, now = new Date()): { label: string; urgent: boolean } {
  if (!due) return { label: '상시', urgent: false };
  const d = new Date(`${due}T23:59:59+09:00`);
  const days = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  const mmdd = due.slice(5).replace('-', '/');
  if (days < 0) return { label: `${mmdd} 마감`, urgent: false };
  return { label: `${mmdd} (D-${days})`, urgent: days <= 3 };
}

export function fmtDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '진행 중';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
