import { useRef, useEffect, useCallback } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';
import type { Language } from '../utils/translations';

interface UsePlaybackNavigationProps {
  selectedChannel: PlaylistItem | null;
  setSelectedChannel: (channel: PlaylistItem | null) => void;
  selectedSeriesForModal: GroupedSeries | null;
  selectedChannelForModal: PlaylistItem | null;
  setSelectedSeriesForModal: (series: GroupedSeries | null) => void;
  setSelectedChannelForModal: (channel: PlaylistItem | null) => void;
  recentlyWatched: PlaylistItem[];
  saveToWatchHistory: (item: PlaylistItem) => void;
  defaultPlayer: string;
  language: Language;
  showToast: (message: string) => void;
}

export function usePlaybackNavigation({
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
}: UsePlaybackNavigationProps) {
  const mainContentRef = useRef<HTMLDivElement>(null);
  const playerReturnStateRef = useRef<{
    seriesModal: GroupedSeries | null;
    channelModal: PlaylistItem | null;
    scrollTop: number;
  } | null>(null);
  const pendingScrollRestoreRef = useRef<number | null>(null);

  const handlePlayStream = useCallback((item: PlaylistItem) => {
    if (!selectedChannel) {
      playerReturnStateRef.current = {
        seriesModal: selectedSeriesForModal,
        channelModal: selectedChannelForModal,
        scrollTop: mainContentRef.current?.scrollTop ?? 0,
      };
    }

    setSelectedChannelForModal(null);
    setSelectedSeriesForModal(null);

    const historyItem = recentlyWatched.find(x => x.id === item.id);
    const itemToPlay = historyItem
      ? {
          ...item,
          currentTime: historyItem.currentTime,
          duration: historyItem.duration,
          progress: historyItem.progress,
        }
      : item;

    saveToWatchHistory(itemToPlay);

    if (defaultPlayer !== 'internal' && window.electronAPI?.playExternal) {
      window.electronAPI.playExternal(item.url, defaultPlayer)
        .then((res) => {
          if (res && !res.success) {
            showToast(res.message);
            setSelectedChannel(itemToPlay);
          } else {
            showToast(language === 'tr' ? `${defaultPlayer.toUpperCase()} Oynatıcıda başlatıldı.` : `Started in ${defaultPlayer.toUpperCase()} Player.`);
          }
        })
        .catch((err) => {
          console.error('External player failed:', err);
          showToast(language === 'tr' ? 'Harici oynatıcı başlatılamadı.' : 'External player could not be started.');
          setSelectedChannel(itemToPlay);
        });
    } else {
      setSelectedChannel(itemToPlay);
    }
  }, [
    selectedChannel,
    selectedSeriesForModal,
    selectedChannelForModal,
    setSelectedChannelForModal,
    setSelectedSeriesForModal,
    recentlyWatched,
    saveToWatchHistory,
    defaultPlayer,
    language,
    showToast,
    setSelectedChannel,
  ]);

  const handlePlayerClose = useCallback(() => {
    const returnState = playerReturnStateRef.current;
    pendingScrollRestoreRef.current = returnState?.scrollTop ?? 0;
    setSelectedChannel(null);
    setSelectedSeriesForModal(returnState?.seriesModal ?? null);
    setSelectedChannelForModal(returnState?.channelModal ?? null);
    playerReturnStateRef.current = null;
  }, [setSelectedChannel, setSelectedSeriesForModal, setSelectedChannelForModal]);

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

  return {
    mainContentRef,
    handlePlayStream,
    handlePlayerClose,
  };
}
