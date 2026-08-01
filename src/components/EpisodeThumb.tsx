import { useState, useEffect, useMemo, memo } from 'react';
import { Play } from 'lucide-react';
import { getFallbackGradient } from '../utils/helpers';
import { tmdbCache, getTmdbApiKey, fetchTmdbPath, resolveTmdbImageSrc, getTmdbLanguage } from '../utils/tmdb';
import type { EpisodeThumbProps } from '../types';

// Global memory cache - asla sıfırlanmaz
const episodeStillCache: Record<string, string> = {};

export const EpisodeThumb = memo(({ tmdbShowId, seasonNumber, episodeNumber, stillPath, fallbackPoster }: EpisodeThumbProps) => {
  const language = typeof localStorage !== 'undefined' ? localStorage.getItem('cinema_language') || 'tr' : 'tr';
  const cacheKey = useMemo(() => {
    return tmdbShowId ? `${tmdbShowId}-${seasonNumber}-${episodeNumber}` : '';
  }, [tmdbShowId, seasonNumber, episodeNumber]);

  // Cache'den başlangıç değeri al
  const cachedStill = useMemo(() => {
    if (!cacheKey) return undefined;
    return episodeStillCache[cacheKey] || undefined;
  }, [cacheKey]);

  const [stillSrc, setStillSrc] = useState<string | null>(cachedStill || null);
  const [loaded, setLoaded] = useState(!!cachedStill);
  const [tried, setTried] = useState(!!cachedStill);

  useEffect(() => {
    if (!tmdbShowId || !cacheKey) {
      setStillSrc(null);
      setTried(true);
      return;
    }

    // Memory cache'de varsa direkt kullan
    if (episodeStillCache[cacheKey]) {
      setStillSrc(episodeStillCache[cacheKey] || null);
      if (episodeStillCache[cacheKey]) setLoaded(true);
      setTried(true);
      return;
    }

    let cancelled = false;

    const resolveStill = async () => {
      // 1. When stillPath is provided by season fetch
      if (stillPath !== undefined) {
        if (!stillPath) {
          episodeStillCache[cacheKey] = '';
          if (!cancelled) {
            setStillSrc(null);
            setTried(true);
          }
          return;
        }

        try {
          const url = await resolveTmdbImageSrc(stillPath, 'w300');
          const finalUrl = url || '';
          episodeStillCache[cacheKey] = finalUrl;

          if (finalUrl && !finalUrl.startsWith('app-file://')) {
            tmdbCache.set(`resolved-still-${cacheKey}`, finalUrl).catch(() => {});
          }

          if (!cancelled) {
            setStillSrc(finalUrl || null);
            setTried(true);
          }
          return;
        } catch {
          if (!cancelled) {
            episodeStillCache[cacheKey] = '';
            setStillSrc(null);
            setTried(true);
          }
          return;
        }
      }

      // 2. Check IndexedDB cache before launching per-episode request
      try {
        const cachedResolved = await tmdbCache.get(`resolved-still-${cacheKey}`);
        if (cachedResolved !== null && cachedResolved !== undefined) {
          episodeStillCache[cacheKey] = cachedResolved;
          if (!cancelled) {
            setStillSrc(cachedResolved || null);
            setTried(true);
          }
          return;
        }
      } catch (e) {
        console.error("IndexedDB resolved-still read error:", e);
      }

      if (cancelled) return;

      // 3. Fallback per-episode request (only if season details didn't supply stillPath after a delay)
      const timeoutId = setTimeout(async () => {
        if (cancelled) return;
        const apiKey = getTmdbApiKey();
        const path = `/3/tv/${tmdbShowId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${apiKey}&language=${getTmdbLanguage()}`;

        try {
          const data = await fetchTmdbPath<{ still_path?: string; error?: string }>(path);
          if (cancelled) return;

          const url = data.still_path ? await resolveTmdbImageSrc(data.still_path, 'w300') : null;
          const finalUrl = url || '';
          episodeStillCache[cacheKey] = finalUrl;

          if (finalUrl && !finalUrl.startsWith('app-file://')) {
            tmdbCache.set(`resolved-still-${cacheKey}`, finalUrl).catch(() => {});
          }

          if (!cancelled) {
            setStillSrc(finalUrl || null);
            setTried(true);
          }
        } catch {
          if (!cancelled) {
            episodeStillCache[cacheKey] = '';
            setStillSrc(null);
            setTried(true);
          }
        }
      }, 400);

      return () => clearTimeout(timeoutId);
    };

    void resolveStill();

    return () => {
      cancelled = true;
    };
  }, [tmdbShowId, seasonNumber, episodeNumber, cacheKey, stillPath]);

  const isStillReady = Boolean(stillSrc && loaded);
  const isLoading = !tried && !isStillReady;

  return (
    <div className="relative w-full h-full overflow-hidden bg-neutral-950">
      {/* 1. Real Episode Still Image */}
      {stillSrc && (
        <img
          src={stillSrc}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isStillReady ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (stillSrc) {
              setStillSrc(null);
              setLoaded(false);
              setTried(true);
            }
          }}
        />
      )}

      {/* 2. Skeleton Shimmer Loader (while fetching / loading) */}
      {isLoading && (
        <div className="absolute inset-0 bg-neutral-900 animate-pulse flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
          <div className="relative flex flex-col items-center gap-1 opacity-35">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Play size={9} fill="currentColor" className="ml-0.5 text-white/50" />
            </div>
            <span className="text-[9px] font-bold text-white/50 select-none">
              {language === 'tr' ? `${episodeNumber}. Bölüm` : `Episode ${episodeNumber}`}
            </span>
          </div>
        </div>
      )}

      {/* 3. Sleek Ambient Fallback (when fetch finished & no still image exists on TMDB) */}
      {tried && !stillSrc && (
        <div className="absolute inset-0 overflow-hidden bg-neutral-950">
          {fallbackPoster ? (
            <>
              <img
                src={fallbackPoster}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-25 filter blur-[3px] scale-110"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${getFallbackGradient(`${tmdbShowId}-${seasonNumber}-${episodeNumber}`)} opacity-50`} />
          )}

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-md shadow-md">
              <Play size={10} fill="#fff" className="ml-0.5 text-white" />
            </div>
            <span className="text-[10px] font-bold text-white/80 tracking-wide select-none drop-shadow-sm">
              {language === 'tr' ? `${episodeNumber}. Bölüm` : `Episode ${episodeNumber}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
