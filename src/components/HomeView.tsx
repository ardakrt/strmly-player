import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Play, ChevronLeft, ChevronRight, UploadCloud, Heart, Sparkles, Info, Trash2 } from 'lucide-react';
import type { ContentPreference, SavedPlaylist } from '../types';
import type { PlaylistItem } from '../utils/m3uParser';
import { ImageWithFallback } from './ImageWithFallback';
import { getFallbackGradient } from '../utils/helpers';
import { cleanMediaTitle, parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { getResolvedTmdbResult, getTmdbApiKey, resolveTmdbImageSrc, tmdbCache, fetchTmdbDetails } from '../utils/tmdb';
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



interface TmdbMetadata {
  posterUrl: string | null;
  rating: string;
  year: string;
  overview: string;
  genres: string[];
  duration: string;
}

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

const TMDB_GENRES_EN: Record<number, string> = {
  28: 'ACTION',
  12: 'ADVENTURE',
  16: 'ANIMATION',
  35: 'COMEDY',
  80: 'CRIME',
  99: 'DOCUMENTARY',
  18: 'DRAMA',
  10751: 'FAMILY',
  14: 'FANTASY',
  36: 'HISTORY',
  27: 'HORROR',
  10402: 'MUSIC',
  9648: 'MYSTERY',
  10749: 'ROMANCE',
  878: 'SCI-FI',
  10770: 'TV MOVIE',
  53: 'THRILLER',
  10752: 'WAR',
  37: 'WESTERN',
  10759: 'ACTION & ADVENTURE',
  10762: 'KIDS',
  10763: 'NEWS',
  10764: 'REALITY',
  10765: 'SCI-FI & FANTASY',
  10766: 'SOAP',
  10767: 'TALK SHOW',
  10768: 'WAR & POLITICS'
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

function VodPosterCard({ channel, globalFavorites, toggleFavorite, handleOpenDetails, requireTmdbPoster = false, onContextMenu }: VodPosterCardProps) {
  const { language } = useSettings();
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
    const cacheKey = `vod-meta-${channel.type}-${cleanTitle}`;

    const loadMetadata = async () => {
      if (globalVodMetadataMap.has(cacheKey)) {
        if (!cancelled) setMetadata(globalVodMetadataMap.get(cacheKey)!);
        return;
      }

      try {
        const cached = await tmdbCache.get(cacheKey);
        if (cached) {
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
        const tmdbImagePath = result.poster_path || result.backdrop_path;
        if (tmdbImagePath) {
          const resolved = await resolveTmdbImageSrc(tmdbImagePath, 'w500');
          if (resolved) {
            posterUrl = resolved;
          }
        }

        const rating = result.vote_average && result.vote_average > 0
          ? result.vote_average.toFixed(1)
          : '';

        const year = (result.release_date || result.first_air_date || '').substring(0, 4);

        const overview = result.overview || '';

        const finalMeta: TmdbMetadata = {
          posterUrl,
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
    return <div ref={cardRef} className="flex-shrink-0 w-[200px] md:w-[240px] aspect-[2/3] snap-start" />;
  }

  if (!metadata) {
    return (
      <div ref={cardRef} className="flex-shrink-0 w-[200px] md:w-[240px] snap-start bg-[#0a0a0c]/80 border border-white/[0.03] rounded-[28px] p-3.5 flex flex-col gap-3.5">
        <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-neutral-900 border border-white/5">
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 bg-[length:200%_100%] animate-shimmer" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-4 bg-neutral-800 rounded w-3/4 animate-pulse" />
          <div className="flex gap-1.5 mt-1">
            <div className="h-3 bg-neutral-800 rounded w-12 animate-pulse" />
            <div className="h-3 bg-neutral-800 rounded w-16 animate-pulse" />
          </div>
          <div className="h-3 bg-neutral-800 rounded w-full mt-2 animate-pulse" />
          <div className="h-3 bg-neutral-800 rounded w-5/6 animate-pulse" />
        </div>
      </div>
    );
  }

  if (requireTmdbPoster && !metadata.posterUrl) {
    return null;
  }

  const displayTitle = channel.type === 'series'
    ? parseSeriesEpisodeInfo(channel.name).cleanTitle
    : cleanMediaTitle(channel.name);

  const displayGenres = metadata.genres.length > 0
    ? metadata.genres.slice(0, 2)
    : (channel.group ? [channel.group.toUpperCase()] : []);

  const displayOverview = metadata.overview || (
    channel.type === 'series'
      ? (language === 'tr'
        ? `${displayTitle} dizisinin tüm sezon ve bölümlerini Türkçe izleyin.`
        : `Watch all seasons and episodes of the series ${displayTitle} online.`)
      : (language === 'tr'
        ? `${displayTitle} filmini kesintisiz Full HD kalitede şimdi izleyin.`
        : `Watch the movie ${displayTitle} in high quality now.`)
  );

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

  const posterSrc = metadata.posterUrl || (requireTmdbPoster ? null : channel.logo);

  const handleCardClick = () => {
    const flatItem = getFlatItem(channel);
    handleOpenDetails(flatItem);
  };

  return (
    <div
      ref={cardRef}
      className="flex-shrink-0 w-[200px] md:w-[240px] group flex flex-col gap-3.5 cursor-pointer snap-start bg-[#0a0a0c]/80 border border-white/[0.03] backdrop-blur-md rounded-[28px] p-3.5 hover:border-white/10 hover:bg-[#121216]/90 transition-all duration-300 hover:scale-[1.02] shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      onClick={handleCardClick}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
    >
      <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-neutral-950/60 border border-white/5 shadow-md flex items-center justify-center">
        {posterSrc ? (
          <img src={posterSrc} alt="" className="absolute inset-0 w-full h-full object-cover animate-fade-in" />
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
          <span className={`h-[22px] px-2.5 text-[9px] md:text-[10px] font-extrabold tracking-wider rounded-full text-white shadow-md flex items-center justify-center border border-transparent ${
            channel.type === 'series' ? 'bg-indigo-600' : 'bg-violet-600'
          }`}>
            {channel.type === 'series' ? 'DİZİ' : 'FİLM'}
          </span>
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
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-15">
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play size={18} fill="#000" className="ml-1" />
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(channel.id, e);
          }}
          className="absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 shadow-lg"
          title="Favorilere Ekle"
        >
          <Heart size={14} fill={globalFavorites.includes(channel.id) ? 'currentColor' : 'none'} className={globalFavorites.includes(channel.id) ? 'text-red-500' : ''} />
        </button>
      </div>

      <div className="flex flex-col gap-2 px-1">
        <h4 className="text-sm md:text-base font-extrabold text-neutral-100 group-hover:text-white line-clamp-1 transition-colors leading-tight">
          {displayTitle}
        </h4>
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {displayGenres.map((genre, idx) => (
            <span
              key={idx}
              className="px-2.5 py-0.5 bg-neutral-800/40 text-neutral-400 font-extrabold uppercase tracking-wide text-[8px] md:text-[9px] rounded-full border border-white/[0.03]"
            >
              {genre}
            </span>
          ))}
        </div>
        <p className="text-[11px] md:text-xs text-neutral-400/70 leading-relaxed line-clamp-2 mt-1 min-h-[2.2rem]">
          {displayOverview}
        </p>
        <div className="border-t border-white/[0.04] my-1" />
        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-neutral-500 font-bold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="uppercase tracking-wider">{displayDuration}</span>
        </div>
      </div>
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
  setActiveFeaturedIndex: (idx: number) => void;
  activeShowcaseList: any[];
  playlists: SavedPlaylist[];
  uniqueRecentlyWatched: PlaylistItem[];
  clearRecentlyWatched: () => void;
  removeFromRecentlyWatched: (item: PlaylistItem) => void;
  handleScrollSlider: (sliderId: string, direction: 'left' | 'right') => void;
  handlePlayStream: (item: PlaylistItem) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  genericLogosSet: Set<string>;
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
  setActiveFeaturedIndex,
  activeShowcaseList,
  playlists,
  uniqueRecentlyWatched,
  clearRecentlyWatched,
  removeFromRecentlyWatched,
  handleScrollSlider,
  handlePlayStream,
  handleOpenDetails,
  genericLogosSet,
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
  const [visibleHomeBlocks, setVisibleHomeBlocks] = useState(2);
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
    setVisibleHomeBlocks(2);
    const timers = [3, 4, 5, 6].map((count, index) => (
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
              <button
                onClick={onOpenPlaylistSetup}
                className="h-12 px-6 rounded-full bg-white text-black hover:bg-neutral-200 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95"
              >
                <UploadCloud size={15} /> IPTV Listesi Ekle
              </button>
              <button
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

  const renderRailCard = (channel: PlaylistItem, keyPrefix: string) => (
    <div
      key={`${keyPrefix}-${channel.id}`}
      className="flex-shrink-0 w-[170px] md:w-[210px] group flex flex-col gap-2.5 cursor-pointer snap-start"
      onClick={() => {
        if (channel.type === 'live') {
          handlePlayStream(channel);
        } else {
          handleOpenDetails(channel);
        }
      }}
      onContextMenu={(event) => openContextMenu(event, channel)}
    >
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-white/5 shadow-lg transform group-hover:scale-[1.04] group-hover:border-white/20 transition-all duration-300 flex items-center justify-center">
        <ImageWithFallback
          src={channel.logo}
          name={channel.name}
          group={channel.group || 'LIVE'}
          itemType={channel.type}
          isGenericLogo={channel.logo ? genericLogosSet.has(channel.logo) : false}
          aspect="landscape"
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play size={16} fill="#000" className="ml-0.5" />
          </div>
        </div>
        <button
          onClick={(e) => toggleFavorite(channel.id, e)}
          className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110"
          title="Favorilere Ekle"
        >
          <Heart size={12} fill={globalFavorites.includes(channel.id) ? 'currentColor' : 'none'} className={globalFavorites.includes(channel.id) ? 'text-red-500' : ''} />
        </button>
      </div>
      <div className="flex flex-col px-1.5">
        <span className="text-xs font-bold text-neutral-200 group-hover:text-white truncate transition-colors">{channel.name}</span>
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mt-0.5">{channel.group || 'Genel'}</span>
      </div>
    </div>
  );

  const playlistHeroImage = featuredTmdbData?.backdrop || featuredTmdbData?.poster || currentHeroItem?.logo;
  const fallbackHeroImage = fallbackHeroItem?.img;

  return (
    <div
      className="flex flex-col gap-8 animate-fade-in pb-12"
      onContextMenu={() => setContextMenu(null)}
    >
      <div className="relative group/hero-outer">
        <div className="absolute -inset-8 z-0 opacity-45 blur-[90px] transition-all duration-1000 pointer-events-none rounded-[45px] overflow-hidden select-none">
          {isPlaylistHero && playlistHeroImage ? (
            <img
              key={playlistHeroImage}
              src={playlistHeroImage}
              alt=""
              className="w-full h-full object-cover scale-125 animate-fade-in"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : !isPlaylistHero && fallbackHeroImage ? (
            <img
              key={fallbackHeroImage}
              src={fallbackHeroImage}
              alt=""
              className="w-full h-full object-cover scale-125 animate-fade-in"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div
              className="w-full h-full transition-all duration-1000"
              style={{ background: getFallbackGradient(isPlaylistHero ? (currentHeroItem?.name || '') : (fallbackHeroItem?.title || '')) }}
            />
          )}
        </div>
        <div
          className="relative z-10 w-full min-h-[360px] md:min-h-[440px] rounded-[32px] overflow-hidden flex items-end select-none border border-white/5 shadow-2xl bg-neutral-950/20 backdrop-blur-[1px]"
        >
          {isPlaylistHero && playlistHeroImage ? (
            <img
              key={playlistHeroImage}
              src={playlistHeroImage}
              className="absolute inset-0 w-full h-full object-cover animate-fade-in"
              style={{ objectPosition: 'center top' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : !isPlaylistHero && fallbackHeroImage ? (
            <img
              key={fallbackHeroImage}
              src={fallbackHeroImage}
              className="absolute inset-0 w-full h-full object-cover animate-fade-in"
              style={{ objectPosition: 'center top' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-black/30 z-10 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/60 to-transparent z-10 pointer-events-none" />

          <div className="absolute bottom-10 left-10 max-w-xl flex flex-col gap-4 z-20">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-2.5 py-0.5 bg-[var(--accent-color)] text-black text-[9px] font-extrabold tracking-widest uppercase rounded shadow-sm shadow-[var(--accent-glow)]">
                {isPlaylistHero ? (language === 'tr' ? 'ÖNE ÇIKAN YAPIM' : 'FEATURED PRODUCTION') : (language === 'tr' ? 'STRMLY SEÇKİ' : 'STRMLY SELECTION')}
              </span>
              <span className="text-[10px] text-neutral-300 font-bold uppercase tracking-wider">
                {isPlaylistHero
                  ? (currentHeroItem?.group || (currentHeroItem?.type === 'movie' ? (language === 'tr' ? 'Sinema (VOD)' : 'Movies (VOD)') : (language === 'tr' ? 'Dizi (VOD)' : 'Series (VOD)')))
                  : fallbackHeroItem?.category}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-none drop-shadow-md">
              {isPlaylistHero
                ? (currentHeroItem?.type === 'series'
                  ? parseSeriesEpisodeInfo(currentHeroItem.name).cleanTitle
                  : currentHeroItem?.name)
                : fallbackHeroItem?.title}
            </h1>

            {isPlaylistHero && (
              <div className="flex items-center gap-3 text-xs font-semibold text-neutral-300 mt-0.5">
                <span className="text-emerald-400 font-extrabold">{featuredTmdbData?.match || (language === 'tr' ? '95% Eşleşme' : '95% Match')}</span>
                <span className="text-neutral-400">{featuredTmdbData?.year || '2025'}</span>
                {featuredTmdbData?.rating && parseFloat(featuredTmdbData.rating) > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-bold">
                    ⭐ {featuredTmdbData.rating}
                  </span>
                )}
              </div>
            )}

            <p className="text-xs text-neutral-300 leading-relaxed font-normal max-w-md drop-shadow line-clamp-3">
              {isPlaylistHero ? (featuredTmdbData?.desc || (language === 'tr' ? 'Strmly kütüphanesinden benzersiz bir yapım.' : 'A unique production from the Strmly library.')) : fallbackHeroItem?.desc}
            </p>

            <div className="flex items-center gap-3 mt-2">
              <button
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
                className="px-6 py-3 bg-white text-black font-bold rounded-full flex items-center gap-2 hover:bg-neutral-200 transition-all duration-300 shadow-lg transform active:scale-95 text-xs"
              >
                <Play size={13} fill="#000" className="ml-0.5" /> {language === 'tr' ? 'Şimdi İzle' : 'Watch Now'}
              </button>
              <button
                onClick={() => {
                  if (isPlaylistHero && currentHeroItem) {
                    handleOpenDetails(currentHeroItem);
                  } else {
                    showToast(language === 'tr' ? "Kendi çalma listenizi yükleyerek tüm içerik detaylarına erişebilirsiniz." : "Upload your own playlist to access all content details.");
                  }
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-all duration-300 transform active:scale-95 text-xs"
              >
                {language === 'tr' ? 'Detaylar' : 'Details'}
              </button>
            </div>
          </div>
          <div className="absolute bottom-10 right-10 flex gap-2 z-20">
            {activeShowcaseList.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setActiveFeaturedIndex(idx)}
                className={`h-1.5 rounded-full cursor-pointer transition-all duration-300 ${activeFeaturedIndex === idx ? 'w-6 bg-[var(--accent-color)]' : 'w-1.5 bg-white/40 hover:bg-white'}`}
              />
            ))}
          </div>

        </div>
      </div>
      {visibleHomeBlocks >= 1 && playlists.length > 0 && uniqueRecentlyWatched.length > 0 && (
        <div className="order-1 flex flex-col gap-4 select-none animate-fade-in">
          <div className="flex items-center justify-between px-0 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-pulse" />
              <h3 className="text-sm md:text-base font-bold tracking-tight text-neutral-200">{language === 'tr' ? 'İzlemeye Devam Et' : 'Continue Watching'}</h3>
            </div>
            <button
              onClick={() => {
                clearRecentlyWatched();
              }}
              className="text-[10px] text-neutral-500 hover:text-red-400 font-bold uppercase tracking-wider transition-colors"
            >
              {t('home.clearHistory')}
            </button>
          </div>

          <div className="relative group/row">
            <button
              onClick={() => handleScrollSlider('slider-history', 'left')}
              className="absolute left-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronLeft size={24} />
            </button>

            <div
              id="slider-history"
              className="flex gap-6 overflow-x-auto pb-6 pt-2 pr-24 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
            >
              {uniqueRecentlyWatched.map(channel => (
                <div
                  key={`recent-${channel.id}`}
                  className="flex-shrink-0 w-[180px] md:w-[220px] group flex flex-col gap-2.5 cursor-pointer snap-start"
                  onClick={() => {
                    handlePlayStream(channel);
                  }}
                  onContextMenu={(event) => openContextMenu(event, channel, true)}
                >
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-white/5 shadow-lg transform group-hover:scale-[1.04] group-hover:border-white/20 transition-all duration-300 flex items-center justify-center">
                    <ImageWithFallback
                      src={channel.logo}
                      name={channel.name}
                      group={channel.group || 'LIVE'}
                      itemType={channel.type}
                      isGenericLogo={channel.logo ? genericLogosSet.has(channel.logo) : false}
                      aspect="landscape"
                    />

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                      <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        <Play size={16} fill="#000" className="ml-0.5" />
                      </div>
                    </div>

                    {channel.progress !== undefined && channel.progress > 0 && (
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-20">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${channel.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col px-1.5">
                    <span className="text-xs font-bold text-neutral-200 group-hover:text-white truncate transition-colors">{channel.name}</span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mt-0.5">{channel.group || (language === 'tr' ? 'Genel' : 'General')}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleScrollSlider('slider-history', 'right')}
              className="absolute right-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronRight size={24} />
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
        <div className="flex flex-col gap-4 select-none animate-fade-in" style={{ order: getSectionPosition('live') }}>
          <div className="flex items-center justify-between px-0 mb-1">
            <div className="flex items-center gap-2">
              <Play size={15} className="text-emerald-400 fill-emerald-400" />
              <h3 className="text-sm md:text-base font-bold tracking-tight text-neutral-200">{contentPreferences.includes('sports') ? (language === 'tr' ? 'Spor Kanalları' : 'Sports Channels') : (language === 'tr' ? 'Hızlı Canlı TV' : 'Quick Live TV')}</h3>
            </div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{contentPreferences.includes('sports') ? (language === 'tr' ? 'Tercihine göre sıralandı' : 'Sorted by preference') : (language === 'tr' ? 'Popüler Kanallar' : 'Popular Channels')}</span>
          </div>

          <div className="relative group/row">
            <button
              onClick={() => handleScrollSlider('slider-quick-live-tv', 'left')}
              className="absolute left-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronLeft size={24} />
            </button>

            <div
              id="slider-quick-live-tv"
              className="flex gap-6 overflow-x-auto pb-6 pt-2 pr-24 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
            >
              {homeLiveTvQuickChannels.map(item => renderRailCard(item, 'quick-live'))}
            </div>

            <button
              onClick={() => handleScrollSlider('slider-quick-live-tv', 'right')}
              className="absolute right-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
      {visibleHomeBlocks >= getSectionPosition('discovery') && playlists.length > 0 && homeDiscoveryItems.length > 0 && (
        <div className="flex flex-col gap-4 select-none animate-fade-in" style={{ order: getSectionPosition('discovery') }}>
          <div className="flex items-center justify-between px-0 mb-1">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-amber-400" fill="currentColor" />
              <h3 className="text-sm md:text-base font-bold tracking-tight text-neutral-200">{contentPreferences.length ? (language === 'tr' ? 'Sana Özel' : 'For You') : (language === 'tr' ? 'Trend Olanlar' : 'Trending Now')}</h3>
            </div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{contentPreferences.length ? (language === 'tr' ? 'İçerik tercihlerine göre' : 'Based on content preferences') : (language === 'tr' ? 'Bugün en çok izlenenler' : 'Most watched today')}</span>
          </div>

          <div className="relative group/row">
            <button
              onClick={() => handleScrollSlider('slider-discovery-home', 'left')}
              className="absolute left-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronLeft size={24} />
            </button>
            <div
              id="slider-discovery-home"
              className="flex gap-6 overflow-x-auto pb-6 pt-2 pr-24 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
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
            <button
              onClick={() => handleScrollSlider('slider-discovery-home', 'right')}
              className="absolute right-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
      {visibleHomeBlocks >= getSectionPosition('movies') && playlists.length > 0 && populerFilmler.length > 0 && (
        <div className="flex flex-col gap-4 select-none animate-fade-in" style={{ order: getSectionPosition('movies') }}>
          <div className="flex items-center justify-between px-0 mb-1">
            <div className="flex items-center gap-2">
              <Play size={14} className="text-white fill-white" />
              <h3 className="text-sm md:text-base font-bold tracking-tight text-neutral-200">{language === 'tr' ? 'Popüler Filmler' : 'Popular Movies'}</h3>
            </div>
            <button
              onClick={() => setSelectedGroup('Sinema')}
              className="text-[10px] text-neutral-500 hover:text-white font-bold uppercase tracking-wider transition-colors"
            >
              {language === 'tr' ? 'Tümünü Gör' : 'See All'}
            </button>
          </div>

          <div className="relative group/row">
            <button
              onClick={() => handleScrollSlider('slider-popular-movies', 'left')}
              className="absolute left-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronLeft size={24} />
            </button>
            <div
              id="slider-popular-movies"
              className="flex gap-6 overflow-x-auto pb-6 pt-2 pr-24 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
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
            <button
              onClick={() => handleScrollSlider('slider-popular-movies', 'right')}
              className="absolute right-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
      {visibleHomeBlocks >= getSectionPosition('series') && playlists.length > 0 && populerDiziler.length > 0 && (
        <div className="flex flex-col gap-4 select-none animate-fade-in" style={{ order: getSectionPosition('series') }}>
          <div className="flex items-center justify-between px-0 mb-1">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-white" />
              <h3 className="text-sm md:text-base font-bold tracking-tight text-neutral-200">{language === 'tr' ? 'Popüler Diziler' : 'Popular Series'}</h3>
            </div>
            <button
              onClick={() => setSelectedGroup('Diziler')}
              className="text-[10px] text-neutral-500 hover:text-white font-bold uppercase tracking-wider transition-colors"
            >
              {language === 'tr' ? 'Tümünü Gör' : 'See All'}
            </button>
          </div>

          <div className="relative group/row">
            <button
              onClick={() => handleScrollSlider('slider-popular-series', 'left')}
              className="absolute left-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronLeft size={24} />
            </button>
            <div
              id="slider-popular-series"
              className="flex gap-6 overflow-x-auto pb-6 pt-2 pr-24 hide-scrollbar snap-x scroll-smooth slider-fading-mask"
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
            <button
              onClick={() => handleScrollSlider('slider-popular-series', 'right')}
              className="absolute right-2 top-[35%] -translate-y-1/2 z-30 w-10 h-16 rounded-2xl bg-black/55 hover:bg-white/90 text-white hover:text-black border border-white/10 flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
      {playlists.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-neutral-950/40 backdrop-blur-md border border-white/5 rounded-3xl mt-4">
          <UploadCloud size={38} className="text-neutral-600 mb-4 animate-bounce" />
          <h3 className="text-base font-semibold text-neutral-200">{t('home.noPlaylistsTitle')}</h3>
          <p className="text-xs text-neutral-500 max-w-sm mt-1.5 mb-5">{t('home.noPlaylistsDesc')}</p>
          <button
            onClick={() => setSelectedGroup('Ayarlar')}
            className="px-5 py-2.5 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-black text-xs font-semibold rounded-xl transition-all"
          >
            {t('home.goToSettings')}
          </button>
        </div>
      )}
    </div>
  );
});
