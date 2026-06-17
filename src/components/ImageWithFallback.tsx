import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Tv } from 'lucide-react';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { cleanMovieName, getTmdbApiKey, tmdbCache, globalSyncPosterMap, getResolvedTmdbResult, resolveTmdbImageSrc } from '../utils/tmdb';
import { getFallbackGradient } from '../utils/helpers';
import { TMDB_CACHE_VERSION } from '../constants';
import type { ImageWithFallbackProps } from '../types';

export const ImageWithFallback = memo(({ src, name, group, size = 'md', itemType, isGenericLogo, aspect }: ImageWithFallbackProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '320px' });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cleanTitle = useMemo(() => {
    if (itemType === 'series') {
      return parseSeriesEpisodeInfo(name).cleanTitle;
    } else if (itemType === 'movie') {
      return cleanMovieName(name);
    }
    return name;
  }, [name, itemType]);

  const resolvedAspect = aspect || 'portrait';

  const cacheKey = useMemo(() => {
    if (itemType !== 'movie' && itemType !== 'series') return '';
    return `${TMDB_CACHE_VERSION}-${itemType}-${cleanTitle}-${resolvedAspect}`;
  }, [cleanTitle, itemType, resolvedAspect]);

  const usesTmdbCover = itemType === 'movie' || itemType === 'series';

  // Cache'den poster URL'sini al (sadece bir kez)
  const cachedPoster = useMemo(() => {
    if (!cacheKey) return undefined;
    return globalSyncPosterMap.get(`resolved-poster-${cacheKey}`);
  }, [cacheKey]);

  const [error, setError] = useState(false);
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const [tmdbPoster, setTmdbPoster] = useState<string | null>(cachedPoster || null);
  const [imgLoaded, setImgLoaded] = useState(!!cachedPoster);

  useEffect(() => {
    setError(false);
    setFailedImageSrc(null);
    // Cache'de varsa imgLoaded'ı sıfırlama
    if (!cachedPoster) setImgLoaded(false);
  }, [src, cachedPoster]);

  // Timeout for src images
  useEffect(() => {
    if (!isVisible || !src || cachedPoster) return;
    const timer = setTimeout(() => {
      if (!imgLoaded && !error) {
        setError(true);
        setImgLoaded(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [src, imgLoaded, error, cachedPoster, isVisible]);

  // Timeout for TMDB images - 5 seconds
  useEffect(() => {
    if (!isVisible || !usesTmdbCover || cachedPoster || !cacheKey) return;
    const timer = setTimeout(() => {
      if (!imgLoaded && !error) {
        setError(true);
        setImgLoaded(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [usesTmdbCover, cachedPoster, cacheKey, imgLoaded, error, isVisible]);

  // TMDB poster yükleme - sadece cache'de yoksa
  useEffect(() => {
    if (!isVisible || !usesTmdbCover || !cacheKey) return;
    if (globalSyncPosterMap.has(`resolved-poster-${cacheKey}`)) return; // Zaten cache'de var (başarılı veya başarısız)

    const apiKey = getTmdbApiKey();
    let cancelled = false;

    const fetchPoster = async () => {
      // Memory cache kontrol
      if (globalSyncPosterMap.has(`resolved-poster-${cacheKey}`)) {
        const memCached = globalSyncPosterMap.get(`resolved-poster-${cacheKey}`);
        if (!cancelled) {
          setTmdbPoster(memCached || null);
          setImgLoaded(true);
        }
        return;
      }

      // IndexedDB cache kontrol
      try {
        const cachedResolved = await tmdbCache.get(`resolved-poster-${cacheKey}`);
        if (cachedResolved !== null) {
          if (cachedResolved === "" || !String(cachedResolved).startsWith('app-file://')) {
            globalSyncPosterMap.set(`resolved-poster-${cacheKey}`, cachedResolved);
            if (!cancelled) {
              setTmdbPoster(cachedResolved || null);
              setImgLoaded(true);
            }
            return;
          }
        }
      } catch (e) {
        console.error("IndexedDB resolved-poster read error:", e);
      }

      if (cancelled) return;

      // TMDB API'den çek
      try {
        const endpoint = itemType === 'series' ? 'tv' : 'movie';
        const result = await getResolvedTmdbResult(endpoint, apiKey, cleanTitle);
        if (cancelled) return;

        const tmdbPath = resolvedAspect === 'landscape' 
          ? (result?.backdrop_path || result?.poster_path) 
          : (result?.poster_path || result?.backdrop_path);
        const posterPath = await resolveTmdbImageSrc(tmdbPath, 'w500') || null;
        const finalPoster = posterPath || '';
        globalSyncPosterMap.set(`resolved-poster-${cacheKey}`, finalPoster);

        // Don't cache app-file:// URLs in IndexedDB — they are install-specific
        // and become stale when the app is reinstalled or disk cache is cleared.
        if (finalPoster && !finalPoster.startsWith('app-file://')) {
          try {
            await tmdbCache.set(`resolved-poster-${cacheKey}`, finalPoster);
          } catch (e) {
            console.error("IndexedDB resolved-poster write error:", e);
          }
        }

        if (!cancelled) {
          setTmdbPoster(posterPath || null);
          setImgLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setTmdbPoster(null);
        }
      }
    };

    fetchPoster();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, usesTmdbCover, cleanTitle, itemType, cachedPoster, isVisible, resolvedAspect]);

  const effectiveSrc = isGenericLogo ? undefined : src;
  const posterSrc = tmdbPoster || cachedPoster;
  const usablePosterSrc = posterSrc && posterSrc !== failedImageSrc ? posterSrc : undefined;
  const usableFallbackSrc = effectiveSrc && !error && effectiveSrc !== failedImageSrc ? effectiveSrc : undefined;

  const displaySrc = isVisible && usesTmdbCover
    ? (usablePosterSrc || usableFallbackSrc || null)
    : (isVisible ? (usableFallbackSrc || null) : null);

  if (displaySrc) {
    return (
      <div ref={rootRef} className="absolute inset-0 bg-neutral-900 overflow-hidden flex items-center justify-center">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 bg-[length:200%_100%] animate-shimmer" />
        )}
        <img
          src={displaySrc}
          alt=""
          onLoad={() => setImgLoaded(true)}
          className={`transition-opacity duration-500 ease-out ${imgLoaded ? 'opacity-100' : 'opacity-0'} ${
            usesTmdbCover
              ? "w-full h-full object-cover z-10"
              : (size === 'lg'
                  ? "max-h-[60%] max-w-[60%] object-contain z-10"
                  : "max-h-[70%] max-w-[70%] object-contain z-10")
          }`}
          onError={() => {
            if (displaySrc) setFailedImageSrc(displaySrc);
            setError(true);
            setImgLoaded(true);
          }}
        />
      </div>
    );
  }

  const isLg = size === 'lg';
  const circleSize = isLg ? "w-12 h-12" : "w-9 h-9";
  const iconSize = isLg ? 24 : 16;
  const textSize = isLg ? "text-xs font-extrabold" : "text-[9px] font-bold";

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 bg-gradient-to-tr ${getFallbackGradient(name)} flex flex-col items-center justify-center text-center select-none ${isLg ? 'p-6' : 'p-4'}`}
    >
      <div className={`${circleSize} rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-1.5 shadow-inner`}>
        <Tv size={iconSize} className="text-white/60" />
      </div>
      <span className={`${textSize} uppercase tracking-widest text-neutral-200 max-w-full truncate px-1`}>
        {cleanTitle}
      </span>
      <span className="text-[8px] text-neutral-500 uppercase tracking-widest font-semibold mt-0.5 max-w-full truncate">
        {group || 'VOD'}
      </span>
    </div>
  );
});
