import { useState, useEffect, useMemo, memo } from 'react';
import { Play } from 'lucide-react';
import { getFallbackGradient } from '../utils/helpers';
import { tmdbCache, getTmdbApiKey, fetchTmdbPath, resolveTmdbImageSrc, getTmdbLanguage } from '../utils/tmdb';
import type { EpisodeThumbProps } from '../types';

// Global memory cache - asla sıfırlanmaz
const episodeStillCache: Record<string, string> = {};

export const EpisodeThumb = memo(({ tmdbShowId, seasonNumber, episodeNumber, stillPath }: EpisodeThumbProps) => {
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
    setLoaded(false);
    if (!tmdbShowId || !cacheKey) { setTried(true); return; }

    // Memory cache'de varsa direkt kullan
    if (episodeStillCache[cacheKey] && stillPath === undefined) {
      setStillSrc(episodeStillCache[cacheKey]);
      setLoaded(true);
      setTried(true);
      return;
    }

    let cancelled = false;

    const fetchStill = async () => {
      // If we have stillPath from season details, prefer it over any previous
      // negative cache from an earlier per-episode lookup.
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

      // TMDB API'den çek
      const apiKey = getTmdbApiKey();
      const path = `/3/tv/${tmdbShowId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${apiKey}&language=${getTmdbLanguage()}`;

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

  return (
    <div className="relative w-full h-full bg-neutral-900">
      {stillSrc && (
        <img
          src={stillSrc}
          alt=""
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => { if (stillSrc) { setStillSrc(null); setLoaded(false); } }}
        />
      )}
      {(!stillSrc || !loaded) && (
        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${getFallbackGradient(`${tmdbShowId}-${seasonNumber}-${episodeNumber}`)}`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative flex flex-col items-center gap-1 text-white/75">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10">
              <Play size={10} fill="currentColor" className="ml-0.5" />
            </div>
            <span className="text-[10px] font-black tracking-wider select-none">
              {language === 'tr' ? `${episodeNumber}. Bölüm` : `Episode ${episodeNumber}`}
            </span>
          </div>
        </div>
      )}
      {tried && !stillSrc && (
        <div className="absolute inset-0 bg-black/10" />
      )}
    </div>
  );
});
