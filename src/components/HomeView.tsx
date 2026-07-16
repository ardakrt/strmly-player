import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Play, ChevronLeft, ChevronRight, UploadCloud, Heart, Info, Trash2 } from 'lucide-react';
import type { ContentPreference, SavedPlaylist } from '../types';
import type { PlaylistItem } from '../utils/m3uParser';
import { ImageWithFallback } from './ImageWithFallback';
import { pickHeroSynopsis, cleanPlaylistLabel } from '../utils/helpers';
import { cleanMediaTitle, parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { getMediaCardLabels } from '../utils/mediaLabels';
import { getResolvedTmdbResult, getTmdbApiKey, resolveTmdbImageSrc, tmdbCache, fetchTmdbDetails, cleanMovieName } from '../utils/tmdb';
import { PrimeHoverCard, useHoverPreview } from './PrimeHoverCard';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { useSettings } from '../context/SettingsContext';

interface VodPosterCardProps {
  channel: any; // Can be PlaylistItem or GroupedSeries
  globalFavorites: string[];
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  requireTmdbPoster?: boolean;
  onContextMenu?: (event: React.MouseEvent, item: any) => void;
}

function HomeRailHeader({
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
    <div className="flex items-center justify-between px-0 mb-0.5">
      <h3 className="text-[15px] md:text-base font-semibold tracking-tight text-white/85">{title}</h3>
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
        <span className="text-[11px] text-white/25 font-medium">{mutedLabel}</span>
      ) : null}
    </div>
  );
}



import type { TmdbMetadata } from '../utils/vodHelpers';

const globalVodMetadataMap = new Map<string, TmdbMetadata>();

const TMDB_GENRES: Record<number, string> = {
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

const getFlatItem = (item: any): PlaylistItem => {
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

function VodPosterCard({ channel, globalFavorites, toggleFavorite, handleOpenDetails, onContextMenu }: VodPosterCardProps) {
  const { language } = useSettings();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const {
    showPreview,
    mountPreview,
    handleMouseEnter,
    handleMouseLeave,
    handlePreviewEnter,
  } = useHoverPreview();

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
        }

        const rating = result.vote_average && result.vote_average > 0
          ? result.vote_average.toFixed(1)
          : '';

        const year = (result.release_date || result.first_air_date || '').substring(0, 4);

        const overview = result.overview || '';
        const tmdbTitle = (result.name || result.title || '').trim() || null;

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

  const posterSrc = metadata.posterUrl;

  const handleCardClick = () => {
    const flatItem = getFlatItem(channel);
    handleOpenDetails(flatItem);
  };

  return (
    <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }} tabIndex={0} role="button"
      ref={cardRef}
      className="home-poster-card flex-shrink-0 w-[168px] md:w-[196px] group cursor-pointer snap-start transition-transform duration-300 hover:scale-[1.03] hover:z-20"
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
    >
      <div className="home-poster-frame relative isolate aspect-[2/3] w-full overflow-hidden rounded-[16px] flex items-center justify-center">
        {posterSrc ? (
          <img src={posterSrc} alt="" className="home-poster-media animate-fade-in transition-transform duration-500" />
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

        <button type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(channel.id, e);
          }}
          className="absolute bottom-2.5 right-2.5 z-30 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white/60 hover:text-red-400 transition-all"
          title="Favorilere Ekle"
         aria-label="Favorilere Ekle">
          <Heart size={13} fill={globalFavorites.includes(channel.id) ? 'currentColor' : 'none'} className={globalFavorites.includes(channel.id) ? 'text-red-500' : ''} />
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
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/10 z-20">
            <div
              className="h-full bg-white/90 transition-all duration-300"
              style={{ width: `${channel.progress}%` }}
            />
          </div>
        )}
      </div>

      {mountPreview && (
        <PrimeHoverCard
          channel={getFlatItem(channel)}
          metadata={metadata}
          cardRef={cardRef}
          visible={showPreview}
          onClose={handleMouseLeave}
          onPreviewEnter={handlePreviewEnter}
          toggleFavorite={toggleFavorite}
          globalFavorites={globalFavorites}
          handleOpenDetails={handleOpenDetails}
        />
      )}
    </div>
  );
}

