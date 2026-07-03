import { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import type { ContentPreference } from "../types";
import { HERO_BACKDROPS } from "../constants";
import { getAccentStylesHelper } from "../utils/helpers";
import { APP_VIEWS } from "../navigation/views";

import { useProfilePreferences } from "./useProfilePreferences";
import { useProfiles } from "./useProfiles";
import { usePlaylists } from "./usePlaylists";
import { usePlayerState } from "./usePlayerState";
import { useAppBoot } from "./useAppBoot";
import { useHomeData } from "./useHomeData";
import { useAppSettings } from "./useAppSettings";
import { useSpotlightSearch } from "./useSpotlightSearch";
import { useFilteredCatalog } from "./useFilteredCatalog";
import { useAppSettingsContextValue } from "./useAppSettingsContextValue";
import { useTmdbCrawler } from "./useTmdbCrawler";
import { usePlaylistIndex } from "./usePlaylistIndex";
import { useAppCategories } from "./useAppCategories";
import { useDetailModal } from "./useDetailModal";
import { useDiagnostics } from "./useDiagnostics";
import { useGroupedSeriesReady } from "./useGroupedSeriesReady";
import { useDynamicIslandToast } from "./useDynamicIslandToast";
import { usePlaybackNavigation } from "./usePlaybackNavigation";

export function useAppProvider() {
  const appSettings = useAppSettings();
  const {
    toast,
    showToast,
    hideToast,
    isParsing,
    setIsParsing,
    sortOption,
    setSortOption,
    qualityFilter,
    setQualityFilter,
    defaultPlayer,
    tmdbApiKey,
    activeAccent,
    activeTheme,
    glassIntensity,
    neonGlowEnabled,
    language,
    setLanguageState,
    scrolled,
    setScrolled,
    selectedGroup,
    setSelectedGroup,
    categorySearchQuery,
    saveAppSetting,
    loadAppSetting,
    setActiveProfileIdSettings,
    setActiveSettingsTab,
    setGlassIntensity,
    setNeonGlowEnabled,
    setCardLayoutSize,
    setDefaultPlayer,
    setTmdbApiKey,
    setActiveAccent,
    setActiveTheme,
    setTranscodeMode,
  } = appSettings;

  const preferences = useProfilePreferences({
    loadAppSetting: (key, isJson, profileId) =>
      loadAppSetting(key, isJson, profileId),
  });

  const playlistsHook = usePlaylists({
    saveAppSetting: (key, val, profileId) =>
      saveAppSetting(key, val, profileId),
    loadAppSetting: (key, isJson, profileId) =>
      loadAppSetting(key, isJson, profileId),
    showToast: (msg) => showToast(msg),
    setSelectedGroup,
    isParsing,
    setIsParsing,
    language,
  });

  const playerState = usePlayerState({
    saveAppSetting,
    loadAppSetting,
    showToast,
    language,
  });

  async function loadProfileData(profileId: string, activateProfile = true) {
    await preferences.load(profileId);
    await playlistsHook.load(profileId);
    await playerState.load(profileId);
    if (activateProfile) profilesHook.setActiveProfileId(profileId);
  }

  async function resetAllProfileData() {
    preferences.reset();
    playlistsHook.reset();
    playerState.reset();
  }

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
    showToast,
    setTranscodeMode,
  });

  const profilesHook = useProfiles({
    tmdbApiKey,
    saveAppSetting: (key, val, profileId) =>
      saveAppSetting(key, val, profileId),
    loadAppSetting: (key, isJson, profileId) =>
      loadAppSetting(key, isJson, profileId),
    showToast: (msg) => showToast(msg),
    loadProfileData: (id) => loadProfileData(id, false),
    resetAllProfileData: () => resetAllProfileData(),
    setIsParsing: (val) => setIsParsing(val),
    loaded,
    language,
  });

  const { activeProfileId, currentProfile } = profilesHook;
  const activeContentPreferences = useMemo<ContentPreference[]>(
    () => currentProfile?.contentPreferences || [],
    [currentProfile],
  );

  useEffect(() => {
    setActiveProfileIdSettings(activeProfileId);
  }, [activeProfileId, setActiveProfileIdSettings]);

  const {
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
    setHiddenMovieCategories,
  } = preferences;

  const {
    playlists,
    activePlaylistId,
    items,
    setShowAddPlaylistForm,
    setVisibleCount,
    buildXtreamSeriesGroup,
  } = playlistsHook;

  const {
    selectedChannel,
    setSelectedChannel,
    globalFavorites,
    recentlyWatched,
    toggleFavorite,
    saveToWatchHistory,
    saveWatchProgress,
    clearRecentlyWatched,
    removeFromRecentlyWatched,
  } = playerState;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const dynamicIslandToast = useDynamicIslandToast({ toast, hideToast });

  useEffect(() => {
    if (selectedGroup === APP_VIEWS.home) {
      setSearchQuery(searchInput);
      return;
    }
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, selectedGroup]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const playlistIndex = usePlaylistIndex(items);
  const {
    uniqueLiveCategories,
    uniqueSeriesCategories,
    uniqueMovieCategories,
    itemBuckets,
  } = playlistIndex;

  const { isSeriesReady, allGroupedSeries } = useGroupedSeriesReady(
    itemBuckets.series,
  );

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
    spotlightSearchResults,
  } = useSpotlightSearch({
    searchInputRef,
    items,
    itemBuckets,
    allGroupedSeries,
    hiddenCategories,
    hiddenMovieCategories,
    hiddenSeriesCategories,
  });

  const {
    activeLiveCategory,
    setActiveLiveCategory,
    activeMovieCategory,
    setActiveMovieCategory,
    activeSeriesCategory,
    setActiveSeriesCategory,
    liveCat,
    seriesCat,
    movieCat,
    visibleLiveCategoryLimit,
    setVisibleLiveCategoryLimit,
    visibleSeriesCategoryLimit,
    setVisibleSeriesCategoryLimit,
    visibleMovieCategoryLimit,
    setVisibleMovieCategoryLimit,
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
    setHiddenMovieCategories,
  });

  const detailModal = useDetailModal({
    tmdbApiKey,
    items,
    allGroupedSeries,
    recentlyWatched,
    buildXtreamSeriesGroup,
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
    getFavoriteIdForItem,
  } = detailModal;

  const {
    checkerLog,
    checkedStatusMap,
    isCheckingHealth,
    runPlaylistDiagnostics,
  } = useDiagnostics({
    items,
    language,
    showToast,
  });

  const itemStats = useMemo(
    () => ({
      live: itemBuckets.live.length,
      movie: itemBuckets.movie.length,
      series: itemBuckets.series.length,
      total: items.length,
    }),
    [itemBuckets, items.length],
  );

  const {
    showcaseItems,
    featuredTmdbData,
    activeFeaturedIndex,
    setActiveFeaturedIndex,
    populerFilmler,
    populerDiziler,
    homeDiscoveryItems,
    homeLiveTvQuickChannels,
    uniqueRecentlyWatched,
    isHomeReady,
  } = useHomeData({
    items,
    itemBuckets,
    allGroupedSeries,
    recentlyWatched,
    tmdbApiKey,
    activeContentPreferences,
  });

  const { filteredDisplayItems, groupedSeriesList, favoriteSeriesList } =
    useFilteredCatalog({
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
    });

  const [hasInitialBooted, setHasInitialBooted] = useState(false);

  useEffect(() => {
    if (loaded && isSeriesReady && isHomeReady) {
      setHasInitialBooted(true);
    }
  }, [loaded, isSeriesReady, isHomeReady]);

  const isAppReady = loaded && isSeriesReady && isHomeReady;

  const activeShowcaseList = useMemo(
    () => (showcaseItems.length > 0 ? showcaseItems : HERO_BACKDROPS),
    [showcaseItems],
  );
  const isPlaylistHero = showcaseItems.length > 0;
  const currentHeroItem = useMemo(
    () =>
      isPlaylistHero
        ? (showcaseItems[activeFeaturedIndex] as (typeof items)[number])
        : null,
    [isPlaylistHero, showcaseItems, activeFeaturedIndex],
  );
  const fallbackHeroItem = useMemo(
    () => (!isPlaylistHero ? HERO_BACKDROPS[activeFeaturedIndex] : null),
    [isPlaylistHero, activeFeaturedIndex],
  );

  useEffect(() => {
    setVisibleCount(100);
  }, [selectedGroup, searchQuery, activePlaylistId, setVisibleCount]);

  useEffect(() => {
    setSortOption("default");
    setQualityFilter("all");
  }, [
    selectedGroup,
    activeLiveCategory,
    activeMovieCategory,
    activeSeriesCategory,
    activePlaylistId,
    setSortOption,
    setQualityFilter,
  ]);

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setScrolled(scrollTop > 10);
    const bottom =
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <=
      e.currentTarget.clientHeight + 800;
    if (bottom) {
      setVisibleCount((prev) => prev + 100);
    }
  };

  const handleScrollSlider = (
    sliderId: string,
    direction: "left" | "right",
  ) => {
    const el = document.getElementById(sliderId);
    if (el) {
      const scrollAmount =
        direction === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
      el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const playback = usePlaybackNavigation({
    selectedChannel,
    setSelectedChannel,
    selectedSeriesForModal,
    selectedChannelForModal,
    setSelectedSeriesForModal,
    setSelectedChannelForModal,
    recentlyWatched,
    saveToWatchHistory,
    defaultPlayer,
    language,
    showToast,
  });

  useEffect(() => {
    if (selectedGroup !== APP_VIEWS.home) return;
    const maxItems =
      showcaseItems.length > 0 ? showcaseItems.length : HERO_BACKDROPS.length;
    if (maxItems <= 1) return;

    const timer = setInterval(() => {
      setActiveFeaturedIndex((prev) => (prev + 1) % maxItems);
    }, 8000);

    return () => clearInterval(timer);
  }, [
    selectedGroup,
    showcaseItems.length,
    activeFeaturedIndex,
    setActiveFeaturedIndex,
  ]);

  const getAccentStyles = () =>
    getAccentStylesHelper(activeAccent, glassIntensity, neonGlowEnabled);

  useTmdbCrawler({
    loaded,
    selectedGroup,
    activeSeriesCategory,
    activeMovieCategory,
    filteredDisplayItems,
    groupedSeriesList,
    itemBuckets,
    allGroupedSeries,
    tmdbApiKey,
  });

  const settingsContextValue = useAppSettingsContextValue({
    appSettings,
    playlistsHook,
    playerState,
    diagnostics: {
      isCheckingHealth,
      checkerLog,
      runPlaylistDiagnostics,
    },
    liveCat,
    seriesCat,
    movieCat,
    items,
    itemStats,
    activeProfileId,
  });

  const liveFavCatsToShow = favoriteCategories.filter(
    (group) =>
      uniqueLiveCategories.includes(group) && !hiddenCategories.includes(group),
  );
  const seriesFavCatsToShow = favoriteSeriesCategories.filter(
    (group) =>
      uniqueSeriesCategories.includes(group) &&
      !hiddenSeriesCategories.includes(group),
  );
  const movieFavCatsToShow = favoriteMovieCategories.filter(
    (group) =>
      uniqueMovieCategories.includes(group) &&
      !hiddenMovieCategories.includes(group),
  );

  return {
    appSettings,
    profilesHook,
    playerState,
    playback,
    detailModal,
    settingsContextValue,
    boot: {
      loaded,
      splashStatus,
      updateAvailable,
      hasInitialBooted,
      isAppReady,
    },
    ui: {
      activeTheme,
      activeAccent,
      scrolled,
      getAccentStyles,
      toast,
      dynamicIslandToast,
    },
    navigation: {
      selectedGroup,
      setSelectedGroup,
      setActiveSettingsTab,
      setShowAddPlaylistForm,
      searchInput,
      setSearchInput,
      setSearchQuery,
      deferredSearchQuery,
      categorySearchQuery,
      setCategorySearchQuery: appSettings.setCategorySearchQuery,
    },
    spotlight: {
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
      spotlightSearchResults,
    },
    catalog: {
      items,
      playlists,
      activePlaylistId,
      favItems: filteredDisplayItems,
      favSeries: favoriteSeriesList,
      groupedSeriesList,
      allGroupedSeries,
      itemStats,
      checkedStatusMap,
      isCheckingHealth,
      checkerLog,
      runPlaylistDiagnostics,
      liveFavCatsToShow,
      seriesFavCatsToShow,
      movieFavCatsToShow,
      liveCat,
      seriesCat,
      movieCat,
      activeLiveCategory,
      setActiveLiveCategory,
      activeSeriesCategory,
      setActiveSeriesCategory,
      activeMovieCategory,
      setActiveMovieCategory,
      visibleLiveCategoryLimit,
      setVisibleLiveCategoryLimit,
      visibleSeriesCategoryLimit,
      setVisibleSeriesCategoryLimit,
      visibleMovieCategoryLimit,
      setVisibleMovieCategoryLimit,
      setVisibleCount,
      globalFavorites,
      toggleFavorite,
      handleOpenDetails,
      handleOpenSeriesModalDirect,
      getFavoriteIdForItem,
      handleMainScroll,
      handleScrollSlider,
    },
    home: {
      isPlaylistHero,
      featuredTmdbData,
      fallbackHeroItem,
      currentHeroItem,
      activeFeaturedIndex,
      setActiveFeaturedIndex,
      activeShowcaseList,
      uniqueRecentlyWatched,
      clearRecentlyWatched,
      removeFromRecentlyWatched,
      homeDiscoveryItems,
      homeLiveTvQuickChannels,
      populerFilmler,
      populerDiziler,
      activeContentPreferences,
    },
    modals: {
      selectedChannelForModal,
      setSelectedChannelForModal,
      selectedSeriesForModal,
      setSelectedSeriesForModal,
      tmdbData,
      tmdbShowId,
      activeSeason,
      setActiveSeason,
      expandedEpisodeId,
      setExpandedEpisodeId,
      recentlyWatched,
    },
    showToast,
    saveWatchProgress,
    isParsing,
    activeProfileId,
    currentProfile,
  };
}

export type AppProviderValue = ReturnType<typeof useAppProvider>;
