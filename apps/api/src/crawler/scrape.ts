/** Same desktop Chrome for the JSON calls and the Playwright browser, so both sites see one client. */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** Pause between result pages. Global setTimeout on purpose: the adapter tests skip it with fake timers. */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, ms));
}
