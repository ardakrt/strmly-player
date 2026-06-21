import { useState } from 'react';
import type { PlaylistItem } from '../types';

interface UsePlayerStateProps {
  saveAppSetting: (key: string, value: any, profileIdOverride?: string | null) => Promise<void>;
  loadAppSetting: (key: string, isJson?: boolean, profileIdOverride?: string | null) => Promise<any>;
  showToast: (message: string) => void;
}

export function usePlayerState({
  saveAppSetting,
  loadAppSetting,
  showToast
}: UsePlayerStateProps) {
  const [selectedChannel, setSelectedChannel] = useState<PlaylistItem | null>(null);
  const [selectedChannelForModal, setSelectedChannelForModal] = useState<PlaylistItem | null>(null);
  
  const [globalFavorites, setGlobalFavorites] = useState<string[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<any[]>([]);

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
    setRecentlyWatched(prev => {
      const updatedItem = { ...item };
      const filtered = prev.filter(x => x.id !== item.id);
      const updated = [updatedItem, ...filtered].slice(0, 10);
      saveAppSetting('cinema_recently_watched', updated);
      return updated;
    });
  };

  const saveWatchProgress = (item: PlaylistItem, time: number, total: number) => {
    if (item.type === 'live') return; // Live channels do not have watch progress

    setRecentlyWatched(prev => {
      const filtered = prev.filter(x => x.id !== item.id);
      const existing = prev.find(x => x.id === item.id);
      const updatedItem = {
        ...(existing || item),
        currentTime: time,
        duration: total,
        progress: total > 0 ? (time / total) * 100 : 0
      };
      const updated = [updatedItem, ...filtered].slice(0, 10);
      saveAppSetting('cinema_recently_watched', updated);
      return updated;
    });
  };

  const load = async (profileId: string) => {
    const [savedGlobalFavs, savedRecentlyWatched] = await Promise.all([
      loadAppSetting('cinema_global_favorites', true, profileId),
      loadAppSetting('cinema_recently_watched', true, profileId)
    ]);

    setGlobalFavorites(Array.isArray(savedGlobalFavs) ? savedGlobalFavs : []);
    setRecentlyWatched(Array.isArray(savedRecentlyWatched) ? savedRecentlyWatched : []);
  };

  const reset = () => {
    setGlobalFavorites([]);
    setRecentlyWatched([]);
    setSelectedChannel(null);
    setSelectedChannelForModal(null);
  };

  return {
    selectedChannel, setSelectedChannel,
    selectedChannelForModal, setSelectedChannelForModal,
    globalFavorites, setGlobalFavorites,
    recentlyWatched, setRecentlyWatched,
    toggleFavorite,
    saveToWatchHistory,
    saveWatchProgress,
    load,
    reset
  };
}
