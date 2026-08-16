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
  TMDB_NO_MATCH,
} from '../utils/tmdb';
import type { ImageWithFallbackProps } from '../types';
import { TitleLogoPlate } from './TitleLogoPlate';
import { useSettings } from '../context/SettingsContext';

const TMDB_TIMEOUT_MS = 3200;
/** Bounded fetch retries: a transient timeout/error must not leave a blank card forever. */
const MAX_TMDB_FETCH_RETRIES = 3;
const TMDB_RETRY_DELAY_MS = 1500;

const getPlaylistTmdbImagePath = (source?: string): string | null => {
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'image.tmdb.org') return null;
    const match = url.pathname.match(/^\/t\/p\/[^/]+(\/[^?#]+)$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
};

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
    // Preload only the next few cards. A multi-row 2400px window started
    // hundreds of TMDB streams and starved artwork already on screen.
    }, { rootMargin: '600px 0px' });
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
 * Community-uploaded TMDB posters sometimes bake pure-black (or transparent)
 * letterbox bars into the 2:3 file — landscape art padded to portrait. Sample
 * the edges on a tiny canvas and return the center-scale that pushes those
 * bars outside the overflow-hidden card, keeping cards full-bleed.
 * Returns null when no meaningful bars exist or the canvas is tainted.
 */
