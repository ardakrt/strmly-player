import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Heart, Play } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import type { TmdbMetadata } from '../../utils/vodHelpers';
import { ImageWithFallback } from '../ImageWithFallback';
import { cleanMediaTitle, parseSeriesEpisodeInfo } from '../../utils/seriesGroupers';
import { getResolvedTmdbResult, getTmdbApiKey, resolveTmdbImageSrc, tmdbCache, fetchTmdbDetails } from '../../utils/tmdb';
import { useSettings } from '../../context/SettingsContext';
import { TiltHoverCard } from '../TiltHoverCard';

interface VodPosterCardProps {
  channel: any; // Can be PlaylistItem or GroupedSeries
  globalFavorites: string[];
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  requireTmdbPoster?: boolean;
  rank?: number;
  rankLabel?: string;
  onContextMenu?: (event: React.MouseEvent, item: any) => void;
}

export function HomeRailHeader({
  title,
  actionLabel,
  onAction,
  mutedLabel,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  mutedLabel?: string;
}) {
  return (
    <div className="home-rail-header flex items-center justify-between px-0 mb-0.5">
      <h3 className="home-rail-title text-[15px] md:text-base font-semibold tracking-tight text-white/85">{title}</h3>
      {onAction && actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="group/see-all inline-flex items-center gap-0.5 text-[12px] text-white/35 hover:text-white/70 font-medium transition-colors"
        >
          {actionLabel}
          <ChevronRight size={14} className="transition-transform group-hover/see-all:translate-x-0.5" />
        </button>
      ) : mutedLabel ? (
        <span className="home-rail-muted text-[11px] text-white/25 font-medium">{mutedLabel}</span>
      ) : null}
    </div>
  );
}



const globalVodMetadataMap = new Map<string, TmdbMetadata>();

