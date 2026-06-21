import { useState, useEffect, useRef, useMemo, useDeferredValue, lazy, Suspense, useCallback } from 'react';
import type { PlaylistItem } from './utils/m3uParser';
import { groupPlaylistItemsToSeries, parseSeriesEpisodeInfo, cleanMediaTitle } from './utils/seriesGroupers';
import type { GroupedSeries, SeriesEpisode } from './utils/seriesGroupers';
import './types';
import type { ContentPreference, SavedPlaylist, Profile } from './types';
import { HERO_BACKDROPS, GLOBAL_KEYS, DEFAULT_AVATARS, TMDB_CACHE_VERSION } from './constants';
import { getMockDetails, hexToRgbStr } from './utils/helpers';
import {
  tmdbCache, globalSyncPosterMap,
  selectBestTmdbResult, cleanMovieName,
  buildTmdbSearchPath,
  getResolvedTmdbResult,
  getTmdbApiKey,
  resolveTmdbImageSrc,
  getTmdbLanguage
} from './utils/tmdb';

import { useCategoryManager } from './hooks/useCategoryManager';
import { CinematicPlayer } from './components/CinematicPlayer';
import { SettingsProvider } from './context/SettingsContext';
import { getTranslation } from './utils/translations';
import type { Language } from './utils/translations';

import {
  getSearchScore,
  getQualityRank,
  isHdChannel,
  getStableMatchPercentage
} from './utils/searchHelpers';

import { useCinematicPlayer } from './hooks/useCinematicPlayer';

import { useProfilePreferences } from './hooks/useProfilePreferences';
import { useProfiles } from './hooks/useProfiles';
import { usePlaylists } from './hooks/usePlaylists';
import { usePlayerState } from './hooks/usePlayerState';
import { useTmdbCrawler } from './hooks/useTmdbCrawler';

import { Navbar } from './components/Navbar';
import { SpotlightSearch } from './components/SpotlightSearch';
import { ProfileScreen } from './components/ProfileScreen';
import { Heart, Play, Tv } from 'lucide-react';

