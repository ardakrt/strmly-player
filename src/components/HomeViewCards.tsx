import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Heart, Info } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import { ImageWithFallback } from './ImageWithFallback';
import { cleanMediaTitle, parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { getResolvedTmdbResult, getTmdbApiKey, resolveTmdbImageSrc, tmdbCache, fetchTmdbDetails } from '../utils/tmdb';
import { useSettings } from '../context/SettingsContext';
import { getFlatItem, getQualityLabel, globalVodMetadataMap, HoverPreviewPortal, TMDB_GENRES, translateDuration, useHoverPreview } from './HomeHoverPreview';
import type { TmdbMetadata, VodPosterCardProps } from './HomeHoverPreview';
export { getFlatItem } from './HomeHoverPreview';

interface LiveTvQuickChannelCardProps {
  channel: PlaylistItem;
  globalFavorites: string[];
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  handlePlayStream: (item: PlaylistItem) => void;
  openContextMenu: (event: React.MouseEvent, item: any) => void;
}

export function LiveTvQuickChannelCard({
  channel,
  globalFavorites,
  toggleFavorite,
  handlePlayStream,
  openContextMenu
}: LiveTvQuickChannelCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const {
    previewPosition,
    isClosing,
    openHoverPreview,
    scheduleCloseHoverPreview,
    keepHoverPreviewOpen,
    setPreviewPosition
  } = useHoverPreview(cardRef);

  return (
    <div
      ref={cardRef}
      className="flex-shrink-0 w-[170px] md:w-[210px] group cursor-pointer snap-start transition-transform duration-300 hover:scale-[1.035] hover:z-20"
      onClick={() => handlePlayStream(channel)}
      onMouseEnter={openHoverPreview}
      onMouseLeave={scheduleCloseHoverPreview}
      onContextMenu={(event) => openContextMenu(event, channel)}
    >
      <div className="relative w-full aspect-video rounded-[18px] overflow-hidden bg-neutral-900 border border-white/[0.07] shadow-[0_12px_30px_rgba(0,0,0,0.35)] group-hover:border-white/20 transition-all duration-300 flex items-center justify-center">
        <ImageWithFallback
          src={channel.logo}
          name={channel.name}
          group={channel.group || 'LIVE'}
          itemType={channel.type}
          isGenericLogo={channel.isGenericLogo}
          aspect="landscape"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent z-10" />
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-25">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play size={16} fill="#000" className="ml-0.5" />
          </div>
        </div>
        <button type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(channel.id, e);
          }}
          className="absolute top-2.5 right-2.5 z-30 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 shadow-sm"
          title="Favorilere Ekle"
         aria-label="Favorilere Ekle">
          <Heart size={12} fill={globalFavorites.includes(channel.id) ? 'currentColor' : 'none'} className={globalFavorites.includes(channel.id) ? 'text-red-500' : ''} />
        </button>
        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-2.5 pt-8 pointer-events-none">
          <span className="block text-xs font-extrabold text-white truncate drop-shadow">{channel.name}</span>
          <span className="block text-[9px] text-white/50 uppercase tracking-wider font-semibold mt-0.5 truncate">{channel.group || 'Genel'}</span>
        </div>
      </div>

      {previewPosition && (
        <HoverPreviewPortal
          channel={channel}
          fallbackLogo={channel.logo}
          previewPosition={previewPosition}
          isClosing={isClosing}
          onMouseEnter={keepHoverPreviewOpen}
          onMouseLeave={scheduleCloseHoverPreview}
          onClose={() => setPreviewPosition(null)}
          globalFavorites={globalFavorites}
          toggleFavorite={toggleFavorite}
          handleOpenDetails={() => {}}
          handlePlayStream={handlePlayStream}
        />
      )}
    </div>
  );
}

interface ContinueWatchingCardProps {
  channel: PlaylistItem;
  language: 'tr' | 'en';
  globalFavorites: string[];
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  handlePlayStream: (item: PlaylistItem) => void;
  openContextMenu: (event: React.MouseEvent, item: any, fromHistory?: boolean) => void;
}