interface HomeViewProps {
  selectedGroup: string;
  searchQuery: string;
  isPlaylistHero: boolean;
  featuredTmdbData: any;
  fallbackHeroItem: any;
  currentHeroItem: PlaylistItem | null;
  activeFeaturedIndex: number;
  /** Index currently painted (lags target until next slide is ready). */
  displayFeaturedIndex: number;
  setActiveFeaturedIndex: (idx: number) => void;
  activeShowcaseList: any[];
  playlists: SavedPlaylist[];
  uniqueRecentlyWatched: PlaylistItem[];
  clearRecentlyWatched: () => void;
  removeFromRecentlyWatched: (item: PlaylistItem) => void;
  handleScrollSlider: (sliderId: string, direction: 'left' | 'right') => void;
  handlePlayStream: (item: PlaylistItem) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  getFavoriteIdForItem: (item: any) => string;
  homeDiscoveryItems: any[];
  homeLiveTvQuickChannels: PlaylistItem[];
  populerFilmler: PlaylistItem[];
  populerDiziler: any[];
  contentPreferences: ContentPreference[];
  setSelectedGroup: (group: string) => void;
  setActiveLiveCategory: (cat: string) => void;
  setActiveSeriesCategory: (cat: string) => void;
  setActiveMovieCategory: (cat: string) => void;
  onOpenPlaylistSetup: () => void;
  showToast: (message: string) => void;
}

