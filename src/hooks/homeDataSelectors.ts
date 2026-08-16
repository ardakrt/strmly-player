import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { cleanMovieName } from '../utils/tmdb';
import { dailyStableScore, takeTopByScore, type PopularShowcaseCandidate } from '../utils/catalogFilters';
import { getItemGroupLower, getItemNameLower, isUnavailableCatalogItem } from '../utils/searchHelpers';

const KIDS_TOKENS = ['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'];
const SPORTS_TOKENS = ['spor', 'sport', 'bein', 's sport', 'ssport', 'tivibu spor', 'smart spor', 'nba', 'futbol'];
const POPULAR_LIVE_PATTERNS = [
  ['trt 1', 'trt1'], ['atv'], ['star tv', 'star'], ['show tv', 'show'], ['tv8', 'tv 8'],
  ['kanal d', 'kanald'], ['now tv', 'now', 'fox tv', 'fox'],
  ['bein sports 1', 'bein sport 1', 'bein 1', 'bein connect 1'],
  ['bein sports 2', 'bein sport 2', 'bein 2', 'bein connect 2'],
  ['bein sports 3', 'bein sport 3', 'bein 3', 'bein connect 3'],
  ['bein sports 4', 'bein sport 4', 'bein 4', 'bein connect 4'],
  ['s sport 1', 's sport', 'ssport 1', 'ssport'], ['s sport 2', 'ssport 2'],
  ['trt spor', 'trtspor'], ['a spor', 'aspor'], ['ntv'], ['cnn turk', 'cnnturk'],
  ['haberturk', 'haber turk'], ['tv8.5', 'tv 8.5', 'tv8,5', 'tv 8,5'],
];

export function getHomeItemCleanTitle(item: PlaylistItem) {
  return item.type === 'series'
    ? parseSeriesEpisodeInfo(item.name).cleanTitle.toLowerCase().trim()
    : cleanMovieName(item.name).toLowerCase().trim();
}

export function getFeaturedCacheKey(item: PlaylistItem) {
  return `${item.url || item.name}|${item.type}|${getHomeItemCleanTitle(item)}`;
}

export function toPopularShowcaseCandidate(item: PlaylistItem, result: any | null): PopularShowcaseCandidate | null {
  if (!result || !(result.backdrop_path || result.poster_path)) return null;
  return {
    item,
    rating: typeof result.vote_average === 'number' ? result.vote_average : 0,
    popularity: typeof result.popularity === 'number' ? result.popularity : undefined,
    voteCount: typeof result.vote_count === 'number' ? result.vote_count : undefined,
    hasBackdrop: Boolean(result.backdrop_path),
  };
}

