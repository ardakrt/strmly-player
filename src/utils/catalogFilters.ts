import type { PlaylistItem } from '../types';
import type { GroupedSeries } from './seriesGroupers';
import { cleanMediaTitle } from './seriesGroupers';
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
function passesUlusalHdRule(item: PlaylistItem): boolean {
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

const releaseYearPattern = /(?:^|\D)((?:19|20)\d{2})(?=\D|$)/g;

function getReleaseYear(value: string): string {
  let year = '';
  for (const match of String(value || '').matchAll(releaseYearPattern)) {
    year = match[1];
  }
  return year;
}

function getCatalogTitleKey(title: string, yearSource = title): string {
  const cleanTitle = cleanMediaTitle(title)
    .replace(/(?:^|\D)(?:19|20)\d{2}(?=\D|$)/g, ' ')
    .replace(/\b(?:4k|uhd|fhd|hd|sd|2160p?|1080[pi]?|720[pi]?|576p?|480p?)\b/gi, ' ')
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const year = getReleaseYear(yearSource);
  return `${cleanTitle || String(title || '').trim().toLocaleLowerCase('tr-TR')}::${year}`;
}

function hasPreferredArtwork(item: PlaylistItem): boolean {
  return Boolean(item.logo && !item.isGenericLogo);
}

/**
 * Collapse provider duplicates in the Movies catalog without touching the
 * underlying playlist. A release year remains part of the key so remakes with
 * the same title continue to appear as separate films.
 */
export function dedupeMovieCatalogItems(items: PlaylistItem[]): PlaylistItem[] {
  if (items.length < 2) return items;

  const deduped: PlaylistItem[] = [];
  const indexByTitle = new Map<string, number>();
  for (const item of items) {
    const key = getCatalogTitleKey(item.name);
    const existingIndex = indexByTitle.get(key);
    if (existingIndex === undefined) {
      indexByTitle.set(key, deduped.length);
      deduped.push(item);
      continue;
    }

    const existing = deduped[existingIndex];
    const existingRank = existing.qualityRank || getQualityRank(existing.name, existing.nameLower);
    const candidateRank = item.qualityRank || getQualityRank(item.name, item.nameLower);
    if (
      candidateRank > existingRank
      || (candidateRank === existingRank
        && hasPreferredArtwork(item)
        && !hasPreferredArtwork(existing))
    ) {
      deduped[existingIndex] = item;
    }
  }
  return deduped;
}

function getSeriesYearSource(series: GroupedSeries): string {
  for (const episodes of Object.values(series.seasons)) {
    if (episodes[0]?.item?.name) return episodes[0].item.name;
  }
  return series.name;
}

/** Collapse the same grouped series repeated under multiple provider groups. */
export function dedupeSeriesCatalogItems(items: GroupedSeries[]): GroupedSeries[] {
  if (items.length < 2) return items;

  const deduped: GroupedSeries[] = [];
  const indexByTitle = new Map<string, number>();
  for (const series of items) {
    const key = getCatalogTitleKey(series.name, getSeriesYearSource(series));
    const existingIndex = indexByTitle.get(key);
    if (existingIndex === undefined) {
      indexByTitle.set(key, deduped.length);
      deduped.push(series);
      continue;
    }

    const existing = deduped[existingIndex];
    if (
      series.episodesCount > existing.episodesCount
      || (series.episodesCount === existing.episodesCount
        && series.logo
        && !series.isGenericLogo
        && (!existing.logo || existing.isGenericLogo))
    ) {
      deduped[existingIndex] = series;
    }
  }
  return deduped;
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

/** TMDB-enriched candidate for home hero showcase. */
export interface PopularShowcaseCandidate {
  item: PlaylistItem;
  /** TMDB vote_average (0–10). */
  rating: number;
  popularity?: number;
  voteCount?: number;
  hasBackdrop?: boolean;
}

/** Local calendar-day seed; includes the year so the slate does not repeat annually. */
export function getLocalCalendarDaySeed(date = new Date()): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** Source-backed TMDB ranking score used before the daily rotation is sampled. */
export function getTmdbShowcaseScore(candidate: PopularShowcaseCandidate): number {
  const rating = Number.isFinite(candidate.rating) ? candidate.rating : 0;
  const popularity = Number.isFinite(candidate.popularity) ? (candidate.popularity as number) : 0;
  const voteCount = Number.isFinite(candidate.voteCount) ? (candidate.voteCount as number) : 0;

  return (
    rating * 24
    + Math.min(popularity, 80) * 0.5
    + Math.min(voteCount, 2500) / 100
    + (candidate.hasBackdrop ? 30 : 0)
  );
}

/**
 * Netflix-style home billboard picker:
 * - Ranks film and dizi in *separate* popular tiers (movies otherwise dominate TMDB votes)
 * - Hard mix quotas (default ~half series) with soft preference tilt
 * - Daily-stable weighted sample inside each tier
 */
export function selectMixedPopularShowcase(
  candidates: PopularShowcaseCandidate[],
  count: number,
  daySeed: number,
  prefs: string[] = [],
): PlaylistItem[] {
  if (count <= 0 || candidates.length === 0) return [];

  const preferSeries = prefs.includes('series') && !prefs.includes('movies');
  const preferMovies = prefs.includes('movies') && !prefs.includes('series');
  // Default slightly series-friendly (ceil) so billboards aren't movie-only.
  let seriesTarget = Math.ceil(count * 0.5);
  if (preferSeries) seriesTarget = Math.round(count * 0.65);
  if (preferMovies) seriesTarget = Math.round(count * 0.35);
  // Keep both types when both exist in the catalog.
  seriesTarget = Math.max(1, Math.min(count - 1, seriesTarget));
  let movieTarget = count - seriesTarget;

  type Ranked = { c: PopularShowcaseCandidate; score: number; index: number };

  const rankType = (isSeries: boolean): Ranked[] =>
    candidates
      .filter((c) => (isSeries ? c.item.type === 'series' : c.item.type !== 'series'))
      .map((c, index) => ({ c, score: getTmdbShowcaseScore(c), index }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

  // Independent popular tiers — never filter series out of a movie-heavy combined top-N.
  const tierPerType = Math.max(count * 5, 28);
  const seriesRanked = rankType(true).slice(0, tierPerType);
  const movieRanked = rankType(false).slice(0, tierPerType);

  // If only one type exists, fill the whole billboard with it.
  if (seriesRanked.length === 0) {
    seriesTarget = 0;
    movieTarget = count;
  } else if (movieRanked.length === 0) {
    seriesTarget = count;
    movieTarget = 0;
  }

  let seed = (daySeed * 2654435761) >>> 0;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  /** Weighted sample without replacement; higher score = more likely. */
  const pickWeighted = (pool: Ranked[], n: number): PopularShowcaseCandidate[] => {
    const available = [...pool];
    const picked: PopularShowcaseCandidate[] = [];
    while (picked.length < n && available.length > 0) {
      const weights = available.map((e, index) => {
        // TMDB rank stays primary; the seeded RNG only rotates within the popular tier.
        const rankWeight = ((available.length - index) / available.length) ** 2;
        return Math.max(e.score, 0.01) * rankWeight;
      });
      const total = weights.reduce((s, w) => s + w, 0);
      let r = rand() * total;
      let idx = 0;
      for (; idx < available.length; idx++) {
        r -= weights[idx];
        if (r <= 0) break;
      }
      idx = Math.min(idx, available.length - 1);
      picked.push(available[idx].c);
      available.splice(idx, 1);
    }
    return picked;
  };

  const seriesPicks = pickWeighted(seriesRanked, Math.min(seriesTarget, seriesRanked.length));
  const moviePicks = pickWeighted(movieRanked, Math.min(movieTarget, movieRanked.length));

  // Backfill only after that type's own popular tier is exhausted.
  const pickedKeys = new Set(
    [...seriesPicks, ...moviePicks].map((c) => c.item.url || c.item.id || c.item.name),
  );
  let need = count - seriesPicks.length - moviePicks.length;
  if (need > 0 && seriesRanked.length > seriesPicks.length) {
    const moreSeries = pickWeighted(
      seriesRanked.filter((e) => !pickedKeys.has(e.c.item.url || e.c.item.id || e.c.item.name)),
      need,
    );
    for (const c of moreSeries) {
      seriesPicks.push(c);
      pickedKeys.add(c.item.url || c.item.id || c.item.name);
    }
    need = count - seriesPicks.length - moviePicks.length;
  }
  if (need > 0 && movieRanked.length > moviePicks.length) {
    const moreMovies = pickWeighted(
      movieRanked.filter((e) => !pickedKeys.has(e.c.item.url || e.c.item.id || e.c.item.name)),
      need,
    );
    for (const c of moreMovies) {
      moviePicks.push(c);
      pickedKeys.add(c.item.url || c.item.id || c.item.name);
    }
  }

  // Interleave dizi / film; the larger default series quota starts first to avoid adjacent types.
  const mixed: PlaylistItem[] = [];
  let si = 0;
  let mi = 0;
  let preferSeriesNext = seriesPicks.length >= moviePicks.length;
  while (mixed.length < count && (si < seriesPicks.length || mi < moviePicks.length)) {
    if (preferSeriesNext && si < seriesPicks.length) {
      mixed.push(seriesPicks[si++].item);
    } else if (mi < moviePicks.length) {
      mixed.push(moviePicks[mi++].item);
    } else if (si < seriesPicks.length) {
      mixed.push(seriesPicks[si++].item);
    }
    preferSeriesNext = !preferSeriesNext;
  }

  return mixed.slice(0, count);
}