// Lazy load heavy panels and modals for code splitting
const HomeView = lazy(() => import('./components/HomeView').then(m => ({ default: m.HomeView })));
const LiveTvView = lazy(() => import('./components/LiveTvView').then(m => ({ default: m.LiveTvView })));
const SeriesView = lazy(() => import('./components/SeriesView').then(m => ({ default: m.SeriesView })));
const MoviesView = lazy(() => import('./components/MoviesView').then(m => ({ default: m.MoviesView })));
const FavoritesView = lazy(() => import('./components/FavoritesView').then(m => ({ default: m.FavoritesView })));
const DiagnosticsView = lazy(() => import('./components/DiagnosticsView').then(m => ({ default: m.DiagnosticsView })));
const ChannelModal = lazy(() => import('./components/ChannelModal').then(m => ({ default: m.ChannelModal })));
const SeriesModal = lazy(() => import('./components/SeriesModal').then(m => ({ default: m.SeriesModal })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const turkishCollator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [splashStatus, setSplashStatus] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('cinema_language');
      return stored === 'en' ? 'Starting Strmly...' : 'Strmly başlatılıyor...';
    } catch {
      return 'Strmly başlatılıyor...';
    }
  });
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = useCallback((message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3500);
  }, []);

  const [isParsing, setIsParsing] = useState(false);

  const [activeLiveCategory, setActiveLiveCategory] = useState<string>('Tümü');
  const [activeMovieCategory, setActiveMovieCategory] = useState<string>('Tümü');
  const [activeSeriesCategory, setActiveSeriesCategory] = useState<string>('Tümü');

  const [categoryEditMode, setCategoryEditMode] = useState<boolean>(false);
  const [seriesCategoryEditMode, setSeriesCategoryEditMode] = useState<boolean>(false);
  const [movieCategoryEditMode, setMovieCategoryEditMode] = useState<boolean>(false);

  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedSeriesCategory, setDraggedSeriesCategory] = useState<string | null>(null);
  const [draggedMovieCategory, setDraggedMovieCategory] = useState<string | null>(null);

  const [sortOption, setSortOption] = useState<string>('default');
  const [qualityFilter, setQualityFilter] = useState<string>('all');

  const pendingDiskWrites = useRef<Record<string, any>>({});

  useEffect(() => {
    const handleBeforeUnload = () => {
      const api = window.electronAPI;
      const saveSync = api?.saveConfigSync;
      if (saveSync) {
        Object.keys(pendingDiskWrites.current).forEach((key) => {
          clearTimeout(pendingDiskWrites.current[key]);
          const stored = localStorage.getItem(key);
          if (stored !== null) {
            try {
              saveSync(key, JSON.parse(stored));
            } catch {
              saveSync(key, stored);
            }
          }
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const [defaultPlayer, setDefaultPlayer] = useState<string>('internal');
  const [tmdbApiKey, setTmdbApiKey] = useState<string>(() => getTmdbApiKey());
  const [activeAccent, setActiveAccent] = useState<string>('#FFFFFF');
  const [activeTheme, setActiveTheme] = useState<string>('space-black');
  const [glassIntensity, setGlassIntensity] = useState<string>('medium');
  const [neonGlowEnabled, setNeonGlowEnabled] = useState<boolean>(true);
  const [cardLayoutSize, setCardLayoutSize] = useState<string>('medium');
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('players');
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('cinema_language');
      if (stored) {
        const parsed = stored.startsWith('"') ? JSON.parse(stored) : stored;
        if (parsed === 'en' || parsed === 'tr') return parsed;
      }
    } catch (e) {}
    return 'tr';
  });

  const t = useCallback((key: string) => {
    return getTranslation(key, language);
  }, [language]);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);

  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onUpdateStatus) return;

    const unsubStatus = window.electronAPI.onUpdateStatus((data: any) => {
      if (data.status === 'available' || data.status === 'downloaded') {
        setUpdateAvailable(true);
      } else if (data.status === 'not-available' || data.status === 'error') {
        setUpdateAvailable(false);
      }
    });

    return () => {
      if (unsubStatus) unsubStatus();
    };
  }, []);

  const [selectedGroup, setSelectedGroup] = useState<string>('Ana Sayfa');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  
  const activeProfileIdRef = useRef<string | null>(null);

  const saveAppSetting = useCallback(async (key: string, value: any, profileIdOverride?: string | null) => {
    let finalKey = key;
    const profId = profileIdOverride !== undefined ? profileIdOverride : activeProfileIdRef.current;
    if (profId && !GLOBAL_KEYS.includes(key)) {
      finalKey = `profile_${profId}_${key}`;
    }
    localStorage.setItem(finalKey, typeof value === 'string' ? value : JSON.stringify(value));

    const api = window.electronAPI;
    if (api && api.saveConfig) {
      if (key === 'cinema_recently_watched') {
        if (pendingDiskWrites.current[finalKey]) {
          clearTimeout(pendingDiskWrites.current[finalKey]);
        }
        pendingDiskWrites.current[finalKey] = setTimeout(async () => {
          try {
            await api.saveConfig(finalKey, value);
          } catch (e) {
            console.error("Config save to disk error:", e);
          }
          delete pendingDiskWrites.current[finalKey];
        }, 1000);
      } else {
        if (pendingDiskWrites.current[finalKey]) {
          clearTimeout(pendingDiskWrites.current[finalKey]);
          delete pendingDiskWrites.current[finalKey];
        }
        try {
          await api.saveConfig(finalKey, value);
        } catch (e) {
          console.error("Config save to disk error:", e);
        }
      }
    }
  }, []);

  const loadAppSetting = async (key: string, isJson = false, profileIdOverride?: string | null): Promise<any> => {
    let finalKey = key;
    const profId = profileIdOverride !== undefined ? profileIdOverride : activeProfileIdRef.current;
    if (profId && !GLOBAL_KEYS.includes(key)) {
      finalKey = `profile_${profId}_${key}`;
    }
    if (window.electronAPI && window.electronAPI.loadConfig) {
      const val = await window.electronAPI.loadConfig(finalKey);
      if (val !== null && val !== undefined) return val;
    }
    const stored = localStorage.getItem(finalKey);
    if (!stored) return null;
    return isJson ? JSON.parse(stored) : stored;
  };

  const preferences = useProfilePreferences({ loadAppSetting: (key, isJson, profileId) => loadAppSetting(key, isJson, profileId) });

  const playlistsHook = usePlaylists({
    saveAppSetting: (key, val, profileId) => saveAppSetting(key, val, profileId),
    loadAppSetting: (key, isJson, profileId) => loadAppSetting(key, isJson, profileId),
    showToast: (msg) => showToast(msg),
    setSelectedGroup,
    isParsing,
    setIsParsing
  });

  const playerState = usePlayerState({
    saveAppSetting: (key, val, profileId) => saveAppSetting(key, val, profileId),
    loadAppSetting: (key, isJson, profileId) => loadAppSetting(key, isJson, profileId),
    showToast: (msg) => showToast(msg)
  });

  const profilesHook = useProfiles({
    tmdbApiKey,
    saveAppSetting: (key, val, profileId) => saveAppSetting(key, val, profileId),
    loadAppSetting: (key, isJson, profileId) => loadAppSetting(key, isJson, profileId),
    showToast: (msg) => showToast(msg),
    loadProfileData: (id) => loadProfileData(id, false),
    resetAllProfileData: () => resetAllProfileData(),
    setIsParsing: (val) => setIsParsing(val)
  });

  const { activeProfileId, setActiveProfileId, currentProfile } = profilesHook;
  const activeContentPreferences = useMemo<ContentPreference[]>(() => currentProfile?.contentPreferences || [], [currentProfile]);

  useEffect(() => {
    activeProfileIdRef.current = activeProfileId;
  }, [activeProfileId]);

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
    playlistFormName, setPlaylistFormName,
    m3uUrl, setM3uUrl,
    xtreamUrl, setXtreamUrl,
    xtreamUser, setXtreamUser,
    xtreamPass, setXtreamPass,
    playlistMode, setPlaylistMode,
    showAddPlaylistForm, setShowAddPlaylistForm,
    setVisibleCount,
    handlePlaylistLoadFromUrl,
    handlePlaylistLoadLocal,
    handleXtreamLoad,
    handleDeletePlaylist,
    handleSelectPlaylist,
    updatePlaylistAutoUpdateInterval,
    autoUpdatePlaylist
  } = playlistsHook;

  const {
    selectedChannel, setSelectedChannel,
    selectedChannelForModal, setSelectedChannelForModal,
    globalFavorites, setGlobalFavorites,
    recentlyWatched, setRecentlyWatched,
    toggleFavorite,
    saveToWatchHistory,
    saveWatchProgress
  } = playerState;

  const {
    profiles, setProfiles,
    isCurrentProfileGradient,
    profileSelectMode, setProfileSelectMode,
    profileFormName, setProfileFormName,
    profileFormAvatar, setProfileFormAvatar,
    profileContentPreferences, setProfileContentPreferences,
    editingProfileId, setEditingProfileId,
    profilePlaylistType, setProfilePlaylistType,
    profileM3uUrl, setProfileM3uUrl,
    profileXtreamUrl, setProfileXtreamUrl,
    profileXtreamUser, setProfileXtreamUser,
    profileXtreamPass, setProfileXtreamPass,
    profileAutoUpdateIntervalHours, setProfileAutoUpdateIntervalHours,
    avatarSearchQuery, setAvatarSearchQuery,
    avatarSearchResults, setAvatarSearchResults,
    avatarSearchLoading,
    trendingAvatars, setTrendingAvatars,
    localSeries, setLocalSeries,
    selectedSeriesForCast, setSelectedSeriesForCast,
    seriesCast, setSeriesCast,
    castLoading, setCastLoading,
    profileDropdownOpen, setProfileDropdownOpen,
    profileEntryReady,
    profileSetupStatus,
    handleSelectProfile,
    handleLogoutProfile,
    handleDeleteProfile,
    handleAvatarSearch,
    handleSaveProfile
  } = profilesHook;
  const [selectedSeriesForModal, setSelectedSeriesForModal] = useState<GroupedSeries | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<string | null>(null);
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


  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightSearchInput, setSpotlightSearchInput] = useState('');
  const [spotlightScope, setSpotlightScope] = useState<'all' | 'live' | 'movie' | 'series'>('all');
  const [spotlightActiveStep, setSpotlightActiveStep] = useState<'select_scope' | 'searching'>('select_scope');
  const [focusedButtonIndex, setFocusedButtonIndex] = useState<number>(0);
  const spotlightInputRef = useRef<HTMLInputElement>(null);

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
  const deferredSpotlightSearchInput = useDeferredValue(spotlightSearchInput);
  const isLiveTvView = selectedGroup === 'Canlı TV' || selectedGroup === 'Canlı TV';
  const isDiagnosticsView = selectedGroup === 'İstatistikler' || selectedGroup === 'İstatistikler';

  const playlistIndex = useMemo(() => {
    const liveSet = new Set<string>();
    const seriesSet = new Set<string>();
    const movieSet = new Set<string>();
    const live: PlaylistItem[] = [];
    const movie: PlaylistItem[] = [];
    const series: PlaylistItem[] = [];
    const liveGroupCounts: Record<string, number> = {};
    const liveGroupMap = new Map<string, PlaylistItem[]>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const group = item.group || 'Genel';
      if (item.type === 'live') {
        const groupLower = group.toLowerCase();
        if (groupLower.includes('ulusal') && !isHdChannel(item.name)) continue;
        liveSet.add(group);
        live.push(item);
        liveGroupCounts[group] = (liveGroupCounts[group] || 0) + 1;
        let groupItems = liveGroupMap.get(group);
        if (!groupItems) {
          groupItems = [];
          liveGroupMap.set(group, groupItems);
        }
        groupItems.push(item);
      } else if (item.type === 'series') {
        const nameLower = item.name.toLocaleLowerCase('tr-TR');
        const groupLower = group.toLocaleLowerCase('tr-TR');
        const isSecIzle = nameLower.includes('seçizle') || nameLower.includes('seç izle') ||
                           nameLower.includes('secizle') || nameLower.includes('sec izle') ||
                           nameLower.includes('seç-izle') || nameLower.includes('sec-izle') ||
                           groupLower.includes('seçizle') || groupLower.includes('seç izle') ||
                           groupLower.includes('secizle') || groupLower.includes('sec izle') ||
                           groupLower.includes('seç-izle') || groupLower.includes('sec-izle');
        if (isSecIzle) continue;

        seriesSet.add(group);
        series.push(item);
      } else if (item.type === 'movie') {
        const nameLower = item.name.toLocaleLowerCase('tr-TR');
        const groupLower = group.toLocaleLowerCase('tr-TR');
        const isSecIzle = nameLower.includes('seçizle') || nameLower.includes('seç izle') ||
                           nameLower.includes('secizle') || nameLower.includes('sec izle') ||
                           nameLower.includes('seç-izle') || nameLower.includes('sec-izle') ||
                           groupLower.includes('seçizle') || groupLower.includes('seç izle') ||
                           groupLower.includes('secizle') || groupLower.includes('sec izle') ||
                           groupLower.includes('seç-izle') || groupLower.includes('sec-izle');
        if (isSecIzle) continue;

        movieSet.add(group);
        movie.push(item);
      }
    }

    return {
      uniqueLiveCategories: Array.from(liveSet),
      uniqueSeriesCategories: Array.from(seriesSet),
      uniqueMovieCategories: Array.from(movieSet),
      itemBuckets: {
        live,
        movie,
        series,
        livePreview: live.slice(0, 15)
      },
      liveGroupCounts,
      liveGroupMap
    };
  }, [items]);

  const { uniqueLiveCategories, uniqueSeriesCategories, uniqueMovieCategories } = playlistIndex;
  const itemBuckets = playlistIndex.itemBuckets;

  const { reset: resetPreferences } = preferences;

  // Reset category configurations if there are no playlists loaded
  useEffect(() => {
    if (playlists.length === 0) {
      resetPreferences();
      const activeProfId = activeProfileIdRef.current;
      if (activeProfId) {
        saveAppSetting('favorite_categories', []);
        saveAppSetting('custom_category_order', []);
        saveAppSetting('hidden_categories', []);
        saveAppSetting('favorite_series_categories', []);
        saveAppSetting('custom_series_category_order', []);
        saveAppSetting('hidden_series_categories', []);
        saveAppSetting('favorite_movie_categories', []);
        saveAppSetting('custom_movie_category_order', []);
        saveAppSetting('hidden_movie_categories', []);
      }
    }
  }, [playlists.length, saveAppSetting, resetPreferences]);

  const [allGroupedSeries, setAllGroupedSeries] = useState<GroupedSeries[]>([]);

  useEffect(() => {
    let cancelled = false;
    setAllGroupedSeries([]);
    const run = () => {
      const grouped = groupPlaylistItemsToSeries(itemBuckets.series);
      for (let i = 0; i < grouped.length; i++) {
        const s = grouped[i] as any;
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

  const itemStats = useMemo(() => ({
    live: itemBuckets.live.length,
    movie: itemBuckets.movie.length,
    series: itemBuckets.series.length,
    total: items.length
  }), [itemBuckets, items.length]);

  const [showcaseItems, setShowcaseItems] = useState<PlaylistItem[]>([]);
  const [featuredTmdbData, setFeaturedTmdbData] = useState<{ match: string; rating: string; year: string; desc: string; backdrop?: string; poster?: string } | null>(null);

  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);

  // Filter recently watched list to keep only the most recent episode of each series, and movies
  const uniqueRecentlyWatched = useMemo(() => {
    const seenSeries = new Set<string>();
    return recentlyWatched.filter(item => {
      if (!item || !item.type || !item.name) return false;
      if (item.type === 'movie') {
        return true;
      }
      if (item.type === 'series') {
        const parsed = parseSeriesEpisodeInfo(item.name);
        const key = `${parsed.cleanTitle}:::${item.group || ''}`;
        if (seenSeries.has(key)) {
          return false;
        }
        seenSeries.add(key);
        return true;
      }
      return false;
    });
  }, [recentlyWatched]);

  const activeShowcaseList = useMemo(() => showcaseItems.length > 0 ? showcaseItems : HERO_BACKDROPS, [showcaseItems]);
  const isPlaylistHero = showcaseItems.length > 0;
  const currentHeroItem = useMemo(() => isPlaylistHero
    ? (showcaseItems[activeFeaturedIndex] as PlaylistItem)
    : null, [isPlaylistHero, showcaseItems, activeFeaturedIndex]);
  const fallbackHeroItem = useMemo(() => !isPlaylistHero
    ? HERO_BACKDROPS[activeFeaturedIndex]
    : null, [isPlaylistHero, activeFeaturedIndex]);

  // Sidebar Category Render Limits (Prevents UI lockups with huge lists)
  const [visibleLiveCategoryLimit, setVisibleLiveCategoryLimit] = useState(40);
  const [visibleSeriesCategoryLimit, setVisibleSeriesCategoryLimit] = useState(40);
  const [visibleMovieCategoryLimit, setVisibleMovieCategoryLimit] = useState(40);

  useEffect(() => {
    setVisibleLiveCategoryLimit(40);
    setVisibleSeriesCategoryLimit(40);
    setVisibleMovieCategoryLimit(40);
  }, [selectedGroup, categorySearchQuery]);

  const [checkerLog, setCheckerLog] = useState<string[]>([]);
  const [checkedStatusMap, setCheckedStatusMap] = useState<Record<string, 'online' | 'offline'>>({});
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const [tmdbData, setTmdbData] = useState<{ id?: number; match: string; rating: string; year: string; desc: string; poster?: string; backdrop?: string } | null>(null);
  const [tmdbShowId, setTmdbShowId] = useState<number | null>(null);
  

  

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Spotlight Modal on Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSpotlight(prev => !prev);
      }

      // Close Spotlight Modal on Escape
      if (e.key === 'Escape' && showSpotlight) {
        e.preventDefault();
        setShowSpotlight(false);
      }

      // Handle spotlight menu navigation when spotlight is open and in selection step
      if (showSpotlight && spotlightActiveStep === 'select_scope') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedButtonIndex(prev => (prev + 1) % 3);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedButtonIndex(prev => (prev - 1 + 3) % 3);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          // Select current option: index 0 -> series, index 1 -> movie, index 2 -> live
          const scopes: Array<'series' | 'movie' | 'live'> = ['series', 'movie', 'live'];
          setSpotlightScope(scopes[focusedButtonIndex]);
          setSpotlightActiveStep('searching');
        }
      }

      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        // Focus spotlight search instead of regular search if available, otherwise regular search
        if (showSpotlight) {
          if (spotlightActiveStep === 'searching') {
            spotlightInputRef.current?.focus();
          }
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSpotlight, spotlightActiveStep, focusedButtonIndex]);

  // Autofocus spotlight input when searching is activated, reset when spotlight opens/closes
  useEffect(() => {
    if (showSpotlight) {
      setSpotlightActiveStep('select_scope');
      setFocusedButtonIndex(0);
      setSpotlightSearchInput('');
      (document.activeElement as HTMLElement)?.blur();
    } else {
      setSpotlightSearchInput('');
    }
  }, [showSpotlight]);

  useEffect(() => {
    if (showSpotlight && spotlightActiveStep === 'searching') {
      const timer = setTimeout(() => {
        spotlightInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [spotlightActiveStep, showSpotlight]);

  useEffect(() => {
    setVisibleCount(100);
  }, [selectedGroup, searchQuery, activePlaylistId, setVisibleCount]);

  // Reset sort and quality filters when switching playlists or categories
  useEffect(() => {
    setSortOption('default');
    setQualityFilter('all');
  }, [selectedGroup, activeLiveCategory, activeMovieCategory, activeSeriesCategory, activePlaylistId]);

  // Select highly-rated VOD items (movies/series) for Hero Showcase Carousel from cache/network
  useEffect(() => {
    if (items.length === 0) {
      setShowcaseItems([]);
      setActiveFeaturedIndex(0);
      return;
    }

    let active = true;

    const selectShowcaseItems = async () => {
      const getDayOfYear = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now.getTime() - start.getTime();
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
      };

      const selectDailyShowcase = <T,>(candidates: T[], count: number): T[] => {
        if (candidates.length <= count) return candidates;
        const daySeed = getDayOfYear();
        const selected: T[] = [];
        const available = [...candidates];

        let seed = daySeed;
        const lcgRandom = () => {
          seed = (seed * 1664525 + 1013904223) % 4294967296;
          return seed / 4294967296;
        };

        for (let i = 0; i < count; i++) {
          const index = Math.floor(lcgRandom() * available.length);
          selected.push(available[index]);
          available.splice(index, 1);
        }
        return selected;
      };

      const getCandidateSuitabilityScore = (item: PlaylistItem) => {
        const name = item.name.toLowerCase();
        const group = (item.group || '').toLowerCase();

        // Exclusions (pushed to the very bottom)
        const excludeKeywords = ['7/24', '24/7', 'seç izle', 'sec izle', 'seçizle', 'secizle', 'sinema tv', 'sinematv', 'live', 'raw', 'test', 'promo', 'fragman'];
        if (excludeKeywords.some(kw => name.includes(kw) || group.includes(kw))) {
          return -10000;
        }

        let score = 0;

        // Prioritize curated VOD platforms and high-quality categories.
        const premiumKeywords = [
          'netflix', 'amazon', 'prime', 'disney', 'apple', 'hbo',
          'exxen', 'blu tv', 'blutv', 'uhd', '4k', '1080p',
          'yabancı film', 'yabancı dizi', 'popüler', 'vizyon', 'trend',
          'sine', 'türkçe dublaj', 'türkçe altyazı', 'aksiyon', 'bilim kurgu'
        ];
        for (const kw of premiumKeywords) {
          if (group.includes(kw)) score += 50;
          if (name.includes(kw)) score += 20;
        }

        // Favor VOD types over general type
        if (item.type === 'series') score += 30;
        if (item.type === 'movie') score += 20;

        if (activeContentPreferences.includes('series') && item.type === 'series') score += 180;
        if (activeContentPreferences.includes('movies') && item.type === 'movie') score += 180;
        if (activeContentPreferences.includes('kids')) {
          const kidsKeywords = ['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney', 'nickelodeon'];
          if (kidsKeywords.some(keyword => name.includes(keyword) || group.includes(keyword))) score += 240;
        }

        return score;
      };

      const getCleanTitle = (item: PlaylistItem) => {
        const isSeries = item.type === 'series';
        return isSeries
          ? parseSeriesEpisodeInfo(item.name).cleanTitle.toLowerCase().trim()
          : cleanMovieName(item.name).toLowerCase().trim();
      };

      const vodItems = [...itemBuckets.movie, ...itemBuckets.series];
      const candidatesSource = vodItems.length > 0 ? vodItems : items;

      const sortedCandidatesSource = [...candidatesSource]
        .map(item => ({ item, score: getCandidateSuitabilityScore(item) }))
        .sort((a, b) => b.score - a.score)
        .map(x => x.item);

      // Take first 300 candidates to check cache
      const candidates = sortedCandidatesSource.slice(0, 300);
      const candidatesWithCachedData: { item: PlaylistItem; result: any; rating: number }[] = [];
      const uncachedCandidates: PlaylistItem[] = [];

      // Query IndexedDB in parallel for these 300 items
      const cacheCheckPromises = candidates.map(async (item) => {
        const isSeries = item.type === 'series';
        const cleanTitle = isSeries
          ? parseSeriesEpisodeInfo(item.name).cleanTitle
          : cleanMovieName(item.name);
        const endpoint = isSeries ? 'tv' : 'movie';

        try {
          const fullPath = buildTmdbSearchPath(endpoint, 'DUMMY_API_KEY', cleanTitle);
          const cleanCachePath = fullPath.replace(/[?&]api_key=[^&]+/, '');
          const cacheKey = `api-${cleanCachePath}`;

          const cachedData = await tmdbCache.get(cacheKey);
          if (cachedData && cachedData.results) {
            const bestResult = selectBestTmdbResult(cachedData.results, cleanTitle);
            if (bestResult && (bestResult.backdrop_path || bestResult.poster_path)) {
              return { item, result: bestResult, rating: bestResult.vote_average || 0.1 };
            }
          }
        } catch (e) {
          console.error("Showcase cache check error:", e);
        }
        return { item, result: null, rating: 0 };
      });

      const cachedCheckResults = await Promise.all(cacheCheckPromises);
      if (!active) return;

      for (const res of cachedCheckResults) {
        if (res.result) {
          candidatesWithCachedData.push(res);
        } else {
          uncachedCandidates.push(res.item);
        }
      }

      // Deduplicate cached items by clean title
      const seenCachedTitles = new Set<string>();
      const uniqueCached: typeof candidatesWithCachedData = [];
      for (const c of candidatesWithCachedData) {
        const title = getCleanTitle(c.item);
        if (!seenCachedTitles.has(title)) {
          seenCachedTitles.add(title);
          uniqueCached.push(c);
        }
      }

      let finalSelected: PlaylistItem[];

      // If we have at least 5 unique cached items with ratings and backdrops, sort and select them
      if (uniqueCached.length >= 5) {
        uniqueCached.sort((a, b) => b.rating - a.rating);
        const topPool = uniqueCached.slice(0, 15);
        finalSelected = selectDailyShowcase(topPool, 5).map(c => c.item);
      } else {
        // Collect unique uncached candidates, excluding already cached unique titles
        const seenUncachedTitles = new Set<string>();
        for (const title of seenCachedTitles) {
          seenUncachedTitles.add(title);
        }

        const uniqueUncached: PlaylistItem[] = [];
        for (const item of uncachedCandidates) {
          const title = getCleanTitle(item);
          if (!seenUncachedTitles.has(title)) {
            seenUncachedTitles.add(title);
            uniqueUncached.push(item);
          }
        }

        // Fetch TMDB ratings from network for a small batch of unique items in parallel
        const apiKey = tmdbApiKey;
        const fetchCount = Math.min(uniqueUncached.length, 15);
        const toFetch = uniqueUncached.slice(0, fetchCount);

        const fetchPromises = toFetch.map(async (item) => {
          const isSeries = item.type === 'series';
          const cleanTitle = isSeries
            ? parseSeriesEpisodeInfo(item.name).cleanTitle
            : cleanMovieName(item.name);
          const endpoint = isSeries ? 'tv' : 'movie';

          try {
            const result = await getResolvedTmdbResult(endpoint, apiKey, cleanTitle);
            if (result && (result.backdrop_path || result.poster_path)) {
              return { item, result, rating: result.vote_average || 0.1 };
            }
          } catch (e) {
            console.error("Showcase network fetch error:", e);
          }
          return { item, result: null, rating: 0 };
        });

        const fetchResults = await Promise.all(fetchPromises);
        if (!active) return;

        const combined = [...uniqueCached];
        for (const res of fetchResults) {
          if (res.result) {
            combined.push(res);
          }
        }

        combined.sort((a, b) => b.rating - a.rating);

        const validCandidates = combined.filter(c => c.rating > 0);

        const finalSeenTitles = new Set<string>();
        const selectList: PlaylistItem[] = [];

        for (const c of validCandidates) {
          const title = getCleanTitle(c.item);
          if (!finalSeenTitles.has(title)) {
            finalSeenTitles.add(title);
            selectList.push(c.item);
          }
        }

        // Fallback to candidatesSource (deduplicated) if we still have less than 15 items
        for (const item of sortedCandidatesSource) {
          if (selectList.length >= 15) break;
          const title = getCleanTitle(item);
          if (!finalSeenTitles.has(title)) {
            finalSeenTitles.add(title);
            selectList.push(item);
          }
        }

        finalSelected = selectDailyShowcase(selectList, 5);
      }

      if (active) {
        setShowcaseItems(finalSelected);
        setActiveFeaturedIndex(0);
      }
    };

    selectShowcaseItems();

    return () => {
      active = false;
    };
  }, [items, itemBuckets, tmdbApiKey, activeContentPreferences]);

  // Fetch TMDB data for active featured carousel item
  useEffect(() => {
    if (showcaseItems.length === 0) {
      setFeaturedTmdbData(null);
      return;
    }
    const activeItem = showcaseItems[activeFeaturedIndex];
    if (!activeItem) return;

    const isSeries = activeItem.type === 'series';
    const cleanTitle = isSeries
      ? parseSeriesEpisodeInfo(activeItem.name).cleanTitle
      : cleanMovieName(activeItem.name);

    const controller = new AbortController();
    const { signal } = controller;

    if (tmdbApiKey) {
      const endpoint = isSeries ? 'tv' : 'movie';
      getResolvedTmdbResult(endpoint, tmdbApiKey, cleanTitle, signal)
        .then(async (result) => {
          if (signal.aborted) return;
          if (result) {
            const backdropPath = await resolveTmdbImageSrc(result.backdrop_path || result.poster_path, 'original', signal);
            const posterPath = result.poster_path && result.poster_path !== result.backdrop_path
              ? await resolveTmdbImageSrc(result.poster_path, 'w500', signal)
              : undefined;
            if (signal.aborted) return;
            setFeaturedTmdbData({
              match: getStableMatchPercentage(cleanTitle),
              rating: result.vote_average ? result.vote_average.toFixed(1) : '7.8',
              year: isSeries
                ? (result.first_air_date ? result.first_air_date.split('-')[0] : '2025')
                : (result.release_date ? result.release_date.split('-')[0] : '2025'),
              desc: result.overview || 'Strmly kütüphanesinden benzersiz bir yapım.',
              backdrop: backdropPath || posterPath,
              poster: posterPath
            });
          } else {
            setFeaturedTmdbData({
              match: '92% Eşleşme',
              rating: '7.5',
              year: '2025',
              desc: 'Strmly kütüphanesinden benzersiz bir yapım. Keyifli seyirler dileriz.',
              backdrop: undefined,
              poster: undefined
            });
          }
        })
        .catch((error) => {
          if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
          setFeaturedTmdbData({
            match: '92% Eşleşme',
            rating: '7.5',
            year: '2025',
            desc: 'Strmly kütüphanesinden benzersiz bir yapım. Keyifli seyirler dileriz.',
            backdrop: undefined,
            poster: undefined
          });
        });
    } else {
      setFeaturedTmdbData({
        match: '92% Eşleşme',
        rating: '7.5',
        year: '2025',
        desc: 'Strmly kütüphanesinden benzersiz bir yapım. Keyifli seyirler dileriz.',
        backdrop: undefined,
        poster: undefined
      });
    }

    return () => {
      controller.abort();
    };
  }, [activeFeaturedIndex, showcaseItems, tmdbApiKey]);

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



  useEffect(() => {
    const loadAppConfig = async () => {
      const startTime = Date.now();
      const isReload = sessionStorage.getItem('strmly_session_active') === 'true';
      sessionStorage.setItem('strmly_session_active', 'true');

      const ensureMinDelay = async (delayMs: number) => {
        if (isReload) return;
        const elapsed = Date.now() - startTime;
        if (elapsed < delayMs) {
          await new Promise(resolve => setTimeout(resolve, delayMs - elapsed));
        }
      };

      // Stage 1: Güncelleştirmeler kontrol ediliyor
      setSplashStatus('Güncelleştirmeler kontrol ediliyor...');
      if (!isReload) {
        await new Promise<void>((resolve) => {
          const api = window.electronAPI;
          if (!api || !api.checkForUpdates || !api.onUpdateStatus || !api.installUpdate) {
            setTimeout(resolve, 800); // Simulate check in browser development
            return;
          }

          const checkForUpdates = api.checkForUpdates;
          const onUpdateStatus = api.onUpdateStatus;
          const installUpdate = api.installUpdate;

          const safetyTimeout = setTimeout(() => {
            unsub();
            resolve();
          }, 3500); // Max 3.5s wait for update server

          const unsub = onUpdateStatus((data: any) => {
            if (data.status === 'checking') {
              setSplashStatus(getTranslation('splash.checkingUpdates', language));
            } else if (data.status === 'available') {
              setSplashStatus(getTranslation('settings.about.updateFound', language).replace('{{version}}', ''));
              clearTimeout(safetyTimeout);
            } else if (data.status === 'downloaded') {
              setSplashStatus(getTranslation('splash.updateDownloaded', language));
              setTimeout(() => {
                installUpdate();
              }, 1200);
            } else if (data.status === 'not-available' || data.status === 'error') {
              clearTimeout(safetyTimeout);
              unsub();
              resolve();
            }
          });

          checkForUpdates().catch(() => {
            clearTimeout(safetyTimeout);
            unsub();
            resolve();
          });
        });
      } else {
        await ensureMinDelay(100);
      }

      // Stage 2: Kullanıcı ayarları yükleniyor
      setSplashStatus(getTranslation('splash.loadingSettings', language));
      const [
        savedProfiles,
        configPlayer,
        savedApiKey,
        configAccent,
        configTheme,
        configGlass,
        configGlow,
        configCardSize,
        configLanguage
      ] = await Promise.all([
        loadAppSetting('cinema_profiles', true),
        loadAppSetting('cinema_default_player'),
        loadAppSetting('cinema_tmdb_key'),
        loadAppSetting('cinema_accent'),
        loadAppSetting('cinema_theme'),
        loadAppSetting('cinema_glass_intensity'),
        loadAppSetting('cinema_neon_glow'),
        loadAppSetting('cinema_card_layout_size'),
        loadAppSetting('cinema_language')
      ]);

      let loadedProfiles = Array.isArray(savedProfiles) ? savedProfiles : [];
      setDefaultPlayer(configPlayer || 'internal');

      const configApiKey = (typeof savedApiKey === 'string' && savedApiKey.trim()) || getTmdbApiKey();
      setTmdbApiKey(configApiKey);

      setActiveAccent(configAccent || '#FFFFFF');
      setActiveTheme(configTheme || 'space-black');
      setGlassIntensity(configGlass || 'medium');
      setNeonGlowEnabled(configGlow !== null ? configGlow === 'true' || configGlow === true : true);
      setCardLayoutSize(configCardSize || 'medium');
      if (configLanguage === 'en' || configLanguage === 'tr') {
        setLanguageState(configLanguage);
      }

      // Migrate checks
      const hasOldPlaylists = localStorage.getItem('cinema_playlists');
      if (loadedProfiles.length === 0 && hasOldPlaylists) {
        const defaultProfile: Profile = {
          id: 'main_profile',
          name: 'Arda',
          avatarUrl: DEFAULT_AVATARS[0]
        };
        loadedProfiles = [defaultProfile];

        await saveAppSetting('cinema_profiles', loadedProfiles);

        const keysToMigrate = [
          'favorite_categories', 'custom_category_order', 'hidden_categories',
          'favorite_series_categories', 'custom_series_category_order', 'hidden_series_categories',
          'favorite_movie_categories', 'custom_movie_category_order', 'hidden_movie_categories',
          'cinema_global_favorites', 'cinema_recently_watched', 'cinema_playlists', 'cinema_active_playlist'
        ];

        for (const k of keysToMigrate) {
          const val = localStorage.getItem(k);
          if (val !== null) {
            const finalKey = `profile_main_profile_${k}`;
            if (window.electronAPI && window.electronAPI.saveConfig) {
              try {
                const parsedVal = JSON.parse(val);
                await window.electronAPI.saveConfig(finalKey, parsedVal);
              } catch {
                await window.electronAPI.saveConfig(finalKey, val);
              }
            }
            localStorage.setItem(finalKey, val);
            localStorage.removeItem(k); // Clean up old key
          }
        }

        await saveAppSetting('cinema_active_profile_id', 'main_profile');
      }

      setProfiles(loadedProfiles);
      await ensureMinDelay(1800);

      // Stage 3: Playlistler güncelleniyor
      setSplashStatus(getTranslation('splash.loadingContents', language));
      try {
        await tmdbCache.loadAllToMemory();
      } catch (err) {
        console.error("Failed to preload TMDB cache:", err);
      }
      await ensureMinDelay(2600);

      // Stage 4: Profil verileri yükleniyor & Strmly başlatılıyor
      setSplashStatus(getTranslation('splash.loadingProfiles', language));
      const activeProfId = await loadAppSetting('cinema_active_profile_id');
      if (activeProfId && loadedProfiles.some(p => p.id === activeProfId)) {
        try {
          await loadProfileData(activeProfId);
        } catch (error) {
          console.error("Error loading active profile:", error);
          showToast(getTranslation('profiles.loadingProfilesError', language));
        }
      } else {
        setActiveProfileId(null);
      }

      await ensureMinDelay(3200);
      
      setLoaded(true);
    };
    loadAppConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch popular Turkish series on boot
  useEffect(() => {
    let cancelled = false;

    const fetchLocalSeriesList = async () => {
      if (!tmdbApiKey) {
        setTrendingAvatars([]);
        return;
      }

      // Never leave an avatar pool from a previous request/profile visible.
      setTrendingAvatars([]);
      try {
        const fetchTmdbJson = async (path: string) => {
          if (window.electronAPI?.fetchTmdb) {
            return await window.electronAPI.fetchTmdb(path) as any;
          }
          const response = await fetch(`https://api.themoviedb.org${path}`);
          if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
          return await response.json();
        };

        const tmdbLang = getTmdbLanguage();
        // Pull several pages and explicitly prioritize productions originating
        // from Turkey. One TMDB page only contains 20 results.
        const pages = await Promise.all([1, 2, 3].map(page => {
          const discoverPath = `/3/discover/tv?api_key=${tmdbApiKey}&with_origin_country=TR&with_original_language=tr&sort_by=popularity.desc&include_null_first_air_dates=false&language=${tmdbLang}&page=${page}`;
          return fetchTmdbJson(discoverPath);
        }));
        const seenIds = new Set<number>();
        const results = pages
          .flatMap(data => Array.isArray(data?.results) ? data.results : [])
          .filter(item => item?.id && !seenIds.has(item.id) && seenIds.add(item.id));

        const items = results.filter(item => item.poster_path).slice(0, 48);

        // Resolve images in parallel
        const resolvedList = await Promise.all(
          items.map(async (item) => {
            const posterUrl = await resolveTmdbImageSrc(item.poster_path, 'w185');
            return {
              id: item.id,
              name: item.name,
              posterUrl: posterUrl || ''
            };
          })
        );

        if (cancelled) return;
        setLocalSeries(resolvedList.filter(item => item.posterUrl));

        // Build the quick-avatar row from actors in prominent Turkish series,
        // so every thumbnail is a face rather than a poster.
        const credits = await Promise.all(items.slice(0, 12).map(item => (
          fetchTmdbJson(`/3/tv/${item.id}/credits?api_key=${tmdbApiKey}&language=${tmdbLang}`).catch(() => ({ cast: [] }))
        )));
        const seenProfiles = new Set<string>();
        const actorPaths = credits
          .flatMap(data => Array.isArray(data?.cast) ? data.cast : [])
          .filter(actor => actor?.profile_path && !seenProfiles.has(actor.profile_path) && seenProfiles.add(actor.profile_path))
          .slice(0, 36)
          .map(actor => actor.profile_path as string);

        if (actorPaths.length > 0) {
          const actorImages = await Promise.all(actorPaths.map(path => resolveTmdbImageSrc(path, 'w185')));
          if (!cancelled) {
            setTrendingAvatars(actorImages.filter((image): image is string => Boolean(image)));
          }
        }
      } catch (e) {
        console.error("Error fetching local series:", e);
      }
    };

    if (loaded) {
      fetchLocalSeriesList();
    }

    return () => {
      cancelled = true;
    };
  }, [loaded, tmdbApiKey, setLocalSeries, setTrendingAvatars]);

  const handleFetchSeriesCast = async (seriesId: number, seriesName: string, mediaType: 'movie' | 'tv' = 'tv') => {
    setCastLoading(true);
    setSelectedSeriesForCast({ id: seriesId, name: seriesName });
    try {
      let castList: any[] = [];
      const creditsPath = `/3/${mediaType}/${seriesId}/credits?api_key=${tmdbApiKey}&language=${getTmdbLanguage()}`;

      if (window.electronAPI && window.electronAPI.fetchTmdb) {
        const res = await window.electronAPI.fetchTmdb(creditsPath) as any;
        if (res && Array.isArray(res.cast)) {
          castList = res.cast;
        }
      } else {
        const res = await fetch(`https://api.themoviedb.org${creditsPath}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.cast)) {
            castList = data.cast;
          }
        }
      }

      // Filter cast to those who have profile photos
      const castWithPhotos = castList.filter(item => item.profile_path).slice(0, 18);

      // Resolve image URLs in parallel
      const resolvedCast = await Promise.all(
        castWithPhotos.map(async (item) => {
          const avatarUrl = await resolveTmdbImageSrc(item.profile_path, 'w185');
          return {
            name: item.name,
            avatarUrl: avatarUrl || ''
          };
        })
      );

      setSeriesCast(resolvedCast.filter(item => item.avatarUrl));
    } catch (e) {
      console.error("Error fetching cast:", e);
      showToast(language === 'tr' ? "Oyuncular yüklenirken bir hata oluştu." : "An error occurred while loading actors.");
    } finally {
      setCastLoading(false);
    }
  };


  // Category manager hooks — one per domain (live/series/movie)
  const liveCat = useCategoryManager({
    domain: 'live',
    uniqueCategories: uniqueLiveCategories,
    categorySearchQuery,
    saveAppSetting,
    showToast,
    activeCategory: activeLiveCategory,
    setActiveCategory: setActiveLiveCategory,
    favorites: favoriteCategories,
    setFavorites: setFavoriteCategories,
    customOrder: customCategoryOrder,
    setCustomOrder: setCustomCategoryOrder,
    hidden: hiddenCategories,
    setHidden: setHiddenCategories,
    editMode: categoryEditMode,
    setEditMode: setCategoryEditMode,
    draggedCategory,
    setDraggedCategory,
  });

  const seriesCat = useCategoryManager({
    domain: 'series',
    uniqueCategories: uniqueSeriesCategories,
    categorySearchQuery,
    saveAppSetting,
    showToast,
    activeCategory: activeSeriesCategory,
    setActiveCategory: setActiveSeriesCategory,
    favorites: favoriteSeriesCategories,
    setFavorites: setFavoriteSeriesCategories,
    customOrder: customSeriesCategoryOrder,
    setCustomOrder: setCustomSeriesCategoryOrder,
    hidden: hiddenSeriesCategories,
    setHidden: setHiddenSeriesCategories,
    editMode: seriesCategoryEditMode,
    setEditMode: setSeriesCategoryEditMode,
    draggedCategory: draggedSeriesCategory,
    setDraggedCategory: setDraggedSeriesCategory,
  });

  const movieCat = useCategoryManager({
    domain: 'movie',
    uniqueCategories: uniqueMovieCategories,
    categorySearchQuery,
    saveAppSetting,
    showToast,
    activeCategory: activeMovieCategory,
    setActiveCategory: setActiveMovieCategory,
    favorites: favoriteMovieCategories,
    setFavorites: setFavoriteMovieCategories,
    customOrder: customMovieCategoryOrder,
    setCustomOrder: setCustomMovieCategoryOrder,
    hidden: hiddenMovieCategories,
    setHidden: setHiddenMovieCategories,
    editMode: movieCategoryEditMode,
    setEditMode: setMovieCategoryEditMode,
    draggedCategory: draggedMovieCategory,
    setDraggedCategory: setDraggedMovieCategory,
  });


  // Sync TMDB/Mock data cache on Detail Modal open
  useEffect(() => {
    const activeItem = selectedChannelForModal || selectedSeriesForModal;
    if (!activeItem) {
      setTmdbData(null);
      setTmdbShowId(null);
      return;
    }
    const isSeries = ('seasons' in activeItem) || activeItem.type === 'series';
    const cleanTitle = ('seasons' in activeItem)
      ? activeItem.name
      : (activeItem.type === 'series'
        ? parseSeriesEpisodeInfo(activeItem.name).cleanTitle
        : cleanMovieName(activeItem.name));
    const group = activeItem.group;

    const controller = new AbortController();
    const { signal } = controller;

    if (tmdbApiKey) {
      const endpoint = isSeries ? 'tv' : 'movie';
      getResolvedTmdbResult(endpoint, tmdbApiKey, cleanTitle, signal)
        .then(async (result) => {
          if (signal.aborted) return;
          if (result) {
            const rating = result.vote_average || 7.5;
            const posterPath = await resolveTmdbImageSrc(result.poster_path, 'w500', signal);
            const backdropPath = await resolveTmdbImageSrc(result.backdrop_path, 'original', signal);
            if (signal.aborted) return;
            setTmdbShowId(isSeries ? result.id : null);
            setTmdbData({
              id: result.id,
              match: `%${Math.floor(rating * 10) || 85} Eşleşme`,
              rating: `★ ${rating.toFixed(1)}`,
              year: isSeries
                ? (result.first_air_date?.split('-')[0] || '2026')
                : (result.release_date?.split('-')[0] || '2026'),
              desc: result.overview || getMockDetails(cleanTitle, group).desc,
              poster: posterPath,
              backdrop: backdropPath
            });
          } else {
            setTmdbShowId(null);
            setTmdbData({
              ...getMockDetails(cleanTitle, group),
              poster: undefined,
              backdrop: undefined
            });
          }
        })
        .catch((error) => {
          if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
          setTmdbShowId(null);
          setTmdbData({
            ...getMockDetails(cleanTitle, group),
            poster: undefined,
            backdrop: undefined
          });
        });
    } else {
      setTmdbData({
        ...getMockDetails(cleanTitle, group),
        poster: undefined,
        backdrop: undefined
      });
    }

    return () => {
      controller.abort();
    };
  }, [selectedChannelForModal, selectedSeriesForModal, tmdbApiKey]);


  // Open series modal with a pre-grouped series object
  const handleOpenSeriesModalDirect = (series: GroupedSeries, targetEpisodeItem?: PlaylistItem) => {
    console.log("[DEBUG] handleOpenSeriesModalDirect called for series:", series.name, "seasons count:", Object.keys(series.seasons).length);
    setSelectedSeriesForModal(series);
    const seasons = Object.keys(series.seasons).map(Number).sort((a, b) => a - b);

    if (targetEpisodeItem) {
      const parsed = parseSeriesEpisodeInfo(targetEpisodeItem.name);
      console.log("[DEBUG] targetEpisodeItem specified. Parsed season:", parsed.season, "episode:", parsed.episode);
      setActiveSeason(parsed.season);
      setExpandedEpisodeId(targetEpisodeItem.id);
    } else if (seasons.length > 0) {
      console.log("[DEBUG] Selecting default season:", seasons[0]);
      setActiveSeason(seasons[0]);
      if (series.seasons[seasons[0]].length > 0) {
        setExpandedEpisodeId(series.seasons[seasons[0]][0].item.id);
      } else {
        setExpandedEpisodeId(null);
      }
    }
  };

  // Open series modal by dynamically grouping sibling episodes from the entire items list
  const handleOpenSeriesModalForFlatItem = (item: PlaylistItem) => {
    console.log("[DEBUG] handleOpenSeriesModalForFlatItem called with item:", item.name);
    const parsed = parseSeriesEpisodeInfo(item.name);
    const seriesGroup = item.group || 'Genel';

    // Find all sibling series items that match clean title and category
    const siblings = items.filter(ch => {
      if (ch.type !== 'series') return false;
      const p = parseSeriesEpisodeInfo(ch.name);
      return p.cleanTitle === parsed.cleanTitle && (ch.group || 'Genel') === seriesGroup;
    });
    console.log("[DEBUG] Found siblings count:", siblings.length);

    const seasonsMap: Record<number, SeriesEpisode[]> = {};
    let episodesCount = 0;

    for (const sib of siblings) {
      const p = parseSeriesEpisodeInfo(sib.name);
      if (!seasonsMap[p.season]) {
        seasonsMap[p.season] = [];
      }
      const exists = seasonsMap[p.season].some(ep => ep.episodeNumber === p.episode);
      if (!exists) {
        seasonsMap[p.season].push({
          episodeNumber: p.episode,
          seasonNumber: p.season,
          item: sib
        });
        episodesCount++;
      }
    }

    // Sort episodes in each season
    for (const seasonNo in seasonsMap) {
      seasonsMap[seasonNo].sort((a, b) => a.episodeNumber - b.episodeNumber);
    }

    const grouped: GroupedSeries = {
      id: `series-${item.id}`,
      name: parsed.cleanTitle,
      logo: item.logo || (siblings.find(s => s.logo)?.logo || ''),
      group: seriesGroup,
      type: 'series',
      seasons: seasonsMap,
      episodesCount
    };

    console.log("[DEBUG] Grouped series:", grouped.name, "episodes:", grouped.episodesCount);
    handleOpenSeriesModalDirect(grouped, item);
  };

  const handleOpenDetails = (item: PlaylistItem) => {
    console.log("[DEBUG] handleOpenDetails called with item:", item.name, "type:", item.type);
    const historyItem = recentlyWatched.find(x => x.id === item.id);
    const itemWithProgress = historyItem
      ? { ...item, currentTime: historyItem.currentTime, duration: historyItem.duration, progress: historyItem.progress }
      : item;

    if (item.type === 'series') {
      handleOpenSeriesModalForFlatItem(itemWithProgress);
    } else {
      console.log("[DEBUG] Opening channel/movie modal for:", itemWithProgress.name);
      setSelectedChannelForModal(itemWithProgress);
    }
  };

  const getFavoriteIdForItem = (item: PlaylistItem | GroupedSeries): string => {
    if ('seasons' in item) return item.id;
    if (item.type !== 'series') return item.id;

    const parsed = parseSeriesEpisodeInfo(item.name);
    const grouped = allGroupedSeries.find(series =>
      series.name === parsed.cleanTitle &&
      (series.group || 'Genel') === (item.group || 'Genel')
    );
    return grouped?.id ?? item.id;
  };

  const clearRecentlyWatched = () => {
    setRecentlyWatched([]);
    saveAppSetting('cinema_recently_watched', []);
    showToast(language === 'tr' ? "İzleme geçmişi temizlendi." : "Watch history cleared.");
  };

  const removeFromRecentlyWatched = (item: PlaylistItem) => {
    setRecentlyWatched(previous => {
      const parsedTarget = item.type === 'series' ? parseSeriesEpisodeInfo(item.name) : null;
      const updated = previous.filter(candidate => {
        if (candidate.id === item.id) return false;
        if (!parsedTarget || candidate.type !== 'series') return true;
        const parsedCandidate = parseSeriesEpisodeInfo(candidate.name);
        return parsedCandidate.cleanTitle !== parsedTarget.cleanTitle ||
          (candidate.group || 'Genel') !== (item.group || 'Genel');
      });
      saveAppSetting('cinema_recently_watched', updated);
      return updated;
    });
    showToast(item.type === 'series'
      ? (language === 'tr' ? "Dizi izleme geçmişinden kaldırıldı." : "Series removed from watch history.")
      : (language === 'tr' ? "İçerik izleme geçmişinden kaldırıldı." : "Content removed from watch history."));
  };

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
  }, [selectedGroup, showcaseItems.length, activeFeaturedIndex]);

  const runPlaylistDiagnostics = useCallback(async () => {
    if (items.length === 0) {
      showToast(language === 'tr' ? "Kontrol edilecek kanal bulunamadı!" : "No channels found to check!");
      return;
    }
    setIsCheckingHealth(true);
    setCheckerLog([
      language === 'tr' ? "Test başlatılıyor..." : "Starting diagnostics...",
      language === 'tr' ? `Toplam kanal sayısı: ${items.length}` : `Total channel count: ${items.length}`,
      language === 'tr' ? "HEAD istekleri gönderiliyor..." : "Sending HEAD requests..."
    ]);

    const limit = 20; // Check up to 20 channels to save performance
    const toCheck = items.slice(0, limit);
    const statusResults: Record<string, 'online' | 'offline'> = {};

    for (let i = 0; i < toCheck.length; i++) {
      const ch = toCheck[i];
      setCheckerLog(prev => [...prev, language === 'tr' ? `[Sorgu ${i + 1}/${limit}] ${ch.name} test ediliyor...` : `[Query ${i + 1}/${limit}] Checking ${ch.name}...`]);
      try {
        const res = await fetch(ch.url, { method: 'HEAD', mode: 'cors', headers: { 'User-Agent': '9XtreamPlayer LibVLC/3.0.22-rc1' } }).catch(() => null);
        if (res && res.status >= 200 && res.status < 400) {
          statusResults[ch.id] = 'online';
          setCheckerLog(prev => [...prev, language === 'tr' ? `ÇEVRİMİÇİ | Kod: ${res.status}` : `ONLINE | Status: ${res.status}`]);
        } else {
          statusResults[ch.id] = 'offline';
          setCheckerLog(prev => [...prev, language === 'tr' ? `ÇEVRİMDIŞI veya CORS Engeli` : `OFFLINE or CORS blocked`]);
        }
      } catch {
        statusResults[ch.id] = 'offline';
        setCheckerLog(prev => [...prev, language === 'tr' ? `HATA | Ulaşılamadı` : `ERROR | Unreachable`]);
      }
      // Brief pause
      await new Promise(r => setTimeout(r, 100));
    }

    setCheckedStatusMap(prev => ({ ...prev, ...statusResults }));
    setIsCheckingHealth(false);
    setCheckerLog(prev => [...prev, language === 'tr' ? "✓ Test tamamlandı. Sonuçlar listelere yansıtıldı!" : "✓ Diagnostics complete. Results updated in lists!"]);
    showToast(language === 'tr' ? "Sağlık kontrolü tamamlandı!" : "Health check complete!");
  }, [items, showToast, language]);

  // Theme variable bindings for dynamic CSS overrides
  const getAccentStyles = () => {
    const rgb = hexToRgbStr(activeAccent);
    return {
      '--accent-color': activeAccent,
      '--accent-hover': activeAccent,
      '--accent-glow': `rgba(${rgb}, 0.45)`,
      '--border-active': activeAccent,
      '--blur-level': glassIntensity === 'high' ? '28px' : glassIntensity === 'medium' ? '14px' : '0px',
      '--glass-opacity': glassIntensity === 'high' ? '0.35' : glassIntensity === 'medium' ? '0.55' : '0.96',
      '--card-glow-shadow': neonGlowEnabled ? `0 8px 30px rgba(${rgb}, 0.25)` : '0 4px 20px rgba(0, 0, 0, 0.3)',
      '--accent-glow-border': neonGlowEnabled ? `rgba(${rgb}, 0.35)` : 'rgba(255, 255, 255, 0.1)',
      '--accent-glow-solid': `rgba(${rgb}, 0.15)`
    } as React.CSSProperties;
  };


  // Filter criteria for groups and grids - memoized to prevent performance issues
  const filteredDisplayItems = useMemo(() => {
    let base = items;
    if (selectedGroup === 'Favorilerim') {
      const favSet = new Set(globalFavorites || []);
      base = items.filter(ch => favSet.has(ch.id));
    } else if (selectedGroup === 'Canlı TV') {
      const hiddenSet = new Set(hiddenCategories || []);
      const liveItems = itemBuckets.live;
      if (activeLiveCategory !== 'Tümü') {
        base = liveItems.filter(ch => (ch.group || 'Genel') === activeLiveCategory);
      } else {
        base = liveItems.filter(ch => !hiddenSet.has(ch.group || 'Genel'));
      }
    } else if (selectedGroup === 'Sinema') {
      const hiddenSet = new Set(hiddenMovieCategories || []);
      const movieItems = itemBuckets.movie;
      if (activeMovieCategory !== 'Tümü') {
        base = movieItems.filter(ch => (ch.group || 'Genel') === activeMovieCategory);
      } else {
        base = movieItems.filter(ch => !hiddenSet.has(ch.group || 'Genel'));
      }
    } else if (selectedGroup === 'Diziler') {
      // Avoid filtering individual episodes for Diziler, we filter allGroupedSeries directly instead!
      return [];
    } else if (selectedGroup !== 'Ana Sayfa' && selectedGroup !== 'İstatistikler' && selectedGroup !== 'Ayarlar') {
      base = items.filter(ch => ch.group === selectedGroup);
    }

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.trim().toLocaleLowerCase('tr-TR');
      base = base.filter(ch => {
        const nLower = ch.nameLower || ch.name.toLocaleLowerCase('tr-TR');
        const gLower = ch.groupLower || (ch.group || 'Genel').toLocaleLowerCase('tr-TR');
        return nLower.includes(query) || gLower.includes(query);
      });
    }

    // Filter national channels to only show HD versions
    base = base.filter(ch => {
      const groupName = ch.group || 'Genel';
      if (groupName.toLowerCase().includes('ulusal')) return isHdChannel(ch.name);
      return true;
    });

    // Filter by quality / resolution
    if (qualityFilter !== 'all') {
      base = base.filter(ch => {
        const nameLower = ch.name.toLowerCase();
        const is4k = nameLower.includes('4k') || nameLower.includes('uhd') || nameLower.includes('2160p');
        const isFhd = nameLower.includes('fhd') || nameLower.includes('1080p') || nameLower.includes('1080i');
        const isHd = (nameLower.includes('hd') && !nameLower.includes('fhd')) || nameLower.includes('720p') || nameLower.includes('720i');
        const isSd = nameLower.includes('sd') || nameLower.includes('576p') || nameLower.includes('480p') || (!is4k && !isFhd && !isHd);

        if (qualityFilter === '4k') return is4k;
        if (qualityFilter === 'fhd') return isFhd;
        if (qualityFilter === 'hd') return isHd;
        if (qualityFilter === 'sd') return isSd;
        return true;
      });
    }

    // Sort items (A-Z / Z-A)
    if (sortOption === 'az') {
      base = [...base].sort((a, b) => turkishCollator.compare(a.name, b.name));
    } else if (sortOption === 'za') {
      base = [...base].sort((a, b) => turkishCollator.compare(b.name, a.name));
    }

    return base;
  }, [items, itemBuckets, selectedGroup, globalFavorites, activeLiveCategory, hiddenCategories, activeMovieCategory, hiddenMovieCategories, deferredSearchQuery, sortOption, qualityFilter]);

  // Memoized grouped series list for when selectedGroup === 'Diziler'
  const groupedSeriesList = useMemo(() => {
    if (selectedGroup !== 'Diziler') return [];

    let base = allGroupedSeries;

    // 1. Filter by Category
    const hiddenSet = new Set(hiddenSeriesCategories || []);
    if (activeSeriesCategory !== 'Tümü') {
      base = base.filter(series => (series.group || 'Genel') === activeSeriesCategory);
    } else {
      base = base.filter(series => !hiddenSet.has(series.group || 'Genel'));
    }

    // 2. Filter by Search Query (matching show name, category, or nested episode names)
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.trim().toLocaleLowerCase('tr-TR');
      base = base.filter(series => {
        const sNameLower = (series as any).nameLower || series.name.toLocaleLowerCase('tr-TR');
        const sGroupLower = (series as any).groupLower || (series.group || 'Genel').toLocaleLowerCase('tr-TR');
        if (sNameLower.includes(query) || sGroupLower.includes(query)) return true;

        return Object.values(series.seasons).some(episodes =>
          episodes.some(ep => {
            const epNameLower = ep.item.nameLower || ep.item.name.toLocaleLowerCase('tr-TR');
            return epNameLower.includes(query);
          })
        );
      });
    }

    // Filter by quality / resolution
    if (qualityFilter !== 'all') {
      base = base.filter(series => {
        const nameLower = series.name.toLowerCase();
        const is4k = nameLower.includes('4k') || nameLower.includes('uhd') || nameLower.includes('2160p');
        const isFhd = nameLower.includes('fhd') || nameLower.includes('1080p') || nameLower.includes('1080i');
        const isHd = (nameLower.includes('hd') && !nameLower.includes('fhd')) || nameLower.includes('720p') || nameLower.includes('720i');
        const isSd = nameLower.includes('sd') || nameLower.includes('576p') || nameLower.includes('480p') || (!is4k && !isFhd && !isHd);

        if (qualityFilter === '4k') return is4k;
        if (qualityFilter === 'fhd') return isFhd;
        if (qualityFilter === 'hd') return isHd;
        if (qualityFilter === 'sd') return isSd;
        return true;
      });
    }

    // Sort items (A-Z / Z-A)
    if (sortOption === 'az') {
      base = [...base].sort((a, b) => turkishCollator.compare(a.name, b.name));
    } else if (sortOption === 'za') {
      base = [...base].sort((a, b) => turkishCollator.compare(b.name, a.name));
    }

    return base;
  }, [allGroupedSeries, selectedGroup, activeSeriesCategory, hiddenSeriesCategories, deferredSearchQuery, sortOption, qualityFilter]);

  // Memoized favorite series list
  const favoriteSeriesList = useMemo(() => {
    const favSet = new Set(globalFavorites || []);
    let base = allGroupedSeries.filter(series => favSet.has(series.id));
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.trim().toLocaleLowerCase('tr-TR');
      base = base.filter(series => {
        const sNameLower = (series as any).nameLower || series.name.toLocaleLowerCase('tr-TR');
        const sGroupLower = (series as any).groupLower || (series.group || 'Genel').toLocaleLowerCase('tr-TR');
        if (sNameLower.includes(query) || sGroupLower.includes(query)) return true;

        return Object.values(series.seasons).some(episodes =>
          episodes.some(ep => {
            const epNameLower = ep.item.nameLower || ep.item.name.toLocaleLowerCase('tr-TR');
            return epNameLower.includes(query);
          })
        );
      });
    }
    return base;
  }, [allGroupedSeries, globalFavorites, deferredSearchQuery]);

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

  // Find duplicate logos that represent generic category posters rather than unique content covers
  const genericLogosSet = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type !== 'live') {
        const logo = item.logo;
        if (logo && logo.startsWith('http')) {
          counts[logo] = (counts[logo] || 0) + 1;
        }
      }
    }

    const genericSet = new Set<string>();
    for (const logo in counts) {
      if (counts[logo] > 5) {
        genericSet.add(logo);
      }
    }
    return genericSet;
  }, [items]);



  // Spotlight Search Results (Snappy O(N) multi-purpose search)
  const spotlightSearchResults = useMemo(() => {
    if (!deferredSpotlightSearchInput.trim()) return [];
    const query = deferredSpotlightSearchInput.trim().toLocaleLowerCase('tr-TR');
    const hiddenLiveSet = new Set(hiddenCategories || []);
    const hiddenMovieSet = new Set(hiddenMovieCategories || []);
    const hiddenSeriesSet = new Set(hiddenSeriesCategories || []);

    const matches: Array<{
      type: 'live' | 'movie' | 'series';
      item: PlaylistItem | GroupedSeries;
      score: number;
    }> = [];

    // 1. Live TV Search (if scope is 'all' or 'live')
    if (spotlightScope === 'all' || spotlightScope === 'live') {
      const liveItems = itemBuckets.live;
      for (let i = 0; i < liveItems.length; i++) {
        const ch = liveItems[i];
        if (hiddenLiveSet.has(ch.group || 'Genel')) continue;
        const nameLower = ch.nameLower || ch.name.toLocaleLowerCase('tr-TR');
        const groupLower = ch.groupLower || (ch.group || 'Genel').toLocaleLowerCase('tr-TR');
        if (groupLower.includes('ulusal') && !isHdChannel(ch.name)) continue;
        const clNameLower = ch.clNameLower || cleanMediaTitle(ch.name).toLocaleLowerCase('tr-TR');
        const score = getSearchScore(ch.name, ch.group || 'Genel', query, clNameLower, nameLower, groupLower, clNameLower);
        if (score > 0) {
          matches.push({ type: 'live', item: ch, score });
        }
      }
    }

    // 2. Movies Search (if scope is 'all' or 'movie')
    if (spotlightScope === 'all' || spotlightScope === 'movie') {
      const movieItems = itemBuckets.movie;
      const dedupedMovies: Record<string, { item: PlaylistItem; score: number; qualityRank: number }> = {};
      for (let i = 0; i < movieItems.length; i++) {
        const ch = movieItems[i];
        if (hiddenMovieSet.has(ch.group || 'Genel')) continue;
        const clNameLower = ch.clNameLower || cleanMediaTitle(ch.name).toLocaleLowerCase('tr-TR');
        const nameLower = ch.nameLower || ch.name.toLocaleLowerCase('tr-TR');
        const groupLower = ch.groupLower || (ch.group || 'Genel').toLocaleLowerCase('tr-TR');
        const score = getSearchScore(ch.name, ch.group || 'Genel', query, clNameLower, nameLower, groupLower, clNameLower);
        if (score > 0) {
          const qRank = getQualityRank(ch.name);
          const existing = dedupedMovies[clNameLower];
          if (!existing || score > existing.score || (score === existing.score && qRank > existing.qualityRank)) {
            dedupedMovies[clNameLower] = { item: ch, score, qualityRank: qRank };
          }
        }
      }
      Object.values(dedupedMovies).forEach(m => {
        matches.push({ type: 'movie', item: m.item, score: m.score });
      });
    }

    // 3. Series Search (if scope is 'all' or 'series')
    if (spotlightScope === 'all' || spotlightScope === 'series') {
      const dedupedSeries: Record<string, { item: GroupedSeries; score: number }> = {};
      for (let i = 0; i < allGroupedSeries.length; i++) {
        const series = allGroupedSeries[i];
        if (hiddenSeriesSet.has(series.group || 'Genel')) continue;
        const sNameLower = (series as any).nameLower || series.name.toLocaleLowerCase('tr-TR');
        const sGroupLower = (series as any).groupLower || (series.group || 'Genel').toLocaleLowerCase('tr-TR');
        const score = getSearchScore(series.name, series.group || 'Genel', query, sNameLower, sNameLower, sGroupLower, sNameLower);

        let episodeMatch = false;
        const seasons = Object.values(series.seasons);
        for (let s = 0; s < seasons.length; s++) {
          const episodes = seasons[s];
          for (let e = 0; e < episodes.length; e++) {
            const ep = episodes[e];
            const epNameLower = ep.item.nameLower || ep.item.name.toLocaleLowerCase('tr-TR');
            if (epNameLower.includes(query)) {
              episodeMatch = true;
              break;
            }
          }
          if (episodeMatch) break;
        }
        const finalScore = score > 0 ? score : (episodeMatch ? 50 : 0);
        if (finalScore > 0) {
          const existing = dedupedSeries[sNameLower];
          if (!existing || finalScore > existing.score) {
            dedupedSeries[sNameLower] = { item: series, score: finalScore };
          }
        }
      }
      Object.values(dedupedSeries).forEach(s => {
        matches.push({ type: 'series', item: s.item, score: s.score });
      });
    }

    // Sort matches by score descending
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }, [allGroupedSeries, deferredSpotlightSearchInput, spotlightScope, hiddenCategories, hiddenMovieCategories, hiddenSeriesCategories, itemBuckets.live, itemBuckets.movie]);

  // Memoized popular movies, excluding maintenance/test/backup items
  const populerFilmler = useMemo(() => {
    if (itemBuckets.movie.length === 0) return [];
    const daySeed = new Date().toISOString().slice(0, 10) + '-movies';
    const scoreItem = (item: PlaylistItem) => {
      const seed = `${daySeed}-${item.name}-${item.group || ''}`;
      let score = 0;
      for (let i = 0; i < seed.length; i++) {
        score = (score + seed.charCodeAt(i)) % 997;
      }
      if (activeContentPreferences.includes('kids')) {
        const text = `${item.name} ${item.group || ''}`.toLocaleLowerCase('tr-TR');
        if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(keyword => text.includes(keyword))) score += 1200;
      }
      return score;
    };

    const filtered = itemBuckets.movie.filter(item => {
      const nameLower = item.name.toLowerCase();
      const groupLower = (item.group || '').toLowerCase();
      if (nameLower.includes('bakim') || nameLower.includes('test') || nameLower.includes('yedek') || nameLower.includes('bakimda') ||
          groupLower.includes('bakim') || groupLower.includes('test') || groupLower.includes('yedek') || groupLower.includes('bakimda')) {
        return false;
      }
      return true;
    });

    return filtered
      .map(item => ({ item, score: scoreItem(item) }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .slice(0, 80);
  }, [itemBuckets.movie, activeContentPreferences]);

  // Memoized popular series, excluding maintenance/test/backup items
  const populerDiziler = useMemo(() => {
    if (allGroupedSeries.length === 0) return [];
    const daySeed = new Date().toISOString().slice(0, 10) + '-series';
    const scoreItem = (item: GroupedSeries) => {
      const seed = `${daySeed}-${item.name}-${item.group || ''}`;
      let score = 0;
      for (let i = 0; i < seed.length; i++) {
        score = (score + seed.charCodeAt(i)) % 997;
      }
      if (activeContentPreferences.includes('kids')) {
        const text = `${item.name} ${item.group || ''}`.toLocaleLowerCase('tr-TR');
        if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(keyword => text.includes(keyword))) score += 1200;
      }
      return score;
    };

    const filtered = allGroupedSeries.filter(item => {
      const nameLower = item.name.toLowerCase();
      const groupLower = (item.group || '').toLowerCase();
      if (nameLower.includes('bakim') || nameLower.includes('test') || nameLower.includes('yedek') || nameLower.includes('bakimda') ||
          groupLower.includes('bakim') || groupLower.includes('test') || groupLower.includes('yedek') || groupLower.includes('bakimda')) {
        return false;
      }
      return true;
    });

    return filtered
      .map(item => ({ item, score: scoreItem(item) }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .slice(0, 80);
  }, [allGroupedSeries, activeContentPreferences]);

  const homeDiscoveryItems = useMemo(() => {
    if (itemBuckets.movie.length + allGroupedSeries.length === 0) return [];
    const daySeed = new Date().toISOString().slice(0, 10);
    const scoreItem = (item: PlaylistItem | GroupedSeries) => {
      const seed = `${daySeed}-${item.name}-${item.group || ''}`;
      let score = 0;
      for (let i = 0; i < seed.length; i++) {
        score = (score + seed.charCodeAt(i)) % 997;
      }
      if (activeContentPreferences.includes('series') && item.type === 'series') score += 700;
      if (activeContentPreferences.includes('movies') && item.type === 'movie') score += 700;
      if (activeContentPreferences.includes('kids')) {
        const text = `${item.name} ${item.group || ''}`.toLocaleLowerCase('tr-TR');
        if (['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney'].some(keyword => text.includes(keyword))) score += 1000;
      }
      return score;
    };

    const selected: { item: PlaylistItem | GroupedSeries; score: number }[] = [];
    const visitItem = (item: PlaylistItem | GroupedSeries) => {
      const nameLower = item.name.toLowerCase();
      const groupLower = (item.group || '').toLowerCase();
      if (nameLower.includes('bakim') || nameLower.includes('test') || nameLower.includes('yedek') || nameLower.includes('bakimda') ||
          groupLower.includes('bakim') || groupLower.includes('test') || groupLower.includes('yedek') || groupLower.includes('bakimda')) {
        return;
      }
      const score = scoreItem(item);
      if (selected.length < 16) {
        selected.push({ item, score });
        selected.sort((a, b) => a.score - b.score);
        return;
      }
      if (score > selected[0].score) {
        selected[0] = { item, score };
        selected.sort((a, b) => a.score - b.score);
      }
    };

    for (let i = 0; i < itemBuckets.movie.length; i++) {
      visitItem(itemBuckets.movie[i]);
    }
    for (let i = 0; i < allGroupedSeries.length; i++) {
      visitItem(allGroupedSeries[i]);
    }

    return selected
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);
  }, [itemBuckets.movie, allGroupedSeries, activeContentPreferences]);

  // Memoized Live TV quick popular Turkish channels
  const homeLiveTvQuickChannels = useMemo(() => {
    const popularPatterns = [
      // National TV channels
      { match: ['trt 1', 'trt1'] },
      { match: ['atv'] },
      { match: ['star tv', 'star'] },
      { match: ['show tv', 'show'] },
      { match: ['tv8', 'tv 8'] },
      { match: ['kanal d', 'kanald'] },
      { match: ['now tv', 'now', 'fox tv', 'fox'] },
      // Sports / Bein Connect TV channels
      { match: ['bein sports 1', 'bein sport 1', 'bein 1', 'bein connect 1'] },
      { match: ['bein sports 2', 'bein sport 2', 'bein 2', 'bein connect 2'] },
      { match: ['bein sports 3', 'bein sport 3', 'bein 3', 'bein connect 3'] },
      { match: ['bein sports 4', 'bein sport 4', 'bein 4', 'bein connect 4'] },
      { match: ['s sport 1', 's sport', 'ssport 1', 'ssport'] },
      { match: ['s sport 2', 'ssport 2'] },
      // Other popular Turkish channels
      { match: ['trt spor', 'trtspor'] },
      { match: ['a spor', 'aspor'] },
      { match: ['ntv'] },
      { match: ['cnn turk', 'cnnturk'] },
      { match: ['haberturk', 'haber turk'] },
      { match: ['tv8.5', 'tv 8.5', 'tv8,5', 'tv 8,5'] }
    ];

    const selected: PlaylistItem[] = [];

    // Find channels in order of patterns to prioritize key channels
    for (const pattern of popularPatterns) {
      const match = itemBuckets.live.find(channel => {
        const nameLower = channel.name.toLowerCase();
        if (nameLower.includes('yedek') || nameLower.includes('test') || nameLower.includes('bakim')) {
          return false;
        }
        return pattern.match.some(term => {
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
          return regex.test(nameLower) || nameLower === term;
        });
      });

      if (match) {
        selected.push(match);
      }
    }

    // Fallback if we have fewer than 10 channels: just add any valid non-backup, non-test live channels
    if (selected.length < 10) {
      for (const channel of itemBuckets.live) {
        if (selected.length >= 15) break;
        const nameLower = channel.name.toLowerCase();
        if (nameLower.includes('yedek') || nameLower.includes('test') || nameLower.includes('bakim') || nameLower.includes('adult') || nameLower.includes('xxx')) {
          continue;
        }
        if (!selected.some(s => s.id === channel.id)) {
          selected.push(channel);
        }
      }
    }

    const visibleChannels = selected.slice(0, 15);
    if (activeContentPreferences.includes('sports')) {
      const sportsKeywords = ['spor', 'sport', 'bein', 's sport', 'ssport', 'tivibu spor', 'smart spor', 'nba', 'futbol'];
      return [...visibleChannels].sort((a, b) => {
        const aText = `${a.name} ${a.group || ''}`.toLocaleLowerCase('tr-TR');
        const bText = `${b.name} ${b.group || ''}`.toLocaleLowerCase('tr-TR');
        const aSport = sportsKeywords.some(keyword => aText.includes(keyword)) ? 1 : 0;
        const bSport = sportsKeywords.some(keyword => bText.includes(keyword)) ? 1 : 0;
        return bSport - aSport;
      });
    }
    return visibleChannels;
  }, [itemBuckets.live, activeContentPreferences]);

  const player = useCinematicPlayer({
    selectedChannel,
    onClose: () => {
      if (player.videoRef.current && player.duration > 0) {
        if (selectedChannel) saveWatchProgress(selectedChannel, player.videoRef.current.currentTime, player.duration);
      }
      const returnState = playerReturnStateRef.current;
      pendingScrollRestoreRef.current = returnState?.scrollTop ?? 0;
      setSelectedChannel(null);
      setSelectedSeriesForModal(returnState?.seriesModal ?? null);
      setSelectedChannelForModal(returnState?.channelModal ?? null);
      playerReturnStateRef.current = null;
    },
    saveWatchProgress,
    showToast
  });

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

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    saveAppSetting('cinema_language', lang);
  }, [saveAppSetting]);

  const settingsContextValue = useMemo(() => ({
    language,
    setLanguage,
    t,
    activeSettingsTab,
    setActiveSettingsTab,
    defaultPlayer,
    setDefaultPlayer,
    tmdbApiKey,
    setTmdbApiKey,
    activeTheme,
    setActiveTheme,
    activeAccent,
    setActiveAccent,
    glassIntensity,
    setGlassIntensity,
    neonGlowEnabled,
    setNeonGlowEnabled,
    cardLayoutSize,
    setCardLayoutSize,
    playlists,
    activePlaylistId,
    showAddPlaylistForm,
    setShowAddPlaylistForm,
    playlistMode,
    setPlaylistMode,
    playlistFormName,
    setPlaylistFormName,
    m3uUrl,
    setM3uUrl,
    xtreamUrl,
    setXtreamUrl,
    xtreamUser,
    setXtreamUser,
    xtreamPass,
    setXtreamPass,
    isParsing,
    hiddenCategories,
    hiddenSeriesCategories,
    hiddenMovieCategories,
    itemStats,
    items,
    recentlyWatched,
    globalFavorites,
    isCheckingHealth,
    checkerLog,
    runPlaylistDiagnostics,
    onPlaylistLoadFromUrl: handlePlaylistLoadFromUrl,
    onPlaylistLoadLocal: handlePlaylistLoadLocal,
    onXtreamLoad: handleXtreamLoad,
    onSelectPlaylist: handleSelectPlaylist,
    onDeletePlaylist: handleDeletePlaylist,
    onRestoreCategory: liveCat.handleRestore,
    onRestoreSeriesCategory: seriesCat.handleRestore,
    onRestoreMovieCategory: movieCat.handleRestore,
    onResetHiddenCategories: liveCat.handleResetHidden,
    onResetHiddenSeriesCategories: seriesCat.handleResetHidden,
    onResetHiddenMovieCategories: movieCat.handleResetHidden,
    onSaveSetting: saveAppSetting,
    onShowToast: showToast,
    onClearRecentlyWatched: () => {
      setRecentlyWatched([]);
      localStorage.removeItem('cinema_recently_watched');
      showToast("İzleme geçmişi temizlendi.");
    },
    onClearFavorites: () => {
      setGlobalFavorites([]);
      saveAppSetting('cinema_global_favorites', []);
      showToast("Favoriler temizlendi.");
    },
    onRefreshPlaylist: (playlist: SavedPlaylist) => {
      autoUpdatePlaylist(playlist, activePlaylistId, true);
    },
    onUpdatePlaylistAutoUpdateInterval: (id: string, hours: 6 | 12 | 24 | 168) => {
      updatePlaylistAutoUpdateInterval(id, hours);
      showToast('Otomatik guncelleme araligi kaydedildi.');
    }
  }), [
    items,
    isCheckingHealth,
    checkerLog,
    runPlaylistDiagnostics,
    activeSettingsTab,
    defaultPlayer,
    tmdbApiKey,
    activeTheme,
    activeAccent,
    glassIntensity,
    neonGlowEnabled,
    cardLayoutSize,
    playlists,
    activePlaylistId,
    showAddPlaylistForm,
    playlistMode,
    playlistFormName,
    m3uUrl,
    xtreamUrl,
    xtreamUser,
    xtreamPass,
    isParsing,
    hiddenCategories,
    hiddenSeriesCategories,
    hiddenMovieCategories,
    itemStats,
    recentlyWatched,
    globalFavorites,
    handlePlaylistLoadFromUrl,
    handlePlaylistLoadLocal,
    handleXtreamLoad,
    handleSelectPlaylist,
    handleDeletePlaylist,
    liveCat.handleRestore,
    seriesCat.handleRestore,
    movieCat.handleRestore,
    liveCat.handleResetHidden,
    seriesCat.handleResetHidden,
    movieCat.handleResetHidden,
    saveAppSetting,
    showToast,
    autoUpdatePlaylist,
    updatePlaylistAutoUpdateInterval,
    setGlobalFavorites,
    setM3uUrl,
    setPlaylistFormName,
    setPlaylistMode,
    setRecentlyWatched,
    setShowAddPlaylistForm,
    setXtreamPass,
    setXtreamUrl,
    setXtreamUser,
    setActiveSettingsTab,
    setDefaultPlayer,
    setTmdbApiKey,
    setActiveTheme,
    setActiveAccent,
    setGlassIntensity,
    setNeonGlowEnabled,
    setCardLayoutSize,
    language,
    t,
    setLanguage
  ]);

  if (selectedChannel) {
    return (
      <SettingsProvider value={settingsContextValue}>
        <CinematicPlayer
        channel={selectedChannel}
        channels={items}
        onChannelChange={handlePlayStream}
        videoRef={player.videoRef}
        playerContainerRef={player.playerContainerRef}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        playerVolume={player.playerVolume}
        playerMuted={player.playerMuted}
        showControls={player.showControls}
        videoReady={player.videoReady}
        playbackSpeed={player.playbackSpeed}
        showSpeedMenu={player.showSpeedMenu}
        audioTracks={player.audioTracks}
        activeAudioTrack={player.activeAudioTrack}
        subtitleTracks={player.subtitleTracks}
        activeSubtitle={player.activeSubtitle}
        showSubtitleMenu={player.showSubtitleMenu}
        isFullscreen={player.isFullscreen}
        accentStyles={getAccentStyles()}
        onClose={() => {
          if (player.videoRef.current && player.duration > 0) {
            saveWatchProgress(selectedChannel, player.videoRef.current.currentTime, player.duration);
          }
          const returnState = playerReturnStateRef.current;
          pendingScrollRestoreRef.current = returnState?.scrollTop ?? 0;
          setSelectedChannel(null);
          setSelectedSeriesForModal(returnState?.seriesModal ?? null);
          setSelectedChannelForModal(returnState?.channelModal ?? null);
          playerReturnStateRef.current = null;
        }}
        onTogglePlay={player.handleTogglePlay}
        onToggleMute={player.handleTogglePlayerMute}
        onVolumeChange={player.handlePlayerVolumeChange}
        onSpeedChange={player.handleSpeedChange}
        onAudioTrackChange={player.handleAudioTrackChange}
        onSubtitleChange={player.setActiveSubtitle}
        onSubtitleUpload={player.handleSubtitleUpload}
        onPiP={player.handlePlayerPiP}
        onToggleFullscreen={player.handleToggleFullscreen}
        onTimelineSeek={player.handleTimelineSeek}
        onSeek={player.handlePlayerSeek}
        onHideControls={() => player.setShowControls(false)}
        onShowSpeedMenu={player.setShowSpeedMenu}
        onShowSubtitleMenu={player.setShowSubtitleMenu}
        formatTime={player.formatPlayerTime}
        onMouseMove={player.handlePlayerMouseMove}
          onMouseLeave={player.handlePlayerMouseLeave}
        />
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
        <Suspense fallback={null}>
          <ProfileScreen
          profiles={profiles}
          profileSelectMode={profileSelectMode}
          profileFormName={profileFormName}
          profileFormAvatar={profileFormAvatar}
          profileContentPreferences={profileContentPreferences}
          editingProfileId={editingProfileId}
          profilePlaylistType={profilePlaylistType}
          profileM3uUrl={profileM3uUrl}
          profileXtreamUrl={profileXtreamUrl}
          profileXtreamUser={profileXtreamUser}
          profileXtreamPass={profileXtreamPass}
          profileAutoUpdateIntervalHours={profileAutoUpdateIntervalHours}
          avatarSearchQuery={avatarSearchQuery}
          avatarSearchResults={avatarSearchResults}
          avatarSearchLoading={avatarSearchLoading}
          trendingAvatars={trendingAvatars}
          localSeries={localSeries}
          selectedSeriesForCast={selectedSeriesForCast}
          seriesCast={seriesCast}
          castLoading={castLoading}
          isParsing={isParsing}
          profileSetupStatus={profileSetupStatus}
          profileEntryReady={profileEntryReady}
          toast={toast}
          activeTheme={activeTheme}
          accentStyles={getAccentStyles()}
          setProfileSelectMode={setProfileSelectMode}
          setProfileFormName={setProfileFormName}
          setProfileFormAvatar={setProfileFormAvatar}
          setProfileContentPreferences={setProfileContentPreferences}
          setEditingProfileId={setEditingProfileId}
          setProfilePlaylistType={setProfilePlaylistType}
          setProfileM3uUrl={setProfileM3uUrl}
          setProfileXtreamUrl={setProfileXtreamUrl}
          setProfileXtreamUser={setProfileXtreamUser}
          setProfileXtreamPass={setProfileXtreamPass}
          setProfileAutoUpdateIntervalHours={setProfileAutoUpdateIntervalHours}
          setAvatarSearchQuery={setAvatarSearchQuery}
          setAvatarSearchResults={setAvatarSearchResults}
          setSelectedSeriesForCast={setSelectedSeriesForCast}
          setSeriesCast={setSeriesCast}
          onSelectProfile={handleSelectProfile}
          onSaveProfile={handleSaveProfile}
          onDeleteProfile={handleDeleteProfile}
          onAvatarSearch={handleAvatarSearch}
            onFetchSeriesCast={handleFetchSeriesCast}
          />
        </Suspense>
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
      <div className="absolute top-[-15%] left-[10%] w-[800px] h-[800px] rounded-full bg-glow-one blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-15%] right-[5%] w-[700px] h-[700px] rounded-full bg-glow-two blur-[100px] pointer-events-none z-0" />

      {isParsing && (
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-fade-in select-none">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-white/5" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[var(--accent-color)] animate-spin shadow-[0_0_15px_var(--accent-glow)]" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-neutral-300">İçerikler Yükleniyor...</span>
        </div>
      )}

      {toast.show && (
        <div className="fixed bottom-8 right-8 z-[5000] px-4.5 py-3 rounded-2xl bg-neutral-900/80 backdrop-blur-md border border-white/10 flex items-center gap-3 shadow-2xl animate-slide-up select-none">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-ping" />
          <span className="text-xs font-semibold tracking-wide text-neutral-200">{toast.message}</span>
        </div>
      )}

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

      {selectedChannelForModal && (
        <Suspense fallback={null}>
          <ChannelModal
            channel={selectedChannelForModal}
            tmdbData={tmdbData}
            onClose={() => setSelectedChannelForModal(null)}
            onPlay={handlePlayStream}
            isFavorite={globalFavorites.includes(selectedChannelForModal.id)}
            onToggleFavorite={(e) => toggleFavorite(selectedChannelForModal.id, e)}
          />
        </Suspense>
      )}

      {selectedSeriesForModal && (
        <Suspense fallback={null}>
          <SeriesModal
            series={selectedSeriesForModal}
            tmdbData={tmdbData}
            tmdbShowId={tmdbShowId}
            activeSeason={activeSeason}
            expandedEpisodeId={expandedEpisodeId}
            recentlyWatched={recentlyWatched}
            onClose={() => setSelectedSeriesForModal(null)}
            onPlay={handlePlayStream}
            onSetActiveSeason={setActiveSeason}
            onSetExpandedEpisodeId={setExpandedEpisodeId}
            isFavorite={globalFavorites.includes(selectedSeriesForModal.id)}
            onToggleFavorite={(e) => toggleFavorite(selectedSeriesForModal.id, e)}
          />
        </Suspense>
      )}

      </div>
    </SettingsProvider>
  );
}
