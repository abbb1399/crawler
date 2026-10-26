const KST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Midnight of the current calendar day in Asia/Seoul, independent of the process TZ. */
export function startOfTodayKst(now = new Date()): Date {
  return new Date(`${KST_DATE.format(now)}T00:00:00+09:00`);
}
