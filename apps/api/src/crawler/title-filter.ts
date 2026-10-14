/**
 * Local relevance filter applied on top of the site's own keyword search, because
 * Wanted's search is fuzzy enough to return "HR Manager" for "node.js 백엔드".
 *
 * - If `exclude` matches the title (case-insensitive substring), drop it.
 * - If `include` is non-empty, at least one term must match.
 */
export function matchesTitle(title: string, include: string[], exclude: string[]): boolean {
  const t = title.toLowerCase();
  if (exclude.some((x) => x && t.includes(x.toLowerCase()))) return false;
  if (include.length > 0 && !include.some((x) => x && t.includes(x.toLowerCase()))) return false;
  return true;
}
