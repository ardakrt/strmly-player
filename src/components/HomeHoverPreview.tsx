import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Heart, Info, Plus, Ban } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import { ImageWithFallback } from './ImageWithFallback';
import { cleanMediaTitle, parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { getResolvedTmdbResult, getTmdbApiKey, resolveTmdbImageSrc, tmdbCache, fetchTmdbDetails } from '../utils/tmdb';
import { useSettings } from '../context/SettingsContext';

export interface VodPosterCardProps {
  channel: any; // Can be PlaylistItem or GroupedSeries
  globalFavorites: string[];
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  handlePlayStream?: (item: PlaylistItem) => void;
  requireTmdbPoster?: boolean;
  onContextMenu?: (event: React.MouseEvent, item: any) => void;
}



export interface TmdbMetadata {
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: string;
  year: string;
  overview: string;
  genres: string[];
  duration: string;
}

export const globalVodMetadataMap = new Map<string, TmdbMetadata>();

export const TMDB_GENRES: Record<number, string> = {
  28: 'AKSİYON',
  12: 'MACERA',
  16: 'ANİMASYON',
  35: 'KOMEDİ',
  80: 'POLİSİYE',
  99: 'BELGESEL',
  18: 'DRAM',
  10751: 'AİLE',
  14: 'FANTASTİK',
  36: 'TARİH',
  27: 'KORKU',
  10402: 'MÜZİK',
  9648: 'GİZEM',
  10749: 'ROMANTİK',
  878: 'BİLİM-KURGU',
  10770: 'TV FİLMİ',
  53: 'GERİLİM',
  10752: 'SAVAŞ',
  37: 'VAHŞİ BATI',
  10759: 'AKSİYON & MACERA',
  10762: 'ÇOCUK',
  10763: 'HABER',
  10764: 'REALITY',
  10765: 'BİLİM-KURGU & FANTASTİK',
  10766: 'PEMBE DİZİ',
  10767: 'TALK SHOW',
  10768: 'SAVAŞ & POLİTİKA'
};

export const getFlatItem = (item: any): PlaylistItem => {
  if (item && item.seasons) {
    const seasonsKeys = Object.keys(item.seasons).map(Number).sort((a, b) => a - b);
    if (seasonsKeys.length > 0) {
      const episodes = item.seasons[seasonsKeys[0]];
      if (episodes && episodes.length > 0) {
        return episodes[0].item;
      }
    }
  }
  return item as PlaylistItem;
};

export const translateDuration = (durationStr: string, language: 'tr' | 'en'): string => {
  if (!durationStr) return '';
  if (language === 'tr') return durationStr;
  return durationStr
    .replace(/DİZİ/g, 'SERIES')
    .replace(/FİLM/g, 'MOVIE')
    .replace(/SEZON/g, 'SEASON')
    .replace(/SA/g, 'H')
    .replace(/DK/g, 'M');
};

export const getQualityLabel = (name: string): string | null => {
  const lower = name.toLowerCase();
  if (lower.includes('4k') || lower.includes('uhd')) return '4K';
  if (lower.includes('1080p') || lower.includes('fhd') || lower.includes('1080')) return 'FHD';
  if (lower.includes('720p') || lower.includes('hd') || lower.includes('720')) return 'HD';
  return null;
};

export function useHoverPreview(cardRef: React.RefObject<HTMLDivElement | null>) {
  const [previewPosition, setPreviewPosition] = useState<{ left: number; top: number } | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const closePreviewTimer = useRef<number | null>(null);
  const openPreviewTimer = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (openPreviewTimer.current) {
        window.clearTimeout(openPreviewTimer.current);
        openPreviewTimer.current = null;
      }
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      if (openPreviewTimer.current) window.clearTimeout(openPreviewTimer.current);
      if (closePreviewTimer.current) window.clearTimeout(closePreviewTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!previewPosition) return;

    const handleGlobalScroll = () => {
      setPreviewPosition(null);
      setIsClosing(false);
    };

    window.addEventListener('scroll', handleGlobalScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleGlobalScroll, { capture: true });
    };
  }, [previewPosition]);

  const openHoverPreview = () => {
    if (openPreviewTimer.current) {
      window.clearTimeout(openPreviewTimer.current);
    }
    openPreviewTimer.current = window.setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect || typeof window === 'undefined') return;

      if (closePreviewTimer.current) {
        window.clearTimeout(closePreviewTimer.current);
        closePreviewTimer.current = null;
      }
      setIsClosing(false);

      const previewWidth = 330;

      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - previewWidth / 2, 16),
        window.innerWidth - previewWidth - 16
      );
      const preferredTop = rect.top - 15;
      const top = Math.max(preferredTop, 12);

      setPreviewPosition({ left, top });
      openPreviewTimer.current = null;
    }, 120);
  };

  const scheduleCloseHoverPreview = () => {
    if (typeof window === 'undefined') {
      setPreviewPosition(null);
      setIsClosing(false);
      return;
    }
    if (openPreviewTimer.current) {
      window.clearTimeout(openPreviewTimer.current);
      openPreviewTimer.current = null;
    }
    if (closePreviewTimer.current) {
      window.clearTimeout(closePreviewTimer.current);
    }

    closePreviewTimer.current = window.setTimeout(() => {
      setIsClosing(true);

      closePreviewTimer.current = window.setTimeout(() => {
        setPreviewPosition(null);
        setIsClosing(false);
        closePreviewTimer.current = null;
      }, 220);
    }, 120);
  };

  const keepHoverPreviewOpen = () => {
    if (openPreviewTimer.current) {
      window.clearTimeout(openPreviewTimer.current);
      openPreviewTimer.current = null;
    }
    if (closePreviewTimer.current && typeof window !== 'undefined') {
      window.clearTimeout(closePreviewTimer.current);
      closePreviewTimer.current = null;
    }
    setIsClosing(false);
  };

  return {
    previewPosition,
    isClosing,
    openHoverPreview,
    scheduleCloseHoverPreview,
    keepHoverPreviewOpen,
    setPreviewPosition
  };
}

