import { useState, useEffect, useMemo } from 'react';
import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import {
  tmdbCache,
  selectBestTmdbResult,
  cleanMovieName,
  buildTmdbSearchPath,
  getResolvedTmdbResult,
  resolveTmdbImageSrc
} from '../utils/tmdb';
import {
  getItemNameLower,
  getItemGroupLower,
  isUnavailableCatalogItem,
  getStableMatchPercentage
} from '../utils/searchHelpers';

interface UseHomeDataProps {
  items: PlaylistItem[];
  itemBuckets: {
    live: PlaylistItem[];
    movie: PlaylistItem[];
    series: PlaylistItem[];
  };
  allGroupedSeries: GroupedSeries[];
  recentlyWatched: PlaylistItem[];
  tmdbApiKey: string;
  activeContentPreferences: string[];
}

export interface FeaturedTmdbData {
  match: string;
  rating: string;
  year: string;
  desc: string;
  backdrop?: string;
  poster?: string;
}

export function useHomeData({
  items,
  itemBuckets,
  allGroupedSeries,
  recentlyWatched,
  tmdbApiKey,
  activeContentPreferences
}: UseHomeDataProps) {
  const [showcaseItems, setShowcaseItems] = useState<PlaylistItem[]>([]);
  const [featuredTmdbData, setFeaturedTmdbData] = useState<FeaturedTmdbData | null>(null);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState<number>(0);

  // Select highly-rated VOD items (movies/series) for Hero Showcase Carousel from cache/network
  useEffect(() => {
    if (items.length === 0) {
      setShowcaseItems([]);
      setActiveFeaturedIndex(0);
      return;
    }

    let active = true;

    const selectShowcaseItems = async () => {
      const getDayOfYear = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now.getTime() - start.getTime();
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
      };

      const selectDailyShowcase = <T,>(candidates: T[], count: number): T[] => {
        if (candidates.length <= count) return candidates;
        const daySeed = getDayOfYear();
        const selected: T[] = [];
        const available = [...candidates];

        let seed = daySeed;
        const lcgRandom = () => {
          seed = (seed * 1664525 + 1013904223) % 4294967296;
          return seed / 4294967296;
        };

        for (let i = 0; i < count; i++) {
          const index = Math.floor(lcgRandom() * available.length);
          selected.push(available[index]);
          available.splice(index, 1);
        }
        return selected;
      };

      const getCandidateSuitabilityScore = (item: PlaylistItem) => {
        const name = item.name.toLowerCase();
        const group = (item.group || '').toLowerCase();

        // Exclusions (pushed to the very bottom)
        const excludeKeywords = ['7/24', '24/7', 'seç izle', 'sec izle', 'seçizle', 'secizle', 'sinema tv', 'sinematv', 'live', 'raw', 'test', 'promo', 'fragman'];
        if (excludeKeywords.some(kw => name.includes(kw) || group.includes(kw))) {
          return -10000;
        }

        let score = 0;

        // Prioritize curated VOD platforms and high-quality categories.
        const premiumKeywords = [
          'netflix', 'amazon', 'prime', 'disney', 'apple', 'hbo',
          'exxen', 'blu tv', 'blutv', 'uhd', '4k', '1080p',
          'yabancı film', 'yabancı dizi', 'popüler', 'vizyon', 'trend',
          'sine', 'türkçe dublaj', 'türkçe altyazı', 'aksiyon', 'bilim kurgu'
        ];
        for (const kw of premiumKeywords) {
          if (group.includes(kw)) score += 50;
          if (name.includes(kw)) score += 20;
        }

        // Favor VOD types over general type
        if (item.type === 'series') score += 30;
        if (item.type === 'movie') score += 20;

        if (activeContentPreferences.includes('series') && item.type === 'series') score += 180;
        if (activeContentPreferences.includes('movies') && item.type === 'movie') score += 180;
        if (activeContentPreferences.includes('kids')) {
          const kidsKeywords = ['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney', 'nickelodeon'];
          if (kidsKeywords.some(keyword => name.includes(keyword) || group.includes(keyword))) score += 240;
        }

        return score;
      };

      const getCleanTitle = (item: PlaylistItem) => {
        const isSeries = item.type === 'series';
        return isSeries
          ? parseSeriesEpisodeInfo(item.name).cleanTitle.toLowerCase().trim()
          : cleanMovieName(item.name).toLowerCase().trim();
      };

      const vodItems = [...itemBuckets.movie, ...itemBuckets.series];
      const candidatesSource = vodItems.length > 0 ? vodItems : items;

      const sortedCandidatesSource = [...candidatesSource]
        .map(item => ({ item, score: getCandidateSuitabilityScore(item) }))
        .sort((a, b) => b.score - a.score)
        .map(x => x.item);

      // Take first 300 candidates to check cache
      const candidates = sortedCandidatesSource.slice(0, 300);
      const candidatesWithCachedData: { item: PlaylistItem; result: any; rating: number }[] = [];
      const uncachedCandidates: PlaylistItem[] = [];

      // Query IndexedDB in parallel for these 300 items
      const cacheCheckPromises = candidates.map(async (item) => {
        const isSeries = item.type === 'series';
        const cleanTitle = isSeries
          ? parseSeriesEpisodeInfo(item.name).cleanTitle
          : cleanMovieName(item.name);
        const endpoint = isSeries ? 'tv' : 'movie';

        try {
          const fullPath = buildTmdbSearchPath(endpoint, 'DUMMY_API_KEY', cleanTitle);
          const cleanCachePath = fullPath.replace(/[?&]api_key=[^&]+/, '');
          const cacheKey = `api-${cleanCachePath}`;

          const cachedData = await tmdbCache.get(cacheKey);
          if (cachedData && cachedData.results) {
            const bestResult = selectBestTmdbResult(cachedData.results, cleanTitle);
            if (bestResult && (bestResult.backdrop_path || bestResult.poster_path)) {
              return { item, result: bestResult, rating: bestResult.vote_average || 0.1 };
            }
          }
        } catch (e) {
          console.error("Showcase cache check error:", e);
        }
        return { item, result: null, rating: 0 };
      });

      const cachedCheckResults = await Promise.all(cacheCheckPromises);
      if (!active) return;

      for (const res of cachedCheckResults) {
        if (res.result) {
          candidatesWithCachedData.push(res);
        } else {
          uncachedCandidates.push(res.item);
        }
      }

      // Deduplicate cached items by clean title
      const seenCachedTitles = new Set<string>();
      const uniqueCached: typeof candidatesWithCachedData = [];
      for (const c of candidatesWithCachedData) {
        const title = getCleanTitle(c.item);
        if (!seenCachedTitles.has(title)) {
          seenCachedTitles.add(title);
          uniqueCached.push(c);
        }
      }

      let finalSelected: PlaylistItem[];

      // If we have at least 5 unique cached items with ratings and backdrops, sort and select them
      if (uniqueCached.length >= 5) {
        uniqueCached.sort((a, b) => b.rating - a.rating);
        const topPool = uniqueCached.slice(0, 15);
        finalSelected = selectDailyShowcase(topPool, 5).map(c => c.item);
      } else {
        // Collect unique uncached candidates, excluding already cached unique titles
        const seenUncachedTitles = new Set<string>();
        for (const title of seenCachedTitles) {
          seenUncachedTitles.add(title);
        }

        const uniqueUncached: PlaylistItem[] = [];
        for (const item of uncachedCandidates) {
          const title = getCleanTitle(item);
          if (!seenUncachedTitles.has(title)) {
            seenUncachedTitles.add(title);
            uniqueUncached.push(item);
          }
        }

        // Fetch TMDB ratings from network for a small batch of unique items in parallel
        const apiKey = tmdbApiKey;
        const fetchCount = Math.min(uniqueUncached.length, 15);
        const toFetch = uniqueUncached.slice(0, fetchCount);

        const fetchPromises = toFetch.map(async (item) => {
          const isSeries = item.type === 'series';
          const cleanTitle = isSeries
            ? parseSeriesEpisodeInfo(item.name).cleanTitle
            : cleanMovieName(item.name);
          const endpoint = isSeries ? 'tv' : 'movie';

          try {
            const result = await getResolvedTmdbResult(endpoint, apiKey, cleanTitle);
            if (result && (result.backdrop_path || result.poster_path)) {
              return { item, result, rating: result.vote_average || 0.1 };
            }
          } catch (e) {
            console.error("Showcase network fetch error:", e);
          }
          return { item, result: null, rating: 0 };
        });

        const fetchResults = await Promise.all(fetchPromises);
        if (!active) return;

        const combined = [...uniqueCached];
        for (const res of fetchResults) {
          if (res.result) {
            combined.push(res);
          }
        }

        combined.sort((a, b) => b.rating - a.rating);

        const validCandidates = combined.filter(c => c.rating > 0);

        const finalSeenTitles = new Set<string>();
        const selectList: PlaylistItem[] = [];

        for (const c of validCandidates) {
          const title = getCleanTitle(c.item);
          if (!finalSeenTitles.has(title)) {
            finalSeenTitles.add(title);
            selectList.push(c.item);
          }
        }

        // Fallback to candidatesSource (deduplicated) if we still have less than 15 items
        for (const item of sortedCandidatesSource) {
          if (selectList.length >= 15) break;
          const title = getCleanTitle(item);
          if (!finalSeenTitles.has(title)) {
            finalSeenTitles.add(title);
            selectList.push(item);
          }
        }

        finalSelected = selectDailyShowcase(selectList, 5);
      }

      if (active) {
        setShowcaseItems(finalSelected);
        setActiveFeaturedIndex(0);
      }
    };

    selectShowcaseItems();

    return () => {
      active = false;
    };
  }, [items, itemBuckets.movie, itemBuckets.series, tmdbApiKey, activeContentPreferences]);

  // Fetch TMDB data for active featured carousel item
  useEffect(() => {
    if (showcaseItems.length === 0) {
      setFeaturedTmdbData(null);
      return;
    }
    const activeItem = showcaseItems[activeFeaturedIndex];
    if (!activeItem) return;

    const isSeries = activeItem.type === 'series';
    const cleanTitle = isSeries
      ? parseSeriesEpisodeInfo(activeItem.name).cleanTitle
      : cleanMovieName(activeItem.name);

    const controller = new AbortController();
    const { signal } = controller;

    if (tmdbApiKey) {
      const endpoint = isSeries ? 'tv' : 'movie';
      getResolvedTmdbResult(endpoint, tmdbApiKey, cleanTitle, signal)
        .then(async (result) => {
          if (signal.aborted) return;
          if (result) {
            const backdropPath = await resolveTmdbImageSrc(result.backdrop_path || result.poster_path, 'original', signal);
            const posterPath = result.poster_path && result.poster_path !== result.backdrop_path
              ? await resolveTmdbImageSrc(result.poster_path, 'w500', signal)
              : undefined;
            if (signal.aborted) return;
            setFeaturedTmdbData({
              match: getStableMatchPercentage(cleanTitle),
              rating: result.vote_average ? result.vote_average.toFixed(1) : '7.8',
              year: isSeries
                ? (result.first_air_date ? result.first_air_date.split('-')[0] : '2025')
                : (result.release_date ? result.release_date.split('-')[0] : '2025'),
              desc: result.overview || 'Strmly kütüphanesinden benzersiz bir yapım.',
              backdrop: backdropPath || posterPath || undefined,
              poster: posterPath || undefined
            });
          } else {
            setFeaturedTmdbData({
              match: '92% Eşleşme',
              rating: '7.5',
              year: '2025',
              desc: 'Strmly kütüphanesinden benzersiz bir yapım. Keyifli seyirler dileriz.',
              backdrop: undefined,
              poster: undefined
            });
          }
        })
        .catch((error) => {
          if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
          setFeaturedTmdbData({
            match: '92% Eşleşme',
            rating: '7.5',
            year: '2025',
            desc: 'Strmly kütüphanesinden benzersiz bir yapım. Keyifli seyirler dileriz.',
            backdrop: undefined,
            poster: undefined
          });
        });
    } else {
      setFeaturedTmdbData({
        match: '92% Eşleşme',
        rating: '7.5',
        year: '2025',
        desc: 'Strmly kütüphanesinden benzersiz bir yapım. Keyifli seyirler dileriz.',
        backdrop: undefined,
        poster: undefined
      });
    }

    return () => {
      controller.abort();
    };
  }, [activeFeaturedIndex, showcaseItems, tmdbApiKey]);

  // Memoized popular movies, excluding maintenance/test/backup items
  const populerFilmler = useMemo(() => {
    if (itemBuckets.movie.length === 0) return [];
    const daySeed = new Date().toISOString().slice(0, 10) + '-movies';
    const scoreItem = (item: PlaylistItem) => {
      const seed = `${daySeed}-${item.name}-${item.group || ''}`;
      let score = 0;
      for (let i = 0; i < seed.length; i++) {
        score = (score + seed.charCodeAt(i)) % 997;
      }
      if (activeContentPreferences.includes('kids')) {
        const nLower = getItemNameLower(item);
        const gLower = getItemGroupLower(item, '');
        const text = `${nLower} ${gLower}`;
        if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(keyword => text.includes(keyword))) score += 1200;
      }
      return score;
    };

    const filtered = itemBuckets.movie.filter(item => !isUnavailableCatalogItem(item));

    return filtered
      .map(item => ({ item, score: scoreItem(item) }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .slice(0, 80);
  }, [itemBuckets.movie, activeContentPreferences]);

  // Memoized popular series, excluding maintenance/test/backup items
  const populerDiziler = useMemo(() => {
    if (allGroupedSeries.length === 0) return [];
    const daySeed = new Date().toISOString().slice(0, 10) + '-series';
    const scoreItem = (item: GroupedSeries) => {
      const seed = `${daySeed}-${item.name}-${item.group || ''}`;
      let score = 0;
      for (let i = 0; i < seed.length; i++) {
        score = (score + seed.charCodeAt(i)) % 997;
      }
      if (activeContentPreferences.includes('kids')) {
        const nLower = getItemNameLower(item);
        const gLower = getItemGroupLower(item, '');
        const text = `${nLower} ${gLower}`;
        if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(keyword => text.includes(keyword))) score += 1200;
      }
      return score;
    };

    const filtered = allGroupedSeries.filter(item => !isUnavailableCatalogItem(item));

    return filtered
      .map(item => ({ item, score: scoreItem(item) }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .slice(0, 80);
  }, [allGroupedSeries, activeContentPreferences]);

  const homeDiscoveryItems = useMemo(() => {
    if (itemBuckets.movie.length + allGroupedSeries.length === 0) return [];
    const daySeed = new Date().toISOString().slice(0, 10);
    const scoreItem = (item: PlaylistItem | GroupedSeries) => {
      const seed = `${daySeed}-${item.name}-${item.group || ''}`;
      let score = 0;
      for (let i = 0; i < seed.length; i++) {
        score = (score + seed.charCodeAt(i)) % 997;
      }
      if (activeContentPreferences.includes('series') && item.type === 'series') score += 700;
      if (activeContentPreferences.includes('movies') && item.type === 'movie') score += 700;
      if (activeContentPreferences.includes('kids')) {
        const nLower = getItemNameLower(item);
        const gLower = getItemGroupLower(item, '');
        const text = `${nLower} ${gLower}`;
        if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(keyword => text.includes(keyword))) score += 1000;
      }
      return score;
    };

    const selected: { item: PlaylistItem | GroupedSeries; score: number }[] = [];
    const visitItem = (item: PlaylistItem | GroupedSeries) => {
      if (isUnavailableCatalogItem(item)) return;
      const score = scoreItem(item);
      if (selected.length < 16) {
        selected.push({ item, score });
        selected.sort((a, b) => a.score - b.score);
        return;
      }
      if (score > selected[0].score) {
        selected[0] = { item, score };
        selected.sort((a, b) => a.score - b.score);
      }
    };

    for (let i = 0; i < itemBuckets.movie.length; i++) {
      visitItem(itemBuckets.movie[i]);
    }
    for (let i = 0; i < allGroupedSeries.length; i++) {
      visitItem(allGroupedSeries[i]);
    }

    return selected
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);
  }, [itemBuckets.movie, allGroupedSeries, activeContentPreferences]);

  // Memoized Live TV quick popular Turkish channels
  const homeLiveTvQuickChannels = useMemo(() => {
    const popularPatterns = [
      { match: ['trt 1', 'trt1'] },
      { match: ['atv'] },
      { match: ['star tv', 'star'] },
      { match: ['show tv', 'show'] },
      { match: ['tv8', 'tv 8'] },
      { match: ['kanal d', 'kanald'] },
      { match: ['now tv', 'now', 'fox tv', 'fox'] },
      { match: ['bein sports 1', 'bein sport 1', 'bein 1', 'bein connect 1'] },
      { match: ['bein sports 2', 'bein sport 2', 'bein 2', 'bein connect 2'] },
      { match: ['bein sports 3', 'bein sport 3', 'bein 3', 'bein connect 3'] },
      { match: ['bein sports 4', 'bein sport 4', 'bein 4', 'bein connect 4'] },
      { match: ['s sport 1', 's sport', 'ssport 1', 'ssport'] },
      { match: ['s sport 2', 'ssport 2'] },
      { match: ['trt spor', 'trtspor'] },
      { match: ['a spor', 'aspor'] },
      { match: ['ntv'] },
      { match: ['cnn turk', 'cnnturk'] },
      { match: ['haberturk', 'haber turk'] },
      { match: ['tv8.5', 'tv 8.5', 'tv8,5', 'tv 8,5'] }
    ];

    const selected: PlaylistItem[] = [];

    for (const pattern of popularPatterns) {
      const match = itemBuckets.live.find(channel => {
        const nameLower = channel.name.toLowerCase();
        if (nameLower.includes('yedek') || nameLower.includes('test') || nameLower.includes('bakim')) {
          return false;
        }
        return pattern.match.some(term => {
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
          return regex.test(nameLower) || nameLower === term;
        });
      });

      if (match) {
        selected.push(match);
      }
    }

    if (selected.length < 10) {
      for (const channel of itemBuckets.live) {
        if (selected.length >= 15) break;
        const nameLower = channel.name.toLowerCase();
        if (nameLower.includes('yedek') || nameLower.includes('test') || nameLower.includes('bakim') || nameLower.includes('adult') || nameLower.includes('xxx')) {
          continue;
        }
        if (!selected.some(s => s.id === channel.id)) {
          selected.push(channel);
        }
      }
    }

    const visibleChannels = selected.slice(0, 15);
    if (activeContentPreferences.includes('sports')) {
      const sportsKeywords = ['spor', 'sport', 'bein', 's sport', 'ssport', 'tivibu spor', 'smart spor', 'nba', 'futbol'];
      return [...visibleChannels].sort((a, b) => {
        const aText = `${a.name} ${a.group || ''}`.toLocaleLowerCase('tr-TR');
        const bText = `${b.name} ${b.group || ''}`.toLocaleLowerCase('tr-TR');
        const aSport = sportsKeywords.some(keyword => aText.includes(keyword)) ? 1 : 0;
        const bSport = sportsKeywords.some(keyword => bText.includes(keyword)) ? 1 : 0;
        return bSport - aSport;
      });
    }
    return visibleChannels;
  }, [itemBuckets.live, activeContentPreferences]);

  // Filter recently watched list to keep only the most recent episode of each series, and movies
  const uniqueRecentlyWatched = useMemo(() => {
    const seenSeries = new Set<string>();
    return recentlyWatched.filter(item => {
      if (!item || !item.type || !item.name) return false;
      if (item.type === 'movie') {
        return true;
      }
      if (item.type === 'series') {
        const parsed = parseSeriesEpisodeInfo(item.name);
        const key = `${parsed.cleanTitle}:::${item.group || ''}`;
        if (seenSeries.has(key)) {
          return false;
        }
        seenSeries.add(key);
        return true;
      }
      return false;
    });
  }, [recentlyWatched]);

  return {
    showcaseItems,
    featuredTmdbData,
    activeFeaturedIndex,
    setActiveFeaturedIndex,
    populerFilmler,
    populerDiziler,
    homeDiscoveryItems,
    homeLiveTvQuickChannels,
    uniqueRecentlyWatched
  };
}
