import { startTransition, useEffect, useRef, useState } from 'react';
import type { SavedPlaylist, PlaylistItem } from '../types';
import { parseM3UAsync } from '../utils/m3uParser';
import { preprocessPlaylistItems } from '../utils/searchHelpers';
import { DEFAULT_AUTO_UPDATE_INTERVAL_HOURS } from '../constants';
import {
  deletePlaylistFromBrowserStorage,
  loadPlaylistFromBrowserStorage,
  savePlaylistToBrowserStorage
} from '../utils/playlistStorage';
import { cleanMovieName } from '../utils/tmdb';
import type { GroupedSeries, SeriesEpisode } from '../utils/seriesGroupers';
import type { Language } from '../utils/translations';

const AUTO_UPDATE_INTERVALS = [6, 12, 24, 168] as const;

const normalizeAutoUpdateInterval = (value: unknown): 6 | 12 | 24 | 168 => {
  const numeric = Number(value);
  return AUTO_UPDATE_INTERVALS.includes(numeric as 6 | 12 | 24 | 168)
    ? numeric as 6 | 12 | 24 | 168
    : DEFAULT_AUTO_UPDATE_INTERVAL_HOURS;
};

const getCacheBustedUrl = (url: string): string => {
  const cb = Date.now();
  return url.includes('?') ? `${url}&_cb=${cb}` : `${url}?_cb=${cb}`;
};

