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
  return isHdChannel(item.name);
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

/**
 * Series quality buckets (historic UI semantics — not exclusive getQualityRank ranks).
 * e.g. "720" alone is SD; "720p"/"720i" are HD; "2160" alone is SD; "2160p" is 4K.
 */
export function seriesMatchesQuality(series: GroupedSeries, qualityFilter: string): boolean {
  if (qualityFilter === 'all') return true;
  const nameLower = getItemNameLower(series);
  const is4k =
    nameLower.includes('4k') || nameLower.includes('uhd') || nameLower.includes('2160p');
  const isFhd =
    nameLower.includes('fhd') || nameLower.includes('1080p') || nameLower.includes('1080i');
  const isHd =
    (nameLower.includes('hd') && !nameLower.includes('fhd')) ||
    nameLower.includes('720p') ||
    nameLower.includes('720i');
  const isSd =
    nameLower.includes('sd') ||
    nameLower.includes('576p') ||
    nameLower.includes('480p') ||
    (!is4k && !isFhd && !isHd);

  if (qualityFilter === '4k') return is4k;
  if (qualityFilter === 'fhd') return isFhd;
  if (qualityFilter === 'hd') return isHd;
  if (qualityFilter === 'sd') return isSd;
  return true;
}

/**
 * Daily-stable score used for home popular rows (same formula as prior useHomeData).
 * Kept pure so top-K selection can be tested without React.
 */
export function dailyStableScore(seed: string): number {
  let score = 0;
  for (let i = 0; i < seed.length; i++) {
    score = (score + seed.charCodeAt(i)) % 997;
  }
  return score;
}

/**
 * Select top `limit` items by score without sorting the full list (partial insertion).
 * Preserves prior semantics: higher score first; ties keep earlier encounter order.
 */
export function takeTopByScore<T>(
  items: T[],
  scoreOf: (item: T) => number,
  limit: number,
): T[] {
  if (limit <= 0 || items.length === 0) return [];
  if (items.length <= limit) {
    return items
      .map((item, index) => ({ item, score: scoreOf(item), index }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((e) => e.item);
  }

  type Entry = { item: T; score: number; index: number };
  const top: Entry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = scoreOf(item);
    if (top.length < limit) {
      top.push({ item, score, index: i });
      if (top.length === limit) {
        top.sort((a, b) => b.score - a.score || a.index - b.index);
      }
      continue;
    }
    const worst = top[top.length - 1];
    if (score < worst.score || (score === worst.score && i > worst.index)) continue;
    top[top.length - 1] = { item, score, index: i };
    // Restore descending order (limit is small, e.g. 80)
    top.sort((a, b) => b.score - a.score || a.index - b.index);
  }
  if (top.length < limit) {
    top.sort((a, b) => b.score - a.score || a.index - b.index);
  }
  return top.map((e) => e.item);
}
