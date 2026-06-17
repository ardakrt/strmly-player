import { useEffect } from 'react';
import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { TMDB_CACHE_VERSION } from '../constants';
import {
  tmdbCache,
  globalSyncPosterMap,
  globalPosterPromises,
  cleanMovieName,
  getResolvedTmdbResult,
  resolveTmdbImageSrc
} from '../utils/tmdb';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';

interface UseTmdbCrawlerProps {
  loaded: boolean;
  selectedGroup: string;
  activeSeriesCategory: string;
  activeMovieCategory: string;
  filteredDisplayItems: PlaylistItem[];
  groupedSeriesList: GroupedSeries[];
  itemBuckets: { movie: PlaylistItem[]; series: PlaylistItem[]; live: PlaylistItem[] };
  allGroupedSeries: GroupedSeries[];
  tmdbApiKey: string;
}

export function useTmdbCrawler({
  loaded,
  selectedGroup,
  activeSeriesCategory,
  activeMovieCategory,
  filteredDisplayItems,
  groupedSeriesList,
  itemBuckets,
  allGroupedSeries,
  tmdbApiKey
}: UseTmdbCrawlerProps) {
  // Background pre-fetcher for visible category items to eliminate TMDB load latency
  useEffect(() => {
    if (!loaded) return;

    let isCancelled = false;
    let itemsToPreFetch: { cleanTitle: string; itemType: 'movie' | 'series' }[] = [];

    if (selectedGroup === 'Sinema') {
      const activeMovies = filteredDisplayItems.filter(item => item.type === 'movie');
      itemsToPreFetch = activeMovies.slice(0, 150).map(item => ({
        cleanTitle: cleanMovieName(item.name),
        itemType: 'movie'
      }));
    } else if (selectedGroup === 'Diziler') {
      itemsToPreFetch = groupedSeriesList.slice(0, 150).map(item => ({
        cleanTitle: parseSeriesEpisodeInfo(item.name).cleanTitle,
        itemType: 'series'
      }));
    }

    if (itemsToPreFetch.length === 0) return;

    const apiKey = tmdbApiKey;
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const runPreFetch = async () => {
      const concurrencyLimit = 6;
      for (let i = 0; i < itemsToPreFetch.length; i += concurrencyLimit) {
        if (isCancelled) break;
        const chunk = itemsToPreFetch.slice(i, i + concurrencyLimit);
        const promises = chunk.map(async (item) => {
          if (isCancelled) return;
          const cacheKeyPortrait = `${TMDB_CACHE_VERSION}-${item.itemType}-${item.cleanTitle}-portrait`;
          const cacheKeyLandscape = `${TMDB_CACHE_VERSION}-${item.itemType}-${item.cleanTitle}-landscape`;

          const hasPort = globalSyncPosterMap.has(`resolved-poster-${cacheKeyPortrait}`);
          const hasLand = globalSyncPosterMap.has(`resolved-poster-${cacheKeyLandscape}`);

          if ((!hasPort && !globalPosterPromises[cacheKeyPortrait]) ||
            (!hasLand && !globalPosterPromises[cacheKeyLandscape])) {
            const endpoint = item.itemType === 'series' ? 'tv' : 'movie';

            const preFetchPromise = (async () => {
              if (isCancelled) return null;
              // Check IndexedDB first
              try {
                const port = await tmdbCache.get(`resolved-poster-${cacheKeyPortrait}`);
                const land = await tmdbCache.get(`resolved-poster-${cacheKeyLandscape}`);
                if (isCancelled) return null;
                if (port !== null && land !== null) {
                  globalSyncPosterMap.set(`resolved-poster-${cacheKeyPortrait}`, port);
                  globalSyncPosterMap.set(`resolved-poster-${cacheKeyLandscape}`, land);
                  return port;
                }
              } catch (e) {
                console.error("IndexedDB resolved-poster prefetch read error:", e);
              }

              // Fallback to TMDB API lookup
              try {
                if (isCancelled) return null;
                const result = await getResolvedTmdbResult(endpoint, apiKey, item.cleanTitle);
                if (isCancelled) return null;
                const portraitSrc = (await resolveTmdbImageSrc(result?.poster_path, 'w500')) || '';
                if (isCancelled) return null;
                const landscapeSrc = (await resolveTmdbImageSrc(result?.backdrop_path || result?.poster_path, 'w500')) || '';

                globalSyncPosterMap.set(`resolved-poster-${cacheKeyPortrait}`, portraitSrc);
                globalSyncPosterMap.set(`resolved-poster-${cacheKeyLandscape}`, landscapeSrc);
                // Don't cache app-file:// URLs in IndexedDB — they are install-specific
                if (!portraitSrc.startsWith('app-file://')) {
                  try {
                    await tmdbCache.set(`resolved-poster-${cacheKeyPortrait}`, portraitSrc);
                    await tmdbCache.set(`resolved-poster-${cacheKeyLandscape}`, landscapeSrc);
                  } catch (e) {
                    console.error("IndexedDB resolved-poster prefetch write error:", e);
                  }
                }
                return portraitSrc;
              } catch {
                return null;
              }
            })();

            globalPosterPromises[cacheKeyPortrait] = preFetchPromise;
            globalPosterPromises[cacheKeyLandscape] = preFetchPromise;
            await preFetchPromise;
          }
        });

        await Promise.all(promises);
        await delay(50);
      }
    };

    runPreFetch();

    return () => {
      isCancelled = true;
    };
  }, [selectedGroup, activeSeriesCategory, activeMovieCategory, filteredDisplayItems, groupedSeriesList, loaded, tmdbApiKey]);

  // Low-priority background crawler to download and cache ALL movies and series from TMDB
  useEffect(() => {
    if (!loaded) return;

    let isCancelled = false;

    const runGlobalCrawler = async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Combine movies and series into one big list of items to crawl
      const moviesToCrawl = itemBuckets.movie.slice(0, 20).map(item => ({
        cleanTitle: cleanMovieName(item.name),
        itemType: 'movie' as const,
        endpoint: 'movie' as const
      }));

      const seriesToCrawl = allGroupedSeries.slice(0, 20).map(item => ({
        cleanTitle: parseSeriesEpisodeInfo(item.name).cleanTitle,
        itemType: 'series' as const,
        endpoint: 'tv' as const
      }));

      const allItems = [...moviesToCrawl, ...seriesToCrawl];
      if (allItems.length === 0) return;

      const apiKey = tmdbApiKey;

      for (let i = 0; i < allItems.length; i++) {
        if (isCancelled) break;

        // Yield to the event loop every 10 items
        if (i % 10 === 0) {
          await delay(0);
        }

        const item = allItems[i];
        const cacheKeyPortrait = `${TMDB_CACHE_VERSION}-${item.itemType}-${item.cleanTitle}-portrait`;
        const cacheKeyLandscape = `${TMDB_CACHE_VERSION}-${item.itemType}-${item.cleanTitle}-landscape`;

        // 1. Check memory cache
        const hasPort = globalSyncPosterMap.has(`resolved-poster-${cacheKeyPortrait}`);
        const hasLand = globalSyncPosterMap.has(`resolved-poster-${cacheKeyLandscape}`);
        if (hasPort && hasLand) {
          continue;
        }

        // 2. Check active promises
        if (globalPosterPromises[cacheKeyPortrait] || globalPosterPromises[cacheKeyLandscape]) {
          continue;
        }

        // 3. Not cached: slow-fetch TMDB metadata
        try {
          const preFetchPromise = (async () => {
            try {
              const result = await getResolvedTmdbResult(item.endpoint, apiKey, item.cleanTitle);
              const portraitSrc = (await resolveTmdbImageSrc(result?.poster_path, 'w500')) || '';
              const landscapeSrc = (await resolveTmdbImageSrc(result?.backdrop_path || result?.poster_path, 'w500')) || '';

              globalSyncPosterMap.set(`resolved-poster-${cacheKeyPortrait}`, portraitSrc);
              globalSyncPosterMap.set(`resolved-poster-${cacheKeyLandscape}`, landscapeSrc);

              // Don't cache app-file:// URLs in IndexedDB — they are install-specific
              if (!portraitSrc.startsWith('app-file://')) {
                try {
                  await tmdbCache.set(`resolved-poster-${cacheKeyPortrait}`, portraitSrc);
                  await tmdbCache.set(`resolved-poster-${cacheKeyLandscape}`, landscapeSrc);
                } catch (e) {
                  console.error("Global crawler IndexedDB write error:", e);
                }
              }
              return portraitSrc;
            } catch {
              return null;
            }
          })();

          globalPosterPromises[cacheKeyPortrait] = preFetchPromise;
          globalPosterPromises[cacheKeyLandscape] = preFetchPromise;
          await preFetchPromise;

          // 500ms delay between background TMDB downloads
          await delay(500);
        } catch (e) {
          console.error("Global crawler fetch error:", e);
          await delay(1000);
        }
      }
    };

    // Delay start of global crawling by 30 seconds after boot
    const timer = setTimeout(() => {
      runGlobalCrawler();
    }, 30000);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [loaded, itemBuckets.movie, allGroupedSeries, tmdbApiKey]);
}
