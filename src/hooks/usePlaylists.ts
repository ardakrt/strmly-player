import { useRef, useState } from 'react';
import type { SavedPlaylist, PlaylistItem } from '../types';
import { parseM3UAsync } from '../utils/m3uParser';
import { preprocessPlaylistItems } from '../utils/searchHelpers';
import { DEFAULT_AUTO_UPDATE_INTERVAL_HOURS } from '../constants';

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

interface UsePlaylistsProps {
  saveAppSetting: (key: string, value: any, profileIdOverride?: string | null) => Promise<void>;
  loadAppSetting: (key: string, isJson?: boolean, profileIdOverride?: string | null) => Promise<any>;
  showToast: (message: string) => void;
  setSelectedGroup: (group: string) => void;
  isParsing: boolean;
  setIsParsing: (val: boolean) => void;
}

export function usePlaylists({
  saveAppSetting,
  loadAppSetting,
  showToast,
  setSelectedGroup,
  isParsing,
  setIsParsing
}: UsePlaylistsProps) {
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('');
  const [items, setItems] = useState<PlaylistItem[]>([]);
  
  const [playlistFormName, setPlaylistFormName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [xtreamUrl, setXtreamUrl] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  const [playlistMode, setPlaylistMode] = useState<'m3u' | 'xtream'>('xtream');
  const [showAddPlaylistForm, setShowAddPlaylistForm] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const autoUpdateTimerRef = useRef<number | null>(null);

  const savePlaylistData = async (id: string, playlistItems: PlaylistItem[]) => {
    if (window.electronAPI && window.electronAPI.savePlaylistItems) {
      await window.electronAPI.savePlaylistItems(id, playlistItems);
    } else {
      localStorage.setItem(`cinema_playlist_items_${id}`, JSON.stringify(playlistItems));
    }
  };

  const loadPlaylistData = async (id: string): Promise<PlaylistItem[]> => {
    if (window.electronAPI && window.electronAPI.loadPlaylistItems) {
      return await window.electronAPI.loadPlaylistItems(id);
    } else {
      const stored = localStorage.getItem(`cinema_playlist_items_${id}`);
      return stored ? JSON.parse(stored) : [];
    }
  };

  const deletePlaylistData = async (id: string) => {
    if (window.electronAPI && window.electronAPI.deletePlaylistItems) {
      await window.electronAPI.deletePlaylistItems(id);
    } else {
      localStorage.removeItem(`cinema_playlist_items_${id}`);
    }
  };

  const clearAutoUpdateTimer = () => {
    if (autoUpdateTimerRef.current !== null) {
      window.clearTimeout(autoUpdateTimerRef.current);
      autoUpdateTimerRef.current = null;
    }
  };

  const scheduleAutoUpdate = (playlist: SavedPlaylist, currentActiveId: string) => {
    clearAutoUpdateTimer();
    const mode = playlist.playlistMode || (playlist.xtreamUrl ? 'xtream' : (playlist.url ? 'm3u' : undefined));
    if (!mode) return;

    const intervalHours = normalizeAutoUpdateInterval(playlist.autoUpdateIntervalHours);
    const lastUpdatedAt = Number(playlist.lastAutoUpdatedAt || Date.now());
    const dueAt = lastUpdatedAt + intervalHours * 60 * 60 * 1000;
    const delayMs = Math.max(1500, dueAt - Date.now());

    autoUpdateTimerRef.current = window.setTimeout(() => {
      autoUpdatePlaylist({ ...playlist, autoUpdateIntervalHours: intervalHours }, currentActiveId);
    }, delayMs);
  };

  const autoUpdatePlaylist = async (playlist: SavedPlaylist, currentActiveId: string, isManual = false) => {
    const mode = playlist.playlistMode || (playlist.xtreamUrl ? 'xtream' : (playlist.url ? 'm3u' : undefined));
    const url = playlist.url;

    if (!mode || (mode === 'm3u' && !url)) {
      if (isManual) {
        showToast(`Yerel M3U dosyaları otomatik güncellenemez. (DEBUG: mode=${playlist.playlistMode || 'tanımsız'}, xUrl=${playlist.xtreamUrl ? 'var' : 'yok'}, url=${playlist.url ? 'var' : 'yok'})`);
      }
      return;
    }
    if (mode === 'xtream' && (!playlist.xtreamUrl || !playlist.xtreamUser || !playlist.xtreamPass)) return;

    if (isManual) {
      setIsParsing(true);
      showToast(`"${playlist.name}" listesi güncelleniyor...`);
    }

    try {
      let fetchUrl = '';
      if (mode === 'm3u') {
        fetchUrl = url!;
      } else {
        fetchUrl = `${playlist.xtreamUrl}/get.php?username=${playlist.xtreamUser}&password=${playlist.xtreamPass}&type=m3u_plus&output=m3u8`;
      }

      console.log(`[Auto-Update] Fetch started for: ${playlist.name}`);
      const res = await fetch(getCacheBustedUrl(fetchUrl), {
        cache: 'no-store',
        headers: {
          'User-Agent': '9XtreamPlayer LibVLC/3.0.22-rc1'
        }
      });
      if (!res.ok) throw new Error("HTTP Hatası: " + res.status);
      const text = await res.text();
      const parsedPlaylist = await parseM3UAsync(text);
      const parsedItems = parsedPlaylist.items;
      const updatedAt = Date.now();
      if (parsedItems.length === 0) throw new Error("Çözümlenebilir kanal bulunamadı!");

      // Save updated items to local file / localStorage
      await savePlaylistData(playlist.id, parsedItems);

      // Update metadata in playlists array
      setPlaylists((currentPlaylists) => {
        const updated = currentPlaylists.map((p) => {
          if (p.id === playlist.id) {
            return {
              ...p,
              channelCount: parsedItems.length,
              groupCount: parsedPlaylist.groups.length,
              groups: parsedPlaylist.groups,
              playlistMode: mode,
              autoUpdateIntervalHours: normalizeAutoUpdateInterval(p.autoUpdateIntervalHours),
              lastAutoUpdatedAt: updatedAt
            };
          }
          return p;
        });
        saveAppSetting('cinema_playlists', updated);
        return updated;
      });

      // If this is currently the active playlist, update items in state
      if (currentActiveId === playlist.id) {
        setItems(preprocessPlaylistItems(parsedItems));
        scheduleAutoUpdate({
          ...playlist,
          autoUpdateIntervalHours: normalizeAutoUpdateInterval(playlist.autoUpdateIntervalHours),
          lastAutoUpdatedAt: updatedAt
        }, currentActiveId);
        showToast(`"${playlist.name}" güncellendi (${parsedItems.length} kanal).`);
      } else {
        showToast(`"${playlist.name}" güncellendi.`);
      }
    } catch (err: any) {
      console.warn(`[Auto-Update] Failed to update playlist ${playlist.name}:`, err.message);
      if (isManual) {
        showToast(`Güncelleme başarısız: ${err.message}`);
      }
    } finally {
      if (isManual) {
        setIsParsing(false);
      }
    }
  };

  const load = async (profileId: string) => {
    const savedPlaylists = await loadAppSetting('cinema_playlists', true, profileId);
    let nextPlaylists: SavedPlaylist[] = [];
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
      if (nextPlaylists.length > 0) {
        const savedActiveId = await loadAppSetting('cinema_active_playlist', false, profileId);
        const activeId = nextPlaylists.some((playlist) => playlist.id === savedActiveId)
          ? savedActiveId
          : nextPlaylists[0].id;

        nextActivePlaylistId = activeId;
        const loadedItems = await loadPlaylistData(activeId);
        nextItems = preprocessPlaylistItems(loadedItems);

        const activePlaylist = nextPlaylists.find(p => p.id === activeId);
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
    showToast("M3U Listesi indiriliyor ve çözümleniyor...");
    try {
      const res = await fetch(getCacheBustedUrl(m3uUrl), {
        cache: 'no-store',
        headers: {
          'User-Agent': '9XtreamPlayer LibVLC/3.0.22-rc1'
        }
      });
      if (!res.ok) throw new Error("HTTP Hatası: " + res.status);
      const text = await res.text();
      const parsedPlaylist = await parseM3UAsync(text);
      const parsedItems = parsedPlaylist.items;

      if (parsedItems.length === 0) throw new Error("Çözümlenebilir kanal bulunamadı!");

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
        lastAutoUpdatedAt: Date.now()
      };

      await savePlaylistData(newList.id, parsedItems);

      const updated = [...playlists, newList];
      setPlaylists(updated);
      await saveAppSetting('cinema_playlists', updated);

      setActivePlaylistId(newList.id);
      await saveAppSetting('cinema_active_playlist', newList.id);
      setItems(preprocessPlaylistItems(parsedItems));

      setM3uUrl('');
      setPlaylistFormName('');
      setShowAddPlaylistForm(false);
      showToast(`${parsedItems.length} kanal başarıyla yüklendi!`);
    } catch (err: any) {
      showToast("Hata: " + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleXtreamLoad = async () => {
    if (!xtreamUrl.trim() || !xtreamUser.trim() || !xtreamPass.trim() || !playlistFormName.trim()) {
      showToast("Tüm Xtream Codes alanlarını doldurmalısınız.");
      return;
    }
    const cleanUrl = xtreamUrl.trim().replace(/\/$/, "");
    const finalUrl = `${cleanUrl}/get.php?username=${xtreamUser.trim()}&password=${xtreamPass.trim()}&type=m3u_plus&output=m3u8`;

    setIsParsing(true);
    showToast("Xtream API'ye bağlanılıyor, listeler çekiliyor...");
    try {
      const res = await fetch(getCacheBustedUrl(finalUrl), {
        cache: 'no-store',
        headers: {
          'User-Agent': '9XtreamPlayer LibVLC/3.0.22-rc1'
        }
      });
      if (!res.ok) throw new Error("HTTP Hatası: " + res.status);
      const text = await res.text();
      const parsedPlaylist = await parseM3UAsync(text);
      const parsedItems = parsedPlaylist.items;
      if (parsedItems.length === 0) throw new Error("Çözümlenebilir kanal veya VOD bulunamadı! Bilgilerinizi kontrol edin.");

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
        lastAutoUpdatedAt: Date.now()
      };

      await savePlaylistData(newList.id, parsedItems);

      const updated = [...playlists, newList];
      setPlaylists(updated);
      await saveAppSetting('cinema_playlists', updated);

      setActivePlaylistId(newList.id);
      await saveAppSetting('cinema_active_playlist', newList.id);
      setItems(preprocessPlaylistItems(parsedItems));

      setXtreamUrl('');
      setXtreamUser('');
      setXtreamPass('');
      setPlaylistFormName('');
      setShowAddPlaylistForm(false);
      showToast(`Xtream Bağlantısı Başarılı! ${parsedItems.length} içerik yüklendi.`);
    } catch (err) {
      showToast("Hata: " + (err instanceof Error ? err.message : err));
    } finally {
      setIsParsing(false);
    }
  };

  const handlePlaylistLoadLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    setIsParsing(true);
    showToast("Yerel M3U dosyası yükleniyor...");
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsedPlaylist = await parseM3UAsync(text);
        const parsedItems = parsedPlaylist.items;
        if (parsedItems.length === 0) throw new Error("M3U dosyası geçersiz veya boş!");

        const distinctGroups = parsedPlaylist.groups;

        const newList: SavedPlaylist = {
          id: Date.now().toString(),
          name: file.name.replace(".m3u", ""),
          channelCount: parsedItems.length,
          groupCount: distinctGroups.length,
          groups: distinctGroups,
          autoUpdateIntervalHours: DEFAULT_AUTO_UPDATE_INTERVAL_HOURS,
          lastAutoUpdatedAt: Date.now()
        };

        await savePlaylistData(newList.id, parsedItems);

        const updated = [...playlists, newList];
        setPlaylists(updated);
        await saveAppSetting('cinema_playlists', updated);

        setActivePlaylistId(newList.id);
        await saveAppSetting('cinema_active_playlist', newList.id);
        setItems(preprocessPlaylistItems(parsedItems));

        setShowAddPlaylistForm(false);
        showToast(`${parsedItems.length} kanal yerel dosyadan yüklendi!`);
      } catch (err: any) {
        showToast("Hata: " + err.message);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDeletePlaylist = async (id: string) => {
    const updated = playlists.filter(p => p.id !== id);
    setPlaylists(updated);
    await saveAppSetting('cinema_playlists', updated);
    await deletePlaylistData(id);
    showToast("Çalma listesi silindi");
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
      showToast(`Liste yükleniyor: ${found.name}`);
      try {
        const loadedItems = await loadPlaylistData(id);
        setItems(preprocessPlaylistItems(loadedItems));
        setSelectedGroup('Ana Sayfa');
        showToast(`Aktif liste: ${found.name} (${loadedItems.length} kanal)`);

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
        showToast("Liste yüklenirken hata oluştu.");
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

  return {
    playlists, setPlaylists,
    activePlaylistId, setActivePlaylistId,
    items, setItems,
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
    autoUpdatePlaylist
  };
}