const hasXtreamCredentials = (playlist: SavedPlaylist | undefined): playlist is SavedPlaylist & {
  xtreamUrl: string;
  xtreamUser: string;
  xtreamPass: string;
} => Boolean(playlist?.xtreamUrl?.trim() && playlist.xtreamUser?.trim() && playlist.xtreamPass?.trim());

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

  const savePlaylistData = async (id: string, playlistItems: PlaylistItem[]) => {
    if (window.electronAPI && window.electronAPI.savePlaylistItems) {
      await window.electronAPI.savePlaylistItems(id, playlistItems);
    } else {
      await savePlaylistToBrowserStorage(id, playlistItems);
    }
  };

  const loadPlaylistData = async (id: string): Promise<PlaylistItem[]> => {
    if (window.electronAPI && window.electronAPI.loadPlaylistItems) {
      return await window.electronAPI.loadPlaylistItems(id);
    } else {
      return loadPlaylistFromBrowserStorage(id);
    }
  };

  const deletePlaylistData = async (id: string) => {
    if (window.electronAPI && window.electronAPI.deletePlaylistItems) {
      await window.electronAPI.deletePlaylistItems(id);
    } else {
      await deletePlaylistFromBrowserStorage(id);
    }
  };

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
    if (iptvUpdateModeRef.current === 'manual') return;

    const mode = playlist.playlistMode || (playlist.xtreamUrl ? 'xtream' : (playlist.url ? 'm3u' : undefined));
    if (!mode) return;

    const intervalHours = normalizeAutoUpdateInterval(playlist.autoUpdateIntervalHours);
    const lastUpdatedAt = Number(playlist.lastAutoUpdatedAt || Date.now());
    const dueAt = lastUpdatedAt + intervalHours * 60 * 60 * 1000;

    // Boot deferral: Wait at least 30 seconds after app startup before checking background updates
    const BOOT_DEFERRAL_MS = 30000;
    const delayMs = delayOverrideMs !== undefined
      ? Math.max(BOOT_DEFERRAL_MS, delayOverrideMs)
      : Math.max(BOOT_DEFERRAL_MS, dueAt - Date.now());

    autoUpdateTimerRef.current = window.setTimeout(() => {
      if (isPlayingRef.current) {
        // Defer by 5 minutes if user is currently watching video
        scheduleAutoUpdate(playlist, currentActiveId, 5 * 60 * 1000);
        return;
      }
      autoUpdatePlaylist({ ...playlist, autoUpdateIntervalHours: intervalHours }, currentActiveId);
    }, delayMs);
  };

  const autoUpdatePlaylist = async (playlist: SavedPlaylist, currentActiveId: string, isManual = false) => {
    const mode = playlist.playlistMode || (playlist.xtreamUrl ? 'xtream' : (playlist.url ? 'm3u' : undefined));
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
        showToast(language === 'tr'
          ? 'Kayıtlı Xtream bağlantı bilgileri okunamadı.'
          : 'The saved Xtream connection details could not be read.');
      }
      return;
    }

    if (!isManual && iptvUpdateModeRef.current === 'manual') return;
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
        showToast(language === 'tr'
          ? `Güncelleme başarısız: ${err.message}`
          : `Update failed: ${err.message}`);
      }
    } finally {
      updateInFlightRef.current.delete(playlist.id);
      if (isManual) {
        setIsParsing(false);
      }
    }
  };

  const load = async (profileId: string) => {
    const savedPlaylists = await loadAppSetting('cinema_playlists', true, profileId);
    let nextPlaylists: SavedPlaylist[] = [];
    let restoredCredentials = false;
    let nextActivePlaylistId = '';
    let nextItems: PlaylistItem[] = [];

    if (savedPlaylists && Array.isArray(savedPlaylists)) {
      nextPlaylists = savedPlaylists.map((playlist: SavedPlaylist) => {
        let mode = playlist.playlistMode;
        if (!mode) {
          if (playlist.xtreamUrl) {
            mode = 'xtream';
          } else if (playlist.url) {
            mode = 'm3u';
          }
        }
        return {
          ...playlist,
          playlistMode: mode,
          autoUpdateIntervalHours: normalizeAutoUpdateInterval(playlist.autoUpdateIntervalHours)
        };
      });

      const browserStorageKey = `profile_${profileId}_cinema_playlists`;
      try {
        const browserPlaylists = JSON.parse(localStorage.getItem(browserStorageKey) || '[]') as SavedPlaylist[];
        if (Array.isArray(browserPlaylists)) {
          const browserById = new Map(browserPlaylists.map((playlist) => [playlist.id, playlist]));
          nextPlaylists = nextPlaylists.map((playlist) => {
            if (playlist.playlistMode !== 'xtream' || hasXtreamCredentials(playlist)) return playlist;
            const localPlaylist = browserById.get(playlist.id);
            if (!hasXtreamCredentials(localPlaylist)) return playlist;
            restoredCredentials = true;
            return {
              ...playlist,
              xtreamUrl: localPlaylist.xtreamUrl.trim(),
              xtreamUser: localPlaylist.xtreamUser.trim(),
              xtreamPass: localPlaylist.xtreamPass.trim()
            };
          });
        }
      } catch {
        // A malformed browser fallback must not prevent the durable playlist from loading.
      }

      if (window.electronAPI?.recoverPlaylistCredentials) {
        nextPlaylists = await Promise.all(nextPlaylists.map(async (playlist) => {
          if (playlist.playlistMode !== 'xtream' || hasXtreamCredentials(playlist)) return playlist;
          try {
            const result = await window.electronAPI!.recoverPlaylistCredentials!(profileId, playlist.id);
            if (!result.success || !hasXtreamCredentials(result.playlist)) return playlist;
            restoredCredentials = true;
            return result.playlist;
          } catch {
            // Renderer hot reloads can temporarily outlive an older Electron main process.
            // Credential recovery is optional and must never block profile loading.
            return playlist;
          }
        }));
      }

      if (restoredCredentials) {
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

          if (!lastUpdatedAt) {
            const now = Date.now();
            nextPlaylists = nextPlaylists.map(p => p.id === activeId ? { ...p, lastAutoUpdatedAt: now } : p);
            await saveAppSetting('cinema_playlists', nextPlaylists, profileId);
            scheduleAutoUpdate({ ...activePlaylist, autoUpdateIntervalHours: intervalHours, lastAutoUpdatedAt: now }, activeId);
          } else {
            scheduleAutoUpdate({ ...activePlaylist, autoUpdateIntervalHours: intervalHours }, activeId);
          }
        }
      }
    }

    setPlaylists(nextPlaylists);
    setActivePlaylistId(nextActivePlaylistId);
    setItems(nextItems);
  };

  const reset = () => {
    clearAutoUpdateTimer();
    setPlaylists([]);
    setActivePlaylistId('');
    setItems([]);
  };

  const handlePlaylistLoadFromUrl = async () => {
    if (!m3uUrl.trim() || !playlistFormName.trim()) return;
    setIsParsing(true);
    showToast(language === 'tr'
      ? "M3U Listesi indiriliyor ve çözümleniyor..."
      : "Downloading and parsing M3U list...");
    try {
      const res = await fetch(getCacheBustedUrl(m3uUrl), {
        cache: 'no-store',
        headers: {
          'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'
        }
      });
      if (!res.ok) throw new Error(language === 'tr' ? "HTTP Hatası: " + res.status : "HTTP Error: " + res.status);
      const data = await res.arrayBuffer();
      const parsedPlaylist = await parseM3UAsync(data);
      const parsedItems = parsedPlaylist.items;

      if (parsedItems.length === 0) throw new Error(language === 'tr' ? "Çözümlenebilir kanal bulunamadı!" : "No playable channels found!");

      const distinctGroups = parsedPlaylist.groups;

      const newList: SavedPlaylist = {
        id: Date.now().toString(),
        name: playlistFormName,
        channelCount: parsedItems.length,
        groupCount: distinctGroups.length,
        groups: distinctGroups,
        playlistMode: 'm3u',
        url: m3uUrl,
        autoUpdateIntervalHours: DEFAULT_AUTO_UPDATE_INTERVAL_HOURS,
        lastAutoUpdatedAt: Date.now(),
        contentRevision: parsedPlaylist.revision,
      };

      await savePlaylistData(newList.id, parsedItems);

      const updated = [...playlists, newList];
      setPlaylists(updated);
      await saveAppSetting('cinema_playlists', updated);

      setActivePlaylistId(newList.id);
      await saveAppSetting('cinema_active_playlist', newList.id);
      setItems(parsedItems);
      scheduleAutoUpdate(newList, newList.id);

      setM3uUrl('');
      setPlaylistFormName('');
      setShowAddPlaylistForm(false);
      showToast(language === 'tr'
        ? `${parsedItems.length} kanal başarıyla yüklendi!`
        : `${parsedItems.length} channels loaded successfully!`);
    } catch (err: any) {
      showToast(language === 'tr' ? "Hata: " + err.message : "Error: " + err.message);
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
      const res = await fetch(getCacheBustedUrl(finalUrl), {
        cache: 'no-store',
        headers: {
          'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'
        }
      });
      if (!res.ok) throw new Error(language === 'tr' ? "HTTP Hatası: " + res.status : "HTTP Error: " + res.status);
      const data = await res.arrayBuffer();
      const parsedPlaylist = await parseM3UAsync(data);
      const parsedItems = parsedPlaylist.items;
      if (parsedItems.length === 0) throw new Error(language === 'tr'
        ? "Çözümlenebilir kanal veya VOD bulunamadı! Bilgilerinizi kontrol edin."
        : "No playable channels or VOD found! Please check your credentials.");

      const distinctGroups = parsedPlaylist.groups;
      const newList: SavedPlaylist = {
        id: Date.now().toString(),
        name: playlistFormName,
        channelCount: parsedItems.length,
        groupCount: distinctGroups.length,
        groups: distinctGroups,
        playlistMode: 'xtream',
        xtreamUrl: cleanUrl,
        xtreamUser: xtreamUser.trim(),
        xtreamPass: xtreamPass.trim(),
        autoUpdateIntervalHours: DEFAULT_AUTO_UPDATE_INTERVAL_HOURS,
        lastAutoUpdatedAt: Date.now(),
        contentRevision: parsedPlaylist.revision,
      };

      await savePlaylistData(newList.id, parsedItems);

      const updated = [...playlists, newList];
      setPlaylists(updated);
      await saveAppSetting('cinema_playlists', updated);

      setActivePlaylistId(newList.id);
      await saveAppSetting('cinema_active_playlist', newList.id);
      setItems(parsedItems);
      scheduleAutoUpdate(newList, newList.id);

      setXtreamUrl('');
      setXtreamUser('');
      setXtreamPass('');
      setPlaylistFormName('');
      setShowAddPlaylistForm(false);
      showToast(language === 'tr'
        ? `Xtream Bağlantısı Başarılı! ${parsedItems.length} içerik yüklendi.`
        : `Xtream connection successful! ${parsedItems.length} items loaded.`);
    } catch (err) {
      showToast(language === 'tr' ? "Hata: " + (err instanceof Error ? err.message : err) : "Error: " + (err instanceof Error ? err.message : err));
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
        const data = await file.arrayBuffer();
        const parsedPlaylist = await parseM3UAsync(data);
        const parsedItems = parsedPlaylist.items;
        if (parsedItems.length === 0) throw new Error(language === 'tr' ? "M3U dosyası geçersiz veya boş!" : "M3U file is invalid or empty!");

        const distinctGroups = parsedPlaylist.groups;

        const newList: SavedPlaylist = {
          id: Date.now().toString(),
          name: file.name.replace(".m3u", ""),
          channelCount: parsedItems.length,
          groupCount: distinctGroups.length,
          groups: distinctGroups,
          autoUpdateIntervalHours: DEFAULT_AUTO_UPDATE_INTERVAL_HOURS,
          lastAutoUpdatedAt: Date.now(),
          contentRevision: parsedPlaylist.revision,
        };

        await savePlaylistData(newList.id, parsedItems);

        const updated = [...playlists, newList];
        setPlaylists(updated);
        await saveAppSetting('cinema_playlists', updated);

        setActivePlaylistId(newList.id);
        await saveAppSetting('cinema_active_playlist', newList.id);
        setItems(parsedItems);

        setShowAddPlaylistForm(false);
        showToast(language === 'tr'
          ? `${parsedItems.length} kanal yerel dosyadan yüklendi!`
          : `${parsedItems.length} channels loaded from local file!`);
      } catch (err: any) {
        showToast(language === 'tr' ? "Hata: " + err.message : "Error: " + err.message);
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
      } catch {
        showToast(language === 'tr' ? "Liste yüklenirken hata oluştu." : "An error occurred while loading the playlist.");
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

  interface XtreamSeriesEpisode {
    id?: string | number;
    episode_num?: string | number;
    title?: string;
    container_extension?: string;
    info?: {
      movie_image?: string;
      duration_secs?: string | number;
    };
  }

  interface XtreamSeriesInfoResponse {
    info?: {
      name?: string;
      cover?: string;
      movie_image?: string;
    };
    episodes?: Record<string, XtreamSeriesEpisode[]>;
  }

  const getXtreamSeriesId = (item: PlaylistItem | null) => {
    if (!item) return null;
    const match = item.id.match(/^xt-series-(\d+)$/);
    return match ? match[1] : null;
  };

  const buildXtreamSeriesGroup = async (sourceItem: PlaylistItem | null, fallbackSeries?: GroupedSeries): Promise<GroupedSeries | null> => {
    const seriesId = getXtreamSeriesId(sourceItem);
    const activePlaylist = playlists.find(playlist => playlist.id === activePlaylistId);
    if (!sourceItem || !seriesId || !activePlaylist?.xtreamUrl || !activePlaylist.xtreamUser || !activePlaylist.xtreamPass) {
      return null;
    }

    const baseUrl = activePlaylist.xtreamUrl.replace(/\/$/, '');
    const username = encodeURIComponent(activePlaylist.xtreamUser);
    const password = encodeURIComponent(activePlaylist.xtreamPass);
    const apiUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;

    try {
      const response = await fetch(apiUrl, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as XtreamSeriesInfoResponse;
      if (!data.episodes || typeof data.episodes !== 'object') {
        return null;
      }

      const seasonsMap: Record<number, SeriesEpisode[]> = {};
      let episodesCount = 0;
      const seriesTitle = cleanMovieName(data.info?.name || fallbackSeries?.name || sourceItem.name);
      const logo = data.info?.cover || data.info?.movie_image || fallbackSeries?.logo || sourceItem.logo || '';

      Object.entries(data.episodes).forEach(([seasonKey, seasonEpisodes]) => {
        const seasonNumber = Number(seasonKey) || 1;
        if (!Array.isArray(seasonEpisodes)) return;
        if (!seasonsMap[seasonNumber]) seasonsMap[seasonNumber] = [];

        seasonEpisodes.forEach((episode, index) => {
          const episodeId = episode.id !== undefined ? String(episode.id) : '';
          if (!episodeId) return;
          const episodeNumber = Number(episode.episode_num) || index + 1;
          const extension = episode.container_extension || 'mp4';
          const episodeTitle = episode.title?.trim();
          const streamUrl = `${baseUrl}/series/${username}/${password}/${encodeURIComponent(episodeId)}.${extension}`;
          const item: PlaylistItem = {
            id: `xt-episode-${seriesId}-${episodeId}`,
            name: episodeTitle
              ? `${seriesTitle} S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')} - ${episodeTitle}`
              : `${seriesTitle} S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`,
            logo: episode.info?.movie_image || logo,
            group: sourceItem.group || fallbackSeries?.group || 'Genel',
            url: streamUrl,
            type: 'series',
            xtreamSeriesId: seriesId,
            xtreamEpisodeId: episodeId
          };

          seasonsMap[seasonNumber].push({
            episodeNumber,
            seasonNumber,
            item
          });
          episodesCount++;
        });
      });

      Object.values(seasonsMap).forEach(episodes => {
        episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
      });

      if (episodesCount === 0) return null;

      return {
        id: fallbackSeries?.id || `series-${sourceItem.id}`,
        name: seriesTitle,
        logo,
        group: sourceItem.group || fallbackSeries?.group || 'Genel',
        type: 'series',
        seasons: seasonsMap,
        episodesCount
      };
    } catch (error) {
      console.error('Failed to fetch Xtream series info:', error);
      showToast(language === 'tr' ? 'Dizi bölümleri alınamadı.' : 'Could not load series episodes.');
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
