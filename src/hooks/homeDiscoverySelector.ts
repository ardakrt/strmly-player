import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { cleanMovieName } from '../utils/tmdb';
import { dailyStableScore, takeTopByScore } from '../utils/catalogFilters';
import { getItemGroupLower, getItemNameLower, isUnavailableCatalogItem } from '../utils/searchHelpers';

interface HomeDiscoveryInput {
  items: PlaylistItem[];
  movies: PlaylistItem[];
  groupedSeries: GroupedSeries[];
  recentlyWatched: PlaylistItem[];
  globalFavorites: string[];
  activeContentPreferences: string[];
  showcaseDaySeed: number;
}

export function selectHomeDiscoveryItems({
  items,
  movies,
  groupedSeries: allGroupedSeries,
  recentlyWatched,
  globalFavorites,
  activeContentPreferences,
  showcaseDaySeed,
}: HomeDiscoveryInput) {
  if (movies.length + allGroupedSeries.length === 0) return [];

  const recommendationLimit = 16;
  const ignoredGroupTokens = new Set([
    'tr', 'film', 'filmler', 'movie', 'movies', 'dizi', 'diziler',
    'series', 'hd', 'fhd', 'uhd', '4k', 'raw', 'istek', 'yapilan',
  ]);
  const titleStopWords = new Set([
    'bir', 've', 'ile', 'veya', 'de', 'da', 'ki', 'icin', 'bu', 'su', 'o',
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
    'season', 'sezon', 'bolum', 'episode', 'tek', 'parca', 'hd', 'fhd', 'uhd', '4k',
    'tr', 'eng', 'dublaj', 'altyazili', 'full', 'watch', 'izle', 'series', 'movie'
  ]);

  const titleKey = (item: PlaylistItem | GroupedSeries) => {
    const title = item.type === 'series'
      ? parseSeriesEpisodeInfo(item.name).cleanTitle
      : cleanMovieName(item.name);
    return (title || item.name).toLocaleLowerCase('tr-TR').trim();
  };
  const groupTokens = (group?: string) =>
    (group || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9çğıöşü]+/u)
      .filter(token => token.length > 2 && !ignoredGroupTokens.has(token));

  const extractTitleKeywords = (title: string) => {
    const cleaned = cleanMovieName(title)
      .toLocaleLowerCase('tr-TR')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
    return cleaned
      .split(/[^a-z0-9çğıöşü]+/u)
      .filter(w => w.length > 2 && !titleStopWords.has(w) && !ignoredGroupTokens.has(w));
  };

  const watchedTitleKeys = new Set<string>();
  const historySignalTitles = new Set<string>();
  const historyGroupWeights = new Map<string, number>();
  const historyKeywordWeights = new Map<string, number>();
  let movieHistoryWeight = 0;
  let seriesHistoryWeight = 0;

  // A) Process Recently Watched Items (Recency Decay + Completion Ratio)
  recentlyWatched.slice(0, 50).forEach((watched, index) => {
    if (!watched || (watched.type !== 'movie' && watched.type !== 'series')) return;
    const key = titleKey(watched);
    if (!key) return;
    watchedTitleKeys.add(key);

    if (historySignalTitles.has(key)) return;
    historySignalTitles.add(key);

    const recencyWeight = Math.max(5, 50 - index);
    const engagementWeight = Math.min(15, Math.max(0, (watched.progress ?? 0) / 100 * 15));
    const signalWeight = recencyWeight + engagementWeight;

    if (watched.type === 'series') seriesHistoryWeight += signalWeight;
    else movieHistoryWeight += signalWeight;

    groupTokens(watched.group).forEach((token) => {
      historyGroupWeights.set(
        token,
        (historyGroupWeights.get(token) || 0) + signalWeight,
      );
    });

    extractTitleKeywords(watched.name).forEach((kw) => {
      historyKeywordWeights.set(
        kw,
        (historyKeywordWeights.get(kw) || 0) + signalWeight * 1.5,
      );
    });
  });

  // B) Process Global Favorites (Explicit High-Intent Positive Signal)
  const favSet = new Set(globalFavorites || []);
  if (favSet.size > 0) {
    const allItemsMap = new Map<string, PlaylistItem | GroupedSeries>();
    items.forEach(i => allItemsMap.set(i.id, i));
    allGroupedSeries.forEach(s => allItemsMap.set(s.id, s));

    favSet.forEach(favId => {
      const item = allItemsMap.get(favId);
      if (!item || (item.type !== 'movie' && item.type !== 'series')) return;
      const key = titleKey(item);
      if (key) watchedTitleKeys.add(key);

      const favoriteWeight = 40;
      if (item.type === 'series') seriesHistoryWeight += favoriteWeight;
      else movieHistoryWeight += favoriteWeight;

      groupTokens(item.group).forEach((token) => {
        historyGroupWeights.set(
          token,
          (historyGroupWeights.get(token) || 0) + favoriteWeight,
        );
      });

      extractTitleKeywords(item.name).forEach((kw) => {
        historyKeywordWeights.set(
          kw,
          (historyKeywordWeights.get(kw) || 0) + favoriteWeight * 1.8,
        );
      });
    });
  }

  const totalSignalWeight = movieHistoryWeight + seriesHistoryWeight;
  const hasHistorySignals = totalSignalWeight > 0;
  const itemScores = new Map<string, number>();

  const scoreItem = (item: PlaylistItem | GroupedSeries) => {
    let score = 0;

    if (hasHistorySignals) {
      const typeWeight = item.type === 'series'
        ? seriesHistoryWeight
        : movieHistoryWeight;
      score += (typeWeight / totalSignalWeight) * 1200;

      for (const token of groupTokens(item.group)) {
        score += (historyGroupWeights.get(token) || 0) * 24;
      }

      for (const kw of extractTitleKeywords(item.name)) {
        const kwWeight = historyKeywordWeights.get(kw) || 0;
        if (kwWeight > 0) {
          score += kwWeight * 35 + 300;
        }
      }
    } else {
      if (activeContentPreferences.includes('series') && item.type === 'series') score += 700;
      if (activeContentPreferences.includes('movies') && item.type === 'movie') score += 700;
    }

    if (activeContentPreferences.includes('kids')) {
      const nLower = getItemNameLower(item);
      const gLower = getItemGroupLower(item, '');
      const text = `${nLower} ${gLower}`;
      if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(keyword => text.includes(keyword))) score += 1000;
    }

    const lowerName = item.name.toLowerCase();
    if (lowerName.includes('4k') || lowerName.includes('uhd')) score += 120;
    else if (lowerName.includes('1080p') || lowerName.includes('fhd')) score += 60;

    // Daily seed rotation score so top recommendations update & refresh every single calendar day
    const dailyVariety = dailyStableScore(`${showcaseDaySeed}-daily-discovery-${item.name}-${item.group || ''}`);
    score += dailyVariety * 150;

    itemScores.set(item.id, score);
    return score;
  };

  const movieCandidates = movies.filter(item =>
    !isUnavailableCatalogItem(item) && !watchedTitleKeys.has(titleKey(item))
  );
  const seriesCandidates = allGroupedSeries.filter(item =>
    !isUnavailableCatalogItem(item) && !watchedTitleKeys.has(titleKey(item))
  );
  const rankedMovies = takeTopByScore(
    movieCandidates,
    scoreItem,
    recommendationLimit * 2,
  );
  const rankedSeries = takeTopByScore(
    seriesCandidates,
    scoreItem,
    recommendationLimit * 2,
  );

  let movieTarget = 8;
  if (hasHistorySignals) {
    const movieShare = movieHistoryWeight / totalSignalWeight;
    movieTarget = Math.min(12, Math.max(4, Math.round(recommendationLimit * movieShare)));
  } else if (
    activeContentPreferences.includes('movies')
    && !activeContentPreferences.includes('series')
  ) {
    movieTarget = 11;
  } else if (
    activeContentPreferences.includes('series')
    && !activeContentPreferences.includes('movies')
  ) {
    movieTarget = 5;
  }
  const seriesTarget = recommendationLimit - movieTarget;
  const movieQuota = Math.min(movieTarget, rankedMovies.length);
  const seriesQuota = Math.min(seriesTarget, rankedSeries.length);

  const recommendations: Array<PlaylistItem | GroupedSeries> = [];
  let movieIndex = 0;
  let seriesIndex = 0;
  const movieFirst = movieTarget >= seriesTarget;
  while (
    recommendations.length < recommendationLimit
    && (movieIndex < movieQuota || seriesIndex < seriesQuota)
  ) {
    if (movieFirst) {
      if (movieIndex < movieQuota && rankedMovies[movieIndex]) {
        recommendations.push(rankedMovies[movieIndex++]);
      }
      if (seriesIndex < seriesQuota && rankedSeries[seriesIndex]) {
        recommendations.push(rankedSeries[seriesIndex++]);
      }
    } else {
      if (seriesIndex < seriesQuota && rankedSeries[seriesIndex]) {
        recommendations.push(rankedSeries[seriesIndex++]);
      }
      if (movieIndex < movieQuota && rankedMovies[movieIndex]) {
        recommendations.push(rankedMovies[movieIndex++]);
      }
    }
  }

  while (recommendations.length < recommendationLimit) {
    const nextMovie = rankedMovies[movieIndex++];
    const nextSeries = rankedSeries[seriesIndex++];
    if (nextMovie) recommendations.push(nextMovie);
    if (recommendations.length < recommendationLimit && nextSeries) {
      recommendations.push(nextSeries);
    }
    if (!nextMovie && !nextSeries) break;
  }

  return recommendations;
}

