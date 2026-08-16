import { useState, useEffect, useMemo, useRef } from 'react';
import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import {
  tmdbCache,
  selectBestTmdbResult,
  cleanMovieName,
  buildTmdbSearchPath,
  getResolvedTmdbResult,
  getTmdbLanguage,
  isMissingTmdbOverview,
} from '../utils/tmdb';
import {
  getLocalCalendarDaySeed,
  getTmdbShowcaseScore,
  selectMixedPopularShowcase,
  type PopularShowcaseCandidate,
} from '../utils/catalogFilters';
import { isSloganLikeBlurb } from '../utils/helpers';
import {
  getFeaturedCacheKey,
  getHomeItemCleanTitle,
  selectPopularMovies,
  selectPopularSeries,
  selectQuickLiveChannels,
  selectUniqueRecentlyWatched,
  sampleUniqueHomeCandidates,
  toPopularShowcaseCandidate,
} from './homeDataSelectors';
import { selectHomeDiscoveryItems } from './homeDiscoverySelector';
import { buildFeaturedTmdbData, createEmptyFeaturedMetadata } from './homeFeaturedMetadata';
import type { FeaturedTmdbData, UseHomeDataProps } from './homeDataTypes';
export type { FeaturedTmdbData } from './homeDataTypes';

export function useHomeData({
  items,
  itemBuckets,
  allGroupedSeries,
  recentlyWatched,
  tmdbApiKey,
  activeContentPreferences,
  globalFavorites = [],
}: UseHomeDataProps) {
  const [showcaseItems, setShowcaseItems] = useState<PlaylistItem[]>([]);
  const [top10Movies, setTop10Movies] = useState<PlaylistItem[]>([]);
  const [top10Series, setTop10Series] = useState<Array<PlaylistItem | GroupedSeries>>([]);
  const [featuredTmdbData, setFeaturedTmdbData] = useState<FeaturedTmdbData | null>(null);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState<number>(0);
  /**
   * Slide currently painted on screen. Only advances when TMDB (+backdrop) for the
   * target index is ready — prevents "flash previous card, then next" on click.
   */
  const [displayFeaturedIndex, setDisplayFeaturedIndex] = useState<number>(0);
  const [isHomeReady, setIsHomeReady] = useState(false);
  const [showcaseDaySeed, setShowcaseDaySeed] = useState(() => getLocalCalendarDaySeed());
  const sessionSeedRef = useRef<number>(Math.floor(Date.now() / 1800000) ^ Math.floor(Math.random() * 100000));

  const isFirstLoadRef = useRef(true);
  /** In-session cache so hero carousel switches reuse metadata without a blank intermediate frame. */
  const featuredCacheRef = useRef<Map<string, FeaturedTmdbData>>(new Map());
  const featuredRequestGenRef = useRef(0);

  // Refresh the daily slate at local midnight even when Strmly stays open overnight.
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeout = window.setTimeout(
      () => setShowcaseDaySeed(getLocalCalendarDaySeed()),
      Math.max(1_000, nextMidnight.getTime() - now.getTime() + 250),
    );
    return () => window.clearTimeout(timeout);
  }, [showcaseDaySeed]);

  // Select highly-rated VOD items (movies/series) for Hero Showcase Carousel from cache/network
  useEffect(() => {
    if (items.length === 0) {
      setShowcaseItems([]);
      setTop10Movies([]);
      setTop10Series([]);
      setActiveFeaturedIndex(0);
      setDisplayFeaturedIndex(0);
      setFeaturedTmdbData(null);
      setIsHomeReady(true);
      isFirstLoadRef.current = true;
      return;
    }

    let active = true;
    let worker: Worker | null = null;
    const selectionController = new AbortController();

    // Safety failsafe: never let home initialization hang the splash screen forever.
    const safetyTimeout = window.setTimeout(() => {
      if (active && isFirstLoadRef.current) {
        setIsHomeReady(true);
        isFirstLoadRef.current = false;
      }
    }, 2500);

    if (isFirstLoadRef.current) {
      setIsHomeReady(false);
    }

    const selectShowcaseItems = async () => {
      const SHOWCASE_COUNT = 7;
      const CACHE_CANDIDATES_PER_TYPE = 120;
      const NETWORK_TARGET_PER_TYPE = 18;
      const NETWORK_CANDIDATES_PER_TYPE = 36;

      const finishReady = (selected: PlaylistItem[]) => {
        if (!active) return;
        window.clearTimeout(safetyTimeout);
        setShowcaseItems(selected);
        setActiveFeaturedIndex(0);
        setDisplayFeaturedIndex(0);
        setFeaturedTmdbData(null);
        setIsHomeReady(true);
        isFirstLoadRef.current = false;
      };

      try {
        const getCleanTitle = getHomeItemCleanTitle;

        // Worker with timeout — never block app boot if the worker stalls.
        const sortedCandidatesSource = await new Promise<PlaylistItem[]>((resolve) => {
          let settled = false;
          const done = (list: PlaylistItem[]) => {
            if (settled) return;
            settled = true;
            resolve(list);
          };
          const timeout = window.setTimeout(() => done([]), 8000);
          try {
            worker = new Worker(new URL('../utils/search.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (e) => {
              if (e.data.action === 'home_candidates_results') {
                window.clearTimeout(timeout);
                done(e.data.candidates || []);
              }
            };
            worker.onerror = () => {
              window.clearTimeout(timeout);
              done([]);
            };
            worker.postMessage({
              action: 'get_home_candidates',
              items,
              itemBuckets,
              activeContentPreferences
            });
          } catch (err) {
            console.error("Failed to initialize home candidates worker:", err);
            window.clearTimeout(timeout);
            done([]);
          }
        });

        if (!active) {
          if (worker) worker.terminate();
          return;
        }

        if (worker) {
          worker.terminate();
          worker = null;
        }

        const activeSeed = showcaseDaySeed ^ sessionSeedRef.current ^ Math.floor(Date.now() / 1000) ^ Math.floor(Math.random() * 100000);

        const source =
          sortedCandidatesSource.length > 0
            ? sortedCandidatesSource
            : [...itemBuckets.series, ...itemBuckets.movie];

        const seriesCandidates = sampleUniqueHomeCandidates(
          source.filter((item) => item.type === 'series'),
          CACHE_CANDIDATES_PER_TYPE,
          activeSeed,
        );
        const movieCandidates = sampleUniqueHomeCandidates(
          source.filter((item) => item.type !== 'series'),
          CACHE_CANDIDATES_PER_TYPE,
          activeSeed ^ 0x9e3779b9,
        );
        const candidates = [...seriesCandidates, ...movieCandidates];

        const cacheCheckPromises = candidates.map(async (item) => {
          const isSeries = item.type === 'series';
          const cleanTitle = isSeries
            ? parseSeriesEpisodeInfo(item.name).cleanTitle
            : cleanMovieName(item.name);
          const endpoint = isSeries ? 'tv' : 'movie';

          try {
            const fullPath = buildTmdbSearchPath(endpoint, 'tmdb_cache_key', cleanTitle);
            const cleanCachePath = fullPath.replace(/[?&]api_key=[^&]+/, '');
            const cacheKey = `api-${cleanCachePath}`;
            const cachedData = await tmdbCache.get(cacheKey);
            const cachedValue = cachedData?.value ?? cachedData;
            if (cachedValue?.results) {
              const bestResult = selectBestTmdbResult(cachedValue.results, cleanTitle);
              return toPopularShowcaseCandidate(item, bestResult);
            }
          } catch (e) {
            console.error("Showcase cache check error:", e);
          }
          return null;
        });

        const cachedCheckResults = await Promise.all(cacheCheckPromises);
        if (!active) return;

        const seenTitles = new Set<string>();
        const popularPool: PopularShowcaseCandidate[] = [];

        for (let i = 0; i < candidates.length; i++) {
          const res = cachedCheckResults[i];
          if (!res) continue;
          const title = getCleanTitle(res.item);
          if (seenTitles.has(title)) continue;
          seenTitles.add(title);
          popularPool.push(res);
        }

        // A cache miss is not a ranking signal. Enrich a bounded, balanced pool
        // from TMDB and stop as soon as each available type has a useful tier.
        const enrichFromTmdb = async (typeCandidates: PlaylistItem[], isSeries: boolean) => {
          if (!tmdbApiKey) return;
          const endpoint = isSeries ? 'tv' : 'movie';
          const currentCount = () =>
            popularPool.filter((candidate) =>
              isSeries ? candidate.item.type === 'series' : candidate.item.type !== 'series'
            ).length;
          const unresolved = typeCandidates
            .filter((item) => !seenTitles.has(getCleanTitle(item)))
            .slice(0, NETWORK_CANDIDATES_PER_TYPE);

          const BATCH_SIZE = 6;
          for (let index = 0; index < unresolved.length; index += BATCH_SIZE) {
            if (!active || selectionController.signal.aborted) return;
            if (currentCount() >= NETWORK_TARGET_PER_TYPE) return;
            const batch = unresolved.slice(index, index + BATCH_SIZE);
            const resolved = await Promise.all(batch.map(async (item) => {
              const cleanTitle = isSeries
                ? parseSeriesEpisodeInfo(item.name).cleanTitle
                : cleanMovieName(item.name);
              try {
                const result = await getResolvedTmdbResult(
                  endpoint,
                  tmdbApiKey,
                  cleanTitle,
                  selectionController.signal,
                );
                return toPopularShowcaseCandidate(item, result);
              } catch (error) {
                if ((error as Error)?.name !== 'AbortError') {
                  console.warn(`TMDB showcase lookup skipped for "${cleanTitle}"`);
                }
                return null;
              }
            }));

            for (const candidate of resolved) {
              if (!candidate) continue;
              const title = getCleanTitle(candidate.item);
              if (seenTitles.has(title)) continue;
              seenTitles.add(title);
              popularPool.push(candidate);
            }
          }
        };

        await Promise.all([
          enrichFromTmdb(seriesCandidates, true),
          enrichFromTmdb(movieCandidates, false),
        ]);
        if (!active) return;

        const finalSelected = selectMixedPopularShowcase(
          popularPool,
          SHOWCASE_COUNT,
          activeSeed,
          activeContentPreferences,
        );

        const rankTmdbCandidates = (isSeries: boolean) =>
          [...popularPool]
            .filter((candidate) =>
              isSeries ? candidate.item.type === 'series' : candidate.item.type !== 'series'
            )
            .sort((a, b) =>
              getTmdbShowcaseScore(b) - getTmdbShowcaseScore(a)
              || a.item.name.localeCompare(b.item.name, 'tr')
            )
            .slice(0, 10);

        const groupedSeriesByTitle = new Map(
          allGroupedSeries.map((series) => [
            parseSeriesEpisodeInfo(series.name).cleanTitle.toLocaleLowerCase('tr-TR').trim(),
            series,
          ]),
        );
        const rankedSeries = rankTmdbCandidates(true).map(({ item }) =>
          groupedSeriesByTitle.get(getCleanTitle(item)) || item
        );

        setTop10Movies(rankTmdbCandidates(false).map(({ item }) => item));
        setTop10Series(rankedSeries);

        finishReady(finalSelected);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        console.error('Home showcase selection failed:', err);
        // Never attach a fabricated TMDB rank; the static hero bank remains available.
        setTop10Movies([]);
        setTop10Series([]);
        finishReady([]);
      }
    };

    selectShowcaseItems();

    return () => {
      active = false;
      window.clearTimeout(safetyTimeout);
      selectionController.abort();
      if (worker) {
        worker.terminate();
      }
    };
  }, [items, itemBuckets, allGroupedSeries, tmdbApiKey, activeContentPreferences, showcaseDaySeed]);

  // Resolve TMDB for the *target* slide; only paint when ready (keeps previous hero until then).
  useEffect(() => {
    // Static fallback hero bank — no async metadata; display tracks target immediately.
    if (showcaseItems.length === 0) {
      setFeaturedTmdbData(null);
      setDisplayFeaturedIndex(activeFeaturedIndex);
      return;
    }

    const targetIndex =
      ((activeFeaturedIndex % showcaseItems.length) + showcaseItems.length) % showcaseItems.length;
    const activeItem = showcaseItems[targetIndex];
    if (!activeItem) return;

    // Already painting this slide with committed data — still warm neighbors.
    // (Re-fetch not needed; cache + display stay put.)

    const isSeries = activeItem.type === 'series';
    const cleanTitle = isSeries
      ? parseSeriesEpisodeInfo(activeItem.name).cleanTitle
      : cleanMovieName(activeItem.name);
    const cacheKey = getFeaturedCacheKey(activeItem);
    const requestGen = ++featuredRequestGenRef.current;
    let cancelled = false;
    const fetchController = new AbortController();

    const isCurrent = () => !cancelled && featuredRequestGenRef.current === requestGen;

    const commit = (data: FeaturedTmdbData) => {
      if (!isCurrent()) return;
      featuredCacheRef.current.set(cacheKey, data);
      // Atomic paint: metadata + which item is on screen change together.
      setFeaturedTmdbData(data);
      setDisplayFeaturedIndex(targetIndex);
    };

    const commitWhenImageReady = (data: FeaturedTmdbData) => {
      if (!isCurrent()) return;
      featuredCacheRef.current.set(cacheKey, data);
      if (!data.backdrop) {
        commit(data);
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled || !isCurrent()) return;
        settled = true;
        commit(data);
      };
      const img = new Image();
      img.onload = finish;
      img.onerror = finish;
      img.src = data.backdrop;
      if (img.complete) finish();
    };

    const isTrUi = activeContentPreferences.includes('tr') || getTmdbLanguage() === 'tr-TR';

    const fallbackFeatured = createEmptyFeaturedMetadata;
    const buildFeaturedFromTmdb = (
      endpoint: 'tv' | 'movie',
      series: boolean,
      result: any,
      signal: AbortSignal,
    ) => buildFeaturedTmdbData({
      endpoint,
      series,
      result,
      signal,
      tmdbApiKey,
      isTrUi,
    });
    const cached = featuredCacheRef.current.get(cacheKey);
    // Re-resolve: missing, placeholder, full novel, or old slogan-only blurbs ("You can't unsee it.").
    const cacheLooksStale =
      !cached ||
      isMissingTmdbOverview(cached.desc) ||
      isSloganLikeBlurb(cached.desc || '') ||
      (cached.desc?.length ?? 0) > 220;
    if (cached && !cacheLooksStale) {
      commitWhenImageReady(cached);
    } else if (!tmdbApiKey) {
      commitWhenImageReady(fallbackFeatured());
    } else {
      const { signal } = fetchController;
      const endpoint = isSeries ? 'tv' : 'movie';

      getResolvedTmdbResult(endpoint, tmdbApiKey, cleanTitle, signal)
        .then(async (result) => {
          if (!isCurrent() || signal.aborted) return;
          if (!result) {
            commitWhenImageReady(fallbackFeatured());
            return;
          }
          const data = await buildFeaturedFromTmdb(endpoint, isSeries, result, signal);
          if (!isCurrent() || signal.aborted) return;
          commitWhenImageReady(data);
        })
        .catch((error) => {
          if (!isCurrent() || signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
          commitWhenImageReady(fallbackFeatured());
        });
    }

    // Prefetch neighbors into cache so the next click paints immediately.
    const warmNeighbor = (offset: number) => {
      if (!tmdbApiKey || showcaseItems.length < 2) return;
      const n =
        ((targetIndex + offset) % showcaseItems.length + showcaseItems.length) % showcaseItems.length;
      const item = showcaseItems[n];
      if (!item) return;
      const key = getFeaturedCacheKey(item);
      const existing = featuredCacheRef.current.get(key);
      if (
        existing &&
        !isMissingTmdbOverview(existing.desc) &&
        !isSloganLikeBlurb(existing.desc || '') &&
        (existing.desc?.length ?? 0) <= 220
      ) {
        if (existing.backdrop) {
          const warmImg = new Image();
          warmImg.src = existing.backdrop;
        }
        return;
      }
      const series = item.type === 'series';
      const title = series
        ? parseSeriesEpisodeInfo(item.name).cleanTitle
        : cleanMovieName(item.name);
      const endpoint = series ? 'tv' : 'movie';
      getResolvedTmdbResult(endpoint, tmdbApiKey, title, fetchController.signal)
        .then(async (result) => {
          if (!result || fetchController.signal.aborted) return;
          const data = await buildFeaturedFromTmdb(endpoint, series, result, fetchController.signal);
          if (fetchController.signal.aborted) return;
          featuredCacheRef.current.set(key, data);
          if (data.backdrop) {
            const warmImg = new Image();
            warmImg.src = data.backdrop;
          }
        })
        .catch(() => { /* ignore warm failures */ });
    };
    warmNeighbor(1);
    warmNeighbor(-1);

    return () => {
      cancelled = true;
      fetchController.abort();
    };
  }, [activeFeaturedIndex, showcaseItems, tmdbApiKey, activeContentPreferences]);

  // Memoized popular movies — top-80 by daily score without full N log-sort when N >> 80
  const populerFilmler = useMemo(() => {
    return selectPopularMovies(itemBuckets.movie, activeContentPreferences);
  }, [itemBuckets.movie, activeContentPreferences]);

  // Memoized popular series — same top-K path as movies
  const populerDiziler = useMemo(() => {
    return selectPopularSeries(allGroupedSeries, activeContentPreferences);
  }, [allGroupedSeries, activeContentPreferences]);

  const homeDiscoveryItems = useMemo(
    () => selectHomeDiscoveryItems({
      items,
      movies: itemBuckets.movie,
      groupedSeries: allGroupedSeries,
      recentlyWatched,
      globalFavorites,
      activeContentPreferences,
      showcaseDaySeed,
    }),
    [
      items,
      itemBuckets.movie,
      allGroupedSeries,
      recentlyWatched,
      globalFavorites,
      activeContentPreferences,
      showcaseDaySeed,
    ],
  );
  // Memoized Live TV quick popular Turkish channels
  const homeLiveTvQuickChannels = useMemo(
    () => selectQuickLiveChannels(itemBuckets.live, activeContentPreferences),
    [itemBuckets.live, activeContentPreferences],
  );
  // Filter recently watched list to keep only the most recent episode of each series, and movies
  // If an episode/movie is finished (progress > 90%):
  // - For movies: remove it
  // - For series: show next episode (with progress = 0), or remove if no next episode
  const uniqueRecentlyWatched = useMemo(
    () => selectUniqueRecentlyWatched(recentlyWatched, allGroupedSeries),
    [recentlyWatched, allGroupedSeries],
  );
  return {
    showcaseItems,
    featuredTmdbData,
    activeFeaturedIndex,
    displayFeaturedIndex,
    setActiveFeaturedIndex,
    top10Movies,
    top10Series,
    populerFilmler,
    populerDiziler,
    homeDiscoveryItems,
    homeLiveTvQuickChannels,
    uniqueRecentlyWatched,
    isHomeReady,
  };
}
