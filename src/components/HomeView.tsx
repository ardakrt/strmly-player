import { useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  Play, Heart, Info, Trash2, UploadCloud
} from 'lucide-react';
import type { ContentPreference, SavedPlaylist } from '../types';
import type { PlaylistItem } from '../utils/m3uParser';
import { ImageWithFallback } from './ImageWithFallback';
import { pickHeroSynopsis, cleanPlaylistLabel } from '../utils/helpers';
import { cleanMediaTitle, parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { cleanMovieName } from '../utils/tmdb';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { useSettings } from '../context/SettingsContext';
import { getFlatItem } from './home/HomeVodCards';
import { HomeEmptyState } from './home/HomeEmptyState';
import { HomeHero } from './home/HomeHero';
import { ContinueWatchingRail } from './home/ContinueWatchingRail';
import { HomeContentRails } from './home/HomeContentRails';

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
  top10Movies?: PlaylistItem[];
  top10Series?: any[];
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
  top10Movies,
  top10Series,
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

  // Geçişten sonra eski resmi temizle (ipeksi yumuşak sinematik 1.2s animasyon)
  useEffect(() => {
    if (prevBackdrop) {
      const timer = setTimeout(() => {
        setPrevBackdrop(null);
      }, 1200);
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
    return [...new Set(['discovery', ...preferredSections, 'live', 'movies', 'series'])];
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
        label: language === 'tr' ? 'İzlemeye devam et' : 'Continue watching',
        icon: <Play size={14} fill="currentColor" />,
        onSelect: () => handlePlayStream(flatItem)
      });
    } else if (isSeries) {
      actions.push({
        id: 'open-series',
        label: language === 'tr' ? 'Dizi detayına git' : 'Open series details',
        icon: <Info size={15} />,
        onSelect: () => handleOpenDetails(flatItem)
      });
    } else {
      actions.push({
        id: 'play',
        label: item.type === 'live' ? (language === 'tr' ? 'Kanalı oynat' : 'Play channel') : (language === 'tr' ? 'Şimdi oynat' : 'Play now'),
        icon: <Play size={14} fill="currentColor" />,
        onSelect: () => handlePlayStream(flatItem)
      });
    }

    if (contextMenu.fromHistory || (!isSeries && item.type !== 'live')) {
      actions.push({
        id: 'details',
        label: isSeries ? (language === 'tr' ? 'Dizi detayına git' : 'Open series details') : (language === 'tr' ? 'Detayları aç' : 'Open details'),
        icon: <Info size={15} />,
        onSelect: () => handleOpenDetails(flatItem)
      });
    }

    actions.push({
      id: 'favorite',
      label: isFavorite ? (language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites') : (language === 'tr' ? 'Favorilere ekle' : 'Add to favorites'),
      icon: <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />,
      onSelect: () => toggleFavorite(favoriteId)
    });

    if (contextMenu.fromHistory) {
      actions.push({
        id: 'remove-history',
        label: language === 'tr' ? 'İzleme geçmişinden kaldır' : 'Remove from history',
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
    return <HomeEmptyState t={t} onOpenPlaylistSetup={onOpenPlaylistSetup} />;
  }
  const railArrowClass =
    'absolute top-[38%] -translate-y-1/2 z-30 w-9 h-9 rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:bg-white/10 hover:text-white active:scale-95';

  const renderRailCard = (channel: PlaylistItem, keyPrefix: string) => {
    const isFavorite = globalFavorites.includes(channel.id);
    const openChannel = () => {
        if (channel.type === 'live') {
          handlePlayStream(channel);
        } else {
          handleOpenDetails(channel);
        }
      };

    return (
    <div
      key={`${keyPrefix}-${channel.id}`}
      className="flex-shrink-0 w-[168px] md:w-[200px] group snap-start transition-transform duration-300 hover:scale-[1.03] hover:z-20"
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
        <button
          type="button"
          onClick={openChannel}
          aria-label={channel.name}
          className="absolute inset-0 z-[25] cursor-pointer rounded-[14px] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
        />
        <button type="button"
          onClick={(e) => toggleFavorite(channel.id, e)}
          className="absolute top-2 right-2 z-30 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-white/60 hover:text-red-400 transition-all"
          title={language === 'tr' ? (isFavorite ? 'Favoriden çıkar' : 'Favoriye ekle') : (isFavorite ? 'Remove favorite' : 'Add favorite')}
          aria-label={language === 'tr' ? (isFavorite ? 'Favoriden çıkar' : 'Favoriye ekle') : (isFavorite ? 'Remove favorite' : 'Add favorite')}
        >
          <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
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
  };

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
  const fallbackHeroDesc = t('home.playlistRequiredDescription');
  const heroDescRaw = isPlaylistHero
    ? (featuredTmdbData?.desc || '')
    : (fallbackHeroItem?.desc || fallbackHeroDesc);
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
      <HomeHero
        language={language}
        t={t}
        isPlaylistHero={isPlaylistHero}
        featuredTmdbData={featuredTmdbData}
        currentHeroItem={currentHeroItem}
        fallbackHeroItem={fallbackHeroItem}
        heroTitle={heroTitle}
        heroTitleSize={heroTitleSize}
        heroDesc={heroDesc}
        heroPrimaryLabel={heroPrimaryLabel}
        heroInfoLabel={heroInfoLabel}
        heroFavoriteId={heroFavoriteId}
        heroIsFavorite={heroIsFavorite}
        loadedBackdrop={loadedBackdrop}
        prevBackdrop={prevBackdrop}
        displayFeaturedIndex={displayFeaturedIndex}
        activeShowcaseList={activeShowcaseList}
        onChangeShowcase={changeShowcase}
        onSelectShowcase={setActiveFeaturedIndex}
        onPlayStream={handlePlayStream}
        onOpenDetails={handleOpenDetails}
        onToggleFavorite={toggleFavorite}
        onShowToast={showToast}
      />
      <div className="relative z-20 -mt-10 md:-mt-12 flex flex-col gap-9 select-none pb-4">
        {visibleHomeBlocks >= 1 && playlists.length > 0 && uniqueRecentlyWatched.length > 0 && (
          <ContinueWatchingRail
            language={language}
            title={language === 'tr' ? 'İzlemeye Devam Et' : 'Continue Watching'}
            clearLabel={t('home.clearHistory')}
            items={uniqueRecentlyWatched}
            railArrowClass={railArrowClass}
            onClear={clearRecentlyWatched}
            onScroll={(direction) => handleScrollSlider('slider-history', direction)}
            onPlay={handlePlayStream}
            onContextMenu={(event, item) => openContextMenu(event, item, true)}
          />
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
      <HomeContentRails
        language={language}
        t={t}
        visibleBlocks={visibleHomeBlocks}
        sectionPosition={getSectionPosition}
        liveChannels={homeLiveTvQuickChannels}
        discoveryItems={homeDiscoveryItems}
        top10Movies={top10Movies}
        top10Series={top10Series}
        popularMovies={populerFilmler}
        popularSeries={populerDiziler}
        recentlyWatchedCount={uniqueRecentlyWatched.length}
        favoriteCount={globalFavorites.length}
        contentPreferences={contentPreferences}
        globalFavorites={globalFavorites}
        railArrowClass={railArrowClass}
        renderLiveCard={(item) => renderRailCard(item, 'quick-live')}
        onScroll={handleScrollSlider}
        onToggleFavorite={toggleFavorite}
        onOpenDetails={handleOpenDetails}
        onContextMenu={openContextMenu}
        onShowAll={setSelectedGroup}
      />
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
