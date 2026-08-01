import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import {
  cleanMovieName,
  getTmdbApiKey,
  tmdbCache,
  globalSyncPosterMap,
  getResolvedTmdbResult,
  getTmdbPosterCacheKey,
  resolveTmdbImageSrc,
} from '../utils/tmdb';
import type { ImageWithFallbackProps } from '../types';
import { TitleLogoPlate } from './TitleLogoPlate';
import { useSettings } from '../context/SettingsContext';

const TMDB_TIMEOUT_MS = 3200;

const lazyVisibilityCallbacks = new Map<Element, () => void>();
let lazyVisibilityObserver: IntersectionObserver | null = null;

const observeLazyVisibility = (element: Element, onVisible: () => void) => {
  if (typeof IntersectionObserver === 'undefined') {
    onVisible();
    return () => {};
  }

  if (!lazyVisibilityObserver) {
    lazyVisibilityObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = lazyVisibilityCallbacks.get(entry.target);
        if (!callback) continue;
        lazyVisibilityCallbacks.delete(entry.target);
        lazyVisibilityObserver?.unobserve(entry.target);
        callback();
      }
    }, { rootMargin: '320px' });
  }

  lazyVisibilityCallbacks.set(element, onVisible);
  lazyVisibilityObserver.observe(element);
  return () => {
    lazyVisibilityCallbacks.delete(element);
    lazyVisibilityObserver?.unobserve(element);
    if (lazyVisibilityCallbacks.size === 0) {
      lazyVisibilityObserver?.disconnect();
      lazyVisibilityObserver = null;
    }
  };
};

/**
 * Poster for movie/series:
 * 1) TMDB poster/backdrop
 * 2) Else custom title-logo designed from TMDB official name (or cleaned playlist name)
 *
 * Live channels still use playlist logos.
 */
