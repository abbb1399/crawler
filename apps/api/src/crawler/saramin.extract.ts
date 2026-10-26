/** Shape extracted inside the page; keep it JSON-serializable. */
export interface SaraminItem {
  recIdx: string;
  title: string;
  company: string;
  location: string | null;
  dateText: string;
  conditions: string[];
  sector: string | null;
  registeredText: string | null;
}

/**
 * The DOM surface the extractor touches. Declared structurally because the api tsconfig has no
 * DOM lib; a real Element (Playwright/jsdom) satisfies it.
 */
export interface ElementLike {
  getAttribute(name: string): string | null;
  querySelector(selectors: string): ElementLike | null;
  querySelectorAll(selectors: string): Iterable<ElementLike>;
  readonly textContent: string | null;
}

/**
 * Reads one search-result card per `.item_recruit` node.
 *
 * Runs INSIDE the browser via `page.$$eval`: Playwright serializes the function source, so the
 * body must be self-contained — no imports, no closure variables, no helpers from this module.
 * The same function runs against a jsdom fixture in unit tests.
 */
export function extractSaraminItems(nodes: ElementLike[]): SaraminItem[] {
  return nodes.map((el) => {
    const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const titleEl = el.querySelector('.job_tit a');
    const condSpans = [...el.querySelectorAll('.job_condition > span')].map(
      (s) => s.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
    return {
      recIdx: el.getAttribute('value') ?? '',
      title: titleEl?.getAttribute('title')?.trim() || text('.job_tit a'),
      company: text('.corp_name a') || text('.corp_name'),
      location: condSpans[0] || null,
      dateText: text('.job_date .date'),
      conditions: condSpans.slice(1),
      sector: text('.job_sector') || null,
      registeredText: text('.job_sector .job_day') || null,
    };
  });
}
