import { startTransition, useEffect, useRef, useState } from 'react';
import type { SavedPlaylist, PlaylistItem } from '../types';
import { parseM3UAsync } from '../utils/m3uParser';
import { preprocessPlaylistItems } from '../utils/searchHelpers';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { getTranslation, type Language } from '../utils/translations';
import {
  getCacheBustedUrl,
  getPlaylistMode,
  hasXtreamCredentials,
  normalizeAutoUpdateInterval,
} from './playlists/playlistHelpers';
import {
  deletePlaylistData,
  loadPlaylistData,
  savePlaylistData,
} from './playlists/playlistDataStorage';
import {
  fetchXtreamSeriesGroup,
  getXtreamSeriesId,
} from './playlists/xtreamSeriesService';
import {
  createImportedPlaylist,
  fetchPlaylistImport,
  parsePlaylistImport,
} from './playlists/playlistImportService';
import { prepareProfilePlaylists } from './playlists/playlistProfileLoader';

export type IptvUpdateMode = 'prompt' | 'silent' | 'manual';

export interface PendingPlaylistUpdate {
  playlistId: string;
  playlistName: string;
  channelCount: number;
  items: PlaylistItem[];
}

interface UsePlaylistsProps {
  saveAppSetting: (key: string, value: any, profileIdOverride?: string | null) => Promise<void>;
  loadAppSetting: (key: string, isJson?: boolean, profileIdOverride?: string | null) => Promise<any>;
  showToast: (message: string) => void;
  setSelectedGroup: (group: string) => void;
  isParsing: boolean;
  setIsParsing: (val: boolean) => void;
  language: Language;
  iptvUpdateMode?: IptvUpdateMode;
  isPlaying?: boolean;
}