export const HomeView = memo(function HomeView({
  selectedGroup,
  searchQuery,
  isPlaylistHero,
  featuredTmdbData,
  fallbackHeroItem,
  currentHeroItem,
  activeFeaturedIndex,
  displayFeaturedIndex,
  setActiveFeaturedIndex,
  activeShowcaseList,
  playlists,
  uniqueRecentlyWatched,
  clearRecentlyWatched,
  removeFromRecentlyWatched,
  handleScrollSlider,
  handlePlayStream,
  handleOpenDetails,
  toggleFavorite,
  globalFavorites,
  getFavoriteIdForItem,
  homeDiscoveryItems,
  homeLiveTvQuickChannels,
  populerFilmler,
  populerDiziler,
  contentPreferences,
  setSelectedGroup,
  onOpenPlaylistSetup,
  showToast
}: HomeViewProps) {
  const { t, language } = useSettings();
  const [visibleHomeBlocks, setVisibleHomeBlocks] = useState(1);

  const playlistHeroBackdrop = featuredTmdbData?.backdrop;
  const playlistHeroPoster = featuredTmdbData?.poster || currentHeroItem?.logo;
  const fallbackHeroImage = fallbackHeroItem?.img;
  const heroBackdropImage = isPlaylistHero ? (playlistHeroBackdrop || playlistHeroPoster) : fallbackHeroImage;
  // Arka plan resmi (Backdrop) için geçiş yönetimi — sadece hero kartının içinde
  const [loadedBackdrop, setLoadedBackdrop] = useState<string | null>(null);
  const [prevBackdrop, setPrevBackdrop] = useState<string | null>(null);
  const loadedBackdropRef = useRef<string | null>(null);

  useEffect(() => {
    loadedBackdropRef.current = loadedBackdrop;
  }, [loadedBackdrop]);

  useEffect(() => {
    if (!heroBackdropImage) {
      if (loadedBackdropRef.current === null) return;
      setPrevBackdrop(loadedBackdropRef.current);
      setLoadedBackdrop(null);
      loadedBackdropRef.current = null;
      return;
    }
    if (heroBackdropImage === loadedBackdropRef.current) return;

    let cancelled = false;
    const img = new Image();
    const handleLoad = () => {
      if (cancelled) return;
      setPrevBackdrop(loadedBackdropRef.current);
      setLoadedBackdrop(heroBackdropImage);
      loadedBackdropRef.current = heroBackdropImage;
    };
    img.onload = handleLoad;
    img.onerror = handleLoad;
    img.src = heroBackdropImage;
    return () => {
      cancelled = true;
    };
  }, [heroBackdropImage]);

  // Geçişten sonra eski resmi temizle (crossfade süresiyle uyumlu)
  useEffect(() => {
    if (prevBackdrop) {
      const timer = setTimeout(() => {
        setPrevBackdrop(null);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [prevBackdrop]);

  const homeSectionOrder = useMemo(() => {
    const preferredSections = contentPreferences.map(preference => {
      if (preference === 'series') return 'series';
      if (preference === 'movies') return 'movies';
      if (preference === 'sports' || preference === 'live') return 'live';
      return 'discovery';
    });
    return [...new Set([...preferredSections, 'discovery', 'live', 'movies', 'series'])];
  }, [contentPreferences]);
  const getSectionPosition = (section: 'discovery' | 'live' | 'movies' | 'series') => homeSectionOrder.indexOf(section) + 2;
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: any;
    fromHistory: boolean;
  } | null>(null);

  const openContextMenu = (event: React.MouseEvent, item: any, fromHistory = false) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item, fromHistory });
  };

  const contextMenuItems: ContextMenuItem[] = contextMenu ? (() => {
    const item = contextMenu.item;
    const flatItem = getFlatItem(item);
    const favoriteId = getFavoriteIdForItem(item);
    const isFavorite = globalFavorites.includes(favoriteId);
    const isSeries = item.type === 'series';
    const actions: ContextMenuItem[] = [];

    if (contextMenu.fromHistory) {
      actions.push({
        id: 'continue',
        label: 'İzlemeye devam et',
        icon: <Play size={14} fill="currentColor" />,
        onSelect: () => handlePlayStream(flatItem)
      });
    } else if (isSeries) {
      actions.push({
        id: 'open-series',
        label: 'Dizi detayına git',
        icon: <Info size={15} />,
        onSelect: () => handleOpenDetails(flatItem)
      });
    } else {
      actions.push({
        id: 'play',
        label: item.type === 'live' ? 'Kanalı oynat' : 'Şimdi oynat',
        icon: <Play size={14} fill="currentColor" />,
        onSelect: () => handlePlayStream(flatItem)
      });
    }

    if (contextMenu.fromHistory || (!isSeries && item.type !== 'live')) {
      actions.push({
        id: 'details',
        label: isSeries ? 'Dizi detayına git' : 'Detayları aç',
        icon: <Info size={15} />,
        onSelect: () => handleOpenDetails(flatItem)
      });
    }

    actions.push({
      id: 'favorite',
      label: isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle',
      icon: <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />,
      onSelect: () => toggleFavorite(favoriteId)
    });

    if (contextMenu.fromHistory) {
      actions.push({
        id: 'remove-history',
        label: 'İzleme geçmişinden kaldır',
        icon: <Trash2 size={14} />,
        danger: true,
        separatorBefore: true,
        onSelect: () => removeFromRecentlyWatched(flatItem)
      });
    }

    return actions;
  })() : [];

  useEffect(() => {
    if (selectedGroup !== 'Ana Sayfa' || searchQuery.trim() !== '') return;
    setVisibleHomeBlocks(1);
    const timers = [2, 3, 4, 5, 6].map((count, index) => (
      window.setTimeout(() => setVisibleHomeBlocks(count), 80 + index * 90)
    ));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [selectedGroup, searchQuery]);

  if (selectedGroup !== 'Ana Sayfa' || searchQuery.trim() !== '') return null;

  if (playlists.length === 0) {
    return (
      <div className="flex flex-col gap-8 animate-fade-in pb-12">
        <div className="relative min-h-[360px] md:min-h-[400px] rounded-[32px] overflow-hidden border border-white/5 bg-neutral-950/35 shadow-2xl flex items-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(255,255,255,0.09),transparent_30%),radial-gradient(circle_at_18%_82%,rgba(255,255,255,0.055),transparent_28%),linear-gradient(135deg,#09090c_0%,#111119_48%,#020203_100%)]" />
          <div className="absolute inset-0 opacity-[0.045] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:72px_72px]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent" />

          <div className="relative z-10 w-full px-8 md:px-12 lg:px-16 py-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-4xl flex items-start gap-5">
              <div className="shrink-0 w-14 h-14 rounded-[18px] bg-white text-black flex items-center justify-center shadow-[0_22px_70px_rgba(255,255,255,0.14)]">
                <UploadCloud size={24} />
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-neutral-500">IPTV kurulumu gerekli</span>
                <h1 className="max-w-3xl text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.04]">
                  IPTV listenizi ekleyerek başlayın
                </h1>
                <p className="max-w-2xl text-sm text-neutral-400 leading-relaxed">
                  M3U veya Xtream Codes listenizi bağlayın; kanallar, filmler, diziler ve favoriler kendi listenize göre oluşsun.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col sm:flex-row lg:flex-col xl:flex-row gap-3">
              <button type="button"
                onClick={onOpenPlaylistSetup}
                className="h-12 px-6 rounded-full bg-white text-black hover:bg-neutral-200 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95"
              >
                <UploadCloud size={15} /> IPTV Listesi Ekle
              </button>
              <button type="button"
                onClick={() => showToast('M3U URL, M3U dosyası veya Xtream Codes bilgileriyle liste ekleyebilirsiniz.')}
                className="h-12 px-6 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 transition-all font-bold text-xs text-white active:scale-95"
              >
                Hangi bilgiler gerekli?
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const railArrowClass =
    'absolute top-[38%] -translate-y-1/2 z-30 w-9 h-9 rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:bg-white/10 hover:text-white active:scale-95';

  const renderRailCard = (channel: PlaylistItem, keyPrefix: string) => (
    <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => {
        if (channel.type === 'live') {
          handlePlayStream(channel);
        } else {
          handleOpenDetails(channel);
        }
      })(); } }} tabIndex={0} role="button"
      key={`${keyPrefix}-${channel.id}`}
      className="flex-shrink-0 w-[168px] md:w-[200px] group cursor-pointer snap-start transition-transform duration-300 hover:scale-[1.03] hover:z-20"
      onClick={() => {
        if (channel.type === 'live') {
          handlePlayStream(channel);
        } else {
          handleOpenDetails(channel);
        }
      }}
      onContextMenu={(event) => openContextMenu(event, channel)}
    >
      <div className="relative w-full aspect-video rounded-[14px] overflow-hidden bg-black/40 border border-white/[0.06] shadow-[0_10px_28px_rgba(0,0,0,0.35)] group-hover:border-white/12 transition-all duration-300 flex items-center justify-center">
        <ImageWithFallback
          src={channel.logo}
          name={channel.name}
          group={channel.group || 'LIVE'}
          itemType={channel.type}
          isGenericLogo={channel.isGenericLogo}
          aspect="landscape"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent z-10" />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
          <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play size={14} fill="#000" className="ml-0.5" />
          </div>
        </div>
        <button type="button"
          onClick={(e) => toggleFavorite(channel.id, e)}
          className="absolute top-2 right-2 z-30 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white/60 hover:text-red-400 transition-all"
          title="Favorilere Ekle"
         aria-label="Favorilere Ekle">
          <Heart size={12} fill={globalFavorites.includes(channel.id) ? 'currentColor' : 'none'} className={globalFavorites.includes(channel.id) ? 'text-red-500' : ''} />
        </button>
        <div className="absolute inset-x-0 bottom-0 z-20 px-2.5 pb-2 pt-6 pointer-events-none">
          <span className="block text-[12px] font-semibold text-white truncate">{channel.name}</span>
          <span className="block text-[10px] text-white/35 font-medium mt-0.5 truncate">
            {cleanPlaylistLabel(channel.group || '') || (language === 'tr' ? 'Canlı' : 'Live')}
          </span>
        </div>
      </div>
    </div>
  );

  const heroTitle = isPlaylistHero
    ? (currentHeroItem?.type === 'series'
      ? parseSeriesEpisodeInfo(currentHeroItem.name).cleanTitle
      : cleanMovieName(currentHeroItem?.name || ''))
    : fallbackHeroItem?.title || '';
  const heroTitleSize = heroTitle.length > 30
    ? 'lg:text-[46px]'
    : heroTitle.length > 20
      ? 'lg:text-[52px]'
      : 'lg:text-[58px]';
  const heroIsSeries = isPlaylistHero
    ? currentHeroItem?.type === 'series'
    : /series|dizi/i.test(String(fallbackHeroItem?.category || ''));
  const heroFavoriteId = currentHeroItem ? getFavoriteIdForItem(currentHeroItem) : '';
  const heroIsFavorite = heroFavoriteId ? globalFavorites.includes(heroFavoriteId) : false;
  const heroPrimaryLabel = language === 'tr'
    ? (heroIsSeries ? 'İzlemeye Başla' : 'Şimdi İzle')
    : (heroIsSeries ? 'Start Watching' : 'Watch Now');
  const heroInfoLabel = language === 'tr' ? 'Daha Fazla Bilgi' : 'More Info';
  // Display stored billboard blurb; only re-cut if a legacy long string slipped through.
  const heroDescRaw = isPlaylistHero
    ? (featuredTmdbData?.desc || '')
    : (fallbackHeroItem?.desc || '');
  const heroDesc = heroDescRaw.length > 220
    ? pickHeroSynopsis({ overview: heroDescRaw, maxLen: 190 })
    : heroDescRaw;

  const changeShowcase = (offset: number) => {
    if (activeShowcaseList.length === 0) return;
    const nextIndex = (activeFeaturedIndex + offset + activeShowcaseList.length) % activeShowcaseList.length;
    setActiveFeaturedIndex(nextIndex);
  };

  return (
    <div
      className="flex flex-col gap-6 page-transition-enter pb-12"
      onContextMenu={() => setContextMenu(null)}
    >
      <div className="relative group/hero-outer -mx-6 md:-mx-10 w-[calc(100%+3rem)] md:w-[calc(100%+5rem)] mb-2">
        {/* Hero only — poster never bleeds under rails */}
        <div
          className="relative z-10 w-full h-[480px] md:h-[78vh] max-h-[820px] rounded-none overflow-hidden flex items-end select-none bg-[#030304]"
        >
          {prevBackdrop && (
            <img
              src={prevBackdrop}
              alt=""
              className="absolute inset-0 w-full h-full object-cover home-hero-image-drift"
              style={{ objectPosition: 'center 25%', zIndex: 1 }}
            />
          )}
          {loadedBackdrop && (
            <img
              key={loadedBackdrop}
              src={loadedBackdrop}
              alt=""
              className="absolute inset-0 w-full h-full object-cover home-hero-image-fade"
              style={{ objectPosition: 'center 25%', zIndex: 2 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          {/* Soft black floor — blend into elevated OLED surface, not pure void */}
          <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-[#0a0a0c] from-[10%] via-[#0a0a0c]/80 via-[36%] to-transparent to-[70%]" />
          {/* Top-down Scrim for nav contrast */}
          <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#0a0a0c]/85 via-[#0a0a0c]/30 to-transparent z-10 pointer-events-none" />
          <div className="home-hero-left-scrim absolute inset-0 z-10 pointer-events-none" />
          <div className="absolute inset-0 z-[11] pointer-events-none bg-black/20" />
          <div className="home-hero-grain absolute inset-0 z-[12] pointer-events-none" />

          <div
            key={`hero-copy-${displayFeaturedIndex}`}
            className="home-hero-copy absolute left-8 right-8 md:left-16 md:right-auto bottom-[28%] md:bottom-[32%] max-w-xl md:max-w-2xl flex flex-col gap-3.5 md:gap-4 z-20 select-none"
          >
            {featuredTmdbData?.logo ? (
              <div key={featuredTmdbData.logo} className="z-10 flex justify-start">
                <img
                  src={featuredTmdbData.logo}
                  alt={heroTitle}
                  className="home-hero-title-logo max-h-[4.25rem] md:max-h-28 object-contain object-left w-auto max-w-[min(100%,420px)]"
                />
              </div>
            ) : (
              <h1 className={`home-hero-title text-4xl md:text-6xl ${heroTitleSize} font-black tracking-[-0.04em] text-white leading-[0.95] z-10`}>
                {heroTitle}
              </h1>
            )}

            {/* Single quiet meta line — no chips */}
            {isPlaylistHero && (() => {
              const metaParts: string[] = [];
              if (featuredTmdbData?.match) {
                metaParts.push(language === 'tr' ? `%${featuredTmdbData.match} Eşleşme` : `${featuredTmdbData.match}% Match`);
              }
              if (featuredTmdbData?.year) metaParts.push(featuredTmdbData.year);
              if (featuredTmdbData?.rating && parseFloat(featuredTmdbData.rating) > 0) {
                metaParts.push(`★ ${featuredTmdbData.rating}`);
              }
              if (featuredTmdbData?.duration) metaParts.push(featuredTmdbData.duration);
              if (!metaParts.length) return null;
              return (
                <p className="text-[12px] md:text-[13px] font-medium text-white/50 tracking-wide z-10">
                  <span className="text-emerald-400/90 font-semibold">{metaParts[0]}</span>
                  {metaParts.slice(1).map((part) => (
                    <span key={part}>
                      <span className="mx-2 text-white/20">·</span>
                      <span className="text-white/55">{part}</span>
                    </span>
                  ))}
                </p>
              );
            })()}

            {heroDesc ? (
              <p className="text-[13px] md:text-[15px] text-white/65 leading-[1.55] font-normal max-w-xl z-10 line-clamp-3">
                {heroDesc}
              </p>
            ) : null}

            <div className="flex items-center gap-3 mt-0.5 z-10">
              <button
                type="button"
                onClick={() => {
                  if (isPlaylistHero && currentHeroItem) {
                    if (currentHeroItem.type === 'series') {
                      handleOpenDetails(currentHeroItem);
                    } else {
                      handlePlayStream(currentHeroItem);
                    }
                  } else if (fallbackHeroItem) {
                    showToast(language === 'tr' ? `${fallbackHeroItem.title} çalma listenizden aranıyor...` : `Searching for ${fallbackHeroItem.title} in your playlist...`);
                  }
                }}
                className="h-11 px-6 bg-white text-black font-bold rounded-lg flex items-center gap-2 hover:bg-white/90 transition-colors duration-200 active:scale-[0.98] text-sm cursor-pointer"
                aria-label={heroPrimaryLabel}
              >
                <Play size={15} fill="#000" className="ml-0.5" />
                {heroPrimaryLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPlaylistHero && currentHeroItem) {
                    handleOpenDetails(currentHeroItem);
                  } else {
                    showToast(language === 'tr' ? "Kendi çalma listenizi yükleyerek tüm içerik detaylarına erişebilirsiniz." : "Upload your own playlist to access all content details.");
                  }
                }}
                className="h-11 px-5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold flex items-center gap-2 transition-colors duration-200 active:scale-[0.98] cursor-pointer text-sm"
                aria-label={heroInfoLabel}
              >
                <Info size={15} className="opacity-80" />
                {heroInfoLabel}
              </button>
              {isPlaylistHero && currentHeroItem ? (
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(heroFavoriteId, e)}
                  className={`h-11 w-11 rounded-lg flex items-center justify-center transition-colors duration-200 cursor-pointer ${
                    heroIsFavorite
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-white/45 hover:text-white/80'
                  }`}
                  aria-label={language === 'tr' ? (heroIsFavorite ? 'Favoriden çıkar' : 'Favoriye ekle') : (heroIsFavorite ? 'Remove favorite' : 'Add favorite')}
                  title={language === 'tr' ? (heroIsFavorite ? 'Favoriden çıkar' : 'Favoriye ekle') : (heroIsFavorite ? 'Remove favorite' : 'Add favorite')}
                >
                  <Heart size={18} fill={heroIsFavorite ? 'currentColor' : 'none'} />
                </button>
              ) : null}
            </div>
          </div>
          {activeShowcaseList.length > 1 && (
            <>
              <button
                type="button"
                aria-label={language === 'tr' ? 'Önceki tanıtım' : 'Previous showcase'}
                onClick={() => changeShowcase(-1)}
                className="absolute left-4 top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/20 text-white/60 opacity-0 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white group-hover/hero-outer:opacity-100 focus-visible:opacity-100"
              >
                <ChevronLeft size={19} />
              </button>
              <button
                type="button"
                aria-label={language === 'tr' ? 'Sonraki tanıtım' : 'Next showcase'}
                onClick={() => changeShowcase(1)}
                className="absolute right-4 top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/20 text-white/60 opacity-0 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white group-hover/hero-outer:opacity-100 focus-visible:opacity-100"
              >
                <ChevronRight size={19} />
              </button>
            </>
          )}

          <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-2 backdrop-blur-xl">
            {activeShowcaseList.map((_, idx) => (
              <button
                key={`showcase-dot-${idx}`}
                type="button"
                aria-label={`${language === 'tr' ? 'Vitrin' : 'Showcase'} ${idx + 1}`}
                onClick={() => setActiveFeaturedIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${displayFeaturedIndex === idx ? 'w-6 bg-white/90' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
              />
            ))}
          </div>

        </div>
        {/* Blend hero into app surface */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#0a0a0c] z-[5]" />
      </div>

      <div className="relative z-20 mt-0 flex flex-col gap-9 select-none pb-4">
        {visibleHomeBlocks >= 1 && playlists.length > 0 && uniqueRecentlyWatched.length > 0 && (
        <div className="order-1 relative z-20 flex flex-col gap-2.5 select-none animate-fade-in">
          <HomeRailHeader
            title={language === 'tr' ? 'İzlemeye Devam Et' : 'Continue Watching'}
            actionLabel={t('home.clearHistory')}
            onAction={() => clearRecentlyWatched()}
          />

          <div className="relative group/row">
            <button type="button"
              aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'}
              onClick={() => handleScrollSlider('slider-history', 'left')}
              className={`${railArrowClass} left-1`}
            >
              <ChevronLeft size={18} />
            </button>

            <div
              id="slider-history"
              className="flex gap-3.5 overflow-x-auto pb-5 pt-1 pr-10 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
            >
              {uniqueRecentlyWatched.map((channel) => {
                const labels = getMediaCardLabels(channel, language);
                const progress = channel.progress ?? 0;
                const hasPlaylistArt = Boolean(
                  channel.logo && String(channel.logo).trim() && !channel.isGenericLogo,
                );
                const cardTitle = labels.title;
                const searchTitle = labels.searchTitle;
                const subtitle =
                  labels.subtitle ||
                  (progress > 0
                    ? language === 'tr'
                      ? `Kaldığın yer %${Math.round(progress)}`
                      : `${Math.round(progress)}% watched`
                    : '');

                return (
                  <div
                    key={`recent-${channel.id}-${cardTitle}`}
                    tabIndex={0}
                    role="button"
                    className="flex w-[200px] shrink-0 cursor-pointer snap-start flex-col gap-1.5 transition-transform duration-300 hover:scale-[1.02] md:w-[232px]"
                    onClick={() => handlePlayStream(channel)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handlePlayStream(channel);
                      }
                    }}
                    onContextMenu={(event) => openContextMenu(event, channel, true)}
                  >
                    {/* Artwork */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#16161a] shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
                      <ImageWithFallback
                        src={hasPlaylistArt ? channel.logo : undefined}
                        name={searchTitle}
                        group={channel.group || 'VOD'}
                        itemType={
                          channel.type === 'series' || channel.type === 'movie'
                            ? channel.type
                            : 'movie'
                        }
                        isGenericLogo={!hasPlaylistArt}
                        aspect="landscape"
                        lazy={false}
                        fallbackToPlaylist
                      />
                      <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg">
                          <Play size={14} fill="#000" className="ml-0.5" />
                        </div>
                      </div>
                      {progress > 0 && (
                        <div className="absolute bottom-0 left-0 z-20 h-[3px] w-full bg-white/10">
                          <div
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Title OUTSIDE the image — never masked/hidden by overlays or missing art */}
                    <div className="min-w-0 px-0.5">
                      <p className="truncate text-[12.5px] font-semibold leading-snug text-white">
                        {cardTitle}
                      </p>
                      {(subtitle || progress > 0) && (
                        <p className="mt-0.5 truncate text-[10.5px] font-medium text-white/45">
                          {subtitle}
                          {progress > 0 && progress < 100
                            ? `${subtitle ? ' · ' : ''}%${Math.round(progress)}`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button"
              aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'}
              onClick={() => handleScrollSlider('slider-history', 'right')}
              className={`${railArrowClass} right-1`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={contextMenu.item.type === 'series'
            ? parseSeriesEpisodeInfo(getFlatItem(contextMenu.item).name).cleanTitle
            : cleanMediaTitle(getFlatItem(contextMenu.item).name)}
          subtitle={contextMenu.fromHistory ? (language === 'tr' ? 'İzlemeye Devam Et' : 'Continue Watching') : (contextMenu.item.group || (language === 'tr' ? 'Medya' : 'Media'))}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
      {visibleHomeBlocks >= getSectionPosition('live') && playlists.length > 0 && homeLiveTvQuickChannels.length > 0 && (
        <div className="flex flex-col gap-2.5 select-none animate-fade-in" style={{ order: getSectionPosition('live') }}>
          <HomeRailHeader
            title={contentPreferences.includes('sports') ? (language === 'tr' ? 'Spor Kanalları' : 'Sports Channels') : (language === 'tr' ? 'Hızlı Canlı TV' : 'Quick Live TV')}
            mutedLabel={contentPreferences.includes('sports') ? (language === 'tr' ? 'Tercihine göre' : 'For you') : (language === 'tr' ? 'Popüler' : 'Popular')}
          />

          <div className="relative group/row">
            <button type="button"
              aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'}
              onClick={() => handleScrollSlider('slider-quick-live-tv', 'left')}
              className={`${railArrowClass} left-1`}
            >
              <ChevronLeft size={18} />
            </button>

            <div
              id="slider-quick-live-tv"
              className="flex gap-3.5 overflow-x-auto pb-5 pt-1 pr-20 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
            >
              {homeLiveTvQuickChannels.map(item => renderRailCard(item, 'quick-live'))}
            </div>

            <button type="button"
              aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'}
              onClick={() => handleScrollSlider('slider-quick-live-tv', 'right')}
              className={`${railArrowClass} right-1`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
      {visibleHomeBlocks >= getSectionPosition('discovery') && playlists.length > 0 && homeDiscoveryItems.length > 0 && (
        <div className="flex flex-col gap-2.5 select-none animate-fade-in" style={{ order: getSectionPosition('discovery') }}>
          <HomeRailHeader
            title={contentPreferences.length ? (language === 'tr' ? 'Sana Özel' : 'For You') : (language === 'tr' ? 'Trend Olanlar' : 'Trending Now')}
            mutedLabel={contentPreferences.length ? (language === 'tr' ? 'Tercihlerine göre' : 'Based on prefs') : (language === 'tr' ? 'Bugün' : 'Today')}
          />

          <div className="relative group/row">
            <button type="button"
              aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'}
              onClick={() => handleScrollSlider('slider-discovery-home', 'left')}
              className={`${railArrowClass} left-1`}
            >
              <ChevronLeft size={18} />
            </button>
            <div
              id="slider-discovery-home"
              className="flex gap-3.5 overflow-x-auto pb-5 pt-1 pr-20 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
            >
              {homeDiscoveryItems.map(item => (
                <VodPosterCard
                  key={`discover-home-${item.id}`}
                  channel={item}
                  globalFavorites={globalFavorites}
                  toggleFavorite={toggleFavorite}
                  handleOpenDetails={handleOpenDetails}
                  onContextMenu={openContextMenu}
                />
              ))}
            </div>
            <button type="button"
              aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'}
              onClick={() => handleScrollSlider('slider-discovery-home', 'right')}
              className={`${railArrowClass} right-1`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
      {visibleHomeBlocks >= getSectionPosition('movies') && playlists.length > 0 && populerFilmler.length > 0 && (
        <div className="flex flex-col gap-2.5 select-none animate-fade-in" style={{ order: getSectionPosition('movies') }}>
          <HomeRailHeader
            title={language === 'tr' ? 'Popüler Filmler' : 'Popular Movies'}
            actionLabel={language === 'tr' ? 'Tümü' : 'See all'}
            onAction={() => setSelectedGroup('Sinema')}
          />

          <div className="relative group/row">
            <button type="button"
              aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'}
              onClick={() => handleScrollSlider('slider-popular-movies', 'left')}
              className={`${railArrowClass} left-1`}
            >
              <ChevronLeft size={18} />
            </button>
            <div
              id="slider-popular-movies"
              className="flex gap-3.5 overflow-x-auto pb-5 pt-1 pr-20 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
            >
              {populerFilmler.map(item => (
                <VodPosterCard
                  key={`pop-movie-${item.id}`}
                  channel={item}
                  globalFavorites={globalFavorites}
                  toggleFavorite={toggleFavorite}
                  handleOpenDetails={handleOpenDetails}
                  onContextMenu={openContextMenu}
                  requireTmdbPoster
                />
              ))}
            </div>
            <button type="button"
              aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'}
              onClick={() => handleScrollSlider('slider-popular-movies', 'right')}
              className={`${railArrowClass} right-1`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
      {visibleHomeBlocks >= getSectionPosition('series') && playlists.length > 0 && populerDiziler.length > 0 && (
        <div className="flex flex-col gap-2.5 select-none animate-fade-in" style={{ order: getSectionPosition('series') }}>
          <HomeRailHeader
            title={language === 'tr' ? 'Popüler Diziler' : 'Popular Series'}
            actionLabel={language === 'tr' ? 'Tümü' : 'See all'}
            onAction={() => setSelectedGroup('Diziler')}
          />

          <div className="relative group/row">
            <button type="button"
              aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'}
              onClick={() => handleScrollSlider('slider-popular-series', 'left')}
              className={`${railArrowClass} left-1`}
            >
              <ChevronLeft size={18} />
            </button>
            <div
              id="slider-popular-series"
              className="flex gap-3.5 overflow-x-auto pb-5 pt-1 pr-20 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
            >
              {populerDiziler.map(item => (
                <VodPosterCard
                  key={`pop-series-${item.id}`}
                  channel={item}
                  globalFavorites={globalFavorites}
                  toggleFavorite={toggleFavorite}
                  handleOpenDetails={handleOpenDetails}
                  onContextMenu={openContextMenu}
                  requireTmdbPoster
                />
              ))}
            </div>
            <button type="button"
              aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'}
              onClick={() => handleScrollSlider('slider-popular-series', 'right')}
              className={`${railArrowClass} right-1`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
      {playlists.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-neutral-950/40 backdrop-blur-md border border-white/5 rounded-3xl mt-4">
          <UploadCloud size={38} className="text-neutral-600 mb-4 animate-pulse" />
          <h3 className="text-base font-semibold text-neutral-200">{t('home.noPlaylistsTitle')}</h3>
          <p className="text-xs text-neutral-500 max-w-sm mt-1.5 mb-5">{t('home.noPlaylistsDesc')}</p>
          <button type="button"
            onClick={() => setSelectedGroup('Ayarlar')}
            className="px-5 py-2.5 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-black text-xs font-semibold rounded-xl transition-all"
          >
            {t('home.goToSettings')}
          </button>
        </div>
      )}
      </div>
    </div>
  );
});