export const ImageWithFallback = memo(
  ({
    src,
    name,
    size = 'md',
    itemType,
    isGenericLogo,
    aspect,
    cover,
    lazy = true,
    fallbackToPlaylist = false,
  }: ImageWithFallbackProps) => {
    const { language } = useSettings();
    const rootRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(!lazy);

    useEffect(() => {
      if (!lazy) {
        setIsVisible(true);
        return;
      }
      const el = rootRef.current;
      if (!el) {
        setIsVisible(true);
        return;
      }
      return observeLazyVisibility(el, () => setIsVisible(true));
    }, [lazy]);

    const cleanTitle = useMemo(() => {
      if (itemType === 'series') {
        return parseSeriesEpisodeInfo(name).cleanTitle || name;
      }
      if (itemType === 'movie') {
        return cleanMovieName(name) || name;
      }
      return name;
    }, [name, itemType]);

    const playlistName = (cleanTitle || name || '').trim() || 'İsimsiz';
    const resolvedAspect = aspect || 'portrait';
    const isPerformanceBenchmark =
      typeof window !== 'undefined' && window.strmlyPerfBench === true;
    const usesTmdbCover =
      !isPerformanceBenchmark && (itemType === 'movie' || itemType === 'series');

    const cacheKey = useMemo(() => {
      if (!usesTmdbCover || (itemType !== 'movie' && itemType !== 'series')) return '';
      return getTmdbPosterCacheKey(itemType, playlistName, resolvedAspect);
    }, [playlistName, itemType, resolvedAspect, usesTmdbCover]);

    const cachedPoster = useMemo(() => {
      if (!cacheKey) return undefined;
      return globalSyncPosterMap.get(`resolved-poster-${cacheKey}`) || undefined;
    }, [cacheKey]);

    const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
    const [tmdbPoster, setTmdbPoster] = useState<string | null>(
      cachedPoster || null,
    );
    /** Official name from TMDB search (preferred for title-logo) */
    const [tmdbOfficialTitle, setTmdbOfficialTitle] = useState<string | null>(
      null,
    );
    const [imgLoaded, setImgLoaded] = useState(!!cachedPoster);
    const [fetchDone, setFetchDone] = useState(!!cachedPoster || !usesTmdbCover);

    const [prevKey, setPrevKey] = useState(cacheKey);
    if (cacheKey !== prevKey) {
      setPrevKey(cacheKey);
      setFailedImageSrc(null);
      setTmdbPoster(cachedPoster || null);
      setTmdbOfficialTitle(null);
      setImgLoaded(!!cachedPoster);
      setFetchDone(!!cachedPoster || !usesTmdbCover);
    }

    useEffect(() => {
      if (!isVisible || !usesTmdbCover || !cacheKey) {
        setFetchDone(true);
        return;
      }

      const memoryCacheKey = `resolved-poster-${cacheKey}`;
      const titleCacheKey = `resolved-title-${cacheKey}`;
      const existing = globalSyncPosterMap.get(memoryCacheKey);
      const existingTitle = globalSyncPosterMap.get(titleCacheKey);
      if (existingTitle) setTmdbOfficialTitle(existingTitle);
      if (existing) {
        setTmdbPoster(existing);
        setFetchDone(true);
        return;
      }

      const apiKey = getTmdbApiKey();
      if (!apiKey) {
        setTmdbPoster(null);
        setFetchDone(true);
        return;
      }

      let cancelled = false;

      const run = async () => {
        try {
          const cachedResolved = await tmdbCache.get(memoryCacheKey);
          if (cancelled) return;
          if (
            cachedResolved &&
            !String(cachedResolved).startsWith('app-file://')
          ) {
            globalSyncPosterMap.set(memoryCacheKey, cachedResolved);
            setTmdbPoster(cachedResolved);
            setFetchDone(true);
            setImgLoaded(false);
            return;
          }
        } catch {
          // continue
        }

        if (cancelled) return;

        try {
          const endpoint = itemType === 'series' ? 'tv' : 'movie';
          const result = await Promise.race([
            getResolvedTmdbResult(endpoint, apiKey, playlistName),
            new Promise<null>((resolve) =>
              window.setTimeout(() => resolve(null), TMDB_TIMEOUT_MS),
            ),
          ]);

          if (cancelled) return;

          if (!result) {
            setTmdbPoster(null);
            setFetchDone(true);
            return;
          }

          // Official title for custom logo plate
          const official = (
            result.name ||
            result.title ||
            result.original_name ||
            result.original_title ||
            ''
          ).trim();
          if (official) {
            setTmdbOfficialTitle(official);
            globalSyncPosterMap.set(titleCacheKey, official);
          }

          const tmdbPath = resolvedAspect === 'landscape'
            ? result.backdrop_path || result.poster_path
            : result.poster_path || result.backdrop_path;

          const posterPath =
            (await resolveTmdbImageSrc(tmdbPath, 'w500')) || null;
          if (cancelled) return;

          if (posterPath) {
            globalSyncPosterMap.set(memoryCacheKey, posterPath);
            if (!posterPath.startsWith('app-file://')) {
              try {
                await tmdbCache.set(memoryCacheKey, posterPath);
              } catch {
                // ignore
              }
            }
            setTmdbPoster(posterPath);
            setImgLoaded(false);
          } else {
            globalSyncPosterMap.delete(memoryCacheKey);
            setTmdbPoster(null);
          }
          setFetchDone(true);
        } catch {
          if (!cancelled) {
            setTmdbPoster(null);
            setFetchDone(true);
          }
        }
      };

      void run();
      return () => {
        cancelled = true;
      };
    }, [
      cacheKey,
      usesTmdbCover,
      playlistName,
      itemType,
      isVisible,
      resolvedAspect,
    ]);

    const playlistSrc =
      isGenericLogo || !src || !String(src).trim() ? undefined : src;
    const usablePlaylistSrc =
      playlistSrc && playlistSrc !== failedImageSrc ? playlistSrc : undefined;

    const posterSrc = tmdbPoster || cachedPoster;
    const usableTmdbSrc =
      posterSrc && posterSrc !== failedImageSrc ? posterSrc : undefined;

    // Movie/series: TMDB art only (playlist logos often broken/black)
    const usesPlaylistFallback = Boolean(
      usesTmdbCover && !usableTmdbSrc && fallbackToPlaylist && usablePlaylistSrc,
    );
    const displaySrc = usesTmdbCover
      ? usableTmdbSrc || (usesPlaylistFallback ? usablePlaylistSrc : null)
      : usablePlaylistSrc || null;

    const logoTitle = (tmdbOfficialTitle || playlistName).trim() || 'İsimsiz';
    const logoTitleLabel = logoTitle === 'İsimsiz' ? (language === 'tr' ? 'İsimsiz' : 'Untitled') : logoTitle;

    // ── Has poster image ──────────────────────────────────────
    if (displaySrc) {
      return (
        <div
          ref={rootRef}
          className="absolute inset-0 z-[1] overflow-hidden bg-[#16161a]"
        >
          {/* Transparent live-channel PNGs must not reveal a duplicate title plate. */}
          {usesTmdbCover && !imgLoaded && (
            <TitleLogoPlate
              title={logoTitleLabel}
              kind={itemType}
              size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
              aspect={resolvedAspect}
            />
          )}
          <img
            src={displaySrc}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            className={`absolute inset-0 z-10 h-full w-full transition-all duration-500 ease-out transform-gpu ${
              imgLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-60 blur-md scale-105'
            } ${
              usesPlaylistFallback
                ? 'object-cover'
                : usesTmdbCover || cover
                ? 'object-cover'
                : 'object-contain max-h-[85%] max-w-[85%] m-auto'
            }`}
            onError={() => {
              setFailedImageSrc(displaySrc);
              setTmdbPoster(null);
              setImgLoaded(true);
            }}
          />
        </div>
      );
    }

    // ── No poster: custom title logo from TMDB name ───────────
    // While still fetching, show logo plate immediately (not blank)
    return (
      <div ref={rootRef} className="absolute inset-0 z-[1]">
        <TitleLogoPlate
          title={logoTitleLabel}
          kind={itemType}
          size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
          aspect={resolvedAspect}
        />
        {!fetchDone && usesTmdbCover ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden opacity-40">
            <div className="h-full w-1/3 animate-pulse bg-white/40" />
          </div>
        ) : null}
      </div>
    );
  },
);
