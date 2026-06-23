import { useState, useEffect, useRef } from 'react';
import type { PlaylistItem } from '../types';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';

interface UsePlayerStateProps {
  saveAppSetting: (key: string, value: any, profileIdOverride?: string | null) => Promise<void>;
  loadAppSetting: (key: string, isJson?: boolean, profileIdOverride?: string | null) => Promise<any>;
  showToast: (message: string) => void;
  language: string;
}

export function usePlayerState({
  saveAppSetting,
  loadAppSetting,
  showToast,
  language
}: UsePlayerStateProps) {
  const [selectedChannel, setSelectedChannel] = useState<PlaylistItem | null>(null);
  
  const [globalFavorites, setGlobalFavorites] = useState<string[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<any[]>([]);

  // Keep a ref to avoid triggering root state updates and app re-renders during active video play ticks
  const recentlyWatchedRef = useRef<any[]>([]);

  useEffect(() => {
    recentlyWatchedRef.current = recentlyWatched;
  }, [recentlyWatched]);

  // Sync ref back to React state when player is closed (selectedChannel becomes null)
  useEffect(() => {
    if (selectedChannel === null) {
      setRecentlyWatched(recentlyWatchedRef.current);
    }
  }, [selectedChannel]);

  const toggleFavorite = (itemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentFavs = globalFavorites;
    let newFavs: string[];
    if (currentFavs.includes(itemId)) {
      newFavs = currentFavs.filter(id => id !== itemId);
      showToast("Favorilerden kaldırıldı");
    } else {
      newFavs = [...currentFavs, itemId];
      showToast("Favorilere eklendi!");
    }

    setGlobalFavorites(newFavs);
    saveAppSetting('cinema_global_favorites', newFavs);
  };

  const saveToWatchHistory = (item: PlaylistItem) => {
    const prev = recentlyWatchedRef.current;
    const updatedItem = { ...item };
    const filtered = prev.filter(x => x.id !== item.id);
    const updated = [updatedItem, ...filtered].slice(0, 10);
    recentlyWatchedRef.current = updated;
    saveAppSetting('cinema_recently_watched', updated);
    // Sync state immediately since we are opening the player shell
    setRecentlyWatched(updated);
  };

  const saveWatchProgress = (item: PlaylistItem, time: number, total: number) => {
    if (item.type === 'live') return; // Live channels do not have watch progress

    const prev = recentlyWatchedRef.current;
    const filtered = prev.filter(x => x.id !== item.id);
    const existing = prev.find(x => x.id === item.id);
    const updatedItem = {
      ...(existing || item),
      currentTime: time,
      duration: total,
      progress: total > 0 ? (time / total) * 100 : 0
    };
    const updated = [updatedItem, ...filtered].slice(0, 10);
    recentlyWatchedRef.current = updated;
    saveAppSetting('cinema_recently_watched', updated);
  };

  const load = async (profileId: string) => {
    const [savedGlobalFavs, savedRecentlyWatched] = await Promise.all([
      loadAppSetting('cinema_global_favorites', true, profileId),
      loadAppSetting('cinema_recently_watched', true, profileId)
    ]);

    const favsList = Array.isArray(savedGlobalFavs) ? savedGlobalFavs : [];
    const watchedList = Array.isArray(savedRecentlyWatched) ? savedRecentlyWatched : [];

    setGlobalFavorites(favsList);
    recentlyWatchedRef.current = watchedList;
    setRecentlyWatched(watchedList);
  };

  const clearRecentlyWatched = () => {
    recentlyWatchedRef.current = [];
    setRecentlyWatched([]);
    saveAppSetting('cinema_recently_watched', []);
    showToast(language === 'tr' ? "İzleme geçmişi temizlendi." : "Watch history cleared.");
  };

  const removeFromRecentlyWatched = (item: PlaylistItem) => {
    const previous = recentlyWatchedRef.current;
    const parsedTarget = item.type === 'series' ? parseSeriesEpisodeInfo(item.name) : null;
    const updated = previous.filter(candidate => {
      if (candidate.id === item.id) return false;
      if (!parsedTarget || candidate.type !== 'series') return true;
      const parsedCandidate = parseSeriesEpisodeInfo(candidate.name);
      return parsedCandidate.cleanTitle !== parsedTarget.cleanTitle ||
        (candidate.group || 'Genel') !== (item.group || 'Genel');
    });
    recentlyWatchedRef.current = updated;
    setRecentlyWatched(updated);
    saveAppSetting('cinema_recently_watched', updated);
    showToast(item.type === 'series'
      ? (language === 'tr' ? "Dizi izleme geçmişinden kaldırıldı." : "Series removed from watch history.")
      : (language === 'tr' ? "İçerik izleme geçmişinden kaldırıldı." : "Content removed from watch history."));
  };

  const reset = () => {
    setGlobalFavorites([]);
    recentlyWatchedRef.current = [];
    setRecentlyWatched([]);
    setSelectedChannel(null);
  };

  return {
    selectedChannel, setSelectedChannel,
    globalFavorites, setGlobalFavorites,
    recentlyWatched, setRecentlyWatched,
    toggleFavorite,
    saveToWatchHistory,
    saveWatchProgress,
    clearRecentlyWatched,
    removeFromRecentlyWatched,
    load,
    reset
  };
}
