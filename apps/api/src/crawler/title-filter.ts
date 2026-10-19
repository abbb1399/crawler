import { REGION_LABEL, type Region } from '@trawler/shared';

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

/**
 * Backstop for the sites' own region filter (Saramin's leaks other regions). Matches when any
 * comma-separated part of the location starts with a region label: "경기 성남시", "서울전체, 인천전체".
 * Unknown location is kept. Empty `regions` = nationwide.
 */
export function matchesRegion(location: string | null, regions: Region[]): boolean {
  if (regions.length === 0 || !location) return true;
  const parts = location.split(',').map((p) => p.trim());
  return regions.some((r) => parts.some((p) => p.startsWith(REGION_LABEL[r])));
}
