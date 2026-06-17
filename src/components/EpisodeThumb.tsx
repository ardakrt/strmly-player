import { useState, useEffect, useMemo, memo } from 'react';
import { tmdbCache, getTmdbApiKey, fetchTmdbPath, resolveTmdbImageSrc } from '../utils/tmdb';
import type { EpisodeThumbProps } from '../types';

// Global memory cache - asla sıfırlanmaz
const episodeStillCache: Record<string, string> = {};

export const EpisodeThumb = memo(({ tmdbShowId, seasonNumber, episodeNumber, fallbackPoster, stillPath }: EpisodeThumbProps) => {
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
    setLoaded(false);
    if (!tmdbShowId || !cacheKey) { setTried(true); return; }

    // Memory cache'de varsa direkt kullan
    if (episodeStillCache[cacheKey]) {
      setStillSrc(episodeStillCache[cacheKey]);
      setLoaded(true);
      setTried(true);
      return;
    }

    let cancelled = false;

    const fetchStill = async () => {
      // IndexedDB cache kontrol
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

      // If we have stillPath from props, resolve it immediately and avoid the individual fetch
      if (stillPath !== undefined) {
        try {
          const url = stillPath ? await resolveTmdbImageSrc(stillPath, 'w300') : null;
          const finalUrl = url || '';
          episodeStillCache[cacheKey] = finalUrl;

          // Don't cache app-file:// URLs in IndexedDB
          if (finalUrl && !finalUrl.startsWith('app-file://')) {
            try {
              await tmdbCache.set(`resolved-still-${cacheKey}`, finalUrl);
            } catch (e) {
              console.error("IndexedDB resolved-still write error:", e);
            }
          }

          if (!cancelled) {
            setStillSrc(url || null);
            setTried(true);
          }
          return;
        } catch (err) {
          console.warn("Failed to resolve stillPath:", err);
        }
      }

      // TMDB API'den çek
      const apiKey = getTmdbApiKey();
      const path = `/3/tv/${tmdbShowId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${apiKey}&language=tr-TR`;

      try {
        const data = await fetchTmdbPath<{ still_path?: string; error?: string }>(path);
        if (cancelled) return;

        const url = data.still_path ? await resolveTmdbImageSrc(data.still_path, 'w300') : null;
        const finalUrl = url || '';
        episodeStillCache[cacheKey] = finalUrl;

        // Don't cache app-file:// URLs in IndexedDB — they are install-specific
        if (!finalUrl.startsWith('app-file://')) {
          try {
            await tmdbCache.set(`resolved-still-${cacheKey}`, finalUrl);
          } catch (e) {
            console.error("IndexedDB resolved-still write error:", e);
          }
        }

        if (!cancelled) {
          setStillSrc(url || null);
          setTried(true);
        }
      } catch {
        if (!cancelled) {
          episodeStillCache[cacheKey] = '';
          setTried(true);
        }
      }
    };

    fetchStill();

    return () => {
      cancelled = true;
    };
  }, [tmdbShowId, seasonNumber, episodeNumber, cacheKey, stillPath]);

  const effectiveSrc = stillSrc || fallbackPoster;

  return (
    <div className="relative w-full h-full bg-neutral-900">
      {effectiveSrc && (
        <img
          src={effectiveSrc}
          alt=""
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => { if (stillSrc) { setStillSrc(null); setLoaded(false); } }}
        />
      )}
      {(!effectiveSrc || !loaded) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.02] to-white/[0.06]">
          <span className="text-white/20 font-black text-base tracking-tight select-none">
            {String(episodeNumber).padStart(2, '0')}
          </span>
        </div>
      )}
      {tried && !stillSrc && fallbackPoster && (
        <div className="absolute inset-0 bg-black/30" />
      )}
    </div>
  );
});