export function usePlaylists({
  saveAppSetting,
  loadAppSetting,
  showToast,
  setSelectedGroup,
  isParsing,
  setIsParsing,
  language,
  iptvUpdateMode = 'silent',
  isPlaying = false
}: UsePlaylistsProps) {
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
  const playlistsRef = useRef<SavedPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('');
  const activePlaylistIdRef = useRef('');
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [pendingPlaylistUpdate, setPendingPlaylistUpdate] = useState<PendingPlaylistUpdate | null>(null);

  const iptvUpdateModeRef = useRef<IptvUpdateMode>(iptvUpdateMode);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const updateInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  useEffect(() => {
    iptvUpdateModeRef.current = iptvUpdateMode;
  }, [iptvUpdateMode]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const applyPendingUpdate = () => {
    if (!pendingPlaylistUpdate) return;
    startTransition(() => setItems(pendingPlaylistUpdate.items));
    showToast(
      language === 'tr'
        ? `"${pendingPlaylistUpdate.playlistName}" yenilendi (${pendingPlaylistUpdate.channelCount} kanal).`
        : `"${pendingPlaylistUpdate.playlistName}" updated (${pendingPlaylistUpdate.channelCount} channels).`
    );
    setPendingPlaylistUpdate(null);
  };

  const dismissPendingUpdate = () => {
    setPendingPlaylistUpdate(null);
  };
  
  const [playlistFormName, setPlaylistFormName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [xtreamUrl, setXtreamUrl] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  const [playlistMode, setPlaylistMode] = useState<'m3u' | 'xtream'>('xtream');
  const [showAddPlaylistForm, setShowAddPlaylistForm] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const autoUpdateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activePlaylistIdRef.current = activePlaylistId;
  }, [activePlaylistId]);

  const clearAutoUpdateTimer = () => {
    if (autoUpdateTimerRef.current !== null) {
      window.clearTimeout(autoUpdateTimerRef.current);
      autoUpdateTimerRef.current = null;
    }
  };

  const scheduleAutoUpdate = (
    playlist: SavedPlaylist,
    currentActiveId: string,
    delayOverrideMs?: number,
  ) => {
    clearAutoUpdateTimer();
    if (iptvUpdateModeRef.current === 'manual' && delayOverrideMs === undefined) return;

    const mode = getPlaylistMode(playlist);
    if (!mode) return;

    const intervalHours = normalizeAutoUpdateInterval(playlist.autoUpdateIntervalHours);
    const lastUpdatedAt = Number(playlist.lastAutoUpdatedAt || Date.now());
    const dueAt = lastUpdatedAt + intervalHours * 60 * 60 * 1000;

    // Boot deferral: Wait at least 30 seconds after app startup before checking background updates
    const BOOT_DEFERRAL_MS = 30000;
    const delayMs = delayOverrideMs !== undefined
      ? Math.max(0, delayOverrideMs)
      : Math.max(BOOT_DEFERRAL_MS, dueAt - Date.now());

    autoUpdateTimerRef.current = window.setTimeout(() => {
      if (isPlayingRef.current) {
        // Defer by 5 minutes if user is currently watching video
        scheduleAutoUpdate(playlist, currentActiveId, 5 * 60 * 1000);
        return;
      }
      autoUpdatePlaylist({ ...playlist, autoUpdateIntervalHours: intervalHours }, currentActiveId, false, delayOverrideMs !== undefined);
    }, delayMs);
  };

  const autoUpdatePlaylist = async (playlist: SavedPlaylist, currentActiveId: string, isManual = false, isRecovery = false) => {
    const mode = getPlaylistMode(playlist);
    const url = playlist.url;

    if (!mode || (mode === 'm3u' && !url)) {
      if (isManual) {
        showToast(language === 'tr'
          ? 'Yerel M3U dosyaları otomatik güncellenemez.'
          : 'Local M3U files cannot be auto-updated.');
      }
      return;
    }
    if (mode === 'xtream' && !hasXtreamCredentials(playlist)) {
      if (isManual) {
        showToast(getTranslation('feedback.playlist.credentialsMissing', language));
      }
      return;
    }

    if (!isManual && !isRecovery && iptvUpdateModeRef.current === 'manual') return;
    if (!isManual && isPlayingRef.current) {
      scheduleAutoUpdate(playlist, currentActiveId, 5 * 60 * 1000);
      return;
    }
    if (updateInFlightRef.current.has(playlist.id)) {
      if (isManual) {
        showToast(language === 'tr' ? 'Bu liste zaten güncelleniyor.' : 'This playlist is already updating.');
      }
      return;
    }
    updateInFlightRef.current.add(playlist.id);

    if (isManual) {
      setIsParsing(true);
      showToast(language === 'tr'
        ? `"${playlist.name}" listesi güncelleniyor...`
        : `Updating playlist "${playlist.name}"...`);
    }

    try {
      let fetchUrl = '';
      if (mode === 'm3u') {
        fetchUrl = url!;
      } else {
        const baseUrl = playlist.xtreamUrl!.replace(/\/$/, '');
        const username = encodeURIComponent(playlist.xtreamUser!);
        const password = encodeURIComponent(playlist.xtreamPass!);
        fetchUrl = `${baseUrl}/get.php?username=${username}&password=${password}&type=m3u_plus&output=m3u8`;
      }

      const res = await fetch(getCacheBustedUrl(fetchUrl), {
        cache: 'no-store',
        headers: {
          'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'
        }
      });
      if (!res.ok) throw new Error(language === 'tr' ? "HTTP Hatası: " + res.status : "HTTP Error: " + res.status);
      const data = await res.arrayBuffer();
      const parsedPlaylist = await parseM3UAsync(data);
      const parsedItems = parsedPlaylist.items;
      const updatedAt = Date.now();
      if (parsedItems.length === 0) throw new Error(language === 'tr' ? "Çözümlenebilir kanal bulunamadı!" : "No playable channels found!");

      const unchanged = Boolean(
        playlist.contentRevision
        && playlist.contentRevision === parsedPlaylist.revision,
      );
      const updatedPlaylist: SavedPlaylist = {
        ...playlist,
        channelCount: parsedItems.length,
        groupCount: parsedPlaylist.groups.length,
        groups: parsedPlaylist.groups,
        playlistMode: mode,
        autoUpdateIntervalHours: normalizeAutoUpdateInterval(playlist.autoUpdateIntervalHours),
        lastAutoUpdatedAt: updatedAt,
        contentRevision: parsedPlaylist.revision,
      };
      const updatedPlaylists = playlistsRef.current.map((current) => (
        current.id === playlist.id ? { ...current, ...updatedPlaylist } : current
      ));
      playlistsRef.current = updatedPlaylists;
      setPlaylists(updatedPlaylists);
      await saveAppSetting('cinema_playlists', updatedPlaylists);

      if (unchanged) {
        if (isManual) {
          showToast(language === 'tr'
            ? `"${playlist.name}" zaten güncel.`
            : `"${playlist.name}" is already up to date.`);
        }
        if (activePlaylistIdRef.current === playlist.id) {
          scheduleAutoUpdate(updatedPlaylist, currentActiveId);
        }
        return;
      }

      // Persist first, then swap the active catalog as a non-urgent render.
      await savePlaylistData(playlist.id, parsedItems);

      // If this is currently the active playlist, handle state according to update mode
      if (activePlaylistIdRef.current === playlist.id) {
        if (isManual) {
          startTransition(() => setItems(parsedItems));
          setPendingPlaylistUpdate(null);
          showToast(language === 'tr'
            ? `"${playlist.name}" güncellendi (${parsedItems.length} kanal).`
            : `"${playlist.name}" updated (${parsedItems.length} channels).`);
        } else if (iptvUpdateModeRef.current === 'prompt' || isPlayingRef.current) {
          setPendingPlaylistUpdate({
            playlistId: playlist.id,
            playlistName: playlist.name,
            channelCount: parsedItems.length,
            items: parsedItems
          });
        } else if (iptvUpdateModeRef.current === 'silent') {
          const applySilently = () => startTransition(() => setItems(parsedItems));
          if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(applySilently, { timeout: 1500 });
          } else {
            window.setTimeout(applySilently, 0);
          }
        }
        scheduleAutoUpdate(updatedPlaylist, currentActiveId);
      } else {
        if (isManual) {
          showToast(language === 'tr'
            ? `"${playlist.name}" güncellendi.`
            : `"${playlist.name}" updated.`);
        }
      }
    } catch (err: any) {
      console.warn(`[Auto-Update] Failed to update playlist ${playlist.name}:`, err.message);
      if (activePlaylistIdRef.current === playlist.id) {
        scheduleAutoUpdate(playlist, currentActiveId, 5 * 60 * 1000);
      }
      if (isManual) {
        showToast(getTranslation('feedback.playlist.refreshFailed', language));
      }
    } finally {
      updateInFlightRef.current.delete(playlist.id);
      if (isManual) {
        setIsParsing(false);
      }
    }
  };

  const activeProfileIdRef = useRef<string | null>(null);

  const load = async (profileId: string) => {
    activeProfileIdRef.current = profileId;
    const savedPlaylists = await loadAppSetting('cinema_playlists', true, profileId);
    let nextPlaylists: SavedPlaylist[] = [];
    let nextActivePlaylistId = '';
    let nextItems: PlaylistItem[] = [];

    if (savedPlaylists && Array.isArray(savedPlaylists)) {
      const prepared = await prepareProfilePlaylists(savedPlaylists, profileId);
      nextPlaylists = prepared.playlists;
      if (prepared.restoredCredentials) {
        await saveAppSetting('cinema_playlists', nextPlaylists, profileId);
      }
      if (nextPlaylists.length > 0) {
        const savedActiveId = await loadAppSetting('cinema_active_playlist', false, profileId);
        const activeId = nextPlaylists.some((playlist) => playlist.id === savedActiveId)
          ? savedActiveId
          : nextPlaylists[0].id;

        nextActivePlaylistId = activeId;
        const activePlaylist = nextPlaylists.find(p => p.id === activeId);

        const loadedItems = await loadPlaylistData(activeId);
        nextItems = preprocessPlaylistItems(loadedItems);

        if (activePlaylist) {
          const intervalHours = normalizeAutoUpdateInterval(activePlaylist.autoUpdateIntervalHours);
          const lastUpdatedAt = Number(activePlaylist.lastAutoUpdatedAt || 0);

          if (!lastUpdatedAt || nextItems.length === 0) {
            const now = Date.now();
            nextPlaylists = nextPlaylists.map(p => p.id === activeId ? { ...p, lastAutoUpdatedAt: now } : p);
            await saveAppSetting('cinema_playlists', nextPlaylists, profileId);
            scheduleAutoUpdate({ ...activePlaylist, autoUpdateIntervalHours: intervalHours, lastAutoUpdatedAt: now }, activeId, 1000);
          } else {
            scheduleAutoUpdate({ ...activePlaylist, autoUpdateIntervalHours: intervalHours }, activeId);
          }
        }
      }
    }

    if (activeProfileIdRef.current !== profileId) return;

    setPlaylists(nextPlaylists);
    setActivePlaylistId(nextActivePlaylistId);
    console.log('PLAYLIST_ITEMS_LOADED:', nextItems.length);
    setItems(nextItems);
  };

  const reset = () => {
    clearAutoUpdateTimer();
    setPlaylists([]);
    setActivePlaylistId('');
    setItems([]);
  };

  const activateImportedPlaylist = async (
    playlist: SavedPlaylist,
    playlistItems: PlaylistItem[],
    scheduleUpdates: boolean,
  ) => {
    await savePlaylistData(playlist.id, playlistItems);
    const updated = [...playlistsRef.current, playlist];
    playlistsRef.current = updated;
    setPlaylists(updated);
    await saveAppSetting('cinema_playlists', updated);
    setActivePlaylistId(playlist.id);
    await saveAppSetting('cinema_active_playlist', playlist.id);
    setItems(playlistItems);
    if (scheduleUpdates) scheduleAutoUpdate(playlist, playlist.id);
    setShowAddPlaylistForm(false);
  };

  const handlePlaylistLoadFromUrl = async () => {
    if (!m3uUrl.trim() || !playlistFormName.trim()) return;
    setIsParsing(true);
    showToast(language === 'tr'
      ? "M3U Listesi indiriliyor ve çözümleniyor..."
      : "Downloading and parsing M3U list...");
    try {
      const parsed = await fetchPlaylistImport(m3uUrl, language);
      const newList = createImportedPlaylist({
        name: playlistFormName,
        parsed,
        mode: 'm3u',
        url: m3uUrl,
      });
      await activateImportedPlaylist(newList, parsed.items, true);

      setM3uUrl('');
      setPlaylistFormName('');
      showToast(getTranslation('feedback.playlist.loaded', language, { count: parsed.items.length }));
    } catch (err: any) {
      console.error('Failed to load M3U playlist:', err);
      showToast(getTranslation('feedback.playlist.loadFailed', language));
    } finally {
      setIsParsing(false);
    }
  };

  const handleXtreamLoad = async () => {
    if (!xtreamUrl.trim() || !xtreamUser.trim() || !xtreamPass.trim() || !playlistFormName.trim()) {
      showToast(language === 'tr'
        ? "Tüm Xtream Codes alanlarını doldurmalısınız."
        : "Please fill in all Xtream Codes fields.");
      return;
    }
    const cleanUrl = xtreamUrl.trim().replace(/\/$/, "");
    const finalUrl = `${cleanUrl}/get.php?username=${xtreamUser.trim()}&password=${xtreamPass.trim()}&type=m3u_plus&output=m3u8`;

    setIsParsing(true);
    showToast(language === 'tr'
      ? "Xtream API'ye bağlanılıyor, listeler çekiliyor..."
      : "Connecting to Xtream API, fetching lists...");
    try {
      const parsed = await fetchPlaylistImport(finalUrl, language);
      const newList = createImportedPlaylist({
        name: playlistFormName,
        parsed,
        mode: 'xtream',
        xtream: {
          url: cleanUrl,
          user: xtreamUser.trim(),
          pass: xtreamPass.trim(),
        },
      });
      await activateImportedPlaylist(newList, parsed.items, true);

      setXtreamUrl('');
      setXtreamUser('');
      setXtreamPass('');
      setPlaylistFormName('');
      showToast(getTranslation('feedback.playlist.xtreamConnected', language, { count: parsed.items.length }));
    } catch (err) {
      console.error('Failed to connect to Xtream:', err);
      showToast(getTranslation('feedback.playlist.xtreamFailed', language));
    } finally {
      setIsParsing(false);
    }
  };

  const handlePlaylistLoadLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    showToast(language === 'tr' ? "Yerel M3U dosyası yükleniyor..." : "Loading local M3U file...");
    try {
        const parsed = await parsePlaylistImport(await file.arrayBuffer(), language);
        const newList = createImportedPlaylist({
          name: file.name.replace(/\.m3u$/i, ""),
          parsed,
        });
        await activateImportedPlaylist(newList, parsed.items, false);
        showToast(getTranslation('feedback.playlist.loaded', language, { count: parsed.items.length }));
      } catch (err: any) {
        console.error('Failed to load local M3U file:', err);
        showToast(getTranslation('feedback.playlist.localFileFailed', language));
      } finally {
        setIsParsing(false);
      }
  };

  const handleDeletePlaylist = async (id: string) => {
    const updated = playlists.filter(p => p.id !== id);
    setPlaylists(updated);
    await saveAppSetting('cinema_playlists', updated);
    await deletePlaylistData(id);
    showToast(language === 'tr' ? "Çalma listesi silindi" : "Playlist deleted");
    if (activePlaylistId === id) {
      if (updated.length > 0) {
        setActivePlaylistId(updated[0].id);
        await saveAppSetting('cinema_active_playlist', updated[0].id);
        setIsParsing(true);
        try {
          const loadedItems = await loadPlaylistData(updated[0].id);
          setItems(preprocessPlaylistItems(loadedItems));
          const now = Date.now();
          const nextPlaylist = updated[0].lastAutoUpdatedAt ? updated[0] : { ...updated[0], lastAutoUpdatedAt: now };
          if (!updated[0].lastAutoUpdatedAt) {
            const playlistsWithTimestamp = updated.map(p => p.id === nextPlaylist.id ? nextPlaylist : p);
            setPlaylists(playlistsWithTimestamp);
            await saveAppSetting('cinema_playlists', playlistsWithTimestamp);
          }
          scheduleAutoUpdate(nextPlaylist, nextPlaylist.id);
        } catch (e) {
          console.error(e);
        } finally {
          setIsParsing(false);
        }
      } else {
        clearAutoUpdateTimer();
        setActivePlaylistId('');
        await saveAppSetting('cinema_active_playlist', '');
        setItems([]);
      }
    }
  };

  const handleSelectPlaylist = async (id: string) => {
    setActivePlaylistId(id);
    await saveAppSetting('cinema_active_playlist', id);
    const found = playlists.find(p => p.id === id);
    if (found) {
      setIsParsing(true);
      showToast(language === 'tr' ? `Liste yükleniyor: ${found.name}` : `Loading playlist: ${found.name}`);
      try {
        const loadedItems = await loadPlaylistData(id);
        setItems(preprocessPlaylistItems(loadedItems));
        setSelectedGroup('Ana Sayfa');
        showToast(language === 'tr'
          ? `Aktif liste: ${found.name} (${loadedItems.length} kanal)`
          : `Active playlist: ${found.name} (${loadedItems.length} channels)`);

        const intervalHours = normalizeAutoUpdateInterval(found.autoUpdateIntervalHours);
        const lastUpdatedAt = Number(found.lastAutoUpdatedAt || 0);

        if (!lastUpdatedAt) {
          const now = Date.now();
          const updated = playlists.map(p => p.id === id ? { ...p, lastAutoUpdatedAt: now, autoUpdateIntervalHours: intervalHours } : p);
          setPlaylists(updated);
          await saveAppSetting('cinema_playlists', updated);
          scheduleAutoUpdate({ ...found, autoUpdateIntervalHours: intervalHours, lastAutoUpdatedAt: now }, id);
        } else {
          scheduleAutoUpdate({ ...found, autoUpdateIntervalHours: intervalHours }, id);
        }
      } catch (error) {
        console.error('Failed to activate playlist:', error);
        showToast(getTranslation('feedback.playlist.loadFailed', language));
      } finally {
        setIsParsing(false);
      }
    }
  };

  const updatePlaylistAutoUpdateInterval = async (id: string, intervalHours: 6 | 12 | 24 | 168) => {
    const normalized = normalizeAutoUpdateInterval(intervalHours);
    const updated = playlists.map(playlist => (
      playlist.id === id
        ? { ...playlist, autoUpdateIntervalHours: normalized }
        : playlist
    ));
    setPlaylists(updated);
    await saveAppSetting('cinema_playlists', updated);
    const active = updated.find(playlist => playlist.id === activePlaylistId);
    if (active) {
      scheduleAutoUpdate(active, activePlaylistId);
    }
  };

  const buildXtreamSeriesGroup = async (sourceItem: PlaylistItem | null, fallbackSeries?: GroupedSeries): Promise<GroupedSeries | null> => {
    const activePlaylist = playlists.find(playlist => playlist.id === activePlaylistId);
    try {
      return await fetchXtreamSeriesGroup({
        sourceItem,
        fallbackSeries,
        activePlaylist,
      });
    } catch (error) {
      console.error('Failed to fetch Xtream series info:', error);
      showToast(getTranslation('feedback.playlist.seriesLoadFailed', language));
      return null;
    }
  };

  return {
    playlists, setPlaylists,
    activePlaylistId, setActivePlaylistId,
    items, setItems,
    pendingPlaylistUpdate, setPendingPlaylistUpdate,
    applyPendingUpdate, dismissPendingUpdate,
    playlistFormName, setPlaylistFormName,
    m3uUrl, setM3uUrl,
    xtreamUrl, setXtreamUrl,
    xtreamUser, setXtreamUser,
    xtreamPass, setXtreamPass,
    playlistMode, setPlaylistMode,
    isParsing, setIsParsing,
    showAddPlaylistForm, setShowAddPlaylistForm,
    visibleCount, setVisibleCount,
    load,
    reset,
    handlePlaylistLoadFromUrl,
    handlePlaylistLoadLocal,
    handleXtreamLoad,
    handleDeletePlaylist,
    handleSelectPlaylist,
    updatePlaylistAutoUpdateInterval,
    loadPlaylistData,
    savePlaylistData,
    autoUpdatePlaylist,
    getXtreamSeriesId,
    buildXtreamSeriesGroup
  };
}
