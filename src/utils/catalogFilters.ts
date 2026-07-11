import type { PlaylistItem } from '../types';
import type { GroupedSeries } from './seriesGroupers';
import {
  getItemGroupLower,
  getItemNameLower,
  getQualityRank,
  isHdChannel,
  itemMatchesQuery,
} from './searchHelpers';

const turkishCollator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });

/** Quality rank 1=SD … 4=4K matches UI qualityFilter tokens. */
export function matchesQualityFilter(rank: number, qualityFilter: string): boolean {
  if (qualityFilter === 'all') return true;
  if (qualityFilter === '4k') return rank === 4;
  if (qualityFilter === 'fhd') return rank === 3;
  if (qualityFilter === 'hd') return rank === 2;
  if (qualityFilter === 'sd') return rank === 1;
  return true;
}

/** National (ulusal) groups only keep HD+ channels. */
export function passesUlusalHdRule(item: PlaylistItem): boolean {
  const gLower = getItemGroupLower(item);
  if (!gLower.includes('ulusal')) return true;
  return isHdChannel(item.name, item.nameLower);
}

/**
 * Single-pass post-filter for display catalog rows (search + ulusal HD + quality).
 * Avoids 2–3 full array walks on large live/movie lists.
 */
export function applyCatalogPostFilters(
  base: PlaylistItem[],
  deferredSearchQuery: string,
  qualityFilter: string,
): PlaylistItem[] {
  const q = deferredSearchQuery.trim();
  const hasSearch = q.length > 0;
  const hasQuality = qualityFilter !== 'all';

  if (!hasSearch && !hasQuality) {
    // Still need ulusal HD rule
    let needsUlusalCheck = false;
    for (let i = 0; i < base.length; i++) {
      if (getItemGroupLower(base[i]).includes('ulusal')) {
        needsUlusalCheck = true;
        break;
      }
    }
    if (!needsUlusalCheck) return base;
  }

  const out: PlaylistItem[] = [];
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    if (hasSearch && !itemMatchesQuery(ch, deferredSearchQuery)) continue;
    if (!passesUlusalHdRule(ch)) continue;
    if (hasQuality) {
      const rank = ch.qualityRank || getQualityRank(ch.name, ch.nameLower);
      if (!matchesQualityFilter(rank, qualityFilter)) continue;
    }
    out.push(ch);
  }
  return out;
}

export function sortByNameAzZa<T extends { name: string }>(
  items: T[],
  sortOption: string,
): T[] {
  if (sortOption === 'az') {
    return items.toSorted((a, b) => turkishCollator.compare(a.name, b.name));
  }
  if (sortOption === 'za') {
    return items.toSorted((a, b) => turkishCollator.compare(b.name, a.name));
  }
  return items;
}

/** Series search: title/group or any episode name (short-circuits on first hit). */
export function seriesMatchesQuery(series: GroupedSeries, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return true;
  const sNameLower = getItemNameLower(series);
  const sGroupLower = getItemGroupLower(series);
  if (sNameLower.includes(q) || sGroupLower.includes(q)) return true;

  const seasons = Object.values(series.seasons);
  for (let s = 0; s < seasons.length; s++) {
    const episodes = seasons[s];
    for (let e = 0; e < episodes.length; e++) {
      const ep = episodes[e];
      const epNameLower = ep.item.nameLower || ep.item.name.toLocaleLowerCase('tr-TR');
      if (epNameLower.includes(q)) return true;
    }
  }
  return false;
}

export function seriesMatchesQuality(series: GroupedSeries, qualityFilter: string): boolean {
  if (qualityFilter === 'all') return true;
  const nameLower = getItemNameLower(series);
  const rank = getQualityRank(series.name, nameLower);
  return matchesQualityFilter(rank, qualityFilter);
}