export function ContinueWatchingCard({
  channel,
  language,
  globalFavorites,
  toggleFavorite,
  handlePlayStream,
  openContextMenu
}: ContinueWatchingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const {
    previewPosition,
    isClosing,
    openHoverPreview,
    scheduleCloseHoverPreview,
    keepHoverPreviewOpen,
    setPreviewPosition
  } = useHoverPreview(cardRef);

  return (
    <div
      ref={cardRef}
      className="flex-shrink-0 w-[200px] md:w-[240px] group cursor-pointer snap-start transition-all duration-300 hover:scale-[1.03]"
      onClick={() => handlePlayStream(channel)}
      onMouseEnter={openHoverPreview}
      onMouseLeave={scheduleCloseHoverPreview}
      onContextMenu={(event) => openContextMenu(event, channel, true)}
    >
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-white/5 shadow-lg transition-all duration-300 group-hover:border-white/15 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.55)] flex items-center justify-center">
        <ImageWithFallback
          src={channel.logo}
          name={channel.name}
          group={channel.group || 'LIVE'}
          itemType={channel.type}
          isGenericLogo={channel.isGenericLogo}
          aspect="landscape"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-25">
          <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play size={15} fill="#000" className="ml-0.5" />
          </div>
        </div>

        {channel.progress !== undefined && channel.progress > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-20">
            <div
              className="h-full bg-[var(--accent-color)] transition-all duration-300"
              style={{ width: `${channel.progress}%` }}
            />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-2.5 pt-8 pointer-events-none">
          {(() => {
            if (channel.type === 'series') {
              const parsed = parseSeriesEpisodeInfo(channel.name);
              if (parsed.season > 0 && parsed.episode > 0) {
                return (
                  <span className="block text-xs font-extrabold text-white truncate drop-shadow">
                    {parsed.cleanTitle} • {language === 'tr' ? `${parsed.season}. Sezon ${parsed.episode}. Bölüm` : `S${parsed.season} E${parsed.episode}`}
                  </span>
                );
              }
            }
            return <span className="block text-xs font-extrabold text-white truncate drop-shadow">{channel.name}</span>;
          })()}
          <span className="block text-[9px] text-white/55 uppercase tracking-wider font-semibold mt-0.5 truncate">{channel.group || (language === 'tr' ? 'Genel' : 'General')}</span>
        </div>
      </div>

      {previewPosition && (
        <HoverPreviewPortal
          channel={channel}
          fallbackLogo={channel.logo}
          previewPosition={previewPosition}
          isClosing={isClosing}
          onMouseEnter={keepHoverPreviewOpen}
          onMouseLeave={scheduleCloseHoverPreview}
          onClose={() => setPreviewPosition(null)}
          globalFavorites={globalFavorites}
          toggleFavorite={toggleFavorite}
          handleOpenDetails={() => {}}
          handlePlayStream={handlePlayStream}
        />
      )}
    </div>
  );
}

