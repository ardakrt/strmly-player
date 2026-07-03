import { useMemo } from "react";
import type { SavedPlaylist } from "../types";

interface UseAppSettingsContextValueProps {
  appSettings: any;
  playlistsHook: any;
  playerState: any;
  diagnostics: any;
  liveCat: any;
  seriesCat: any;
  movieCat: any;
  items: any[];
  itemStats: any;
  activeProfileId: string | null;
}

export function useAppSettingsContextValue({
  appSettings,
  playlistsHook,
  playerState,
  diagnostics,
  liveCat,
  seriesCat,
  movieCat,
  items,
  itemStats,
  activeProfileId,
}: UseAppSettingsContextValueProps) {
  const {
    language,
    setLanguage,
    t,
    activeSettingsTab,
    setActiveSettingsTab,
    defaultPlayer,
    setDefaultPlayer,
    transcodeMode,
    setTranscodeMode,
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
    isParsing,
    saveAppSetting,
    loadAppSetting,
    showToast,
  } = appSettings;

  const {
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
    handlePlaylistLoadFromUrl,
    handlePlaylistLoadLocal,
    handleXtreamLoad,
    handleSelectPlaylist,
    handleDeletePlaylist,
    autoUpdatePlaylist,
    updatePlaylistAutoUpdateInterval,
  } = playlistsHook;

  const {
    recentlyWatched,
    setRecentlyWatched,
    globalFavorites,
    setGlobalFavorites,
  } = playerState;

  const { isCheckingHealth, checkerLog, runPlaylistDiagnostics } = diagnostics;

  const hiddenCategories = liveCat.hidden;
  const hiddenSeriesCategories = seriesCat.hidden;
  const hiddenMovieCategories = movieCat.hidden;

  return useMemo(
    () => ({
      language,
      setLanguage,
      t,
      activeSettingsTab,
      setActiveSettingsTab,
      defaultPlayer,
      setDefaultPlayer,
      transcodeMode,
      setTranscodeMode,
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
      activeProfileId,
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
      onLoadSetting: loadAppSetting,
      onShowToast: showToast,
      onClearRecentlyWatched: () => {
        setRecentlyWatched([]);
        localStorage.removeItem("cinema_recently_watched");
        showToast("İzleme geçmişi temizlendi.");
      },
      onClearFavorites: () => {
        setGlobalFavorites([]);
        saveAppSetting("cinema_global_favorites", []);
        showToast("Favoriler temizlendi.");
      },
      onRefreshPlaylist: (playlist: SavedPlaylist) => {
        autoUpdatePlaylist(playlist, activePlaylistId, true);
      },
      onUpdatePlaylistAutoUpdateInterval: (
        id: string,
        hours: 6 | 12 | 24 | 168,
      ) => {
        updatePlaylistAutoUpdateInterval(id, hours);
        showToast("Otomatik guncelleme araligi kaydedildi.");
      },
    }),
    [
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
      activeProfileId,
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
      loadAppSetting,
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
      transcodeMode,
      setTranscodeMode,
      setTmdbApiKey,
      setActiveTheme,
      setActiveAccent,
      setGlassIntensity,
      setNeonGlowEnabled,
      setCardLayoutSize,
      language,
      t,
      setLanguage,
    ],
  );
}
