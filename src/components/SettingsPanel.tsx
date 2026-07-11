import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Check,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Info,
  Palette,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
  Search,
  Tv,
  Film,
  Video,
  Globe,
  FileText,
  Tag,
  Cpu,
  Code,
  ExternalLink,
  Download
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import type { SavedPlaylist } from '../types';
import { useDownloads } from '../hooks/useDownloads';

import { ACCENT_COLORS, CustomSelect, dangerButton, EMPTY_ARRAY, EmptyState, fieldStyle, labelStyle, PageHeader, primaryButton, secondaryButton, SettingRow, StatBox, THEMES, UPDATE_OPTIONS } from './SettingsControls';

export const SettingsPanel = ({ onNavigate }: { onNavigate?: (view: string) => void }) => {
  const {
    language, setLanguage, t,
    activeSettingsTab, setActiveSettingsTab,
    defaultPlayer, setDefaultPlayer,
    activeTheme, setActiveTheme,
    activeAccent, setActiveAccent,
    glassIntensity, setGlassIntensity,
    neonGlowEnabled, setNeonGlowEnabled,
    cardLayoutSize, setCardLayoutSize,
    playlists, activePlaylistId,
    showAddPlaylistForm, setShowAddPlaylistForm,
    playlistMode, setPlaylistMode,
    playlistFormName, setPlaylistFormName,
    m3uUrl, setM3uUrl,
    xtreamUrl, setXtreamUrl,
    xtreamUser, setXtreamUser,
    xtreamPass, setXtreamPass,
    isParsing,
    hiddenCategories, hiddenSeriesCategories, hiddenMovieCategories,
    itemStats, recentlyWatched, globalFavorites,
    onPlaylistLoadFromUrl, onPlaylistLoadLocal, onXtreamLoad,
    onSelectPlaylist, onDeletePlaylist,
    onRestoreCategory, onRestoreSeriesCategory, onRestoreMovieCategory,
    onResetHiddenCategories, onResetHiddenSeriesCategories, onResetHiddenMovieCategories,
    onSaveSetting, onLoadSetting, onShowToast,
    onClearRecentlyWatched, onClearFavorites,
    onRefreshPlaylist,
    onUpdatePlaylistAutoUpdateInterval
  } = useSettings();

  const { downloads } = useDownloads();

  const safePlaylists = Array.isArray(playlists) ? playlists : EMPTY_ARRAY;
  const safeHiddenCategories = Array.isArray(hiddenCategories) ? hiddenCategories : EMPTY_ARRAY;
  const safeHiddenSeriesCategories = Array.isArray(hiddenSeriesCategories) ? hiddenSeriesCategories : EMPTY_ARRAY;
  const safeHiddenMovieCategories = Array.isArray(hiddenMovieCategories) ? hiddenMovieCategories : EMPTY_ARRAY;

  const safeRecentlyWatched = Array.isArray(recentlyWatched) ? recentlyWatched : EMPTY_ARRAY;
  const safeGlobalFavorites = Array.isArray(globalFavorites) ? globalFavorites : EMPTY_ARRAY;

  const [categorySearch, setCategorySearch] = useState('');
  const [categorySubTab, setCategorySubTab] = useState<'all' | 'live' | 'series' | 'movie'>('all');

  const [updateState, setUpdateState] = useState<{
    status: 'idle' | 'checking' | 'available' | 'downloading' | 'not-available' | 'downloaded' | 'error';
    message: string;
    version?: string;
    progress?: number;
  }>({ status: 'idle', message: '' });
  const hasAutoCheckedUpdatesRef = useRef(false);

  const [downloadsFolder, setDownloadsFolder] = useState<string>('');
  const [showMoveDownloadsPrompt, setShowMoveDownloadsPrompt] = useState<boolean>(false);
  const [pendingDownloadsFolder, setPendingDownloadsFolder] = useState<string>('');
  const [pendingDownloadsFolderToken, setPendingDownloadsFolderToken] = useState<string>('');
  const [moveExistingDownloads, setMoveExistingDownloads] = useState<boolean>(true);
  const [isMovingDownloads, setIsMovingDownloads] = useState<boolean>(false);
  const [moveProgress, setMoveProgress] = useState<{
    percent: number;
    currentFile: string;
    filesMoved: number;
    totalFiles: number;
  } | null>(null);
  const [segmentConcurrency, setSegmentConcurrency] = useState<number>(6);
  const [downloadMaxHeight, setDownloadMaxHeight] = useState<number>(1080);

  useEffect(() => {
    void (async () => {
      try {
        const conc = await onLoadSetting?.('cinema_download_segment_concurrency');
        const height = await onLoadSetting?.('cinema_download_max_height');
        const concNum = Number(conc);
        const heightNum = Number(height);
        if (Number.isFinite(concNum) && concNum >= 1 && concNum <= 8) {
          setSegmentConcurrency(Math.floor(concNum));
        }
        if (Number.isFinite(heightNum) && [480, 720, 1080, 2160].includes(heightNum)) {
          setDownloadMaxHeight(heightNum);
        }
      } catch {
        // defaults
      }
    })();
  }, [onLoadSetting]);

  useEffect(() => {
    if (window.electronAPI?.getDownloadsFolder) {
      window.electronAPI.getDownloadsFolder().then(setDownloadsFolder).catch(console.error);
    } else {
      setDownloadsFolder(language === 'tr' ? 'Varsayılan (Videolar/Strmly)' : 'Default (Videos/Strmly)');
    }
  }, [language]);

  useEffect(() => {
    if (!window.electronAPI?.onMoveDownloadsProgress) return;
    const unsub = window.electronAPI.onMoveDownloadsProgress((data) => {
      setMoveProgress({
        percent: data.progress,
        currentFile: data.currentFile,
        filesMoved: data.filesMoved,
        totalFiles: data.totalFiles
      });
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onUpdateStatus || !window.electronAPI.onUpdateProgress) return;

    const unsubStatus = window.electronAPI.onUpdateStatus((data: any) => {
      setUpdateState(prev => ({
        ...prev,
        status: data.status,
        message: data.message,
        version: data.version || prev.version,
        progress: data.status === 'downloading' ? (prev.progress ?? 0) : data.status === 'downloaded' ? 100 : undefined
      }));
    });

    const unsubProgress = window.electronAPI.onUpdateProgress((data: any) => {
      setUpdateState(prev => ({
        ...prev,
        status: 'downloading',
        progress: data.percent
      }));
    });

    return () => {
      if (unsubStatus) unsubStatus();
      if (unsubProgress) unsubProgress();
    };
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
      setUpdateState({ status: 'checking', message: language === 'tr' ? 'Güncellemeler denetleniyor...' : 'Checking for updates...' });
      const res = await window.electronAPI.checkForUpdates();
      if (res && !res.success) {
        setUpdateState({ status: 'error', message: language === 'tr' ? `Güncelleme denetleme başarısız: ${res.error}` : `Update check failed: ${res.error}` });
      }
    } else {
      setUpdateState({ status: 'error', message: language === 'tr' ? 'Electron API bulunamadı.' : 'Electron API not found.' });
    }
  }, [language]);

  const handleDownloadUpdate = async () => {
    if (window.electronAPI && window.electronAPI.downloadUpdate) {
      setUpdateState(prev => ({
        ...prev,
        status: 'downloading',
        message: language === 'tr' ? 'Güncelleme indiriliyor...' : 'Downloading update...',
        progress: 0
      }));
      const res = await window.electronAPI.downloadUpdate();
      if (res && !res.success) {
        setUpdateState({ status: 'error', message: language === 'tr' ? `Güncelleme indirilemedi: ${res.error}` : `Update download failed: ${res.error}` });
      }
    } else {
      setUpdateState({ status: 'error', message: language === 'tr' ? 'Electron API bulunamadı.' : 'Electron API not found.' });
    }
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI && window.electronAPI.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  const [autoPlayNext, setAutoPlayNext] = useState(() => {
    try { return localStorage.getItem('strmly_auto_play_next') === 'true'; } catch { return false; }
  });

  const [bufferEnabled, setBufferEnabled] = useState(() => {
    try { return localStorage.getItem('strmly_buffer_enabled') === 'true'; } catch { return false; }
  });
  const [hwAccelerationEnabled, setHwAccelerationEnabled] = useState(() => {
    try { return localStorage.getItem('strmly_hw_acceleration_enabled') !== 'false'; } catch { return true; }
  });
  const [appVersion, setAppVersion] = useState('1.5.17');
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
    }
  }, []);
  const [bufferSize, setBufferSize] = useState(() => {
    try { return localStorage.getItem('strmly_buffer_size') || '30'; } catch { return '30'; }
  });
  const [connectionTimeout, setConnectionTimeout] = useState(() => {
    try { return localStorage.getItem('strmly_connection_timeout') || '10'; } catch { return '10'; }
  });
  const [retryCount, setRetryCount] = useState(() => {
    try { return localStorage.getItem('strmly_retry_count') || '3'; } catch { return '3'; }
  });
  const [uiScale, setUiScale] = useState(() => {
    try { return localStorage.getItem('strmly_ui_scale') || 'medium'; } catch { return 'medium'; }
  });
  const [backgroundGrain, setBackgroundGrain] = useState(() => {
    try { return localStorage.getItem('strmly_background_grain') === 'true'; } catch { return false; }
  });


  const changeUiScale = (scale: 'small' | 'medium' | 'large') => {
    setUiScale(scale);
    try {
      localStorage.setItem('strmly_ui_scale', scale);
      if (scale === 'small') {
        document.documentElement.style.fontSize = '14px';
      } else if (scale === 'large') {
        document.documentElement.style.fontSize = '18.5px';
      } else {
        document.documentElement.style.fontSize = '16px';
      }
    } catch (e) {
      console.warn('localStorage scale save error:', e);
    }
  };

  const toggleGrainOverlay = (enabled: boolean) => {
    setBackgroundGrain(enabled);
    try {
      localStorage.setItem('strmly_background_grain', String(enabled));
      const existing = document.getElementById('strmly-grain-overlay');
      if (enabled) {
        if (!existing) {
          const el = document.createElement('div');
          el.id = 'strmly-grain-overlay';
          el.className = 'grain-overlay';
          document.body.appendChild(el);
        }
      } else {
        if (existing) {
          existing.remove();
        }
      }
    } catch (e) {
      console.warn('localStorage grain save error:', e);
    }
  };

  const tabs = [
    { id: 'players', label: t('settings.tabs.players'), icon: Activity },
    { id: 'playlists', label: t('settings.tabs.playlists'), icon: Database },
    { id: 'categories', label: t('settings.tabs.categories'), icon: EyeOff },
    { id: 'downloads', label: language === 'tr' ? 'Kaydedilenler' : 'Saved', icon: Download },
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'playback', label: t('settings.tabs.playback'), icon: Check },
    { id: 'network', label: t('settings.tabs.network'), icon: UploadCloud },
    { id: 'data', label: t('settings.tabs.data'), icon: HardDrive },
    { id: 'about', label: t('settings.tabs.about'), icon: Info }
  ];

  const activeTab = tabs.find(tab => tab.id === activeSettingsTab) || tabs[0];

  useEffect(() => {
    if (activeTab.id !== 'about' || hasAutoCheckedUpdatesRef.current) return;
    hasAutoCheckedUpdatesRef.current = true;
    void handleCheckUpdates();
  }, [activeTab.id, handleCheckUpdates]);

  const categoryTotal = safeHiddenCategories.length + safeHiddenSeriesCategories.length + safeHiddenMovieCategories.length;



  const saveLocalSetting = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage save error:', e);
    }
  };

  const exportSettings = () => {
    try {
      const settings: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) settings[key] = localStorage.getItem(key);
      }

      const worker = new Worker(new URL('../utils/settings.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const { success, result } = e.data;
        if (success) {
          const blob = new Blob([result], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `strmly-settings-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          onShowToast(language === 'tr' ? 'Ayarlar dışa aktarıldı.' : 'Settings exported.');
        } else {
          onShowToast(language === 'tr' ? 'Dışa aktarma hatası.' : 'Export error.');
        }
        worker.terminate();
      };
      worker.postMessage({ type: 'export', payload: settings });
    } catch {
      onShowToast(language === 'tr' ? 'Dışa aktarma hatası.' : 'Export error.');
    }
  };

  const importSettings = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const worker = new Worker(new URL('../utils/settings.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
          const { success, result, error } = e.data;
          if (success) {
            Object.entries(result).forEach(([key, value]) => {
              localStorage.setItem(key, String(value));
            });
            onShowToast(language === 'tr' ? 'Ayarlar içe aktarıldı. Uygulamayı yenileyin.' : 'Settings imported. Please refresh the app.');
          } else {
            onShowToast(language === 'tr' ? `İçe aktarma hatası: ${error}` : `Import error: ${error}`);
          }
          worker.terminate();
        };
        worker.postMessage({ type: 'import', payload: reader.result as string });
      } catch {
        onShowToast(language === 'tr' ? 'İçe aktarma hatası.' : 'Import error.');
      }
    };
    reader.readAsText(file);
  };

  const renderPlaylistCard = (playlist: SavedPlaylist) => {
    const isActive = playlist.id === activePlaylistId;
    return (
      <div
        key={playlist.id}
        className={`rounded-2xl border p-4.5 transition-all duration-200 ${
          isActive
            ? 'border-[var(--accent-color)]/30 bg-white/[0.03]'
            : 'border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <button type="button" className="min-w-0 text-left cursor-pointer flex-1 group/play" onClick={() => onSelectPlaylist(playlist.id)}>
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-bold text-white group-hover/play:text-[var(--accent-color)] transition-colors">{playlist.name}</span>
              {isActive && (
                <span className="rounded bg-[var(--accent-color)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">
                  {language === 'tr' ? 'Aktif' : 'Active'}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs font-medium text-neutral-500">
              {playlist.channelCount || 0} {language === 'tr' ? 'içerik' : 'items'} • {playlist.groupCount || playlist.groups?.length || 0} {language === 'tr' ? 'grup' : 'groups'}
            </div>
          </button>
          <div className="flex shrink-0 gap-1.5">
            <button type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              disabled={isParsing}
              onClick={() => onRefreshPlaylist(playlist)}
              title={language === 'tr' ? 'Listeyi Güncelle' : 'Update Playlist'}
             aria-label={language === 'tr' ? 'Listeyi Güncelle' : 'Update Playlist'}>
              <RefreshCw size={12} className={isParsing && isActive ? 'animate-spin text-[var(--accent-color)]' : ''} />
            </button>
            <button type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/15 bg-red-950/15 text-red-300 hover:bg-red-900/20 transition-all active:scale-95 cursor-pointer"
              onClick={() => onDeletePlaylist(playlist.id)}
              title={language === 'tr' ? 'Listeyi Sil' : 'Delete Playlist'}
             aria-label={language === 'tr' ? 'Listeyi Sil' : 'Delete Playlist'}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Otomatik Güncelleme' : 'Auto Update'}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {UPDATE_OPTIONS.map(option => (
              <button type="button"
                key={option.value}
                className={`h-7.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  (playlist.autoUpdateIntervalHours || 24) === option.value
                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-black shadow-sm font-black'
                    : 'border-white/5 bg-white/[0.01] text-neutral-400 hover:border-white/12 hover:bg-white/[0.03] hover:text-white'
                }`}
                onClick={() => onUpdatePlaylistAutoUpdateInterval(playlist.id, option.value)}
              >
                {option.value === 6 ? (language === 'tr' ? '6 Sa' : '6h') :
                 option.value === 12 ? (language === 'tr' ? '12 Sa' : '12h') :
                 option.value === 24 ? (language === 'tr' ? '24 Sa' : '24h') :
                 (language === 'tr' ? '7 G' : '7d')}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHiddenGroup = (
    title: string,
    icon: React.ComponentType<{ size?: number; className?: string }>,
    groups: string[],
    restore: (name: string) => void,
    colorClass: string
  ) => {
    const q = categorySearch.trim().toLocaleLowerCase('tr-TR');
    const filtered = q 
      ? groups.filter(g => g.toLocaleLowerCase('tr-TR').includes(q))
      : groups;

    return (
      <div className="rounded-2xl border border-white/5 bg-neutral-900/10 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.005] px-5 py-4 select-none">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-white/[0.03] border border-white/5 ${colorClass} flex items-center justify-center`}>
              {React.createElement(icon, { size: 16 })}
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">{title}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">{groups.length} kategori gizli</div>
            </div>
          </div>
          {q && (
            <div className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5 text-neutral-400">
              {filtered.length} {language === 'tr' ? 'eşleşti' : 'matched'}
            </div>
          )}
        </div>
        <div className="p-5">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center opacity-65">
              <Eye className="text-neutral-500 mb-2.5" size={22} />
              <div className="text-xs font-bold text-neutral-300">{language === 'tr' ? 'Gizli kategori bulunmuyor' : 'No hidden categories'}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">{language === 'tr' ? 'Bu bölümdeki tüm kategoriler şu an görünür durumda.' : 'All categories in this section are currently visible.'}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-neutral-500 italic text-center py-6">{language === 'tr' ? 'Arama kriterinize uygun gizli kategori bulunamadı.' : 'No hidden categories found matching your search criteria.'}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1 hide-scrollbar">
              {filtered.map(group => (
                <div 
                  key={`${title}-${group}`}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/[0.015] hover:bg-white/[0.035] hover:border-white/10 transition-all duration-200 shadow-md group/card"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <EyeOff size={14} className="text-neutral-500 group-hover/card:text-neutral-300 transition-colors shrink-0" />
                    <span className="text-xs font-semibold text-neutral-300 group-hover/card:text-white transition-colors truncate" title={group}>
                      {group}
                    </span>
                  </div>
                  <button type="button"
                    onClick={() => restore(group)}
                    className="inline-flex h-7.5 items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/10 transition-all cursor-pointer shrink-0"
                    title={language === 'tr' ? 'Kategoriyi Göster' : 'Show Category'}
                   aria-label={language === 'tr' ? 'Kategoriyi Göster' : 'Show Category'}>
                    <Eye size={11} className="shrink-0" />
                    <span>{language === 'tr' ? 'Göster' : 'Show'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="settings-redesign pb-10 text-[14px] leading-relaxed text-neutral-200 page-transition-enter">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]/70">Strmly</span>
          <h1 className="text-2xl font-black tracking-tight text-white leading-none mt-0.5">{t('settings.title')}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.01] p-1 select-none backdrop-blur-md">
          <div className="px-3 py-1 text-center border-r border-white/5 last:border-r-0">
            <span className="block text-[8px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Liste' : 'Playlists'}</span>
              <span className="block mt-0.5 text-sm font-black text-white">{safePlaylists.length}</span>
          </div>
          <div className="px-3 py-1 text-center border-r border-white/5 last:border-r-0">
            <span className="block text-[8px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'İçerik' : 'Items'}</span>
            <span className="block mt-0.5 text-sm font-black text-white">{itemStats.total}</span>
          </div>
          <div className="px-3 py-1 text-center last:border-r-0">
            <span className="block text-[8px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Gizli' : 'Hidden'}</span>
            <span className="block mt-0.5 text-sm font-black text-white">{categoryTotal}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] rounded-[24px] border border-white/5 bg-white/[0.015] backdrop-blur-2xl shadow-2xl overflow-hidden min-h-[600px]">
        <aside className="border-b lg:border-b-0 lg:border-r border-white/5 bg-black/15 p-4 flex flex-col gap-0.5 select-none w-full shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 px-3 mb-2 hidden lg:block">{language === 'tr' ? 'Menü' : 'Menu'}</span>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const selected = activeTab.id === tab.id;
            return (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveSettingsTab(tab.id)}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-bold transition-all duration-200 cursor-pointer border ${
                  selected
                    ? 'bg-white/[0.05] text-[var(--accent-color)] border-white/10 shadow-sm'
                    : 'text-neutral-400 hover:bg-white/[0.02] hover:text-white border-transparent'
                }`}
              >
                <Icon size={14} className={selected ? 'text-[var(--accent-color)]' : 'text-neutral-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>
        <section className="p-6 md:p-8 overflow-y-auto max-h-[72vh] bg-black/5">
          {activeTab.id === 'players' && (
            <>
              <PageHeader 
                title={language === 'tr' ? 'Genel Ayarlar' : 'General Settings'} 
                description={language === 'tr' ? 'Varsayılan oynatma motorunu, dil ve medya API ayarlarını buradan yönetin.' : 'Manage default player, language, and media API settings here.'} 
              />
              <div>
                <SettingRow title={t('settings.appearance.language')} description={t('settings.appearance.languageDesc')}>
                  <CustomSelect
                    value={language}
                    onChange={(val) => {
                      setLanguage(val as any);
                      onShowToast(val === 'tr' ? 'Dil Türkçe olarak ayarlandı.' : 'Language set to English.');
                    }}
                    options={[
                      { value: 'tr', label: 'Türkçe' },
                      { value: 'en', label: 'English' }
                    ]}
                  />
                </SettingRow>

                <SettingRow title={t('settings.players.title')} description={t('settings.players.desc')}>
                  <CustomSelect
                    value={defaultPlayer}
                    onChange={(val) => {
                      setDefaultPlayer(val);
                      onSaveSetting('cinema_default_player', val);
                      onShowToast(`${t('settings.players.saveSuccess')} (${val.toUpperCase()})`);
                    }}
                    options={[
                      { value: 'internal', label: t('settings.players.internal') },
                      { value: 'vlc', label: `VLC Player (${language === 'tr' ? 'Harici' : 'External'})` },
                      { value: 'mpv', label: `MPV Player (${language === 'tr' ? 'Harici' : 'External'})` }
                    ]}
                  />
                </SettingRow>

 
              </div>
            </>
          )}

          {activeTab.id === 'downloads' && (
            <>
              <PageHeader
                title={language === 'tr' ? 'Kaydedilenler' : 'Saved'}
                description={language === 'tr' ? 'İndirdiğiniz ve kaydettiğiniz medyaları tam ekran yöneticide düzenleyin.' : 'Manage your downloaded and saved media in the full-screen manager.'}
              />
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-md shadow-xl py-12">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 text-[var(--accent-color)] shadow-lg shadow-[var(--accent-color)]/5 animate-pulse-slow">
                    <Download size={28} />
                  </div>
                  <h3 className="text-base font-black text-white tracking-wide">
                    {language === 'tr' ? 'Gelişmiş İndirme Yöneticisi' : 'Advanced Download Manager'}
                  </h3>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-neutral-400 font-medium">
                    {language === 'tr'
                      ? 'İndirme hızlarını takip etmek, disk alanı durumunu kontrol etmek ve tüm indirmelerinizi modern bir arayüzle yönetmek için tam ekran indirme yöneticisini açın.'
                      : 'Open the full-screen download manager to track download speeds, monitor disk space usage, and manage all your downloads in a modern interface.'}
                  </p>

                  {downloads.length > 0 && (
                    <div className="mt-6 mb-8 flex gap-6 px-6 py-3.5 rounded-xl bg-black/30 border border-white/5">
                      <div className="text-center">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Ögeler' : 'Items'}</span>
                        <span className="block mt-0.5 text-sm font-black text-white">{downloads.length}</span>
                      </div>
                      <div className="w-px bg-white/5" />
                      <div className="text-center">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Durum' : 'Status'}</span>
                        <span className="block mt-0.5 text-sm font-black text-emerald-400">
                          {downloads.filter(d => d.status === 'completed').length} {language === 'tr' ? 'Hazır' : 'Ready'}
                        </span>
                      </div>
                    </div>
                  )}

                  <button type="button"
                    onClick={() => onNavigate?.('İndirilenler')}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent-color)] px-6 text-xs font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-[var(--accent-color)]/10"
                  >
                    <Download size={14} strokeWidth={2.5} />
                    <span>{language === 'tr' ? 'Kaydedilenleri Yönet' : 'Manage Saved Media'}</span>
                  </button>
                </div>

                {/* Kayıt Konumu Ayarı */}
                <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-md shadow-xl flex flex-col gap-4 text-left animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
                      <HardDrive size={16} className="text-[var(--accent-color)]" />
                      <span>{language === 'tr' ? 'Kayıt Klasörü' : 'Save Directory'}</span>
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                      {language === 'tr'
                        ? 'Dizi ve filmlerin indirileceği varsayılan disk konumunu seçin.'
                        : 'Choose the default storage directory for your movies and series downloads.'}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/5 text-xs text-neutral-300 font-mono select-text truncate">
                      {downloadsFolder || (language === 'tr' ? 'Yükleniyor...' : 'Loading...')}
                    </div>
                    <button type="button"
                      onClick={async () => {
                        if (!window.electronAPI?.selectDownloadsFolder) return;
                        const res = await window.electronAPI.selectDownloadsFolder();
                        if (!res.canceled && res.filePath && res.selectionToken) {
                          setPendingDownloadsFolder(res.filePath);
                          setPendingDownloadsFolderToken(res.selectionToken);
                          setShowMoveDownloadsPrompt(true);
                        }
                      }}
                      className="h-11 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>{language === 'tr' ? 'Konumu Değiştir' : 'Change Location'}</span>
                    </button>
                  </div>
                </div>

                {/* HLS download tuning */}
                <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-md shadow-xl flex flex-col gap-5 text-left animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
                      <Activity size={16} className="text-[var(--accent-color)]" />
                      <span>{language === 'tr' ? 'İndirme Performansı' : 'Download Performance'}</span>
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                      {language === 'tr'
                        ? 'HLS indirmelerde eşzamanlı segment sayısı ve tercih edilen maksimum kalite. Aynı anda yalnızca bir indirme işi çalışır (IPTV hesabı güvenliği).'
                        : 'Concurrent HLS segments and preferred max quality. Only one download job runs at a time (IPTV account safety).'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        {language === 'tr' ? 'Segment paralelliği' : 'Segment concurrency'}
                      </span>
                      <CustomSelect
                        value={String(segmentConcurrency)}
                        onChange={(v) => {
                          const n = Math.min(8, Math.max(1, Number(v) || 6));
                          setSegmentConcurrency(n);
                          onSaveSetting('cinema_download_segment_concurrency', n);
                          onShowToast(
                            language === 'tr'
                              ? `Segment paralelliği: ${n}`
                              : `Segment concurrency: ${n}`,
                          );
                        }}
                        options={[1, 2, 3, 4, 6, 8].map((n) => ({
                          value: String(n),
                          label: language === 'tr' ? `${n} bağlantı` : `${n} connections`,
                        }))}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        {language === 'tr' ? 'Maks. kalite (master HLS)' : 'Max quality (master HLS)'}
                      </span>
                      <CustomSelect
                        value={String(downloadMaxHeight)}
                        onChange={(v) => {
                          const n = Number(v) || 1080;
                          setDownloadMaxHeight(n);
                          onSaveSetting('cinema_download_max_height', n);
                          onShowToast(
                            language === 'tr'
                              ? `İndirme kalitesi: ${n}p`
                              : `Download quality: ${n}p`,
                          );
                        }}
                        options={[
                          { value: '480', label: '480p' },
                          { value: '720', label: '720p' },
                          { value: '1080', label: '1080p' },
                          { value: '2160', label: language === 'tr' ? 'En iyi (4K’ya kadar)' : 'Best (up to 4K)' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab.id === 'playlists' && (
            <>
              <PageHeader 
                title={t('settings.playlists.title')} 
                description={language === 'tr' ? 'M3U ve Xtream kaynaklarını ekleyin, aktif listeyi seçin ve otomatik güncelleme aralığını belirleyin.' : 'Add M3U and Xtream sources, select the active playlist, and set the auto-update interval.'} 
              />
              <div className="mb-5 flex justify-end">
                <button type="button" className={showAddPlaylistForm ? secondaryButton : primaryButton} onClick={() => setShowAddPlaylistForm(!showAddPlaylistForm)}>
                  {showAddPlaylistForm ? <X size={14} /> : <Plus size={14} />}
                  {showAddPlaylistForm ? t('common.close') : t('settings.playlists.addPlaylist')}
                </button>
              </div>

              {showAddPlaylistForm && (
                <div className="rounded-2xl border border-white/5 p-5 mb-5 bg-white/[0.005] animate-scale-in">
                  <div className="mb-4 inline-grid grid-cols-2 w-full max-w-[200px] rounded-lg border border-white/8 bg-black/40 p-0.5">
                    <button type="button"
                      className={`h-7.5 rounded text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        playlistMode === 'xtream'
                          ? 'bg-white text-black shadow-sm font-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      onClick={() => setPlaylistMode('xtream')}
                    >
                      Xtream
                    </button>
                    <button type="button"
                      className={`h-7.5 rounded text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        playlistMode === 'm3u'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      onClick={() => setPlaylistMode('m3u')}
                    >
                      M3U
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="md:col-span-2">
                      <div className={labelStyle}>{t('settings.playlists.playlistName')}</div>
                      <input className={`${fieldStyle} mt-1.5 w-full md:w-full`} value={playlistFormName} onChange={(e) => setPlaylistFormName(e.target.value)} placeholder={language === 'tr' ? 'Örn: Ev Sineması, Spor Listem' : 'e.g., Home Cinema, My Playlist'} />
                    </label>

                    {playlistMode === 'm3u' ? (
                      <>
                        <label className="md:col-span-2">
                          <div className={labelStyle}>{language === 'tr' ? 'M3U URL Adresi' : 'M3U URL Address'}</div>
                          <input className={`${fieldStyle} mt-1.5 w-full md:w-full`} value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} placeholder="http://example.com/playlist.m3u" />
                        </label>
                        <div className="flex flex-col gap-2.5 md:col-span-2 sm:flex-row mt-1">
                          <button type="button" className={primaryButton} disabled={isParsing || !m3uUrl.trim()} onClick={onPlaylistLoadFromUrl}>
                            {isParsing ? t('common.loading') : (language === 'tr' ? 'URL İndir' : 'Download URL')}
                          </button>
                          <label className={secondaryButton}>
                            {t('profiles.importLocalFile')}
                            <input type="file" accept=".m3u" onChange={onPlaylistLoadLocal} className="hidden" />
                          </label>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="md:col-span-2">
                          <div className={labelStyle}>{language === 'tr' ? 'Sunucu Adresi' : 'Server Address'}</div>
                          <input className={`${fieldStyle} mt-1.5 w-full md:w-full`} value={xtreamUrl} onChange={(e) => setXtreamUrl(e.target.value)} placeholder="http://server-address.com:8080" />
                        </label>
                        <label>
                          <div className={labelStyle}>{t('profiles.xtreamUser')}</div>
                          <input className={`${fieldStyle} mt-1.5 w-full md:w-full`} value={xtreamUser} onChange={(e) => setXtreamUser(e.target.value)} placeholder={language === 'tr' ? 'Kullanıcı adı' : 'Username'} />
                        </label>
                        <label>
                          <div className={labelStyle}>{t('profiles.xtreamPass')}</div>
                          <input className={`${fieldStyle} mt-1.5 w-full md:w-full`} type="password" value={xtreamPass} onChange={(e) => setXtreamPass(e.target.value)} placeholder={language === 'tr' ? 'Şifre' : 'Password'} />
                        </label>
                        <button type="button" className={`${primaryButton} md:col-span-2 mt-1`} disabled={isParsing || !xtreamUrl.trim() || !xtreamUser.trim() || !xtreamPass.trim()} onClick={onXtreamLoad}>
                          {isParsing ? (language === 'tr' ? 'Bağlanılıyor...' : 'Connecting...') : (language === 'tr' ? 'Xtream ile Giriş Yap' : 'Login with Xtream')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {safePlaylists.length === 0 ? (
                <EmptyState 
                  icon={UploadCloud} 
                  title={t('settings.playlists.noPlaylists')} 
                  description={language === 'tr' ? 'Listenizi M3U URL\'i veya Xtream API ile ekledikten sonra kanallarınız ve kataloglarınız burada listelenecektir.' : 'After adding your list via M3U URL or Xtream API, your channels and catalogs will be listed here.'} 
                />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">{safePlaylists.map(renderPlaylistCard)}</div>
              )}
            </>
          )}

          {activeTab.id === 'categories' && (
            <>
              <PageHeader title={language === 'tr' ? "Gizli Kategoriler" : "Hidden Categories"} description={language === 'tr' ? "Daha önce ana ekranda veya listelerde gizlediğiniz tüm kategorileri buradan geri getirebilirsiniz." : "You can restore all categories that you previously hid on the main screen or lists from here."} />
              
              {/* Kategori İstatistik Kartları */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <button type="button"
                  onClick={() => setCategorySubTab(categorySubTab === 'live' ? 'all' : 'live')}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-150 hover:translate-y-[-2px] cursor-pointer ${
                    categorySubTab === 'live'
                      ? 'border-indigo-500/30 bg-indigo-500/5 shadow-[0_8px_30px_rgba(99,102,241,0.1)]'
                      : 'border-white/5 bg-white/[0.01] hover:border-indigo-500/20 hover:bg-indigo-500/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl border transition-all ${
                      categorySubTab === 'live' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-white/[0.03] border-white/5 text-neutral-400 group-hover:text-indigo-400'
                    }`}>
                      <Tv size={18} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-400/10 px-2.5 py-0.5 rounded-full select-none">{language === 'tr' ? 'Canlı TV' : 'Live TV'}</span>
                  </div>
                  <div className="mt-4">
                    <span className="block text-2xl font-black tracking-tight text-white leading-none">
                      {safeHiddenCategories.length}
                    </span>
                    <span className="block mt-1 text-[11px] font-medium text-neutral-400">{language === 'tr' ? 'Gizli Kategori' : 'Hidden Category'}</span>
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-indigo-500/10 opacity-30 blur-xl group-hover:scale-150 transition-transform duration-500" />
                </button>

                <button type="button"
                  onClick={() => setCategorySubTab(categorySubTab === 'series' ? 'all' : 'series')}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-150 hover:translate-y-[-2px] cursor-pointer ${
                    categorySubTab === 'series'
                      ? 'border-pink-500/30 bg-pink-500/5 shadow-[0_8px_30px_rgba(244,63,94,0.1)]'
                      : 'border-white/5 bg-white/[0.01] hover:border-pink-500/20 hover:bg-pink-500/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl border transition-all ${
                      categorySubTab === 'series' ? 'bg-pink-500/20 border-pink-500/30 text-pink-400' : 'bg-white/[0.03] border-white/5 text-neutral-400 group-hover:text-pink-400'
                    }`}>
                      <Video size={18} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-pink-400 bg-pink-400/10 px-2.5 py-0.5 rounded-full select-none">{language === 'tr' ? 'Dizi' : 'Series'}</span>
                  </div>
                  <div className="mt-4">
                    <span className="block text-2xl font-black tracking-tight text-white leading-none">
                      {safeHiddenSeriesCategories.length}
                    </span>
                    <span className="block mt-1 text-[11px] font-medium text-neutral-400">{language === 'tr' ? 'Gizli Kategori' : 'Hidden Category'}</span>
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-pink-500/10 opacity-30 blur-xl group-hover:scale-150 transition-transform duration-500" />
                </button>

                <button type="button"
                  onClick={() => setCategorySubTab(categorySubTab === 'movie' ? 'all' : 'movie')}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-150 hover:translate-y-[-2px] cursor-pointer ${
                    categorySubTab === 'movie'
                      ? 'border-amber-500/30 bg-amber-500/5 shadow-[0_8px_30px_rgba(245,158,11,0.1)]'
                      : 'border-white/5 bg-white/[0.01] hover:border-amber-500/20 hover:bg-amber-500/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl border transition-all ${
                      categorySubTab === 'movie' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-white/[0.03] border-white/5 text-neutral-400 group-hover:text-amber-400'
                    }`}>
                      <Film size={18} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full select-none">{language === 'tr' ? 'Film' : 'Movie'}</span>
                  </div>
                  <div className="mt-4">
                    <span className="block text-2xl font-black tracking-tight text-white leading-none">
                      {safeHiddenMovieCategories.length}
                    </span>
                    <span className="block mt-1 text-[11px] font-medium text-neutral-400">{language === 'tr' ? 'Gizli Kategori' : 'Hidden Category'}</span>
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-amber-500/10 opacity-30 blur-xl group-hover:scale-150 transition-transform duration-500" />
                </button>
              </div>

              {/* Filtre ve Arama Araç Çubuğu */}
              <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/[0.01] border border-white/5 p-4 rounded-2xl select-none">
                <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto hide-scrollbar shrink-0">
                  <button type="button"
                    onClick={() => setCategorySubTab('all')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      categorySubTab === 'all'
                        ? 'bg-white/[0.06] text-[var(--accent-color)] border border-white/10 shadow-sm font-black'
                        : 'text-neutral-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    {language === 'tr' ? 'Tümü' : 'All'} ({categoryTotal})
                  </button>
                  <button type="button"
                    onClick={() => setCategorySubTab('live')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      categorySubTab === 'live'
                        ? 'bg-white/[0.06] text-[var(--accent-color)] border border-white/10 shadow-sm font-black'
                        : 'text-neutral-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    {language === 'tr' ? 'Canlı TV' : 'Live TV'} ({safeHiddenCategories.length})
                  </button>
                  <button type="button"
                    onClick={() => setCategorySubTab('series')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      categorySubTab === 'series'
                        ? 'bg-white/[0.06] text-[var(--accent-color)] border border-white/10 shadow-sm font-black'
                        : 'text-neutral-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    {language === 'tr' ? 'Diziler' : 'Series'} ({safeHiddenSeriesCategories.length})
                  </button>
                  <button type="button"
                    onClick={() => setCategorySubTab('movie')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      categorySubTab === 'movie'
                        ? 'bg-white/[0.06] text-[var(--accent-color)] border border-white/10 shadow-sm font-black'
                        : 'text-neutral-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    {language === 'tr' ? 'Filmler' : 'Movies'} ({safeHiddenMovieCategories.length})
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder={language === 'tr' ? 'Gizli kategori ara...' : 'Search hidden categories...'}
                      className="w-full h-9 pl-9.5 pr-4 rounded-xl border border-white/5 bg-black/25 text-xs font-semibold text-white placeholder-neutral-500 focus:outline-none focus:border-white/12 focus:bg-black/35 transition-all"
                    />
                    {categorySearch && (
                      <button type="button" 
                        onClick={() => setCategorySearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                       aria-label="Close">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <button type="button"
                    className={`${secondaryButton} h-9 w-full sm:w-auto flex items-center justify-center gap-2`}
                    onClick={() => {
                      if (categorySubTab === 'all' || categorySubTab === 'live') onResetHiddenCategories();
                      if (categorySubTab === 'all' || categorySubTab === 'series') onResetHiddenSeriesCategories();
                      if (categorySubTab === 'all' || categorySubTab === 'movie') onResetHiddenMovieCategories();
                      setCategorySearch('');
                    }}
                    disabled={
                      (categorySubTab === 'all' && categoryTotal === 0) ||
                      (categorySubTab === 'live' && safeHiddenCategories.length === 0) ||
                      (categorySubTab === 'series' && safeHiddenSeriesCategories.length === 0) ||
                      (categorySubTab === 'movie' && safeHiddenMovieCategories.length === 0)
                    }
                   aria-label="View">
                    <Eye size={13} /> {language === 'tr' ? 'Seçilileri Göster' : 'Show Selected'}
                  </button>
                </div>
              </div>

              <div className="grid gap-5">
                {(categorySubTab === 'all' || categorySubTab === 'live') && 
                  renderHiddenGroup(language === 'tr' ? 'Canlı TV Kategorileri' : 'Live TV Categories', Tv, safeHiddenCategories, onRestoreCategory, 'text-indigo-400')
                }
                {(categorySubTab === 'all' || categorySubTab === 'series') && 
                  renderHiddenGroup(language === 'tr' ? 'Dizi Kategorileri' : 'Series Categories', Video, safeHiddenSeriesCategories, onRestoreSeriesCategory, 'text-pink-400')
                }
                {(categorySubTab === 'all' || categorySubTab === 'movie') && 
                  renderHiddenGroup(language === 'tr' ? 'Film Kategorileri' : 'Movie Categories', Film, safeHiddenMovieCategories, onRestoreMovieCategory, 'text-amber-400')
                }
              </div>
            </>
          )}

          {activeTab.id === 'appearance' && (
            <>
              <PageHeader title={t('settings.appearance.title')} description={t('settings.appearance.desc')} />
              <div>
                <SettingRow title={t('settings.appearance.theme')} description={t('settings.appearance.themeDesc')} vertical={true}>
                  <div className="grid max-w-4xl gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
                    {THEMES.map(theme => {
                      const isActive = activeTheme === theme.id;
                      
                      let bgGradientClass = '';
                      let sidebarBgClass = '';
                      let glowClass = '';

                      if (theme.id === 'space-black') {
                        bgGradientClass = 'from-black via-[#050508] to-[#12121c]';
                        sidebarBgClass = 'bg-[#07070a]/70';
                        glowClass = 'bg-white';
                      } else if (theme.id === 'deep-space') {
                        bgGradientClass = 'from-black via-[#03030d] to-[#0f113a]';
                        sidebarBgClass = 'bg-[#060616]/70';
                        glowClass = 'bg-purple-500';
                      } else if (theme.id === 'slate-dark') {
                        bgGradientClass = 'from-[#020306] via-[#070a12] to-[#161f2e]';
                        sidebarBgClass = 'bg-[#0b1122]/70';
                        glowClass = 'bg-teal-500';
                      } else if (theme.id === 'forest-mint') {
                        bgGradientClass = 'from-black via-[#022c22] to-[#064e3b]';
                        sidebarBgClass = 'bg-[#022c22]/70';
                        glowClass = 'bg-emerald-500';
                      } else if (theme.id === 'sunset-orange') {
                        bgGradientClass = 'from-black via-[#1c0c02] to-[#451a03]';
                        sidebarBgClass = 'bg-[#140801]/70';
                        glowClass = 'bg-orange-500';
                      } else if (theme.id === 'midnight-purple') {
                        bgGradientClass = 'from-black via-[#0f052d] to-[#2e1065]';
                        sidebarBgClass = 'bg-[#0b0321]/70';
                        glowClass = 'bg-pink-500';
                      } else if (theme.id === 'nordic-frost') {
                        bgGradientClass = 'from-black via-[#020617] to-[#0f172a]';
                        sidebarBgClass = 'bg-[#0b0f19]/70';
                        glowClass = 'bg-sky-400';
                      } else if (theme.id === 'rose-gold') {
                        bgGradientClass = 'from-black via-[#11050a] to-[#2d121c]';
                        sidebarBgClass = 'bg-[#14050b]/70';
                        glowClass = 'bg-rose-400';
                      } else if (theme.id === 'crimson-tide') {
                        bgGradientClass = 'from-black via-[#110104] to-[#3f0712]';
                        sidebarBgClass = 'bg-[#140105]/70';
                        glowClass = 'bg-rose-600';
                      } else if (theme.id === 'ocean-abyss') {
                        bgGradientClass = 'from-black via-[#021a1b] to-[#042f2e]';
                        sidebarBgClass = 'bg-[#011819]/70';
                        glowClass = 'bg-teal-600';
                      }
                      
                      return (
                        <button type="button"
                          key={theme.id}
                          onClick={() => {
                            setActiveTheme(theme.id);
                            onSaveSetting('cinema_theme', theme.id);
                          }}
                          className={`group/theme flex flex-col p-2.5 rounded-xl border text-left transition-all duration-300 hover:translate-y-[-2px] cursor-pointer ${
                            isActive
                              ? 'border-[var(--accent-color)] bg-white/[0.04] shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                              : 'border-white/5 bg-white/[0.005] hover:border-white/12 hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className={`w-full h-16 rounded-lg bg-gradient-to-tr ${bgGradientClass} border border-white/5 mb-2 relative overflow-hidden flex`}>
                            <div className={`w-3.5 h-full border-r border-white/5 flex flex-col items-center py-1.5 gap-1 select-none shrink-0 ${sidebarBgClass}`}>
                              <div className="w-1.5 h-1.5 rounded bg-white/40" />
                              <div className="w-1.5 h-1 rounded-sm bg-white/20" />
                              <div className="w-1.5 h-1 rounded-sm bg-white/20" />
                              <div className="w-1.5 h-1 rounded-sm bg-white/20" />
                            </div>
                            <div className="flex-1 h-full p-1.5 flex flex-col gap-1.5 justify-between select-none">
                              <div className="flex justify-between items-center">
                                <div className="w-4 h-1 rounded bg-white/30" />
                                <div className="w-2 h-1 rounded bg-white/30" />
                              </div>
                              <div className="w-full h-4 rounded bg-white/5 border border-white/[0.03] flex items-center px-1">
                                <div className="w-3 h-0.5 rounded bg-white/20" />
                              </div>
                              <div className="grid grid-cols-3 gap-1">
                                <div className="h-4 rounded-sm bg-white/10" />
                                <div className="h-4 rounded-sm bg-white/10" />
                                <div className="h-4 rounded-sm bg-white/10" />
                              </div>
                            </div>
                            <div className={`absolute -top-6 -right-6 w-12 h-12 rounded-full opacity-40 blur-md pointer-events-none ${glowClass}`} />
                            {isActive && (
                              <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center animate-fade-in">
                                <div className="w-6 h-6 rounded-full bg-[var(--accent-color)] text-black flex items-center justify-center shadow-lg transform scale-110">
                                  <Check size={12} strokeWidth={4} />
                                </div>
                              </div>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-[var(--accent-color)] font-black' : 'text-neutral-400 group-hover/theme:text-white'}`}>
                            {theme.id === 'space-black' ? (language === 'tr' ? 'OLED Siyah' : 'OLED Space Black') :
                             theme.id === 'deep-space' ? (language === 'tr' ? 'Gece Mavisi' : 'Deep Space Blue') :
                             theme.id === 'slate-dark' ? (language === 'tr' ? 'Koyu Slate' : 'Slate Dark') :
                             theme.id === 'forest-mint' ? (language === 'tr' ? 'Orman Yeşili' : 'Forest Mint') :
                             theme.id === 'sunset-orange' ? (language === 'tr' ? 'Günbatımı Kızılı' : 'Sunset Orange') :
                             theme.id === 'midnight-purple' ? (language === 'tr' ? 'Gece Yarısı Moru' : 'Midnight Purple') :
                             theme.id === 'nordic-frost' ? (language === 'tr' ? 'Kutup Esintisi' : 'Nordic Frost') :
                             theme.id === 'rose-gold' ? (language === 'tr' ? 'Sakura Pembesi' : 'Sakura Blossom') :
                             theme.id === 'crimson-tide' ? (language === 'tr' ? 'Kozmik Kızıl' : 'Cyberpunk Crimson') :
                             theme.id === 'ocean-abyss' ? (language === 'tr' ? 'Okyanus Derinliği' : 'Ocean Abyss') : theme.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </SettingRow>

                <SettingRow title={t('settings.appearance.accentColor')} description={t('settings.appearance.accentDesc')} vertical={true}>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_COLORS.map(item => (
                      <button type="button"
                        key={item.color}
                        className={`flex h-9 items-center gap-2 rounded-full border px-3 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          activeAccent === item.color
                            ? 'border-[var(--accent-color)] bg-white/[0.05] text-white font-bold'
                            : 'border-white/5 bg-white/[0.01] text-neutral-400 hover:border-white/12 hover:bg-white/[0.03] hover:text-white'
                        }`}
                        onClick={() => {
                          setActiveAccent(item.color);
                          onSaveSetting('cinema_accent', item.color);
                        }}
                      >
                        <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: item.color }} />
                        {language === 'tr' ? item.name : (
                          item.name === 'Beyaz' ? 'White' :
                          item.name === 'Mavi' ? 'Blue' :
                          item.name === 'Yeşil' ? 'Green' :
                          item.name === 'Sarı' ? 'Yellow' :
                          item.name === 'Mor' ? 'Purple' :
                          item.name === 'Kırmızı' ? 'Red' :
                          item.name === 'Pembe' ? 'Pink' : 'Cyan'
                        )}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow title={t('settings.appearance.glass')} description={t('settings.appearance.glassDesc')}>
                  <div className="inline-flex gap-0.5 p-0.5 rounded-lg border border-white/5 bg-black/30 select-none">
                    {['low', 'medium', 'high'].map(level => {
                      const isActive = glassIntensity === level;
                      return (
                        <button type="button"
                          key={level}
                          onClick={() => {
                            setGlassIntensity(level);
                            onSaveSetting('cinema_glass_intensity', level);
                          }}
                          className={`h-7 px-3.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            isActive
                              ? 'bg-white text-black shadow-sm font-black'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {level === 'low' ? (language === 'tr' ? 'Az' : 'Low') : 
                           level === 'medium' ? (language === 'tr' ? 'Orta' : 'Medium') : 
                           (language === 'tr' ? 'Yüksek' : 'High')}
                        </button>
                      );
                    })}
                  </div>
                </SettingRow>

                <SettingRow title={t('settings.appearance.cardSize')} description={t('settings.appearance.cardSizeDesc')}>
                  <div className="inline-flex gap-0.5 p-0.5 rounded-lg border border-white/5 bg-black/30 select-none">
                    {[
                      { id: 'small', label: language === 'tr' ? 'Küçük' : 'Small' },
                      { id: 'medium', label: language === 'tr' ? 'Orta' : 'Medium' },
                      { id: 'large', label: language === 'tr' ? 'Büyük' : 'Large' }
                    ].map(size => {
                      const isActive = cardLayoutSize === size.id;
                      return (
                        <button type="button"
                          key={size.id}
                          onClick={() => {
                            setCardLayoutSize(size.id);
                            onSaveSetting('cinema_card_layout_size', size.id);
                          }}
                          className={`h-7 px-3.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            isActive
                              ? 'bg-white text-black shadow-sm font-black'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {size.label}
                        </button>
                      );
                    })}
                  </div>
                </SettingRow>

                <SettingRow title={language === 'tr' ? 'Arayüz Ölçeği' : 'UI Scale'} description={language === 'tr' ? 'Uygulamanın genel yazı boyutu ve arayüz elemanlarının ölçeğini ayarlayın.' : 'Adjust the overall font size and interface element scaling.'}>
                  <div className="inline-flex gap-0.5 p-0.5 rounded-lg border border-white/5 bg-black/30 select-none">
                    {[
                      { id: 'small', label: language === 'tr' ? 'Küçük' : 'Small' },
                      { id: 'medium', label: language === 'tr' ? 'Orta' : 'Medium' },
                      { id: 'large', label: language === 'tr' ? 'Büyük' : 'Large' }
                    ].map(size => {
                      const isActive = uiScale === size.id;
                      return (
                        <button type="button"
                          key={size.id}
                          onClick={() => changeUiScale(size.id as 'small' | 'medium' | 'large')}
                          className={`h-7 px-3.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            isActive
                              ? 'bg-white text-black shadow-sm font-black'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {size.label}
                        </button>
                      );
                    })}
                  </div>
                </SettingRow>

                <SettingRow title={t('settings.appearance.neon')} description={t('settings.appearance.neonDesc')}>
                  <button type="button"
                    onClick={() => {
                      const next = !neonGlowEnabled;
                      setNeonGlowEnabled(next);
                      onSaveSetting('cinema_neon_glow', next);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 border focus:outline-none cursor-pointer ${
                      neonGlowEnabled
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                        : 'bg-white/[0.03] border-white/8'
                    }`}
                  >
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full transition-all duration-200 ${
                        neonGlowEnabled
                          ? 'left-5.5 bg-black'
                          : 'left-0.5 bg-neutral-400'
                      }`}
                    />
                  </button>
                </SettingRow>

                <SettingRow title={language === 'tr' ? 'Sinematik Film Greni' : 'Cinematic Film Grain'} description={language === 'tr' ? 'Arka plana hafif, hareketli hissettiren pürüzlü film dokusu katmanı ekler.' : 'Adds a subtle, moving textured film grain overlay to the background.'}>
                  <button type="button"
                    onClick={() => toggleGrainOverlay(!backgroundGrain)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 border focus:outline-none cursor-pointer ${
                      backgroundGrain
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                        : 'bg-white/[0.03] border-white/8'
                    }`}
                  >
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full transition-all duration-200 ${
                        backgroundGrain
                          ? 'left-5.5 bg-black'
                          : 'left-0.5 bg-neutral-400'
                      }`}
                    />
                  </button>
                </SettingRow>
              </div>
            </>
          )}

          {activeTab.id === 'playback' && (
            <>
              <PageHeader title="Oynatma Seçenekleri" description="Oynatıcı davranışları, ara bellek süreleri ve izleme akış ayarları." />
              <div>
                <SettingRow title="Sonraki Bölümü Otomatik Oynat" description="Dizi bölümü bittiğinde sıradaki bölüme otomatik geçmeyi dener.">
                  <button type="button"
                    onClick={() => {
                      const next = !autoPlayNext;
                      setAutoPlayNext(next);
                      saveLocalSetting('strmly_auto_play_next', String(next));
                    }}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 border focus:outline-none cursor-pointer ${
                      autoPlayNext
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                        : 'bg-white/[0.03] border-white/8'
                    }`}
                  >
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full transition-all duration-200 ${
                        autoPlayNext
                          ? 'left-5.5 bg-black'
                          : 'left-0.5 bg-neutral-400'
                      }`}
                    />
                  </button>
                </SettingRow>
                
                <SettingRow title="Ek Ön Bellek (Buffer)" description="Zayıf internet bağlantılarında takılmaları önlemek için daha uzun süre ara belleğe alma sağlar.">
                  <div className="flex items-center gap-3.5">
                    <button type="button"
                      onClick={() => {
                        const next = !bufferEnabled;
                        setBufferEnabled(next);
                        saveLocalSetting('strmly_buffer_enabled', String(next));
                      }}
                      className={`relative w-11 h-6 rounded-full transition-all duration-200 border focus:outline-none shrink-0 cursor-pointer ${
                        bufferEnabled
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                          : 'bg-white/[0.03] border-white/8'
                      }`}
                    >
                      <span
                        className={`absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full transition-all duration-200 ${
                          bufferEnabled
                            ? 'left-5.5 bg-black'
                            : 'left-0.5 bg-neutral-400'
                        }`}
                      />
                    </button>
                    {bufferEnabled && (
                      <div className="flex items-center gap-2 animate-fade-in">
                        <input
                          className={`${fieldStyle} max-w-[80px] text-center !w-20`}
                          type="number"
                          min="5"
                          max="120"
                          value={bufferSize}
                          onChange={(e) => {
                            setBufferSize(e.target.value);
                            saveLocalSetting('strmly_buffer_size', e.target.value);
                          }}
                        />
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Saniye</span>
                      </div>
                    )}
                  </div>
                </SettingRow>

                <SettingRow
                  title={language === 'tr' ? "Donanım Hızlandırması (GPU)" : "Hardware Acceleration (GPU)"}
                  description={language === 'tr' 
                    ? "Menülerde akıcılığı ve video oynatma performansını artırır. Ekran kartınızla ilgili çökme, donma veya siyah ekran sorunları yaşıyorsanız kapatmayı deneyin."
                    : "Improves UI smoothness and video playback performance. Try turning this off if you experience GPU driver crashes, freezes, or black screens."}
                >
                  <button type="button"
                    onClick={async () => {
                      const next = !hwAccelerationEnabled;
                      setHwAccelerationEnabled(next);
                      try {
                        localStorage.setItem('strmly_hw_acceleration_enabled', String(next));
                        if (window.electronAPI && window.electronAPI.saveConfig) {
                          await window.electronAPI.saveConfig('disableHardwareAcceleration', !next);
                        }
                        const confirmText = language === 'tr'
                          ? 'Donanım hızlandırması ayarının geçerli olması için uygulamanın yeniden başlatılması gerekir. Şimdi yeniden başlatılsın mı?'
                          : 'The application needs to be restarted for hardware acceleration settings to take effect. Restart now?';
                        if (window.confirm(confirmText)) {
                          if (window.electronAPI && window.electronAPI.relaunchApp) {
                            window.electronAPI.relaunchApp();
                          }
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 border focus:outline-none cursor-pointer ${
                      hwAccelerationEnabled
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                        : 'bg-white/[0.03] border-white/8'
                    }`}
                  >
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full transition-all duration-200 ${
                        hwAccelerationEnabled
                          ? 'left-5.5 bg-black'
                          : 'left-0.5 bg-neutral-400'
                      }`}
                    />
                  </button>
                </SettingRow>

              </div>
            </>
          )}

          {activeTab.id === 'network' && (
            <>
              <PageHeader title="Ağ ve Bağlantı" description="Gelişmiş ağ bağlantısı zaman aşımı ve otomatik yeniden deneme limitleri." />
              <div>
                <SettingRow title="Bağlantı Zaman Aşımı" description="Yayın açılırken sunucuya bağlanmak için beklenecek maksimum süre.">
                  <div className="flex items-center gap-2">
                    <input
                      className={`${fieldStyle} max-w-[100px] text-center !w-24`}
                      type="number"
                      min="3"
                      max="60"
                      value={connectionTimeout}
                      onChange={(e) => {
                        setConnectionTimeout(e.target.value);
                        saveLocalSetting('strmly_connection_timeout', e.target.value);
                      }}
                    />
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Saniye</span>
                  </div>
                </SettingRow>
                <SettingRow title="Yeniden Bağlanma Sınırı" description="Bağlantı koptuğunda veya sunucu hata verdiğinde kaç kez deneme yapılacağı.">
                  <div className="flex items-center gap-2">
                    <input
                      className={`${fieldStyle} max-w-[100px] text-center !w-24`}
                      type="number"
                      min="0"
                      max="10"
                      value={retryCount}
                      onChange={(e) => {
                        setRetryCount(e.target.value);
                        saveLocalSetting('strmly_retry_count', e.target.value);
                      }}
                    />
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Deneme</span>
                  </div>
                </SettingRow>
              </div>
            </>
          )}



          {activeTab.id === 'data' && (
            <>
              <PageHeader title="Veri Yönetimi" description="İzleme geçmişinizi, favorilerinizi ve yerel ayar yedeklerinizi yönetin." />
              <div className="mb-5 grid gap-3.5 sm:grid-cols-3">
                <StatBox label="İzleme Geçmişi" value={safeRecentlyWatched.length} />
                <StatBox label="Favorilerim" value={safeGlobalFavorites.length} />
                <StatBox label="Toplam İçerik" value={itemStats.total} />
              </div>
              <div>
                <SettingRow title="İzleme Geçmişi" description="Daha önce izlediğiniz veya kaldığınız yer bilgisi kaydedilen tüm içerikleri siler.">
                  <button type="button" className={dangerButton} onClick={onClearRecentlyWatched}>Geçmişi Temizle</button>
                </SettingRow>
                <SettingRow title="Favorilerim" description="Favoriler listenize eklediğiniz tüm kanal, dizi ve film kayıtlarını sıfırlar.">
                  <button type="button" className={dangerButton} onClick={onClearFavorites}>Favorileri Temizle</button>
                </SettingRow>
                <SettingRow title="Yerel Ayar Yedekleme" description="Strmly ayarlarını JSON dosyası olarak dışarı aktarın veya geri yükleyin.">
                  <div className="flex items-center gap-2">
                    <button type="button" className={secondaryButton} onClick={exportSettings}>Yedeği Dışa Aktar</button>
                    <label className={secondaryButton}>
                      Yedeği İçe Aktar
                      <input type="file" accept=".json" className="hidden" onChange={(e) => importSettings(e.target.files?.[0])} />
                    </label>
                  </div>
                </SettingRow>
              </div>
            </>
          )}

          {activeTab.id === 'about' && (
            <>
              <PageHeader title="Strmly Hakkında" description="Uygulama sürümü, lisans ve platform bilgileri." />
              <div className="relative overflow-hidden flex flex-col items-center text-center py-6">
                
                {/* Logo & Branding */}
                <div className="relative w-20 h-20 rounded-[24px] bg-white text-black flex items-center justify-center shadow-[0_0_35px_rgba(255,255,255,0.08)] mb-5 border border-white/20 hover:scale-105 transition-all duration-300 group cursor-pointer">
                  <img src="./icon.png" className="w-12 h-12 object-contain group-hover:rotate-6 transition-transform duration-300" alt="Strmly Logo" />
                </div>

                <h3 className="text-2xl font-black tracking-tight text-white leading-none">STRMLY</h3>
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[var(--accent-color)] mt-2">Premium IPTV Player</p>
                
                <p className="mt-4 max-w-md text-xs leading-relaxed text-neutral-400 font-medium">
                  Strmly, en sevdiğiniz canlı yayınları, dizileri ve filmleri son derece akıcı cam arayüzü ve yüksek performanslı oynatma motoruyla izlemeniz için geliştirilmiş yeni nesil IPTV oynatıcıdır.
                </p>

                {/* Grid Cards with Icons */}
                <div className="mt-8 grid w-full gap-3.5 sm:grid-cols-2 lg:grid-cols-4 border-t border-white/5 pt-6">
                  
                  <div className="rounded-xl border border-white/5 bg-white/[0.005] hover:bg-white/[0.015] hover:border-white/10 p-3.5 flex flex-col items-center transition-all duration-200 group">
                    <Tag size={16} className="text-[var(--accent-color)] group-hover:scale-110 transition-transform mb-2.5" />
                    <div className="text-sm font-black text-white">{appVersion}</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-500">{language === 'tr' ? 'Versiyon' : 'Version'}</div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.005] hover:bg-white/[0.015] hover:border-white/10 p-3.5 flex flex-col items-center transition-all duration-200 group">
                    <Cpu size={16} className="text-sky-400 group-hover:scale-110 transition-transform mb-2.5" />
                    <div className="text-sm font-black text-white">Electron</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-500">Platform</div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.005] hover:bg-white/[0.015] hover:border-white/10 p-3.5 flex flex-col items-center transition-all duration-200 group">
                    <Code size={16} className="text-emerald-400 group-hover:scale-110 transition-transform mb-2.5" />
                    <div className="text-sm font-black text-white">React 19</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-500">{language === 'tr' ? 'Teknoloji' : 'Technology'}</div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.005] hover:bg-white/[0.015] hover:border-white/10 p-3.5 flex flex-col items-center transition-all duration-200 group">
                    <Database size={16} className="text-purple-400 group-hover:scale-110 transition-transform mb-2.5" />
                    <div className="text-sm font-black text-white">TMDB v3</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-500">{language === 'tr' ? 'Meta Veri' : 'Metadata'}</div>
                  </div>

                </div>

                {/* External Links */}
                <div className="mt-6 flex items-center gap-3 justify-center w-full">
                  <a
                    href="https://github.com/ardakrt/strmly-player"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-neutral-400 hover:text-neutral-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Globe size={13} />
                    <span>GitHub</span>
                    <ExternalLink size={10} className="opacity-55" />
                  </a>
                  <a
                    href="https://github.com/ardakrt/strmly-player/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-neutral-400 hover:text-neutral-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    <FileText size={13} />
                    <span>{language === 'tr' ? 'Lisans' : 'License'}</span>
                    <ExternalLink size={10} className="opacity-55" />
                  </a>
                </div>

                {/* Updates Checker */}
                <div className="w-full max-w-sm mt-8 border-t border-white/5 pt-6 flex flex-col items-center gap-4">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'UYGULAMA GÜNCELLEMESİ' : 'APPLICATION UPDATE'}</span>
                    {updateState.status !== 'idle' && (
                      <p className="text-xs font-semibold text-neutral-300 mt-1">{updateState.message}</p>
                    )}
                  </div>

                  {updateState.status === 'idle' && (
                    <button type="button"
                      onClick={handleCheckUpdates}
                      className="px-6 py-2.5 bg-white hover:bg-neutral-200 text-black font-extrabold text-xs uppercase rounded-full shadow-lg transition-transform active:scale-95 transform cursor-pointer"
                    >
                      {language === 'tr' ? 'Güncelleştirmeleri Denetle' : 'Check for Updates'}
                    </button>
                  )}

                  {updateState.status === 'checking' && (
                    <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin mt-1" />
                  )}

                  {updateState.status === 'available' && (
                    <button type="button"
                      onClick={handleDownloadUpdate}
                      className="min-w-[220px] px-6 py-2.5 bg-white hover:bg-neutral-200 text-neutral-950 font-extrabold text-xs uppercase rounded-full shadow-lg transition-transform active:scale-95 transform cursor-pointer"
                    >
                      {language === 'tr' ? 'Güncellemeyi İndir' : 'Download Update'}
                    </button>
                  )}

                  {updateState.status === 'downloading' && (
                    <div className="w-full max-w-xs flex flex-col gap-2 mt-1">
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-[var(--accent-color)] h-full transition-all duration-300" style={{ width: `${updateState.progress ?? 0}%` }} />
                      </div>
                      <span className="text-[10px] text-neutral-500 font-extrabold text-right">% {updateState.progress ?? 0} {language === 'tr' ? 'İndiriliyor' : 'Downloading'}</span>
                    </div>
                  )}

                  {updateState.status === 'downloaded' && (
                    <button type="button"
                      onClick={handleInstallUpdate}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs uppercase rounded-full shadow-lg transition-all active:scale-95 transform cursor-pointer animate-pulse mt-1"
                    >
                      {language === 'tr' ? 'Güncellemeyi Kur ve Yeniden Başlat' : 'Install Update & Restart'}
                    </button>
                  )}

                  {(updateState.status === 'not-available' || updateState.status === 'error') && (
                    <button type="button"
                      onClick={handleCheckUpdates}
                      className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs uppercase rounded-full shadow-md transition-transform active:scale-95 transform cursor-pointer"
                    >
                      {language === 'tr' ? 'Yeniden Denetle' : 'Check Again'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      {showMoveDownloadsPrompt && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-md bg-neutral-950 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-scale-in text-left">
            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-black text-white leading-tight">
                {language === 'tr' ? 'İndirme Konumunu Değiştir' : 'Change Download Directory'}
              </h3>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                {language === 'tr'
                  ? `Yeni klasör konumu: ${pendingDownloadsFolder}`
                  : `New directory location: ${pendingDownloadsFolder}`}
              </p>
            </div>

            {isMovingDownloads ? (
              <div className="flex flex-col gap-4 py-2 animate-fade-in text-left">
                <div className="flex justify-between items-center text-xs font-bold text-white">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>{language === 'tr' ? 'Dosyalar Taşınıyor...' : 'Moving Files...'}</span>
                  </span>
                  <span>{moveProgress ? `%${moveProgress.percent}` : '%0'}</span>
                </div>
                
                {/* Progress Bar Container */}
                <div className="w-full bg-white/5 border border-white/5 rounded-full h-3 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-300 shadow-[0_0_8px_var(--accent-glow)]"
                    style={{
                      width: `${moveProgress ? moveProgress.percent : 0}%`,
                      backgroundColor: 'var(--accent-color)'
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2 mt-1 bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
                  <div className="flex justify-between items-center text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    <span>{language === 'tr' ? 'Taşınan Ögeler' : 'Moved Items'}</span>
                    <span className="text-white">
                      {moveProgress ? `${moveProgress.filesMoved} / ${moveProgress.totalFiles}` : '0 / 0'}
                    </span>
                  </div>
                  {moveProgress?.currentFile && (
                    <div className="text-[10px] text-neutral-500 font-mono select-text truncate mt-1 border-t border-white/5 pt-1.5 leading-relaxed">
                      <span className="text-neutral-400 font-bold">{language === 'tr' ? 'Dosya:' : 'File:'}</span> {moveProgress.currentFile}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-white">
                    {language === 'tr' ? 'Mevcut Dosyaları Taşı' : 'Move Existing Files'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {language === 'tr'
                      ? 'Eski klasördeki tüm indirmelerinizi yeni konuma otomatik taşır.'
                      : 'Automatically moves all existing downloads from the old directory to the new directory.'}
                  </span>
                </div>
                <button type="button"
                  onClick={() => setMoveExistingDownloads(!moveExistingDownloads)}
                  className={`w-12 h-6.5 rounded-full p-[3px] transition-all duration-300 relative cursor-pointer border ${
                    moveExistingDownloads
                      ? 'border-transparent shadow-[0_0_12px_var(--accent-glow)]'
                      : 'bg-black/40 border-white/10 hover:border-white/20'
                  }`}
                  style={moveExistingDownloads ? { backgroundColor: 'var(--accent-color)' } : {}}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full shadow-md transition-all duration-300 ${
                      moveExistingDownloads ? 'translate-x-5' : 'translate-x-0'
                    }`}
                    style={{
                      backgroundColor: moveExistingDownloads
                        ? (activeAccent === '#FFFFFF' || activeAccent === '#fff' ? '#000000' : '#FFFFFF')
                        : '#9CA3AF'
                    }}
                  />
                </button>
              </div>
            )}

            {!isMovingDownloads ? (
              <div className="flex items-center gap-3 mt-2">
                <button type="button"
                  onClick={() => {
                    setShowMoveDownloadsPrompt(false);
                    setPendingDownloadsFolder('');
                    setPendingDownloadsFolderToken('');
                  }}
                  className="flex-1 py-3 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-bold text-white rounded-xl transition-all cursor-pointer text-center"
                >
                  {language === 'tr' ? 'İptal' : 'Cancel'}
                </button>
                <button type="button"
                  onClick={async () => {
                    if (!window.electronAPI?.setDownloadsFolder) return;
                    setIsMovingDownloads(true);
                    setMoveProgress({ percent: 0, currentFile: '', filesMoved: 0, totalFiles: 0 });
                    try {
                      const res = await window.electronAPI.setDownloadsFolder({
                        folderPath: pendingDownloadsFolder,
                        moveExisting: moveExistingDownloads,
                        selectionToken: pendingDownloadsFolderToken
                      });
                      if (res?.success) {
                        setDownloadsFolder(pendingDownloadsFolder);
                        onShowToast(language === 'tr' ? 'İndirme konumu güncellendi!' : 'Download directory updated!');
                      } else {
                        onShowToast(language === 'tr' ? `Hata: ${res?.error}` : `Error: ${res?.error}`);
                      }
                    } catch (err: any) {
                      onShowToast(language === 'tr' ? `Hata: ${err.message}` : `Error: ${err.message}`);
                    } finally {
                      setIsMovingDownloads(false);
                      setShowMoveDownloadsPrompt(false);
                      setPendingDownloadsFolder('');
                      setPendingDownloadsFolderToken('');
                      setMoveProgress(null);
                    }
                  }}
                  className="flex-1 py-3 bg-white hover:bg-neutral-200 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
                >
                  <span>{language === 'tr' ? 'Uygula' : 'Apply'}</span>
                </button>
              </div>
            ) : (
              <div className="text-[10px] text-neutral-500 text-center font-medium mt-1 animate-pulse-slow">
                {language === 'tr'
                  ? 'Lütfen aktarım tamamlanana kadar uygulamayı kapatmayın.'
                  : 'Please do not close the application until transfer completes.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