export function VodPosterCard({ channel, globalFavorites, toggleFavorite, handleOpenDetails, handlePlayStream, onContextMenu }: VodPosterCardProps) {
  const { language } = useSettings();
  const quality = getQualityLabel(channel.name);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
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
    }, { rootMargin: '360px' });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const {
    previewPosition,
    isClosing,
    openHoverPreview,
    scheduleCloseHoverPreview,
    keepHoverPreviewOpen,
    setPreviewPosition
  } = useHoverPreview(cardRef);

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
  }, [channel.type, cleanTitle, isVisible]);

  if (!isVisible) {
    return <div ref={cardRef} className="flex-shrink-0 w-[176px] md:w-[208px] aspect-[2/3] snap-start" />;
  }

  if (!metadata) {
    return (
      <div ref={cardRef} className="flex-shrink-0 w-[176px] md:w-[208px] snap-start">
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

  const posterSrc = metadata.posterUrl || channel.logo;
  const isInFavorites = globalFavorites.includes(channel.id);

  const handleCardClick = () => {
    const flatItem = getFlatItem(channel);
    handleOpenDetails(flatItem);
  };

  return (
    <div
      ref={cardRef}
      className="home-poster-card flex-shrink-0 w-[176px] md:w-[208px] group cursor-pointer snap-start transition-all duration-300 hover:scale-[1.03] hover:z-20"
      onClick={handleCardClick}
      onMouseEnter={openHoverPreview}
      onMouseLeave={scheduleCloseHoverPreview}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
    >
      <div className="relative aspect-[2/3] w-full rounded-[22px] overflow-hidden bg-neutral-950/60 border border-white/[0.07] shadow-[0_14px_38px_rgba(0,0,0,0.4)] flex items-center justify-center transition-all duration-300 group-hover:border-white/20 group-hover:shadow-[0_22px_55px_rgba(0,0,0,0.58)]">
        {posterSrc ? (
          <img src={posterSrc} alt="" className="absolute inset-0 w-full h-full object-cover animate-fade-in transition-transform duration-500 group-hover:scale-105" />
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
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/20 pointer-events-none" />

        {/* Floating Badges on Card */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
          <span className="home-media-type-badge h-[22px] px-2.5 text-[9px] font-extrabold tracking-wider rounded-full text-white shadow-md flex items-center justify-center border border-white/10">
            {channel.type === 'series' ? 'DİZİ' : 'FİLM'}
          </span>
          {quality && (
            <span className="h-[22px] px-2.5 bg-[var(--accent-color)]/25 text-[var(--accent-color)] font-extrabold text-[9px] rounded-full flex items-center justify-center border border-[var(--accent-color)]/20 shadow-md">
              {quality}
            </span>
          )}
          {metadata.rating && (
            <span className="h-[22px] px-2 bg-black/60 backdrop-blur-sm text-white font-extrabold text-[9px] md:text-[10px] rounded-full flex items-center justify-center gap-1 shadow-sm border border-white/10">
              <span className="text-yellow-400 text-xs">★</span> {metadata.rating}
            </span>
          )}
        </div>

        {metadata.year && (
          <div className="absolute top-3 right-3 z-10 pointer-events-none">
            <span className="h-[22px] px-2.5 bg-black/60 backdrop-blur-sm text-neutral-200 font-extrabold text-[9px] md:text-[10px] rounded-full border border-white/10 shadow-sm flex items-center justify-center">
              {metadata.year}
            </span>
          </div>
        )}

        {/* Center Glassmorphic Play Button on Hover */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const flatItem = getFlatItem(channel);
            if (handlePlayStream && flatItem.type !== 'series') {
              handlePlayStream(flatItem);
            } else {
              handleOpenDetails(flatItem);
            }
          }}
          className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-15 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--accent-color)] text-black flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-all duration-300 hover:scale-110">
            <Play size={18} fill="#000" className="ml-1" />
          </div>
        </button>

        {/* Bottom Actions Row (Favorite & Details) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(channel.id, e);
          }}
          className="absolute bottom-3 right-3 z-30 w-8 h-8 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 shadow-lg cursor-pointer"
          title={isInFavorites ? (language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites') : (language === 'tr' ? 'Favorilere ekle' : 'Add to favorites')}
         aria-label={isInFavorites ? (language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites') : (language === 'tr' ? 'Favorilere ekle' : 'Add to favorites')}>
          <Heart size={13} fill={globalFavorites.includes(channel.id) ? 'currentColor' : 'none'} className={globalFavorites.includes(channel.id) ? 'text-red-500' : ''} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetails(getFlatItem(channel));
          }}
          className="absolute bottom-3 right-12 z-30 w-8 h-8 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-white transition-all transform hover:scale-110 shadow-lg cursor-pointer"
          title={language === 'tr' ? 'Detaylar' : 'Details'}
         aria-label={language === 'tr' ? 'Detaylar' : 'Details'}>
          <Info size={13} />
        </button>

        <div className="absolute inset-x-0 bottom-0 z-20 p-3.5 pr-22 pt-12 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none">
          <h4 className="text-sm md:text-[15px] font-extrabold text-white line-clamp-1 leading-tight drop-shadow">
            {displayTitle}
          </h4>
          <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-white/55 transition-all duration-300 group-hover:text-white/75">
            {metadata.duration && <span>{translateDuration(metadata.duration, language)}</span>}
            {displayGenres[0] && <><span className="text-white/25">•</span><span className="truncate">{displayGenres[0]}</span></>}
          </div>
        </div>
        {channel.progress !== undefined && channel.progress > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-20">
            <div
              className="h-full bg-[var(--accent-color)] transition-all duration-300"
              style={{ width: `${channel.progress}%` }}
            />
          </div>
        )}
      </div>

      {previewPosition && (
        <HoverPreviewPortal
          channel={getFlatItem(channel)}
          fallbackLogo={channel.logo}
          previewPosition={previewPosition}
          isClosing={isClosing}
          onMouseEnter={keepHoverPreviewOpen}
          onMouseLeave={scheduleCloseHoverPreview}
          onClose={() => setPreviewPosition(null)}
          globalFavorites={globalFavorites}
          toggleFavorite={toggleFavorite}
          handleOpenDetails={handleOpenDetails}
          handlePlayStream={handlePlayStream}
        />
      )}
    </div>
  );
}
