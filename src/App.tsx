import { useState, useEffect, useRef, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import type { PlaylistItem } from './utils/m3uParser';
import { groupPlaylistItemsToSeries } from './utils/seriesGroupers';
import type { GroupedSeries } from './utils/seriesGroupers';
import './types';
import type { ContentPreference } from './types';
import { HERO_BACKDROPS } from './constants';
import { getAccentStylesHelper } from './utils/helpers';

import { SettingsProvider } from './context/SettingsContext';

import { useProfilePreferences } from './hooks/useProfilePreferences';
import { useProfiles } from './hooks/useProfiles';
import { usePlaylists } from './hooks/usePlaylists';
import { usePlayerState } from './hooks/usePlayerState';
import { useAppBoot } from './hooks/useAppBoot';
import { useHomeData } from './hooks/useHomeData';
import { useAppSettings } from './hooks/useAppSettings';
import { useSpotlightSearch } from './hooks/useSpotlightSearch';
import { useFilteredCatalog } from './hooks/useFilteredCatalog';
import { useAppSettingsContextValue } from './hooks/useAppSettingsContextValue';
import { useTmdbCrawler } from './hooks/useTmdbCrawler';
import { usePlaylistIndex } from './hooks/usePlaylistIndex';
import { useAppCategories } from './hooks/useAppCategories';
import { useDetailModal } from './hooks/useDetailModal';
import { useDiagnostics } from './hooks/useDiagnostics';

import { Navbar } from './components/Navbar';
import { SpotlightSearch } from './components/SpotlightSearch';
import { Heart, Play, Tv, Info, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ProfileScreenWrapper } from './components/ProfileScreenWrapper';
import { AppModals } from './components/AppModals';

// Lazy load heavy panels and modals for code splitting
const HomeView = lazy(() => import('./components/HomeView').then(m => ({ default: m.HomeView })));
const LiveTvView = lazy(() => import('./components/LiveTvView').then(m => ({ default: m.LiveTvView })));
const SeriesView = lazy(() => import('./components/SeriesView').then(m => ({ default: m.SeriesView })));
const MoviesView = lazy(() => import('./components/MoviesView').then(m => ({ default: m.MoviesView })));
const FavoritesView = lazy(() => import('./components/FavoritesView').then(m => ({ default: m.FavoritesView })));
const DiagnosticsView = lazy(() => import('./components/DiagnosticsView').then(m => ({ default: m.DiagnosticsView })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const PlayerScreen = lazy(() => import('./components/PlayerScreen').then(m => ({ default: m.PlayerScreen })));

const getToastDetails = (message: string) => {
  const msgLower = message.toLowerCase();
  
  if (
    msgLower.includes('yükleniyor') || 
    msgLower.includes('güncelleniyor') || 
    msgLower.includes('indiriliyor') || 
    msgLower.includes('bağlanılıyor') || 
    msgLower.includes('çözümleniyor') ||
    msgLower.includes('loading') ||
    msgLower.includes('updating') ||
    msgLower.includes('downloading') ||
    msgLower.includes('connecting')
  ) {
    return {
      icon: <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />,
      colorClass: 'border-blue-500/20 shadow-[0_4px_16px_rgba(59,130,246,0.12)]',
    };
  }
  
  if (
    msgLower.includes('hata') || 
    msgLower.includes('başarısız') || 
    msgLower.includes('bulunamadı') || 
    msgLower.includes('olamadı') || 
    msgLower.includes('error') || 
    msgLower.includes('failed') ||
    msgLower.includes('yanlış') ||
    msgLower.includes('invalid')
  ) {
    return {
      icon: <AlertCircle size={14} className="text-red-400 shrink-0" />,
      colorClass: 'border-red-500/20 shadow-[0_4px_16px_rgba(239,68,68,0.12)]',
    };
  }
  
  if (
    msgLower.includes('başarılı') || 
    msgLower.includes('eklendi') || 
    msgLower.includes('güncellendi') || 
    msgLower.includes('yüklendi') || 
    msgLower.includes('kaydedildi') || 
    msgLower.includes('başlatıldı') || 
    msgLower.includes('temizlendi') ||
    msgLower.includes('kaldırıldı') ||
    msgLower.includes('success') ||
    msgLower.includes('imported') ||
    msgLower.includes('complete') ||
    msgLower.includes('cleared') ||
    msgLower.includes('added') ||
    msgLower.includes('removed') ||
    msgLower.includes('aktarıldı')
  ) {
    return {
      icon: <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />,
      colorClass: 'border-emerald-500/20 shadow-[0_4px_16px_rgba(16,185,129,0.12)]',
    };
  }
  
  return {
    icon: <Info size={14} className="text-[var(--accent-color)] shrink-0" />,
    colorClass: 'border-white/12 shadow-[0_4px_16px_rgba(255,255,255,0.08)]',
  };
};

export default function App() {
  const appSettings = useAppSettings();
  const {
    toast, showToast, hideToast, isParsing, setIsParsing, sortOption, setSortOption,
    qualityFilter, setQualityFilter, defaultPlayer, setDefaultPlayer,
    tmdbApiKey, setTmdbApiKey, activeAccent, setActiveAccent, activeTheme,
    setActiveTheme, glassIntensity, neonGlowEnabled, language,
    setLanguageState, scrolled, setScrolled, selectedGroup, setSelectedGroup,
    categorySearchQuery, setCategorySearchQuery, saveAppSetting, loadAppSetting,
    setActiveProfileIdSettings, setActiveSettingsTab, setGlassIntensity,
    setNeonGlowEnabled, setCardLayoutSize
  } = appSettings;

  const { loaded, splashStatus, updateAvailable } = useAppBoot({
    language,
    setLanguageState,
    loadAppSetting,
    saveAppSetting,
    loadProfileData,
    setActiveProfileId: (id) => {
      profilesHook.setActiveProfileId(id);
      setActiveProfileIdSettings(id);
    },
    setProfiles: (p) => profilesHook.setProfiles(p),
    setDefaultPlayer,
    setTmdbApiKey,
    setActiveAccent,
    setActiveTheme,
    setGlassIntensity,
    setNeonGlowEnabled,
    setCardLayoutSize,
    showToast
  });

  const preferences = useProfilePreferences({ loadAppSetting: (key, isJson, profileId) => loadAppSetting(key, isJson, profileId) });

  const playlistsHook = usePlaylists({
    saveAppSetting: (key, val, profileId) => saveAppSetting(key, val, profileId),
    loadAppSetting: (key, isJson, profileId) => loadAppSetting(key, isJson, profileId),
    showToast: (msg) => showToast(msg),
    setSelectedGroup,
    isParsing,
    setIsParsing,
    language
  });

  const playerState = usePlayerState({
    saveAppSetting,
    loadAppSetting,
    showToast,
    language
  });

  const profilesHook = useProfiles({
    tmdbApiKey,
    saveAppSetting: (key, val, profileId) => saveAppSetting(key, val, profileId),
    loadAppSetting: (key, isJson, profileId) => loadAppSetting(key, isJson, profileId),
    showToast: (msg) => showToast(msg),
    loadProfileData: (id) => loadProfileData(id, false),
    resetAllProfileData: () => resetAllProfileData(),
    setIsParsing: (val) => setIsParsing(val),
    loaded,
    language
  });

  const { activeProfileId, setActiveProfileId, currentProfile } = profilesHook;
  const activeContentPreferences = useMemo<ContentPreference[]>(() => currentProfile?.contentPreferences || [], [currentProfile]);

  useEffect(() => {
    setActiveProfileIdSettings(activeProfileId);
  }, [activeProfileId, setActiveProfileIdSettings]);

  async function loadProfileData(profileId: string, activateProfile = true) {
    await preferences.load(profileId);
    await playlistsHook.load(profileId);
    await playerState.load(profileId);
    if (activateProfile) setActiveProfileId(profileId);
  }

  async function resetAllProfileData() {
    preferences.reset();
    playlistsHook.reset();
    playerState.reset();
  }

  const {
    favoriteCategories, setFavoriteCategories,
    customCategoryOrder, setCustomCategoryOrder,
    hiddenCategories, setHiddenCategories,
    favoriteSeriesCategories, setFavoriteSeriesCategories,
    customSeriesCategoryOrder, setCustomSeriesCategoryOrder,
    hiddenSeriesCategories, setHiddenSeriesCategories,
    favoriteMovieCategories, setFavoriteMovieCategories,
    customMovieCategoryOrder, setCustomMovieCategoryOrder,
    hiddenMovieCategories, setHiddenMovieCategories
  } = preferences;

  const {
    playlists,
    activePlaylistId,
    items,
    setShowAddPlaylistForm,
    setVisibleCount,
    buildXtreamSeriesGroup
  } = playlistsHook;

  const {
    selectedChannel, setSelectedChannel,
    globalFavorites,
    recentlyWatched,
    toggleFavorite,
    saveToWatchHistory,
    saveWatchProgress,
    clearRecentlyWatched,
    removeFromRecentlyWatched
  } = playerState;

  const {
    profiles,
    isCurrentProfileGradient,
    profileDropdownOpen, setProfileDropdownOpen,
    handleSelectProfile,
    handleLogoutProfile
  } = profilesHook;

  const mainContentRef = useRef<HTMLDivElement>(null);
  const playerReturnStateRef = useRef<{
    seriesModal: GroupedSeries | null;
    channelModal: PlaylistItem | null;
    scrollTop: number;
  } | null>(null);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);


  const {
    showSpotlight,
    setShowSpotlight,
    spotlightSearchInput,
    setSpotlightSearchInput,
    spotlightScope,
    setSpotlightScope,
    spotlightActiveStep,
    setSpotlightActiveStep,
    focusedButtonIndex,
    setFocusedButtonIndex,
    spotlightInputRef,
    deferredSpotlightSearchInput,
  } = useSpotlightSearch({
    searchInputRef
  });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastExit, setToastExit] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast.show) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastExitTimerRef.current) clearTimeout(toastExitTimerRef.current);
      
      setToastMessage(toast.message);
      setToastExit(false);
      setToastVisible(true);
      
      toastTimerRef.current = setTimeout(() => {
        setToastVisible(false);
        setToastExit(true);
        toastExitTimerRef.current = setTimeout(() => {
          setToastMessage('');
          setToastExit(false);
          hideToast();
        }, 500);
      }, 5000);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastExitTimerRef.current) clearTimeout(toastExitTimerRef.current);
    };
  }, [toast.show, toast.message, hideToast]);

  const handleToastMouseEnter = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const handleToastMouseLeave = () => {
    if (!toastVisible || toastExit) return;
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setToastExit(true);
      toastExitTimerRef.current = setTimeout(() => {
        setToastMessage('');
        setToastExit(false);
        hideToast();
      }, 500);
    }, 5000);
  };

  // Debounce search input to prevent lagging on every keystroke (Instant for Ana Sayfa)
  useEffect(() => {
    if (selectedGroup === 'Ana Sayfa') {
      setSearchQuery(searchInput);
      return;
    }
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, selectedGroup]);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isLiveTvView = selectedGroup === 'Canlı TV';
  const isDiagnosticsView = selectedGroup === 'İstatistikler';

  const playlistIndex = usePlaylistIndex(items);
  const { uniqueLiveCategories: rawUniqueLiveCategories, uniqueSeriesCategories: rawUniqueSeriesCategories, uniqueMovieCategories: rawUniqueMovieCategories } = playlistIndex;

  const uniqueLiveCategories = rawUniqueLiveCategories;
  const uniqueMovieCategories = rawUniqueMovieCategories;
  const uniqueSeriesCategories = rawUniqueSeriesCategories;

  const itemBuckets = playlistIndex.itemBuckets;

  const [allGroupedSeries, setAllGroupedSeries] = useState<GroupedSeries[]>([]);

  useEffect(() => {
    let cancelled = false;
    setAllGroupedSeries([]);
    const run = () => {
      const grouped = groupPlaylistItemsToSeries(itemBuckets.series);
      for (let i = 0; i < grouped.length; i++) {
        const s = grouped[i];
        s.nameLower = s.name.toLocaleLowerCase('tr-TR');
        s.groupLower = (s.group || 'Genel').toLocaleLowerCase('tr-TR');
      }
      if (!cancelled) setAllGroupedSeries(grouped);
    };

    const idle = (window as any).requestIdleCallback;
    const cancelIdle = (window as any).cancelIdleCallback;
    const handle = idle ? idle(run, { timeout: 1200 }) : window.setTimeout(run, 60);

    return () => {
      cancelled = true;
      if (idle && cancelIdle) cancelIdle(handle);
      else window.clearTimeout(handle);
    };
  }, [itemBuckets.series]);

  const {
    activeLiveCategory, setActiveLiveCategory,
    activeMovieCategory, setActiveMovieCategory,
    activeSeriesCategory, setActiveSeriesCategory,
    liveCat, seriesCat, movieCat,
    visibleLiveCategoryLimit,
    setVisibleLiveCategoryLimit,
    visibleSeriesCategoryLimit,
    setVisibleSeriesCategoryLimit,
    visibleMovieCategoryLimit,
    setVisibleMovieCategoryLimit
  } = useAppCategories({
    playlists,
    saveAppSetting,
    uniqueLiveCategories,
    uniqueSeriesCategories,
    uniqueMovieCategories,
    categorySearchQuery,
    showToast,
    selectedGroup,
    favoriteCategories,
    setFavoriteCategories,
    customCategoryOrder,
    setCustomCategoryOrder,
    hiddenCategories,
    setHiddenCategories,
    favoriteSeriesCategories,
    setFavoriteSeriesCategories,
    customSeriesCategoryOrder,
    setCustomSeriesCategoryOrder,
    hiddenSeriesCategories,
    setHiddenSeriesCategories,
    favoriteMovieCategories,
    setFavoriteMovieCategories,
    customMovieCategoryOrder,
    setCustomMovieCategoryOrder,
    hiddenMovieCategories,
    setHiddenMovieCategories
  });

  const {
    selectedChannelForModal,
    setSelectedChannelForModal,
    selectedSeriesForModal,
    setSelectedSeriesForModal,
    activeSeason,
    setActiveSeason,
    expandedEpisodeId,
    setExpandedEpisodeId,
    tmdbData,
    tmdbShowId,
    handleOpenSeriesModalDirect,
    handleOpenDetails,
    getFavoriteIdForItem
  } = useDetailModal({
    tmdbApiKey,
    items,
    allGroupedSeries,
    recentlyWatched,
    buildXtreamSeriesGroup
  });

  const {
    checkerLog,
    checkedStatusMap,
    isCheckingHealth,
    runPlaylistDiagnostics
  } = useDiagnostics({
    items,
    language,
    showToast
  });

  const itemStats = useMemo(() => ({
    live: itemBuckets.live.length,
    movie: itemBuckets.movie.length,
    series: itemBuckets.series.length,
    total: items.length
  }), [itemBuckets, items.length]);

  const {
    showcaseItems,
    featuredTmdbData,
    activeFeaturedIndex,
    setActiveFeaturedIndex,
    populerFilmler,
    populerDiziler,
    homeDiscoveryItems,
    homeLiveTvQuickChannels,
    uniqueRecentlyWatched
  } = useHomeData({
    items,
    itemBuckets,
    allGroupedSeries,
    recentlyWatched,
    tmdbApiKey,
    activeContentPreferences
  });

  const {
    filteredDisplayItems,
    groupedSeriesList,
    favoriteSeriesList,
    genericLogosSet,
    spotlightSearchResults
  } = useFilteredCatalog({
    items,
    itemBuckets,
    playlistIndex,
    allGroupedSeries,
    selectedGroup,
    globalFavorites,
    activeLiveCategory,
    activeMovieCategory,
    activeSeriesCategory,
    hiddenCategories,
    hiddenMovieCategories,
    hiddenSeriesCategories,
    deferredSearchQuery,
    sortOption,
    qualityFilter,
    deferredSpotlightSearchInput,
    spotlightScope
  });

  const activeShowcaseList = useMemo(() => showcaseItems.length > 0 ? showcaseItems : HERO_BACKDROPS, [showcaseItems]);
  const isPlaylistHero = showcaseItems.length > 0;
  const currentHeroItem = useMemo(() => isPlaylistHero
    ? (showcaseItems[activeFeaturedIndex] as PlaylistItem)
    : null, [isPlaylistHero, showcaseItems, activeFeaturedIndex]);
  const fallbackHeroItem = useMemo(() => !isPlaylistHero
    ? HERO_BACKDROPS[activeFeaturedIndex]
    : null, [isPlaylistHero, activeFeaturedIndex]);



  

  



  useEffect(() => {
    setVisibleCount(100);
  }, [selectedGroup, searchQuery, activePlaylistId, setVisibleCount]);

  // Reset sort and quality filters when switching playlists or categories
  useEffect(() => {
    setSortOption('default');
    setQualityFilter('all');
  }, [selectedGroup, activeLiveCategory, activeMovieCategory, activeSeriesCategory, activePlaylistId, setSortOption, setQualityFilter]);



  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > 10) {
      setScrolled(true);
    } else {
      setScrolled(false);
    }
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 800;
    if (bottom) {
      setVisibleCount(prev => prev + 100);
    }
  };

  // Watch history actions are handled by the playerState hook

  const handleScrollSlider = (sliderId: string, direction: 'left' | 'right') => {
    const el = document.getElementById(sliderId);
    if (el) {
      const scrollAmount = direction === 'left' ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Launch Internal/External Media Player
  const handlePlayStream = (item: PlaylistItem) => {
    // Preserve the exact screen that launched the player. Episode changes
    // inside the player must not overwrite the original return destination.
    if (!selectedChannel) {
      playerReturnStateRef.current = {
        seriesModal: selectedSeriesForModal,
        channelModal: selectedChannelForModal,
        scrollTop: mainContentRef.current?.scrollTop ?? 0
      };
    }

    setSelectedChannelForModal(null);
    setSelectedSeriesForModal(null);

    // Look up watch progress from recentlyWatched
    const historyItem = recentlyWatched.find(x => x.id === item.id);
    const itemToPlay = historyItem
      ? {
        ...item,
        currentTime: historyItem.currentTime,
        duration: historyItem.duration,
        progress: historyItem.progress
      }
      : item;

    saveToWatchHistory(itemToPlay);

    if (defaultPlayer !== 'internal' && window.electronAPI?.playExternal) {
      window.electronAPI.playExternal(item.url, defaultPlayer)
        .then((res) => {
          if (res && !res.success) {
            showToast(res.message);
            // Fallback to internal player if external player launch fails
            setSelectedChannel(itemToPlay);
          } else {
            showToast(language === 'tr' ? `${defaultPlayer.toUpperCase()} Oynatıcıda başlatıldı.` : `Started in ${defaultPlayer.toUpperCase()} Player.`);
          }
        })
        .catch((err) => {
          console.error("External player failed:", err);
          showToast(language === 'tr' ? "Harici oynatıcı başlatılamadı." : "External player could not be started.");
          setSelectedChannel(itemToPlay);
        });
    } else {
      setSelectedChannel(itemToPlay);
    }
  };

  useEffect(() => {
    if (selectedGroup !== 'Ana Sayfa') return;
    const maxItems = showcaseItems.length > 0 ? showcaseItems.length : HERO_BACKDROPS.length;
    if (maxItems <= 1) return;

    const timer = setInterval(() => {
      setActiveFeaturedIndex(prev => (prev + 1) % maxItems);
    }, 8000);

    return () => clearInterval(timer);
  }, [selectedGroup, showcaseItems.length, activeFeaturedIndex, setActiveFeaturedIndex]);

  // Theme variable bindings for dynamic CSS overrides
  const getAccentStyles = () => getAccentStylesHelper(activeAccent, glassIntensity, neonGlowEnabled);


  // Removed legacy catalog search and category filtering (now handled by useFilteredCatalog)

  // Background TMDB prefetcher and crawler hook integration
  useTmdbCrawler({
    loaded,
    selectedGroup,
    activeSeriesCategory,
    activeMovieCategory,
    filteredDisplayItems,
    groupedSeriesList,
    itemBuckets,
    allGroupedSeries,
    tmdbApiKey
  });

  // Memoized popular movies, excluding maintenance/test/backup items
  // Removed legacy homepage computations (now handled by useHomeData)

  useEffect(() => {
    if (selectedChannel || pendingScrollRestoreRef.current === null) return;

    const scrollTop = pendingScrollRestoreRef.current;
    pendingScrollRestoreRef.current = null;
    const frameId = requestAnimationFrame(() => {
      if (mainContentRef.current) {
        mainContentRef.current.scrollTop = scrollTop;
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [selectedChannel]);



  const settingsContextValue = useAppSettingsContextValue({
    appSettings,
    playlistsHook,
    playerState,
    diagnostics: {
      isCheckingHealth,
      checkerLog,
      runPlaylistDiagnostics
    },
    liveCat,
    seriesCat,
    movieCat,
    items,
    itemStats
  });

  if (selectedChannel) {
    return (
      <SettingsProvider value={settingsContextValue}>
        <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
          <PlayerScreen
            channel={selectedChannel}
            channels={items}
            onChannelChange={handlePlayStream}
            accentStyles={getAccentStyles()}
            saveWatchProgress={saveWatchProgress}
            showToast={showToast}
            onClose={() => {
              const returnState = playerReturnStateRef.current;
              pendingScrollRestoreRef.current = returnState?.scrollTop ?? 0;
              setSelectedChannel(null);
              setSelectedSeriesForModal(returnState?.seriesModal ?? null);
              setSelectedChannelForModal(returnState?.channelModal ?? null);
              playerReturnStateRef.current = null;
            }}
          />
        </Suspense>
      </SettingsProvider>
    );
  }

  if (!loaded) {
    return (
      <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#040405] text-white flex flex-col items-center justify-center select-none font-sans">
        {/* Faint pulsing ambient background glow in center */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full opacity-[0.018] blur-[140px] pointer-events-none transition-all duration-1000 animate-pulse-slow" 
          style={{ 
            left: 'calc(50% - 250px)',
            top: 'calc(50% - 250px)',
            backgroundColor: activeAccent 
          }}
        />

        {/* Minimalist Column */}
        <div className="relative flex flex-col items-center splash-enter">
          {/* Subtle Logo Container */}
          <div className="relative w-20 h-20 flex items-center justify-center animate-pulse-slow">
            <div className="absolute inset-0 rounded-[24px] bg-white/[0.01] border border-white/[0.04] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]" />
            <img src="./icon.png" className="w-12 h-12 object-contain opacity-80" alt="Strmly Logo" />
          </div>

          {/* Minimalist Title */}
          <h1 
            className="text-xl font-light tracking-[0.45em] text-white/85 uppercase mt-8 pl-[0.45em] transition-all duration-1000"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            STRMLY
          </h1>

          {/* Thin Progress bar */}
          <div className="relative h-[2px] w-28 overflow-hidden rounded-full bg-white/[0.06] mt-8">
            <div 
              className="absolute inset-y-0 left-0 w-1/2 rounded-full splash-progress" 
              style={{ 
                backgroundColor: activeAccent,
                boxShadow: `0 0 8px ${activeAccent}`
              }}
            />
          </div>

          {/* Minimalist Status Text */}
          <span 
            className="text-[10px] tracking-[0.2em] text-white/30 uppercase font-semibold mt-4 transition-all duration-300 min-h-[16px] text-center px-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {splashStatus}
          </span>
        </div>
      </div>
    );
  }

  if (loaded && activeProfileId === null) {
    return (
      <SettingsProvider value={settingsContextValue}>
        <ProfileScreenWrapper
          profilesHook={profilesHook}
          isParsing={isParsing}
          toast={toast}
          activeTheme={activeTheme}
          accentStyles={getAccentStyles()}
        />
      </SettingsProvider>
    );
  }

  const favItems = filteredDisplayItems;
  const favSeries = favoriteSeriesList;
  const liveFavCatsToShow = favoriteCategories.filter(group => uniqueLiveCategories.includes(group) && !hiddenCategories.includes(group));
  const seriesFavCatsToShow = favoriteSeriesCategories.filter(group => uniqueSeriesCategories.includes(group) && !hiddenSeriesCategories.includes(group));
  const movieFavCatsToShow = favoriteMovieCategories.filter(group => uniqueMovieCategories.includes(group) && !hiddenMovieCategories.includes(group));



  return (
    <SettingsProvider value={settingsContextValue}>
      <div
        className={`app-wrapper flex flex-col h-screen bg-[var(--bg-main)] text-white relative overflow-hidden select-none ${activeTheme}`}
        style={getAccentStyles()}
        onContextMenu={(event) => event.preventDefault()}
      >
      <div className="absolute top-[-15%] left-[10%] w-[800px] h-[800px] rounded-full bg-glow-one pointer-events-none z-0" />
      <div className="absolute bottom-[-15%] right-[5%] w-[700px] h-[700px] rounded-full bg-glow-two pointer-events-none z-0" />

      {isParsing && (
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-fade-in select-none">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-white/5" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[var(--accent-color)] animate-spin shadow-[0_0_15px_var(--accent-glow)]" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-neutral-300">İçerikler Yükleniyor...</span>
        </div>
      )}

      {toastMessage && (() => {
        const { icon, colorClass } = getToastDetails(toastMessage);
        return (
          <div
            className={`dynamic-island-toast select-none ${
              scrolled ? 'scrolled' : ''
            } ${
              toastVisible ? 'visible' : ''
            } ${toastExit ? 'exit' : ''} ${colorClass}`}
            onMouseEnter={handleToastMouseEnter}
            onMouseLeave={handleToastMouseLeave}
          >
            <div className="dynamic-island-content">
              {icon}
              <span className="text-[12px] font-semibold tracking-wide text-neutral-100">{toastMessage}</span>
            </div>
          </div>
        );
      })()}

      <Navbar
        loaded={loaded}
        scrolled={scrolled}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        setSearchInput={setSearchInput}
        setSearchQuery={setSearchQuery}
        setShowSpotlight={setShowSpotlight}
        setSpotlightScope={setSpotlightScope}
        profileDropdownOpen={profileDropdownOpen}
        setProfileDropdownOpen={setProfileDropdownOpen}
        currentProfile={currentProfile}
        isCurrentProfileGradient={!!isCurrentProfileGradient}
        items={items}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        profiles={profiles}
        handleSelectProfile={handleSelectProfile}
        handleLogoutProfile={handleLogoutProfile}
        updateAvailable={updateAvailable}
      />

      <div ref={mainContentRef} className="flex-1 overflow-y-auto px-6 md:px-10 pt-28 pb-10 relative z-30 select-none hide-scrollbar" onScroll={handleMainScroll}>
        {selectedGroup === 'Ana Sayfa' && !deferredSearchQuery.trim() && (
          <Suspense fallback={null}>
        <HomeView
          selectedGroup={selectedGroup}
          searchQuery={deferredSearchQuery}
          isPlaylistHero={isPlaylistHero}
          featuredTmdbData={featuredTmdbData}
          fallbackHeroItem={fallbackHeroItem}
          currentHeroItem={currentHeroItem}
          activeFeaturedIndex={activeFeaturedIndex}
          setActiveFeaturedIndex={setActiveFeaturedIndex}
          activeShowcaseList={activeShowcaseList}
          playlists={playlists}
          uniqueRecentlyWatched={uniqueRecentlyWatched}
          clearRecentlyWatched={clearRecentlyWatched}
          removeFromRecentlyWatched={removeFromRecentlyWatched}
          handleScrollSlider={handleScrollSlider}
          handlePlayStream={handlePlayStream}
          handleOpenDetails={handleOpenDetails}
          genericLogosSet={genericLogosSet}
          toggleFavorite={toggleFavorite}
          globalFavorites={globalFavorites}
          getFavoriteIdForItem={getFavoriteIdForItem}
          homeDiscoveryItems={homeDiscoveryItems}
          homeLiveTvQuickChannels={homeLiveTvQuickChannels}
          populerFilmler={populerFilmler}
          populerDiziler={populerDiziler}
          contentPreferences={activeContentPreferences}
          setSelectedGroup={setSelectedGroup}
          setActiveLiveCategory={setActiveLiveCategory}
          setActiveSeriesCategory={setActiveSeriesCategory}
          setActiveMovieCategory={setActiveMovieCategory}
          onOpenPlaylistSetup={() => {
            setActiveSettingsTab('playlists');
            setShowAddPlaylistForm(true);
            setSelectedGroup('Ayarlar');
          }}
          showToast={showToast}
        />
          </Suspense>
        )}

        {selectedGroup === 'Favorilerim' && favItems.length === 0 && favSeries.length === 0 && !deferredSearchQuery.trim() && (
          <div className="min-h-[calc(100vh-180px)] flex items-center justify-center animate-fade-in">
            <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-neutral-950/45 backdrop-blur-2xl p-8 md:p-10 text-center shadow-[0_28px_90px_rgba(0,0,0,0.45)] overflow-hidden relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="mx-auto mb-6 w-20 h-20 rounded-[24px] bg-white/[0.06] border border-white/10 flex items-center justify-center text-red-500 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
                <Heart size={30} fill="currentColor" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Henüz favorin yok</h2>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                Kanalların, filmlerin veya dizilerin üzerindeki kalp simgesine tıklayarak favori listenizi oluşturabilirsiniz.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setSelectedGroup('Canlı TV')}
                  className="h-11 px-5 rounded-full bg-white text-black hover:bg-neutral-200 transition-all font-bold text-xs flex items-center gap-2"
                >
                  <Tv size={15} /> Canlı TV'ye Git
                </button>
                <button
                  onClick={() => setSelectedGroup('Ana Sayfa')}
                  className="h-11 px-5 rounded-full bg-white/8 hover:bg-white/14 border border-white/10 transition-all font-bold text-xs text-white flex items-center gap-2"
                >
                  <Play size={14} fill="currentColor" /> Ana Sayfa
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedGroup === 'Favorilerim' && (favItems.length > 0 || favSeries.length > 0 || deferredSearchQuery.trim()) && (
          <Suspense fallback={null}>
        <FavoritesView
          selectedGroup={selectedGroup}
          favChannels={favItems.filter(item => item.type === 'live' || item.type === undefined)}
          favMovies={favItems.filter(item => item.type === 'movie')}
          favSeries={favSeries}
          handlePlayStream={handlePlayStream}
          handleOpenDetails={handleOpenDetails}
          handleOpenSeriesModalDirect={handleOpenSeriesModalDirect}
          toggleFavorite={toggleFavorite}
          globalFavorites={globalFavorites}
          genericLogosSet={genericLogosSet}
          checkedStatusMap={checkedStatusMap}
        />
          </Suspense>
        )}

        {isLiveTvView && (
          <Suspense fallback={null}>
        <LiveTvView
          selectedGroup={selectedGroup}
          activeLiveCategory={activeLiveCategory}
          setActiveLiveCategory={setActiveLiveCategory}
          categorySearchQuery={categorySearchQuery}
          setCategorySearchQuery={setCategorySearchQuery}
          liveFavCatsToShow={liveFavCatsToShow}
          liveCat={liveCat}
          visibleLiveCategoryLimit={visibleLiveCategoryLimit}
          setVisibleLiveCategoryLimit={setVisibleLiveCategoryLimit}
          filteredDisplayItems={favItems}
          handleMainScroll={handleMainScroll}
          handlePlayStream={handlePlayStream}
          checkedStatusMap={checkedStatusMap}
          toggleFavorite={toggleFavorite}
          globalFavorites={globalFavorites}
          setVisibleCount={setVisibleCount}
        />
          </Suspense>
        )}

        {selectedGroup === 'Diziler' && (
          <Suspense fallback={null}>
        <SeriesView
          selectedGroup={selectedGroup}
          activeSeriesCategory={activeSeriesCategory}
          setActiveSeriesCategory={setActiveSeriesCategory}
          categorySearchQuery={categorySearchQuery}
          setCategorySearchQuery={setCategorySearchQuery}
          seriesFavCatsToShow={seriesFavCatsToShow}
          seriesCat={seriesCat}
          visibleSeriesCategoryLimit={visibleSeriesCategoryLimit}
          setVisibleSeriesCategoryLimit={setVisibleSeriesCategoryLimit}
          groupedSeriesList={groupedSeriesList}
          handleMainScroll={handleMainScroll}
          handleOpenSeriesModalDirect={handleOpenSeriesModalDirect}
          genericLogosSet={genericLogosSet}
          toggleFavorite={toggleFavorite}
          globalFavorites={globalFavorites}
          setVisibleCount={setVisibleCount}
        />
          </Suspense>
        )}

        {selectedGroup === 'Sinema' && (
          <Suspense fallback={null}>
        <MoviesView
          selectedGroup={selectedGroup}
          activeMovieCategory={activeMovieCategory}
          setActiveMovieCategory={setActiveMovieCategory}
          categorySearchQuery={categorySearchQuery}
          setCategorySearchQuery={setCategorySearchQuery}
          movieFavCatsToShow={movieFavCatsToShow}
          movieCat={movieCat}
          visibleMovieCategoryLimit={visibleMovieCategoryLimit}
          setVisibleMovieCategoryLimit={setVisibleMovieCategoryLimit}
          filteredDisplayItems={favItems}
          handleMainScroll={handleMainScroll}
          handleOpenDetails={handleOpenDetails}
          handlePlayStream={handlePlayStream}
          genericLogosSet={genericLogosSet}
          checkedStatusMap={checkedStatusMap}
          toggleFavorite={toggleFavorite}
          globalFavorites={globalFavorites}
          setVisibleCount={setVisibleCount}
        />
          </Suspense>
        )}

        {isDiagnosticsView && (
          <Suspense fallback={null}>
        <DiagnosticsView
          selectedGroup={selectedGroup}
          searchQuery={deferredSearchQuery}
          items={items}
          itemStats={itemStats}
          playlists={playlists}
          activePlaylistId={activePlaylistId}
          isCheckingHealth={isCheckingHealth}
          checkerLog={checkerLog}
          runPlaylistDiagnostics={runPlaylistDiagnostics}
        />
          </Suspense>
        )}

        {selectedGroup === 'Ayarlar' && !deferredSearchQuery.trim() && (
          <Suspense fallback={null}>
            <SettingsPanel />
          </Suspense>
        )}
      </div>

      <SpotlightSearch
        showSpotlight={showSpotlight}
        setShowSpotlight={setShowSpotlight}
        spotlightActiveStep={spotlightActiveStep}
        setSpotlightActiveStep={setSpotlightActiveStep}
        focusedButtonIndex={focusedButtonIndex}
        setFocusedButtonIndex={setFocusedButtonIndex}
        spotlightScope={spotlightScope}
        setSpotlightScope={setSpotlightScope}
        spotlightSearchInput={spotlightSearchInput}
        setSpotlightSearchInput={setSpotlightSearchInput}
        spotlightInputRef={spotlightInputRef}
        spotlightSearchResults={spotlightSearchResults}
        handlePlayStream={handlePlayStream}
        handleOpenDetails={handleOpenDetails}
        handleOpenSeriesModalDirect={handleOpenSeriesModalDirect}
      />

      <AppModals
        selectedChannelForModal={selectedChannelForModal}
        setSelectedChannelForModal={setSelectedChannelForModal}
        selectedSeriesForModal={selectedSeriesForModal}
        setSelectedSeriesForModal={setSelectedSeriesForModal}
        tmdbData={tmdbData}
        tmdbShowId={tmdbShowId}
        activeSeason={activeSeason}
        expandedEpisodeId={expandedEpisodeId}
        recentlyWatched={recentlyWatched}
        handlePlayStream={handlePlayStream}
        globalFavorites={globalFavorites}
        toggleFavorite={toggleFavorite}
        setActiveSeason={setActiveSeason}
        setExpandedEpisodeId={setExpandedEpisodeId}
      />

      </div>
    </SettingsProvider>
  );
}
