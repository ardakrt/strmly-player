import React, { createContext, useContext } from 'react';
import type { SavedPlaylist } from '../types';

export interface SettingsContextType {
  activeSettingsTab: string;
  setActiveSettingsTab: (tab: string) => void;
  defaultPlayer: string;
  setDefaultPlayer: (player: string) => void;
  tmdbApiKey: string;
  setTmdbApiKey: (key: string) => void;
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
  activeAccent: string;
  setActiveAccent: (accent: string) => void;
  glassIntensity: string;
  setGlassIntensity: (intensity: string) => void;
  neonGlowEnabled: boolean;
  setNeonGlowEnabled: (enabled: boolean) => void;
  cardLayoutSize: string;
  setCardLayoutSize: (size: string) => void;
  playlists: SavedPlaylist[];
  activePlaylistId: string;
  showAddPlaylistForm: boolean;
  setShowAddPlaylistForm: (show: boolean) => void;
  playlistMode: 'm3u' | 'xtream';
  setPlaylistMode: (mode: 'm3u' | 'xtream') => void;
  playlistFormName: string;
  setPlaylistFormName: (name: string) => void;
  m3uUrl: string;
  setM3uUrl: (url: string) => void;
  xtreamUrl: string;
  setXtreamUrl: (url: string) => void;
  xtreamUser: string;
  setXtreamUser: (user: string) => void;
  xtreamPass: string;
  setXtreamPass: (pass: string) => void;
  isParsing: boolean;
  hiddenCategories: string[];
  hiddenSeriesCategories: string[];
  hiddenMovieCategories: string[];
  itemStats: { total: number; live: number; movie: number; series: number };
  items: any[];
  recentlyWatched: any[];
  globalFavorites: string[];
  isCheckingHealth: boolean;
  checkerLog: string[];
  runPlaylistDiagnostics: () => void;
  onPlaylistLoadFromUrl: () => void;
  onPlaylistLoadLocal: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onXtreamLoad: () => void;
  onSelectPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
  onRestoreCategory: (name: string) => void;
  onRestoreSeriesCategory: (name: string) => void;
  onRestoreMovieCategory: (name: string) => void;
  onResetHiddenCategories: () => void;
  onResetHiddenSeriesCategories: () => void;
  onResetHiddenMovieCategories: () => void;
  onSaveSetting: (key: string, value: any) => void;
  onShowToast: (message: string) => void;
  onClearRecentlyWatched: () => void;
  onClearFavorites: () => void;
  onRefreshPlaylist: (playlist: SavedPlaylist) => void;
  onUpdatePlaylistAutoUpdateInterval: (id: string, hours: 6 | 12 | 24 | 168) => void;
}

export const SettingsContext = createContext<SettingsContextType | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  value: SettingsContextType;
  children: React.ReactNode;
}

export const SettingsProvider = ({ value, children }: SettingsProviderProps) => {
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