const measureLetterbox = (el: HTMLImageElement): { sx: number; sy: number } | null => {
  try {
    if (!el.naturalWidth || !el.naturalHeight) return null;
    const W = 20;
    const H = 30;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(el, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);
    const lum = (x: number, y: number) => {
      const i = (y * W + x) * 4;
      return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * (data[i + 3] / 255);
    };
    const colIsBar = (x: number) => {
      let dark = 0;
      for (let y = 0; y < H; y++) if (lum(x, y) < 10) dark++;
      return dark >= H * 0.95;
    };
    const rowIsBar = (y: number) => {
      let dark = 0;
      for (let x = 0; x < W; x++) if (lum(x, y) < 10) dark++;
      return dark >= W * 0.95;
    };
    const maxX = Math.floor(W * 0.22);
    const maxY = Math.floor(H * 0.22);
    let left = 0;
    while (left < maxX && colIsBar(left)) left++;
    let right = 0;
    while (right < maxX && colIsBar(W - 1 - right)) right++;
    let top = 0;
    while (top < maxY && rowIsBar(top)) top++;
    let bottom = 0;
    while (bottom < maxY && rowIsBar(H - 1 - bottom)) bottom++;
    const fx = (left + right) / W;
    const fy = (top + bottom) / H;
    if (fx < 0.06 && fy < 0.06) return null;
    // Center-scale needed so a bar fraction f on one edge leaves the box:
    // (1-s)/2 + f*s <= 0  →  s >= 1/(1-2f). Cap the crop at 16% per axis.
    const scale = (f: number) => 1 / (1 - 2 * Math.min(f, 0.16));
    return {
      sx: fx >= 0.06 ? scale(fx) : 1,
      sy: fy >= 0.06 ? scale(fy) : 1,
    };
  } catch {
    return null;
  }
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
    blurUp = false,
  }: ImageWithFallbackProps) => {
    const { language } = useSettings();
    const rootRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

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
    const playlistTmdbImagePath = useMemo(
      // Series entries are grouped from episodes, so their playlist logo can
      // be a TMDB episode still. Always resolve the series itself and use its
      // poster_path instead of promoting an arbitrary episode frame.
      () => itemType === 'series' ? null : getPlaylistTmdbImagePath(src),
      [itemType, src],
    );
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
      const cached = globalSyncPosterMap.get(`resolved-poster-${cacheKey}`);
      // The no-match marker is bookkeeping, never an image source.
      return cached && cached !== TMDB_NO_MATCH && !cached.startsWith('app-file://') ? cached : undefined;
    }, [cacheKey]);
    const memoryCacheKey = cacheKey ? `resolved-poster-${cacheKey}` : '';

    // cachedPoster must be derived before this initializer reads it (TDZ).
    const [isVisible, setIsVisible] = useState(() => !lazy || !!cachedPoster);

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

    const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
    const [tmdbPoster, setTmdbPoster] = useState<string | null>(
      cachedPoster || null,
    );
    /** Official name from TMDB search (preferred for title-logo) */
    const [tmdbOfficialTitle, setTmdbOfficialTitle] = useState<string | null>(
      null,
    );
    const [imgLoaded, setImgLoaded] = useState(false);
    /** Netflix-style reveal: set once the current src is fully decoded via
     *  img.decode() — pixels are ready BEFORE the fade starts, so the card
     *  can never flash or show a half-painted frame. */
    const [decodedSrc, setDecodedSrc] = useState<string | null>(null);
    /** Letterbox bars baked into the poster file (community TMDB uploads pad
     *  landscape art to 2:3 with black). Measured once per decode; the img is
     *  center-scaled so the bars fall outside the overflow-hidden card. */
    const [edgeCrop, setEdgeCrop] = useState<{ sx: number; sy: number } | null>(null);
    const [fetchDone, setFetchDone] = useState(!!cachedPoster || !usesTmdbCover);
    /** Bounded retry counter: transient TMDB timeouts must not leave a permanent title plate. */
    const [retryCount, setRetryCount] = useState(0);
    /** Skip memory/IndexedDB cache once so a dead cached URL is re-resolved fresh. */
    const [bypassCache, setBypassCache] = useState(false);

    const [prevKey, setPrevKey] = useState(cacheKey);
    if (cacheKey !== prevKey) {
      setPrevKey(cacheKey);
      setFailedImageSrc(null);
      setTmdbPoster(cachedPoster || null);
      setTmdbOfficialTitle(null);
      setImgLoaded(false);
      setDecodedSrc(null);
      setFetchDone(!!cachedPoster || !usesTmdbCover);
    }

    useEffect(() => {
      if (!isVisible || !usesTmdbCover || !cacheKey) {
        setFetchDone(true);
        return;
      }

      const memoryCacheKey = `resolved-poster-${cacheKey}`;
      const titleCacheKey = `resolved-title-${cacheKey}`;
      const existingTitle = globalSyncPosterMap.get(titleCacheKey);
      if (existingTitle) setTmdbOfficialTitle(existingTitle);
      // A previous attempt may have cached a dead URL; bypassing the cache once
      // forces a fresh resolution so the artwork the detail modal shows also
      // appears on the card.
      if (!bypassCache) {
        const existing = globalSyncPosterMap.get(memoryCacheKey);
        if (existing === TMDB_NO_MATCH) {
          // TMDB has no match for this title — stop here, never re-query.
          setTmdbPoster(null);
          setFetchDone(true);
          return;
        }
        if (existing) {
          setTmdbPoster(existing);
          setFetchDone(true);
          return;
        }
      }

      let cancelled = false;
      let retryTimer: number | undefined;

      const scheduleRetry = () => {
        if (cancelled || retryCount >= MAX_TMDB_FETCH_RETRIES) return;
        retryTimer = window.setTimeout(() => {
          setBypassCache(true);
          setRetryCount((count) => count + 1);
        }, TMDB_RETRY_DELAY_MS);
      };

      const run = async () => {
        try {
          if (!bypassCache) {
            const cachedResolved = await tmdbCache.get(memoryCacheKey);
            if (cancelled) return;
            // app-file:// URLs are safe to reuse: the Electron protocol handler
            // re-roots tmdb-cache paths onto the current cache dir and
            // auto-redownloads missing files; onError below purges dead URLs.
            // Skipping them forced a full re-resolution of every artwork on
            // each app restart.
            if (cachedResolved === TMDB_NO_MATCH) {
              globalSyncPosterMap.set(memoryCacheKey, TMDB_NO_MATCH);
              setTmdbPoster(null);
              setFetchDone(true);
              return;
            }
            if (cachedResolved && !String(cachedResolved).startsWith('app-file://')) {
              globalSyncPosterMap.set(memoryCacheKey, cachedResolved);
              setTmdbPoster(cachedResolved);
              setFetchDone(true);
              setImgLoaded(false);
              return;
            }
          }
        } catch {
          // continue
        }

        if (cancelled) return;

        try {
          // Many Xtream/M3U catalogs already provide an exact TMDB image.
          // Persist that file directly instead of blocking the first poster
          // on another title search.
          if (playlistTmdbImagePath) {
            const localPoster = await resolveTmdbImageSrc(
              playlistTmdbImagePath,
              resolvedAspect === 'portrait' ? 'w342' : 'w500',
            );
            if (cancelled) return;
            if (localPoster) {
              globalSyncPosterMap.set(memoryCacheKey, localPoster);
              await tmdbCache.set(memoryCacheKey, localPoster).catch(() => undefined);
              setFailedImageSrc((failed) => failed === localPoster ? null : failed);
              setTmdbPoster(localPoster);
              setImgLoaded(false);
              setBypassCache(false);
              setFetchDone(true);
              return;
            }
          }

          const apiKey = getTmdbApiKey();
          if (!apiKey) {
            setTmdbPoster(null);
            setFetchDone(true);
            return;
          }

          const endpoint = itemType === 'series' ? 'tv' : 'movie';
          const timeoutSentinel = '__tmdb_timeout__' as const;
          const result = await Promise.race([
            getResolvedTmdbResult(endpoint, apiKey, playlistName),
            new Promise<typeof timeoutSentinel>((resolve) =>
              window.setTimeout(() => resolve(timeoutSentinel), TMDB_TIMEOUT_MS),
            ),
          ]);

          if (cancelled) return;

          if (result === timeoutSentinel) {
            // Timeout is transient. The detail modal resolves without a
            // timeout, so retry briefly instead of leaving a permanent plate.
            scheduleRetry();
            if (retryCount >= MAX_TMDB_FETCH_RETRIES) {
              setTmdbPoster(null);
              setFetchDone(true);
            }
            return;
          }

          if (!result) {
            // Definitive no-match from TMDB scoring. Cache the negative so
            // this title is never re-queried on future mounts or restarts.
            globalSyncPosterMap.set(memoryCacheKey, TMDB_NO_MATCH);
            try {
              await tmdbCache.set(memoryCacheKey, TMDB_NO_MATCH);
            } catch {
              // ignore
            }
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

          const posterPath = (await resolveTmdbImageSrc(
            tmdbPath,
            resolvedAspect === 'portrait' ? 'w342' : 'w500',
          )) || null;
          if (cancelled) return;

          if (posterPath) {
            globalSyncPosterMap.set(memoryCacheKey, posterPath);
            // Persist app-file:// URLs too — they survive restarts because the
            // protocol handler re-resolves them against the active cache dir.
            try {
              await tmdbCache.set(memoryCacheKey, posterPath);
            } catch {
              // ignore
            }
            setFailedImageSrc((failed) => failed === posterPath ? null : failed);
            setTmdbPoster(posterPath);
            setImgLoaded(false);
            setBypassCache(false);
          } else {
            globalSyncPosterMap.delete(memoryCacheKey);
            setTmdbPoster(null);
          }
          setFetchDone(true);
        } catch {
          if (!cancelled) {
            scheduleRetry();
            if (retryCount >= MAX_TMDB_FETCH_RETRIES) {
              setTmdbPoster(null);
              setFetchDone(true);
            }
          }
        }
      };

      void run();
      return () => {
        cancelled = true;
        if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      };
    }, [
      cacheKey,
      usesTmdbCover,
      playlistName,
      itemType,
      isVisible,
      resolvedAspect,
      playlistTmdbImagePath,
      retryCount,
      bypassCache,
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

    // A changed source must wait for its own load/decode event. The previous
    // implementation could run before the new <img> ref existed and mark the
    // poster ready prematurely, producing a bright pop when pixels arrived.
    useEffect(() => {
      setDecodedSrc(null);
      setImgLoaded(false);
      setEdgeCrop(null);
    }, [displaySrc]);

    const isTrustedPlaylistTmdbSource = Boolean(
      playlistTmdbImagePath && (
        displaySrc === usablePlaylistSrc
      ),
    );
    const revealed = blurUp && !isTrustedPlaylistTmdbSource
      ? decodedSrc === displaySrc
      : imgLoaded;

    // ── Has poster image ──────────────────────────────────────
    if (displaySrc) {
      return (
        <div
          ref={rootRef}
          className="absolute inset-0 z-[1] overflow-hidden bg-[#16161a]"
        >
          {/* Placeholder crossfades out as the artwork fades in. */}
          {usesTmdbCover && (
            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                revealed ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <TitleLogoPlate
                title={logoTitleLabel}
                kind={itemType}
                size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
                aspect={resolvedAspect}
              />
            </div>
          )}
          <img
            ref={imgRef}
            src={displaySrc}
            alt=""
            loading={usesTmdbCover ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={async (event) => {
              const image = event.currentTarget;
              setImgLoaded(true);
              if (!blurUp) return;
              try {
                await image.decode();
              } catch {
                // A successful load is still usable when decode() is absent or rejects.
              }
              if (imgRef.current !== image) return;
              setEdgeCrop(measureLetterbox(image));
              setDecodedSrc(displaySrc);
            }}
            style={edgeCrop ? { transform: `scale(${edgeCrop.sx}, ${edgeCrop.sy})` } : undefined}
            // Reveal styles:
            // - blurUp: Netflix-style reveal — pure opacity fade, gated on
            //   img.decode() so pixels are fully ready before the fade.
            // - default: calm opacity fade; the title plate stays until the
            //   image is decoded so async resolution never reads as flashing.
            className={`absolute inset-0 z-10 h-full w-full ${
              usesPlaylistFallback
                ? 'object-cover'
                : usesTmdbCover || cover
                ? 'object-cover'
                : 'object-contain max-h-[85%] max-w-[85%] m-auto'
            } ${blurUp ? '' : 'transition-opacity duration-200 ease-out'} ${
              revealed ? 'opacity-100' : 'opacity-0'
            }`}
            onError={() => {
              setFailedImageSrc(displaySrc);
              setTmdbPoster(null);
              setImgLoaded(true);
              // Dead cached URL (stale app-file:// path or removed CDN asset):
              // purge it and re-resolve fresh, mirroring what the detail modal
              // successfully shows.
              globalSyncPosterMap.delete(memoryCacheKey);
              if (retryCount < MAX_TMDB_FETCH_RETRIES) {
                setBypassCache(true);
                setRetryCount((count) => count + 1);
              }
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
