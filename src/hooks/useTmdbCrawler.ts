import { useEffect } from 'react';
import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { TMDB_CACHE_VERSION } from '../constants';
import {
  globalSyncPosterMap,
  cleanMovieName
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
  // Background pre-fetcher for visible category items using Web Worker
  useEffect(() => {
    if (!loaded || !tmdbApiKey) return;

    let itemsToPreFetch: { cleanTitle: string; itemType: 'movie' | 'series'; endpoint: 'tv' | 'movie' }[] = [];

    if (selectedGroup === 'Sinema') {
      const activeMovies = filteredDisplayItems.filter(item => item.type === 'movie');
      itemsToPreFetch = activeMovies.slice(0, 150).map(item => ({
        cleanTitle: cleanMovieName(item.name),
        itemType: 'movie',
        endpoint: 'movie'
      }));
    } else if (selectedGroup === 'Diziler') {
      itemsToPreFetch = groupedSeriesList.slice(0, 150).map(item => ({
        cleanTitle: parseSeriesEpisodeInfo(item.name).cleanTitle,
        itemType: 'series',
        endpoint: 'tv'
      }));
    }

    // Filter out items already in memory cache to prevent redundant work
    const unfilteredItems = itemsToPreFetch.filter(item => {
      const cacheKeyPortrait = `${TMDB_CACHE_VERSION}-${item.itemType}-${item.cleanTitle}-portrait`;
      return !globalSyncPosterMap.has(`resolved-poster-${cacheKeyPortrait}`);
    });

    if (unfilteredItems.length === 0) return;

    const worker = new Worker(new URL('../utils/tmdbCrawler.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const { type, cleanTitle, itemType, portraitSrc, landscapeSrc } = e.data;
      if (type === 'progress') {
        const cacheKeyPortrait = `${TMDB_CACHE_VERSION}-${itemType}-${cleanTitle}-portrait`;
        const cacheKeyLandscape = `${TMDB_CACHE_VERSION}-${itemType}-${cleanTitle}-landscape`;
        if (portraitSrc) {
          globalSyncPosterMap.set(`resolved-poster-${cacheKeyPortrait}`, portraitSrc);
        }
        if (landscapeSrc) {
          globalSyncPosterMap.set(`resolved-poster-${cacheKeyLandscape}`, landscapeSrc);
        }
      }
    };

    worker.postMessage({ items: unfilteredItems, apiKey: tmdbApiKey });

    return () => {
      worker.terminate();
    };
  }, [selectedGroup, activeSeriesCategory, activeMovieCategory, filteredDisplayItems, groupedSeriesList, loaded, tmdbApiKey]);

  // Low-priority background crawler to download and cache ALL movies and series using Web Worker
  useEffect(() => {
    if (!loaded || !tmdbApiKey) return;

    let worker: Worker | null = null;

    const runGlobalCrawler = () => {
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

      const unfilteredItems = allItems.filter(item => {
        const cacheKeyPortrait = `${TMDB_CACHE_VERSION}-${item.itemType}-${item.cleanTitle}-portrait`;
        return !globalSyncPosterMap.has(`resolved-poster-${cacheKeyPortrait}`);
      });

      if (unfilteredItems.length === 0) return;

      worker = new Worker(new URL('../utils/tmdbCrawler.worker.ts', import.meta.url), { type: 'module' });

      worker.onmessage = (e) => {
        const { type, cleanTitle, itemType, portraitSrc, landscapeSrc } = e.data;
        if (type === 'progress') {
          const cacheKeyPortrait = `${TMDB_CACHE_VERSION}-${itemType}-${cleanTitle}-portrait`;
          const cacheKeyLandscape = `${TMDB_CACHE_VERSION}-${itemType}-${cleanTitle}-landscape`;
          if (portraitSrc) {
            globalSyncPosterMap.set(`resolved-poster-${cacheKeyPortrait}`, portraitSrc);
          }
          if (landscapeSrc) {
            globalSyncPosterMap.set(`resolved-poster-${cacheKeyLandscape}`, landscapeSrc);
          }
        }
      };

      worker.postMessage({ items: unfilteredItems, apiKey: tmdbApiKey });
    };

    // Delay start of global crawling by 30 seconds after boot
    const timer = setTimeout(() => {
      runGlobalCrawler();
    }, 30000);

    return () => {
      clearTimeout(timer);
      if (worker) {
        worker.terminate();
      }
    };
  }, [loaded, itemBuckets.movie, allGroupedSeries, tmdbApiKey]);

  // Clear memory cache of TMDB posters when API key changes to trigger retries
  useEffect(() => {
    if (tmdbApiKey) {
      globalSyncPosterMap.clear();
    }
  }, [tmdbApiKey]);
}