interface HoverPreviewPortalProps {
  channel: PlaylistItem;
  fallbackLogo?: string;
  previewPosition: { left: number; top: number };
  isClosing: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
  globalFavorites: string[];
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  handlePlayStream?: (item: PlaylistItem) => void;
}

export function HoverPreviewPortal({
  channel,
  fallbackLogo,
  previewPosition,
  isClosing,
  onMouseEnter,
  onMouseLeave,
  onClose,
  globalFavorites,
  toggleFavorite,
  handleOpenDetails,
  handlePlayStream
}: HoverPreviewPortalProps) {
  const { language } = useSettings();
  const quality = getQualityLabel(channel.name);
  const isLive = channel.type === 'live';

  const cleanTitle = useMemo(() => {
    if (channel.type === 'series') {
      return parseSeriesEpisodeInfo(channel.name).cleanTitle;
    }
    return cleanMediaTitle(channel.name);
  }, [channel.name, channel.type]);

  const [metadata, setMetadata] = useState<TmdbMetadata | null>(null);

  useEffect(() => {
    if (isLive) return;

    let cancelled = false;
    const endpoint = channel.type === 'series' ? 'tv' : 'movie';
    const cacheKey = `vod-meta-v2-${channel.type}-${cleanTitle.toLowerCase()}`;

    const loadMetadata = async () => {
      if (globalVodMetadataMap.has(cacheKey)) {
        if (!cancelled) setMetadata(globalVodMetadataMap.get(cacheKey)!);
        return;
      }

      try {
        const cached = await tmdbCache.get(cacheKey);
        if (cached && (cached.posterUrl !== null || (!cached.rating && !cached.year && !cached.overview))) {
          globalVodMetadataMap.set(cacheKey, cached);
          if (!cancelled) setMetadata(cached);
          return;
        }
      } catch (e) {
        console.error("Failed to read VOD meta cache:", e);
      }

      try {
        const result: any = await getResolvedTmdbResult(endpoint, getTmdbApiKey(), cleanTitle);
        if (cancelled) return;

        if (!result) {
          const fallback: TmdbMetadata = {
            posterUrl: null,
            backdropUrl: null,
            rating: '',
            year: '',
            overview: '',
            genres: [],
            duration: channel.type === 'series' ? 'DİZİ' : 'FİLM'
          };
          globalVodMetadataMap.set(cacheKey, fallback);
          await tmdbCache.set(cacheKey, fallback);
          if (!cancelled) setMetadata(fallback);
          return;
        }

        let duration = channel.type === 'series' ? 'DİZİ' : 'FİLM';
        let genres: string[] = [];

        try {
          const details: any = await fetchTmdbDetails(endpoint, getTmdbApiKey(), result.id);
          if (details && !details.error) {
            if (details.genres) {
              genres = details.genres.map((g: any) => g.name.toUpperCase());
            }
            if (channel.type === 'series') {
              if (details.number_of_seasons) {
                duration = `${details.number_of_seasons} SEZON`;
              }
            } else {
              if (details.runtime) {
                const hrs = Math.floor(details.runtime / 60);
                const mins = details.runtime % 60;
                duration = hrs > 0
                  ? (mins > 0 ? `${hrs} SA ${mins} DK` : `${hrs} SA`)
                  : `${mins} DK`;
              }
            }
          }
        } catch (err) {
          console.warn("Failed to fetch TMDB details, falling back to basic result:", err);
          if (result.genre_ids) {
            genres = result.genre_ids
              .map((id: number) => TMDB_GENRES[id])
              .filter(Boolean);
          }
        }

        let posterUrl: string | null = null;
        let backdropUrl: string | null = null;

        if (result.poster_path) {
          posterUrl = await resolveTmdbImageSrc(result.poster_path, 'w500');
        }
        if (result.backdrop_path) {
          backdropUrl = await resolveTmdbImageSrc(result.backdrop_path, 'w780');
        } else {
          backdropUrl = posterUrl;
        }

        const rating = result.vote_average && result.vote_average > 0
          ? result.vote_average.toFixed(1)
          : '';

        const year = (result.release_date || result.first_air_date || '').substring(0, 4);

        const overview = result.overview || '';

        const finalMeta: TmdbMetadata = {
          posterUrl,
          backdropUrl,
          rating,
          year,
          overview,
          genres,
          duration
        };

        globalVodMetadataMap.set(cacheKey, finalMeta);
        await tmdbCache.set(cacheKey, finalMeta);

        if (!cancelled) setMetadata(finalMeta);
      } catch (err) {
        console.error("VOD metadata loading failed:", err);
        const errFallback: TmdbMetadata = {
          posterUrl: null,
          backdropUrl: null,
          rating: '',
          year: '',
          overview: '',
          genres: [],
          duration: channel.type === 'series' ? 'DİZİ' : 'FİLM'
        };
        if (!cancelled) setMetadata(errFallback);
      }
    };

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [channel.type, cleanTitle, isLive]);

  const displayTitle = channel.type === 'series'
    ? parseSeriesEpisodeInfo(channel.name).cleanTitle
    : (isLive ? channel.name : cleanMediaTitle(channel.name));

  const displayGenres = (metadata && metadata.genres.length > 0)
    ? metadata.genres.slice(0, 2)
    : (channel.group ? [channel.group.toUpperCase()] : []);

  const displayOverview = isLive
    ? (language === 'tr' ? "Kesintisiz canlı TV yayınını şimdi Full HD kalitede izleyin." : "Watch seamless live TV broadcast in high quality now.")
    : ((metadata && metadata.overview) || (
        channel.type === 'series'
          ? (language === 'tr'
            ? `${displayTitle} dizisinin tüm sezon ve bölümlerini Türkçe izleyin.`
            : `Watch all seasons and episodes of the series ${displayTitle} online.`)
          : (language === 'tr'
            ? `${displayTitle} filmini kesintisiz Full HD kalitede şimdi izleyin.`
            : `Watch the movie ${displayTitle} in high quality now.`)
      ));

  let displayDuration = metadata ? metadata.duration : '';
  if (displayDuration && displayDuration.endsWith(' DK')) {
    const rawMins = displayDuration.replace(' DK', '').trim();
    if (/^\d+$/.test(rawMins)) {
      const minutes = parseInt(rawMins, 10);
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      displayDuration = hrs > 0
        ? (mins > 0 ? `${hrs} SA ${mins} DK` : `${hrs} SA`)
        : `${mins} DK`;
    }
  }
  displayDuration = translateDuration(displayDuration, language);

  const previewImageSrc = isLive ? channel.logo : ((metadata && metadata.backdropUrl) || (metadata && metadata.posterUrl) || channel.logo || fallbackLogo);
  const isInFavorites = globalFavorites.includes(channel.id);

  const hideLabel = channel.type === 'series'
    ? (language === 'tr' ? 'Diziyi gizle' : 'Hide series')
    : (isLive
      ? (language === 'tr' ? 'Kanalı gizle' : 'Hide channel')
      : (language === 'tr' ? 'Filmi gizle' : 'Hide movie'));

  const favLabel = isInFavorites
    ? (language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites')
    : (language === 'tr' ? 'Favorilere ekle' : 'Add to favorites');

  return createPortal(
    <div
      className={`home-hover-preview fixed z-40 w-[330px] overflow-hidden rounded-[20px] border border-white/[0.08] bg-neutral-950/98 shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-2xl ${
        isClosing ? 'preview-shrink' : 'animate-preview-grow'
      }`}
      style={{ left: previewPosition.left, top: previewPosition.top }}
      onClick={(event) => event.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
        <ImageWithFallback
          src={previewImageSrc || fallbackLogo || undefined}
          name={channel.name}
          group={channel.group || 'VOD'}
          itemType={channel.type}
          isGenericLogo={false}
          aspect="landscape"
          cover={true}
          lazy={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/35 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
          {isLive ? (
            <span className="h-[18px] px-2 bg-red-600 border border-red-500/30 text-[8px] font-black tracking-wider rounded text-white flex items-center justify-center animate-pulse">
              {language === 'tr' ? 'CANLI' : 'LIVE'}
            </span>
          ) : (
            <span className="h-[18px] px-2 bg-black/60 backdrop-blur-md border border-white/10 text-[8px] font-black tracking-wider rounded text-white/90 flex items-center justify-center">
              {channel.type === 'series' ? (language === 'tr' ? 'DİZİ' : 'TV') : (language === 'tr' ? 'FİLM' : 'MOVIE')}
            </span>
          )}
          {quality && (
            <span className="h-[18px] px-2 bg-[var(--accent-color)]/20 backdrop-blur-md border border-[var(--accent-color)]/30 text-[8px] font-black tracking-wider rounded text-[var(--accent-color)] flex items-center justify-center">
              {quality}
            </span>
          )}
        </div>

        {channel.progress !== undefined && channel.progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div className="h-full bg-[var(--accent-color)]" style={{ width: `${channel.progress}%` }} />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2.5">
        <div>
          <h3 className="line-clamp-1 text-[16px] font-black leading-tight text-white tracking-wide" title={displayTitle}>
            {displayTitle}
          </h3>

          <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-400">
            <span className="h-4.5 w-4.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">✓</span>
            <span>{language === 'tr' ? "İzlemeye Hazır" : 'Ready to watch'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (handlePlayStream) {
                handlePlayStream(channel);
              } else {
                handleOpenDetails(channel);
              }
              onClose();
            }}
            className="flex-1 flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-black text-black transition-all hover:bg-neutral-200 active:scale-95 shadow-[0_4px_12px_rgba(255,255,255,0.15)] cursor-pointer"
          >
            <Play size={12} fill="currentColor" />
            <span className="truncate">
              {channel.progress ? (language === 'tr' ? 'Devam Et' : 'Continue') : (language === 'tr' ? 'Oynat' : 'Play')}
            </span>
          </button>

          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] border border-white/[0.04] text-neutral-300 transition-all hover:bg-white/[0.12] hover:text-white active:scale-95 cursor-pointer"
            onClick={(event) => {
              toggleFavorite(channel.id, event);
            }}
            title={favLabel}
          >
            {isInFavorites ? <Heart size={14} fill="currentColor" className="text-red-500" /> : <Plus size={16} />}
          </button>

          {!isLive && (
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] border border-white/[0.04] text-neutral-300 transition-all hover:bg-white/[0.12] hover:text-white active:scale-95 cursor-pointer"
              onClick={() => handleOpenDetails(channel)}
              title={language === 'tr' ? 'Detaylar' : 'Details'}
            >
              <Info size={14} />
            </button>
          )}

          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] border border-white/[0.04] text-neutral-300 hover:text-red-400 transition-all hover:bg-white/[0.12] active:scale-95 cursor-pointer"
            onClick={onClose}
            title={hideLabel}
          >
            <Ban size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2.5 text-[11px] font-bold text-neutral-400 mt-0.5">
          {metadata && metadata.rating && (
            <span className="flex items-center gap-0.5 text-yellow-500 font-bold">
              ★ {metadata.rating}
            </span>
          )}
          {metadata && metadata.rating && <span>•</span>}
          {metadata && metadata.year && <span>{metadata.year}</span>}
          {metadata && metadata.year && <span>•</span>}
          {displayDuration && <span>{displayDuration}</span>}
          {(!metadata || !metadata.year) && displayGenres[0] && (
            <span>{displayGenres[0].toLowerCase()}</span>
          )}
          {metadata && metadata.year && displayGenres[0] && (
            <>
              <span>•</span>
              <span className="truncate max-w-[90px] text-neutral-500">{displayGenres[0].toLowerCase()}</span>
            </>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-neutral-400/85 font-medium line-clamp-3 mt-1">
          {displayOverview}
        </p>
      </div>
    </div>,
    document.getElementById('hover-preview-portal-target') || document.body
  );
}
