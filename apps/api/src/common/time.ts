const KST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD of an instant in Asia/Seoul. */
export function kstDateString(d: Date): string {
  return KST_DATE.format(d);
}

/** Midnight of the current calendar day in Asia/Seoul, independent of the process TZ. */
export function startOfTodayKst(now = new Date()): Date {
  return new Date(`${kstDateString(now)}T00:00:00+09:00`);
}