const TMDB_GENRES: Record<number, { tr: string; en: string }> = {
  28: { tr: 'AKSİYON', en: 'ACTION' },
  12: { tr: 'MACERA', en: 'ADVENTURE' },
  16: { tr: 'ANİMASYON', en: 'ANIMATION' },
  35: { tr: 'KOMEDİ', en: 'COMEDY' },
  80: { tr: 'POLİSİYE', en: 'CRIME' },
  99: { tr: 'BELGESEL', en: 'DOCUMENTARY' },
  18: { tr: 'DRAM', en: 'DRAMA' },
  10751: { tr: 'AİLE', en: 'FAMILY' },
  14: { tr: 'FANTASTİK', en: 'FANTASY' },
  36: { tr: 'TARİH', en: 'HISTORY' },
  27: { tr: 'KORKU', en: 'HORROR' },
  10402: { tr: 'MÜZİK', en: 'MUSIC' },
  9648: { tr: 'GİZEM', en: 'MYSTERY' },
  10749: { tr: 'ROMANTİK', en: 'ROMANCE' },
  878: { tr: 'BİLİM-KURGU', en: 'SCI-FI' },
  10770: { tr: 'TV FİLMİ', en: 'TV MOVIE' },
  53: { tr: 'GERİLİM', en: 'THRILLER' },
  10752: { tr: 'SAVAŞ', en: 'WAR' },
  37: { tr: 'VAHŞİ BATI', en: 'WESTERN' },
  10759: { tr: 'AKSİYON & MACERA', en: 'ACTION & ADVENTURE' },
  10762: { tr: 'ÇOCUK', en: 'KIDS' },
  10763: { tr: 'HABER', en: 'NEWS' },
  10764: { tr: 'REALITY', en: 'REALITY' },
  10765: { tr: 'BİLİM-KURGU & FANTASTİK', en: 'SCI-FI & FANTASY' },
  10766: { tr: 'PEMBE DİZİ', en: 'SOAP' },
  10767: { tr: 'TALK SHOW', en: 'TALK SHOW' },
  10768: { tr: 'SAVAŞ & POLİTİKA', en: 'WAR & POLITICS' }
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

const translateDuration = (durationStr: string, language: 'tr' | 'en'): string => {
  if (!durationStr) return '';
  if (language === 'tr') return durationStr;
  return durationStr
    .replace(/DİZİ/g, 'SERIES')
    .replace(/FİLM/g, 'MOVIE')
    .replace(/SEZON/g, 'SEASON')
    .replace(/SA/g, 'H')
    .replace(/DK/g, 'M');
};

export function VodPosterCard({ channel, globalFavorites, toggleFavorite, handleOpenDetails, rank, rankLabel, onContextMenu }: VodPosterCardProps) {
  const { language } = useSettings();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [failedPosterSrc, setFailedPosterSrc] = useState<string | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;


    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '360px' });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cleanTitle = useMemo(() => {
    if (channel.type === 'series') {
      return parseSeriesEpisodeInfo(channel.name).cleanTitle;
    }
    return cleanMediaTitle(channel.name);
  }, [channel.name, channel.type]);

  const [metadata, setMetadata] = useState<TmdbMetadata | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    const endpoint = channel.type === 'series' ? 'tv' : 'movie';
    const cacheKey = `vod-meta-v3-${channel.type}-${cleanTitle}`;

    const loadMetadata = async () => {
      if (globalVodMetadataMap.has(cacheKey)) {
        if (!cancelled) setMetadata(globalVodMetadataMap.get(cacheKey)!);
        return;
      }

      try {
        const cached = await tmdbCache.get(cacheKey);
        // Self-healing: If cached metadata exists but posterUrl is null, and it was a successful TMDB match
        // (meaning it has a rating, year, or overview), let's bypass the cache to re-resolve the poster.
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
        let genres: string[] = Array.isArray(result.genre_ids)
          ? result.genre_ids
              .map((id: number) => TMDB_GENRES[id]?.[language === 'tr' ? 'tr' : 'en'])
              .filter(Boolean)
          : [];

        const posterUrl = result.poster_path
          ? (await resolveTmdbImageSrc(result.poster_path, 'w342')) || null
          : null;
        const rating = result.vote_average && result.vote_average > 0
          ? result.vote_average.toFixed(1)
          : '';
        const year = (result.release_date || result.first_air_date || '').substring(0, 4);
        const overview = result.overview || '';
        const tmdbTitle = (result.name || result.title || '').trim() || null;

        // Poster-first paint: details/runtime enrich the card afterwards and
        // must never hold the artwork behind a second API round-trip.
        const quickMeta: TmdbMetadata = {
          posterUrl,
          title: tmdbTitle,
          rating,
          year,
          overview,
          genres,
          duration,
        };
        globalVodMetadataMap.set(cacheKey, quickMeta);
        if (!cancelled) setMetadata(quickMeta);

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
          // Search-result genres were already painted with the poster.
        }

        let backdropUrl: string | null = null;
        if (result.backdrop_path) {
          backdropUrl = (await resolveTmdbImageSrc(result.backdrop_path, 'w780')) || null;
        }

        const finalMeta: TmdbMetadata = {
          posterUrl,
          backdropUrl,
          title: tmdbTitle,
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
  }, [channel.type, cleanTitle, isVisible, language]);

  const posterSrc = metadata?.posterUrl || null;
  useEffect(() => {
    setFailedPosterSrc(null);
  }, [posterSrc]);

  if (!isVisible) {
    return <div ref={cardRef} data-card-state="idle" className="flex-shrink-0 w-[176px] md:w-[208px] aspect-[2/3] snap-start" />;
  }

  if (!metadata) {
    return (
      <div ref={cardRef} data-card-state="loading" className="flex-shrink-0 w-[176px] md:w-[208px] snap-start" aria-hidden="true">
        <div className="relative aspect-[2/3] w-full rounded-[22px] overflow-hidden border border-white/5 skeleton-card-shimmer" />
      </div>
    );
  }

  const displayTitle = channel.type === 'series'
    ? parseSeriesEpisodeInfo(channel.name).cleanTitle
    : cleanMediaTitle(channel.name);

  const displayGenres = metadata.genres.length > 0
    ? metadata.genres.slice(0, 2)
    : (channel.group ? [channel.group.toUpperCase()] : []);

  let displayDuration = metadata.duration;
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
  if (!displayDuration) {
    if (channel.type === 'series') {
      const seasonsCount = channel.seasons ? Object.keys(channel.seasons).length : 0;
      displayDuration = seasonsCount > 0 ? `${seasonsCount} SEZON` : 'DİZİ';
    } else {
      displayDuration = 'FİLM';
    }
  }
  displayDuration = translateDuration(displayDuration, language);

  const usablePosterSrc = posterSrc && posterSrc !== failedPosterSrc ? posterSrc : null;
  const isFavorite = globalFavorites.includes(channel.id);

  const handleCardClick = () => {
    const flatItem = getFlatItem(channel);
    handleOpenDetails(flatItem);
  };

  return (
    <div
      ref={cardRef}
      data-card-state="ready"
      data-rank={rank}
      className={`home-poster-card flex-shrink-0 w-[168px] md:w-[196px] group snap-start transition-colors duration-300 hover:z-20 ${rank ? 'home-poster-card--ranked' : ''}`}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
    >
      <TiltHoverCard className="w-full rounded-[16px]">
        <div className="home-poster-frame relative isolate aspect-[2/3] w-full overflow-hidden rounded-[16px] flex items-center justify-center">
          {usablePosterSrc ? (
            <img
              src={usablePosterSrc}
              alt=""
              className="home-poster-media animate-fade-in transition-transform duration-500"
              onError={() => setFailedPosterSrc(usablePosterSrc)}
            />
          ) : (
            <ImageWithFallback
              src={channel.logo}
              name={channel.name}
              group={channel.group || 'VOD'}
              itemType={channel.type}
              isGenericLogo={false}
              aspect="portrait"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent pointer-events-none" />
          {rank ? (
            <span className="top10-rank-overlay" aria-hidden="true">{rank}</span>
          ) : null}

          {/* Calm badges: type + year only */}
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <span className="h-5 px-2 text-[9px] font-semibold tracking-wide rounded-md text-white/90 bg-black/45 backdrop-blur-sm border border-white/10 flex items-center">
              {channel.type === 'series' ? (language === 'tr' ? 'Dizi' : 'Series') : (language === 'tr' ? 'Film' : 'Movie')}
            </span>
          </div>
          {metadata.year ? (
            <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
              <span className="h-5 px-2 text-[9px] font-semibold text-white/70 bg-black/45 backdrop-blur-sm rounded-md border border-white/10 flex items-center">
                {metadata.year}
              </span>
            </div>
          ) : null}

          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-15">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
              <Play size={16} fill="#000" className="ml-0.5" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCardClick}
            aria-label={rankLabel ? `${rankLabel}: ${displayTitle}` : displayTitle}
            className="absolute inset-0 z-[25] cursor-pointer rounded-[16px] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
          />

          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(channel.id, e);
            }}
            className="absolute bottom-2.5 right-2.5 z-30 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-white/60 hover:text-red-400 transition-all"
            title={language === 'tr' ? (isFavorite ? 'Favoriden çıkar' : 'Favoriye ekle') : (isFavorite ? 'Remove favorite' : 'Add favorite')}
            aria-label={language === 'tr' ? (isFavorite ? 'Favoriden çıkar' : 'Favoriye ekle') : (isFavorite ? 'Remove favorite' : 'Add favorite')}
          >
            <Heart size={13} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
          </button>

          <div className="absolute inset-x-0 bottom-0 z-20 p-3 pr-11 pointer-events-none">
            <h4 className="text-[13px] font-semibold text-white line-clamp-1 leading-tight">
              {displayTitle}
            </h4>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-white/45">
              {metadata.rating ? (
                <span className="inline-flex items-center gap-0.5 text-amber-400/90">
                  <span className="text-[10px]">★</span> {metadata.rating}
                </span>
              ) : null}
              {metadata.rating && displayDuration ? <span className="text-white/20">·</span> : null}
              <span className="truncate">{displayDuration}</span>
              {displayGenres[0] ? (
                <>
                  <span className="text-white/20">·</span>
                  <span className="truncate">{displayGenres[0]}</span>
                </>
              ) : null}
            </div>
          </div>
          {channel.progress !== undefined && channel.progress > 0 && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-30">
              <div
                className="h-full bg-red-500"
                style={{ width: `${Math.min(Math.max(channel.progress, 0), 100)}%` }}
              />
            </div>
          )}
        </div>
      </TiltHoverCard>
    </div>
  );
}

export function Top10Card({
  rank,
  rankLabel,
  item,
  globalFavorites,
  toggleFavorite,
  handleOpenDetails,
  onContextMenu,
}: {
  rank: number;
  rankLabel: string;
  item: any;
  globalFavorites: string[];
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  onContextMenu?: (event: React.MouseEvent, item: any) => void;
}) {
  return (
    <div className={`top10-card group/top10 relative flex shrink-0 items-end snap-start ${rank === 1 ? 'top10-card--rank-one' : ''} ${rank === 10 ? 'top10-card--double' : ''}`}>
      <div className="top10-card-poster relative z-10 w-full">
        <VodPosterCard
          channel={item}
          rank={rank}
          rankLabel={rankLabel}
          globalFavorites={globalFavorites}
          toggleFavorite={toggleFavorite}
          handleOpenDetails={handleOpenDetails}
          onContextMenu={onContextMenu}
          requireTmdbPoster
        />
      </div>
    </div>
  );
}