export function sampleUniqueHomeCandidates(list: PlaylistItem[], limit: number, seed: number) {
  const seen = new Set<string>();
  const unique: PlaylistItem[] = [];
  for (const item of list) {
    const title = getHomeItemCleanTitle(item);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    unique.push(item);
    if (unique.length >= Math.max(limit * 3, 240)) break;
  }
  if (unique.length <= limit) return unique;
  let state = (seed * 1664525 + 1013904223) >>> 0;
  const pool = [...unique];
  for (let index = pool.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = Math.floor((state / 4294967296) * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, limit);
}

function getPopularItems<T extends PlaylistItem | GroupedSeries>(items: T[], preferences: string[], seedSuffix: string) {
  const daySeed = `${new Date().toISOString().slice(0, 10)}-${seedSuffix}`;
  const kids = preferences.includes('kids');
  return takeTopByScore(
    items.filter((item) => !isUnavailableCatalogItem(item)),
    (item) => {
      let score = dailyStableScore(`${daySeed}-${item.name}-${item.group || ''}`);
      if (kids) {
        const text = `${getItemNameLower(item)} ${getItemGroupLower(item, '')}`;
        if (KIDS_TOKENS.some((token) => text.includes(token))) score += 1200;
      }
      return score;
    },
    80,
  );
}

export const selectPopularMovies = (items: PlaylistItem[], preferences: string[]) => getPopularItems(items, preferences, 'movies');
export const selectPopularSeries = (items: GroupedSeries[], preferences: string[]) => getPopularItems(items, preferences, 'series');

const isBlockedLiveChannel = (name: string, includeAdult = false) => {
  const lower = name.toLowerCase();
  return lower.includes('yedek') || lower.includes('test') || lower.includes('bakim') || (includeAdult && (lower.includes('adult') || lower.includes('xxx')));
};

export function selectQuickLiveChannels(items: PlaylistItem[], preferences: string[]) {
  const selected: PlaylistItem[] = [];
  for (const terms of POPULAR_LIVE_PATTERNS) {
    const match = items.find((channel) => {
      const name = channel.name.toLowerCase();
      if (isBlockedLiveChannel(name)) return false;
      return terms.some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(name) || name === term);
    });
    if (match) selected.push(match);
  }
  if (selected.length < 10) {
    for (const channel of items) {
      if (selected.length >= 15) break;
      if (!isBlockedLiveChannel(channel.name, true) && !selected.some((item) => item.id === channel.id)) selected.push(channel);
    }
  }
  const visible = selected.slice(0, 15);
  if (!preferences.includes('sports')) return visible;
  return visible.toSorted((a, b) => {
    const aText = `${a.name} ${a.group || ''}`.toLocaleLowerCase('tr-TR');
    const bText = `${b.name} ${b.group || ''}`.toLocaleLowerCase('tr-TR');
    return Number(SPORTS_TOKENS.some((token) => bText.includes(token))) - Number(SPORTS_TOKENS.some((token) => aText.includes(token)));
  });
}

export function selectUniqueRecentlyWatched(recentlyWatched: PlaylistItem[], groupedSeries: GroupedSeries[]) {
  const seenSeries = new Set<string>();
  const mapped = recentlyWatched.map((item) => {
    if (!item) return null;
    const rawName = String(item.name || '').trim();
    if (!rawName) return null;
    let type = item.type;
    if (type !== 'movie' && type !== 'series' && type !== 'live') {
      const looksLikeEpisode = /s\s*\d+\s*e\s*\d+/i.test(rawName) || /\d+\s*\.?\s*sezon/i.test(rawName) || /\d+\s*\.?\s*bölüm/i.test(rawName);
      type = looksLikeEpisode ? 'series' : 'movie';
    }
    const isFinished = (item.progress ?? 0) > 90;
    const baseItem: PlaylistItem = { ...item, name: rawName, type };
    if (type === 'movie') return isFinished ? null : baseItem;
    if (type !== 'series') return null;

    const parsed = parseSeriesEpisodeInfo(rawName);
    const seriesName = (parsed.cleanTitle || rawName).trim() || rawName;
    const key = `${seriesName.toLowerCase()}:::${item.group || ''}`;
    if (seenSeries.has(key)) return null;
    seenSeries.add(key);
    const grouped = groupedSeries.find((series) => series.name === seriesName && (series.group || 'Genel') === (item.group || 'Genel'))
      || groupedSeries.find((series) => (parseSeriesEpisodeInfo(series.name).cleanTitle || series.name).toLowerCase() === seriesName.toLowerCase());
    const resolveLogo = (base: PlaylistItem) => {
      if (base.logo && String(base.logo).trim() && !base.isGenericLogo) return base;
      const logo = grouped?.logo && String(grouped.logo).trim() ? grouped.logo : undefined;
      return logo ? { ...base, logo, isGenericLogo: false } : base;
    };
    if (!isFinished) return resolveLogo(baseItem);
    if (!grouped) return null;
    const episodes = Object.values(grouped.seasons).flat().toSorted((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    const currentIndex = episodes.findIndex((episode) => episode.seasonNumber === parsed.season && episode.episodeNumber === parsed.episode);
    if (currentIndex < 0 || currentIndex >= episodes.length - 1) return null;
    return resolveLogo({ ...episodes[currentIndex + 1].item, currentTime: undefined, duration: undefined, progress: undefined });
  });
  return mapped.filter((item): item is PlaylistItem => item !== null);
}
