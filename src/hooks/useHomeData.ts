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
  getStableMatchPercentage
} from '../utils/searchHelpers';
import {
  dailyStableScore,
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
  activeContentPreferences
}: UseHomeDataProps) {
  const [showcaseItems, setShowcaseItems] = useState<PlaylistItem[]>([]);
  const [featuredTmdbData, setFeaturedTmdbData] = useState<FeaturedTmdbData | null>(null);
  /** Target slide (user click / auto-rotate). */
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState<number>(0);
  /**
   * Slide currently painted on screen. Only advances when TMDB (+backdrop) for the
   * target index is ready — prevents "flash previous card, then next" on click.
   */
  const [displayFeaturedIndex, setDisplayFeaturedIndex] = useState<number>(0);
  const [isHomeReady, setIsHomeReady] = useState(false);

  const isFirstLoadRef = useRef(true);
  /** In-session cache so hero carousel switches reuse metadata without a blank intermediate frame. */
  const featuredCacheRef = useRef<Map<string, FeaturedTmdbData>>(new Map());
  const featuredRequestGenRef = useRef(0);

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
      setActiveFeaturedIndex(0);
      setDisplayFeaturedIndex(0);
      setFeaturedTmdbData(null);
      setIsHomeReady(true);
      isFirstLoadRef.current = true;
      return;
    }

    let active = true;
    let worker: Worker | null = null;
    if (isFirstLoadRef.current) {
      setIsHomeReady(false);
    }

    const selectShowcaseItems = async () => {
      const getDayOfYear = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now.getTime() - start.getTime();
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
      };

      const SHOWCASE_COUNT = 7;

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
            rating: typeof result.vote_average === 'number' ? result.vote_average : 0.1,
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

        // Fast path only: IndexedDB cache + bare playlist fill. Network enrich blocked home boot.
        const source =
          sortedCandidatesSource.length > 0
            ? sortedCandidatesSource
            : [...itemBuckets.series, ...itemBuckets.movie];
        const candidates = source.slice(0, 300);

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

        // Ensure both types can appear even when TMDB cache is thin.
        if (popularPool.length < SHOWCASE_COUNT
          || !popularPool.some((c) => c.item.type === 'series')
          || !popularPool.some((c) => c.item.type !== 'series')) {
          const bareSeries = source.filter((i) => i.type === 'series');
          const bareMovies = source.filter((i) => i.type !== 'series');
          let bi = 0;
          let bj = 0;
          while (popularPool.length < 40 && (bi < bareSeries.length || bj < bareMovies.length)) {
            const next = bi <= bj
              ? (bi < bareSeries.length ? bareSeries[bi++] : bareMovies[bj++])
              : (bj < bareMovies.length ? bareMovies[bj++] : bareSeries[bi++]);
            if (!next) break;
            const title = getCleanTitle(next);
            if (seenTitles.has(title)) continue;
            seenTitles.add(title);
            popularPool.push({ item: next, rating: 0.1, hasBackdrop: false });
          }
        }

        const finalSelected = selectMixedPopularShowcase(
          popularPool,
          SHOWCASE_COUNT,
          getDayOfYear(),
          activeContentPreferences,
        );

        finishReady(finalSelected.length > 0 ? finalSelected : source.slice(0, SHOWCASE_COUNT));
      } catch (err) {
        console.error('Home showcase selection failed:', err);
        // Last-ditch: never leave the app gated on isHomeReady.
        const fallback = [...itemBuckets.series.slice(0, 4), ...itemBuckets.movie.slice(0, 4)].slice(0, 7);
        finishReady(fallback);
      }
    };

    selectShowcaseItems();

    return () => {
      active = false;
      if (worker) {
        worker.terminate();
      }
    };
  }, [items, itemBuckets, tmdbApiKey, activeContentPreferences]);

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
    const fallbackFeatured = (title = cleanTitle): FeaturedTmdbData => ({
      match: getStableMatchPercentage(title, activeContentPreferences, isSeries ? 'series' : 'movie'),
      rating: '',
      year: '',
      desc: '',
      backdrop: undefined,
      poster: undefined
    });

    const buildFeaturedFromTmdb = async (
      endpoint: 'tv' | 'movie',
      title: string,
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
        match: getStableMatchPercentage(title, activeContentPreferences, series ? 'series' : 'movie'),
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
          const data = await buildFeaturedFromTmdb(endpoint, cleanTitle, isSeries, result, signal);
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
          const data = await buildFeaturedFromTmdb(endpoint, title, series, result, fetchController.signal);
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
    populerFilmler,
    populerDiziler,
    homeDiscoveryItems,
    homeLiveTvQuickChannels,
    uniqueRecentlyWatched,
    isHomeReady
  };
}
