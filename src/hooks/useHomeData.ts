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
  resolveTmdbImageSrc,
  fetchTmdbDetails,
  getTmdbLanguage,
  resolveTmdbOverview,
  isMissingTmdbOverview,
} from '../utils/tmdb';
import {
  getItemNameLower,
  getItemGroupLower,
  isUnavailableCatalogItem,
} from '../utils/searchHelpers';
import {
  dailyStableScore,
  getLocalCalendarDaySeed,
  getTmdbShowcaseScore,
  takeTopByScore,
  selectMixedPopularShowcase,
  type PopularShowcaseCandidate,
} from '../utils/catalogFilters';
import { isSloganLikeBlurb, pickHeroSynopsis } from '../utils/helpers';

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
  globalFavorites?: string[];
}

export interface FeaturedTmdbData {
  match: string;
  rating: string;
  year: string;
  /** Short billboard blurb (tagline or clipped overview) — never the full synopsis. */
  desc: string;
  backdrop?: string;
  poster?: string;
  logo?: string;
  duration?: string;
  genres?: string[];
}

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

  const getFeaturedCacheKey = (item: PlaylistItem) => {
    const isSeries = item.type === 'series';
    const cleanTitle = isSeries
      ? parseSeriesEpisodeInfo(item.name).cleanTitle
      : cleanMovieName(item.name);
    return `${item.url || item.name}|${item.type}|${cleanTitle}`;
  };

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
        setShowcaseItems(selected);
        setActiveFeaturedIndex(0);
        setDisplayFeaturedIndex(0);
        setFeaturedTmdbData(null);
        setIsHomeReady(true);
        isFirstLoadRef.current = false;
      };

      try {
        const toPopularCandidate = (
          item: PlaylistItem,
          result: any | null,
        ): PopularShowcaseCandidate | null => {
          if (!result) return null;
          const hasArt = !!(result.backdrop_path || result.poster_path);
          if (!hasArt) return null;
          return {
            item,
            rating: typeof result.vote_average === 'number' ? result.vote_average : 0,
            popularity: typeof result.popularity === 'number' ? result.popularity : undefined,
            voteCount: typeof result.vote_count === 'number' ? result.vote_count : undefined,
            hasBackdrop: !!result.backdrop_path,
          };
        };

        const getCleanTitle = (item: PlaylistItem) => {
          const isSeries = item.type === 'series';
          return isSeries
            ? parseSeriesEpisodeInfo(item.name).cleanTitle.toLowerCase().trim()
            : cleanMovieName(item.name).toLowerCase().trim();
        };

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

        const source =
          sortedCandidatesSource.length > 0
            ? sortedCandidatesSource
            : [...itemBuckets.series, ...itemBuckets.movie];
        const uniqueByTitle = (list: PlaylistItem[], limit: number) => {
          const seen = new Set<string>();
          const unique: PlaylistItem[] = [];
          for (const item of list) {
            const title = getCleanTitle(item);
            if (!title || seen.has(title)) continue;
            seen.add(title);
            unique.push(item);
            if (unique.length >= limit) break;
          }
          return unique;
        };
        const seriesCandidates = uniqueByTitle(
          source.filter((item) => item.type === 'series'),
          CACHE_CANDIDATES_PER_TYPE,
        );
        const movieCandidates = uniqueByTitle(
          source.filter((item) => item.type !== 'series'),
          CACHE_CANDIDATES_PER_TYPE,
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
              return toPopularCandidate(item, bestResult);
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
                return toPopularCandidate(item, result);
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
          showcaseDaySeed,
          activeContentPreferences,
        );

        const rankTmdbCandidates = (isSeries: boolean) =>
          popularPool
            .filter((candidate) =>
              isSeries ? candidate.item.type === 'series' : candidate.item.type !== 'series'
            )
            .toSorted((a, b) =>
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

    /** No TMDB match / API key — never invent marketing copy for the synopsis. */
    const fallbackFeatured = (): FeaturedTmdbData => ({
      match: '',
      rating: '',
      year: '',
      desc: '',
      backdrop: undefined,
      poster: undefined
    });

    const buildFeaturedFromTmdb = async (
      endpoint: 'tv' | 'movie',
      series: boolean,
      result: any,
      signal: AbortSignal,
    ): Promise<FeaturedTmdbData> => {
      const backdropPath = await resolveTmdbImageSrc(result.backdrop_path || result.poster_path, 'original', signal);
      const posterPath = result.poster_path && result.poster_path !== result.backdrop_path
        ? await resolveTmdbImageSrc(result.poster_path, 'w500', signal)
        : undefined;

      let logoUrl: string | undefined;
      let duration: string | undefined;
      let genres: string[] = [];
      let detailsOverview: string | undefined;
      let detailsTagline: string | undefined;

      try {
        const details: any = await fetchTmdbDetails(endpoint, tmdbApiKey, result.id, signal);
        if (details && !details.error) {
          detailsOverview = details.overview;
          detailsTagline = typeof details.tagline === 'string' ? details.tagline : undefined;
          if (details.images?.logos?.length) {
            const logos = details.images.logos;
            const bestLogo = logos.find((l: any) => l.iso_639_1 === 'tr')
              || logos.find((l: any) => l.iso_639_1 === 'en')
              || logos[0];
            if (bestLogo) {
              logoUrl = await resolveTmdbImageSrc(bestLogo.file_path, 'w500', signal);
            }
          }
          if (details.genres) {
            genres = details.genres.slice(0, 2).map((g: any) => g.name);
          }
          if (series && details.number_of_seasons) {
            duration = `${details.number_of_seasons} ${isTrUi ? 'Sezon' : 'Seasons'}`;
          } else if (!series && details.runtime) {
            const hrs = Math.floor(details.runtime / 60);
            const mins = details.runtime % 60;
            duration = hrs > 0
              ? (mins > 0 ? `${hrs}sa ${mins}dk` : `${hrs}sa`)
              : `${mins}dk`;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch TMDB featured details:', err);
      }

      // Full synopsis from TMDB (tr → en). Used only as source for a short billboard cut.
      const overview = await resolveTmdbOverview(
        endpoint,
        tmdbApiKey,
        result.id,
        [detailsOverview, result.overview],
        signal,
      );

      // Prefer tagline when missing in UI language — try EN details tagline.
      let tagline = detailsTagline?.trim() || '';
      if (!tagline && getTmdbLanguage() !== 'en-US') {
        try {
          const enDetails: any = await fetchTmdbDetails(endpoint, tmdbApiKey, result.id, signal, 'en-US');
          if (enDetails && !enDetails.error && typeof enDetails.tagline === 'string') {
            tagline = enDetails.tagline.trim();
          }
        } catch {
          /* optional */
        }
      }

      // Max-style teaser: full-sentence overview blurb (not a 3-word tagline slogan).
      const shortDesc = pickHeroSynopsis({ tagline, overview, maxLen: 190 });

      return {
        match: '',
        rating: result.vote_average ? result.vote_average.toFixed(1) : '',
        year: series
          ? (result.first_air_date ? result.first_air_date.split('-')[0] : '')
          : (result.release_date ? result.release_date.split('-')[0] : ''),
        desc: shortDesc,
        backdrop: backdropPath || posterPath || undefined,
        poster: posterPath || undefined,
        logo: logoUrl || undefined,
        duration: duration || undefined,
        genres: genres.length > 0 ? genres : undefined
      };
    };

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
    if (itemBuckets.movie.length === 0) return [];
    const daySeed = new Date().toISOString().slice(0, 10) + '-movies';
    const kids = activeContentPreferences.includes('kids');
    const candidates = itemBuckets.movie.filter(item => !isUnavailableCatalogItem(item));
    return takeTopByScore(
      candidates,
      (item) => {
        let score = dailyStableScore(`${daySeed}-${item.name}-${item.group || ''}`);
        if (kids) {
          const text = `${getItemNameLower(item)} ${getItemGroupLower(item, '')}`;
          if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(k => text.includes(k))) {
            score += 1200;
          }
        }
        return score;
      },
      80,
    );
  }, [itemBuckets.movie, activeContentPreferences]);

  // Memoized popular series — same top-K path as movies
  const populerDiziler = useMemo(() => {
    if (allGroupedSeries.length === 0) return [];
    const daySeed = new Date().toISOString().slice(0, 10) + '-series';
    const kids = activeContentPreferences.includes('kids');
    const candidates = allGroupedSeries.filter(item => !isUnavailableCatalogItem(item));
    return takeTopByScore(
      candidates,
      (item) => {
        let score = dailyStableScore(`${daySeed}-${item.name}-${item.group || ''}`);
        if (kids) {
          const text = `${getItemNameLower(item)} ${getItemGroupLower(item, '')}`;
          if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(k => text.includes(k))) {
            score += 1200;
          }
        }
        return score;
      },
      80,
    );
  }, [allGroupedSeries, activeContentPreferences]);

  const homeDiscoveryItems = useMemo(() => {
    if (itemBuckets.movie.length + allGroupedSeries.length === 0) return [];

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

    const movieCandidates = itemBuckets.movie.filter(item =>
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
  }, [
    items,
    itemBuckets.movie,
    allGroupedSeries,
    recentlyWatched,
    globalFavorites,
    activeContentPreferences,
    showcaseDaySeed,
  ]);

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
      return visibleChannels.toSorted((a, b) => {
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
  // If an episode/movie is finished (progress > 90%):
  // - For movies: remove it
  // - For series: show next episode (with progress = 0), or remove if no next episode
  const uniqueRecentlyWatched = useMemo(() => {
    const seenSeries = new Set<string>();
    const mapped = recentlyWatched.map((item) => {
      if (!item) return null;
      const rawName = String(item.name || '').trim();
      if (!rawName) return null;

      // Some older history entries may miss type — infer series from episode pattern
      let type = item.type;
      if (type !== 'movie' && type !== 'series' && type !== 'live') {
        const looksLikeEpisode =
          /s\s*\d+\s*e\s*\d+/i.test(rawName) ||
          /\d+\s*\.?\s*sezon/i.test(rawName) ||
          /\d+\s*\.?\s*bölüm/i.test(rawName);
        type = looksLikeEpisode ? 'series' : 'movie';
      }

      const progress = item.progress ?? 0;
      const isFinished = progress > 90;
      const baseItem: PlaylistItem = { ...item, name: rawName, type };

      if (type === 'movie') {
        if (isFinished) return null;
        return baseItem;
      }

      if (type === 'series') {
        const parsed = parseSeriesEpisodeInfo(rawName);
        const seriesKeyName = (parsed.cleanTitle || rawName).trim() || rawName;
        const key = `${seriesKeyName.toLowerCase()}:::${item.group || ''}`;
        if (seenSeries.has(key)) return null;
        seenSeries.add(key);

        const titleKey = seriesKeyName.toLowerCase();
        const grouped =
          allGroupedSeries.find(
            (series) =>
              series.name === seriesKeyName &&
              (series.group || 'Genel') === (item.group || 'Genel'),
          ) ||
          allGroupedSeries.find(
            (series) =>
              (parseSeriesEpisodeInfo(series.name).cleanTitle || series.name)
                .toLowerCase() === titleKey,
          );

        const resolveLogo = (base: PlaylistItem): PlaylistItem => {
          const hasLogo = Boolean(
            base.logo && String(base.logo).trim() && !base.isGenericLogo,
          );
          if (hasLogo) return base;
          const seriesLogo =
            grouped?.logo && String(grouped.logo).trim()
              ? grouped.logo
              : undefined;
          if (!seriesLogo) return base;
          return { ...base, logo: seriesLogo, isGenericLogo: false };
        };

        if (isFinished) {
          if (grouped) {
            const allEpisodes: {
              episodeNumber: number;
              seasonNumber: number;
              item: PlaylistItem;
            }[] = [];
            for (const sNoStr in grouped.seasons) {
              const sNo = parseInt(sNoStr, 10);
              allEpisodes.push(...grouped.seasons[sNo]);
            }
            allEpisodes.sort((a, b) => {
              if (a.seasonNumber !== b.seasonNumber) {
                return a.seasonNumber - b.seasonNumber;
              }
              return a.episodeNumber - b.episodeNumber;
            });

            const currentIndex = allEpisodes.findIndex(
              (ep) =>
                ep.seasonNumber === parsed.season &&
                ep.episodeNumber === parsed.episode,
            );

            if (currentIndex !== -1 && currentIndex < allEpisodes.length - 1) {
              const nextEp = allEpisodes[currentIndex + 1].item;
              return resolveLogo({
                ...nextEp,
                currentTime: undefined,
                duration: undefined,
                progress: undefined,
              });
            }
          }
          return null;
        }

        return resolveLogo(baseItem);
      }

      return null;
    });

    return mapped.filter((item): item is PlaylistItem => item !== null);
  }, [recentlyWatched, allGroupedSeries]);

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
    isHomeReady
  };
}
