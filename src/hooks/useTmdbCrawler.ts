import { useEffect, useRef } from 'react';
import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import {
  globalSyncPosterMap,
  cleanMovieName,
  getTmdbPosterCacheKey,
  getResolvedTmdbResult,
  resolveTmdbImageSrc,
  tmdbCache,
  TMDB_NO_MATCH,
} from '../utils/tmdb';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';

interface UseTmdbCrawlerProps {
  enabled: boolean;
  loaded: boolean;
  homeReady: boolean;
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
  enabled,
  loaded,
  homeReady,
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
    if (!enabled || window.electronAPI || !loaded || !tmdbApiKey) return;

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
      const cacheKeyPortrait = getTmdbPosterCacheKey(item.itemType, item.cleanTitle, 'portrait');
      return !globalSyncPosterMap.has(`resolved-poster-${cacheKeyPortrait}`);
    });

    if (unfilteredItems.length === 0) return;

    const worker = new Worker(new URL('../utils/tmdbCrawler.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const { type, cleanTitle, itemType, portraitSrc, landscapeSrc } = e.data;
      if (type === 'progress') {
        const cacheKeyPortrait = getTmdbPosterCacheKey(itemType, cleanTitle, 'portrait');
        const cacheKeyLandscape = getTmdbPosterCacheKey(itemType, cleanTitle, 'landscape');
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
  }, [enabled, selectedGroup, activeSeriesCategory, activeMovieCategory, filteredDisplayItems, groupedSeriesList, loaded, tmdbApiKey]);

  // Low-priority background crawler to download and cache ALL movies and series using Web Worker
  useEffect(() => {
    if (!enabled || window.electronAPI || !loaded || !tmdbApiKey) return;

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
        const cacheKeyPortrait = getTmdbPosterCacheKey(item.itemType, item.cleanTitle, 'portrait');
        return !globalSyncPosterMap.has(`resolved-poster-${cacheKeyPortrait}`);
      });

      if (unfilteredItems.length === 0) return;

      worker = new Worker(new URL('../utils/tmdbCrawler.worker.ts', import.meta.url), { type: 'module' });

      worker.onmessage = (e) => {
        const { type, cleanTitle, itemType, portraitSrc, landscapeSrc } = e.data;
        if (type === 'progress') {
          const cacheKeyPortrait = getTmdbPosterCacheKey(itemType, cleanTitle, 'portrait');
          const cacheKeyLandscape = getTmdbPosterCacheKey(itemType, cleanTitle, 'landscape');
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
  }, [enabled, loaded, itemBuckets.movie, allGroupedSeries, tmdbApiKey]);

  // Electron background catalogue warmer. Web Workers cannot use the
  // main-process TMDB bridge on restricted networks, so resolve through the
  // renderer in small idle batches. The first movie/series screens are warmed
  // first; the remaining unique catalogue keeps indexing in the background.
  // Artwork stays in Chromium's HTTP cache — no Strmly image files are made.
  useEffect(() => {
    if (!enabled || !window.electronAPI || !loaded || !homeReady || !tmdbApiKey) return;

    let cancelled = false;
    let timer: number | undefined;

    const toEntry = (item: PlaylistItem | GroupedSeries) => {
      const itemType = item.type === 'series' ? 'series' as const : 'movie' as const;
      const cleanTitle = itemType === 'series'
        ? parseSeriesEpisodeInfo(item.name).cleanTitle
        : cleanMovieName(item.name);
      return {
        cleanTitle,
        itemType,
        endpoint: itemType === 'series' ? 'tv' as const : 'movie' as const,
      };
    };

    // Rails are grouped by category. Walking the raw catalogue deeply warms one
    // category while later visible rows stay cold. Breadth-first ordering takes
    // card 1 from every category, then card 2, matching what the user sees.
    const breadthFirstByGroup = <T extends PlaylistItem | GroupedSeries>(source: T[]) => {
      const groups = new Map<string, T[]>();
      for (const item of source) {
        const key = item.group || 'Genel';
        const group = groups.get(key);
        if (group) group.push(item);
        else groups.set(key, [item]);
      }
      const ordered: T[] = [];
      const rows = Array.from(groups.values());
      const maxDepth = Math.max(0, ...rows.map((row) => row.length));
      for (let depth = 0; depth < maxDepth; depth += 1) {
        for (const row of rows) {
          if (row[depth]) ordered.push(row[depth]);
        }
      }
      return ordered;
    };

    const movies = breadthFirstByGroup(itemBuckets.movie).map(toEntry);
    const series = breadthFirstByGroup(allGroupedSeries).map(toEntry);
    const interleave = <T,>(left: T[], right: T[]) => {
      const result: T[] = [];
      const length = Math.max(left.length, right.length);
      for (let index = 0; index < length; index += 1) {
        if (left[index]) result.push(left[index]);
        if (right[index]) result.push(right[index]);
      }
      return result;
    };
    const selectedFirst = selectedGroup === 'Diziler'
      ? interleave(series, movies)
      : interleave(movies, series);
    const priorityCount = 240;
    const priority = selectedFirst.slice(0, priorityCount);
    const remainder = selectedFirst.slice(priorityCount);
    const seen = new Set<string>();
    const queue = [...priority, ...remainder].filter((item) => {
      const key = `${item.itemType}-${item.cleanTitle.toLocaleLowerCase('tr-TR').trim()}`;
      if (!item.cleanTitle || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const decodePoster = async (src: string) => {
      if (cancelled || !src.startsWith('tmdb-image://')) return;
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = cursor < priority.length ? 'high' : 'low';
      image.src = src;
      try {
        await image.decode();
      } catch {
        // Missing artwork is retried by the visible card path if needed.
      }
    };

    const warmItem = async (item: typeof queue[number]) => {
      if (cancelled) return;
      const cacheKey = getTmdbPosterCacheKey(item.itemType, item.cleanTitle, 'portrait');
      const resolvedKey = `resolved-poster-${cacheKey}`;
      const memoryPoster = globalSyncPosterMap.get(resolvedKey);
      if (memoryPoster === TMDB_NO_MATCH) return;
      if (memoryPoster) {
        await decodePoster(memoryPoster);
        return;
      }

      const cached = await tmdbCache.get(resolvedKey).catch(() => null);
      if (cancelled || cached === TMDB_NO_MATCH) return;
      if (typeof cached === 'string' && cached.startsWith('tmdb-image://')) {
        globalSyncPosterMap.set(resolvedKey, cached);
        await decodePoster(cached);
        return;
      }

      let result;
      try {
        result = await getResolvedTmdbResult(
          item.endpoint,
          tmdbApiKey,
          item.cleanTitle,
        );
      } catch {
        // Authentication, rate-limit and transient network failures are not
        // proof that a title has no TMDB match. Leave it uncached so a later
        // request with a healthy key can recover immediately.
        return;
      }
      if (cancelled) return;
      if (!result) {
        globalSyncPosterMap.set(resolvedKey, TMDB_NO_MATCH);
        await tmdbCache.set(resolvedKey, TMDB_NO_MATCH).catch(() => undefined);
        return;
      }

      const poster = await resolveTmdbImageSrc(result.poster_path, 'w342').catch(() => undefined);
      if (!poster || cancelled) return;
      globalSyncPosterMap.set(resolvedKey, poster);
      await tmdbCache.set(resolvedKey, poster).catch(() => undefined);
      await decodePoster(poster);
    };

    let cursor = 0;
    const runBatch = async () => {
      if (cancelled || cursor >= queue.length) return;
      const batchSize = cursor < priority.length ? 6 : 3;
      const batch = queue.slice(cursor, cursor + batchSize);
      cursor += batch.length;
      await Promise.all(batch.map(warmItem));
      if (cancelled || cursor >= queue.length) return;
      timer = window.setTimeout(runBatch, cursor < priority.length ? 80 : 500);
    };

    // Home first-paint warming owns the network during boot. As soon as that
    // gate opens, begin warming Movies/Series without an arbitrary 5s gap.
    timer = window.setTimeout(runBatch, 250);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [enabled, loaded, homeReady, selectedGroup, itemBuckets.movie, allGroupedSeries, tmdbApiKey]);

  // Clear memory cache of TMDB posters only when the API key actually
  // changes. Clearing on mount wiped every cached poster at boot, forcing
  // every card through the slow resolution path (visible flashing).
  const prevApiKeyRef = useRef(tmdbApiKey);
  useEffect(() => {
    const prev = prevApiKeyRef.current;
    prevApiKeyRef.current = tmdbApiKey;
    if (tmdbApiKey && prev && tmdbApiKey !== prev) {
      globalSyncPosterMap.clear();
    }
  }, [tmdbApiKey]);
}
