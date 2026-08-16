import { useEffect, useMemo } from "react";
import type { ContentPreference } from "../types";
import { getAccentStylesHelper } from "../utils/helpers";

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
import { useGroupedSeriesReady } from "./useGroupedSeriesReady";
import { useDynamicIslandToast } from "./useDynamicIslandToast";
import { usePlaybackNavigation } from "./usePlaybackNavigation";
import { useAppProviderSearch } from "./useAppProviderSearch";
import { useHeroPresentation } from "./useHeroPresentation";
import { useAppProviderCatalogDerived } from "./useAppProviderCatalogDerived";
import { useAppProviderUiLifecycle } from "./useAppProviderUiLifecycle";

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
    iptvUpdateMode,
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
    iptvUpdateMode,
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

  const boot = useAppBoot({
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
  const { loaded } = boot;

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

  const {
    searchQuery,
    setSearchQuery,
    searchInput,
    setSearchInput,
    searchInputRef,
    deferredSearchQuery,
  } = useAppProviderSearch(selectedGroup);

  const dynamicIslandToast = useDynamicIslandToast({ toast, hideToast, language });

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
    isSearchingWorker,
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
    language,
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
    showcaseItems,
    featuredTmdbData,
    activeFeaturedIndex,
    displayFeaturedIndex,
    setActiveFeaturedIndex,
    top10Movies,
    top10Series,
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
    globalFavorites,
  });

  const {
    filteredDisplayItems,
    groupedSeriesList,
    favoriteSeriesList,
    seriesCategoryCounts,
    movieCatalogItems,
    movieCategoryCounts,
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
    });


  const {
    itemStats,
    favChannels,
    favMovies,
    allLiveItems,
    liveFavCatsToShow,
    seriesFavCatsToShow,
    movieFavCatsToShow,
  } = useAppProviderCatalogDerived({
    items,
    itemBuckets,
    filteredDisplayItems,
    uniqueLiveCategories,
    uniqueSeriesCategories,
    uniqueMovieCategories,
    favoriteCategories,
    favoriteSeriesCategories,
    favoriteMovieCategories,
    hiddenCategories,
    hiddenSeriesCategories,
    hiddenMovieCategories,
  });

  const {
    activeShowcaseList,
    isPlaylistHero,
    currentHeroItem,
    fallbackHeroItem,
    heroAmbientColors,
  } = useHeroPresentation({
    showcaseItems,
    featuredTmdbData,
    activeFeaturedIndex,
    displayFeaturedIndex,
    setActiveFeaturedIndex,
    selectedGroup,
  });

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

  const getAccentStyles = () =>
    getAccentStylesHelper(activeAccent, glassIntensity, neonGlowEnabled);

  const settingsContextValue = useAppSettingsContextValue({
    appSettings,
    playlistsHook,
    playerState,
    liveCat,
    seriesCat,
    movieCat,
    items,
    itemStats,
    activeProfileId,
  });

  useTmdbCrawler({
    enabled: true,
    loaded,
    homeReady: isHomeReady,
    selectedGroup,
    activeSeriesCategory,
    activeMovieCategory,
    filteredDisplayItems,
    groupedSeriesList,
    itemBuckets,
    allGroupedSeries,
    tmdbApiKey,
  });

  const {
    hasInitialBooted,
    isAppReady,
    handleMainScroll,
    handleScrollSlider,
  } = useAppProviderUiLifecycle({
    selectedGroup,
    searchQuery,
    activePlaylistId,
    activeLiveCategory,
    activeMovieCategory,
    activeSeriesCategory,
    setVisibleCount,
    setSortOption,
    setQualityFilter,
    setScrolled,
    loaded,
    isSeriesReady,
    isHomeReady,
  });

  return {
    appSettings,
    profilesHook,
    playerState,
    playback,
    detailModal,
    settingsContextValue,
    boot: {
      ...boot,
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
      isSearchingWorker,
    },
    catalog: {
      items,
      playlists,
      activePlaylistId,
      favItems: filteredDisplayItems,
      favSeries: favoriteSeriesList,
      favChannels,
      favMovies,
      allLiveItems,
      groupedSeriesList,
      allGroupedSeries,
      seriesCategoryCounts,
      movieCatalogItems,
      movieCategoryCounts,
      itemStats,
      checkedStatusMap: {},
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
      displayFeaturedIndex,
      setActiveFeaturedIndex,
      activeShowcaseList,
      top10Movies,
      top10Series,
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
    heroAmbientColors,
  };
}

export type AppProviderValue = ReturnType<typeof useAppProvider>;
