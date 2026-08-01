import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Info,
  Palette,
  Plus,
  RefreshCw,
  UploadCloud,
  X,
  Search,
  Globe,
  FileText,
  ExternalLink,
  Download
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { HoldToConfirmButton } from './HoldToConfirmButton';
import {
  AUTOPLAY_NEXT_KEY,
  BUFFER_ENABLED_KEY,
  BUFFER_SIZE_KEY,
  CONNECTION_TIMEOUT_KEY,
  RETRY_COUNT_KEY,
  getPlaybackSettings,
} from '../utils/playbackSettings';
import { prepareSettingsImport } from '../utils/settingsBackup';
import type { SavedPlaylist } from '../types';
import { useDownloads } from '../hooks/useDownloads';

import { CustomSelect, dangerButton, EMPTY_ARRAY, EmptyState, fieldStyle, labelStyle, PageHeader, primaryButton, secondaryButton, SettingRow, StatBox, UPDATE_OPTIONS } from './SettingsControls';

const handleInstallUpdateHelper = () => {
  if (window.electronAPI && window.electronAPI.installUpdate) {
    window.electronAPI.installUpdate();
  }
};

const saveLocalSettingHelper = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage save error:', e);
  }
};

export const SettingsPanel = ({ onNavigate }: { onNavigate?: (view: string) => void }) => {
  const {
    language, setLanguage, t,
    activeSettingsTab, setActiveSettingsTab,
    defaultPlayer, setDefaultPlayer,
    iptvUpdateMode, setIptvUpdateMode,
    activeAccent,
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
  const [refreshingPlaylistId, setRefreshingPlaylistId] = useState<string | null>(null);

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

  const [autoPlayNext, setAutoPlayNext] = useState(() => getPlaybackSettings().autoPlayNext);

  const [bufferEnabled, setBufferEnabled] = useState(() => getPlaybackSettings().bufferEnabled);
  const [hwAccelerationEnabled, setHwAccelerationEnabled] = useState(() => {
    try { return localStorage.getItem('strmly_hw_acceleration_enabled') !== 'false'; } catch { return true; }
  });
  const [appVersion, setAppVersion] = useState('1.5.17');
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
    }
  }, []);
  const [bufferSize, setBufferSize] = useState(() => String(getPlaybackSettings().bufferSeconds));
  const [connectionTimeout, setConnectionTimeout] = useState(() => String(getPlaybackSettings().connectionTimeoutSeconds));
  const [retryCount, setRetryCount] = useState(() => String(getPlaybackSettings().retryCount));
  const [uiScale, setUiScale] = useState(() => {
    try { return localStorage.getItem('strmly_ui_scale') || 'medium'; } catch { return 'medium'; }
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

  const tabs = [
    { id: 'playlists', label: t('settings.tabs.playlists'), icon: Database },
    { id: 'categories', label: t('settings.tabs.categories'), icon: EyeOff },
    { id: 'downloads', label: language === 'tr' ? 'Kaydedilenler' : 'Saved', icon: Download },
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'playback', label: language === 'tr' ? 'Oynatma ve Bağlantı' : 'Playback & Connection', icon: Check },
    { id: 'data', label: t('settings.tabs.data'), icon: HardDrive },
    { id: 'about', label: t('settings.tabs.about'), icon: Info }
  ];

  const resolvedSettingsTab = activeSettingsTab === 'network'
    ? 'playback'
    : activeSettingsTab === 'players'
      ? 'appearance'
      : activeSettingsTab;
  const activeTab = tabs.find(tab => tab.id === resolvedSettingsTab) || tabs[0];

  useEffect(() => {
    if (activeTab.id !== 'about' || hasAutoCheckedUpdatesRef.current) return;
    hasAutoCheckedUpdatesRef.current = true;
    void handleCheckUpdates();
  }, [activeTab.id, handleCheckUpdates]);

  const categoryTotal = safeHiddenCategories.length + safeHiddenSeriesCategories.length + safeHiddenMovieCategories.length;
  const categoryTabs: Array<{
    id: 'all' | 'live' | 'series' | 'movie';
    label: string;
    count: number;
  }> = [
    { id: 'all', label: language === 'tr' ? 'Tümü' : 'All', count: categoryTotal },
    { id: 'live', label: language === 'tr' ? 'Canlı TV' : 'Live TV', count: safeHiddenCategories.length },
    { id: 'series', label: language === 'tr' ? 'Diziler' : 'Series', count: safeHiddenSeriesCategories.length },
    { id: 'movie', label: language === 'tr' ? 'Filmler' : 'Movies', count: safeHiddenMovieCategories.length },
  ];
  const activeHiddenCount = categoryTabs.find(tab => tab.id === categorySubTab)?.count ?? 0;





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
          try {
            const { success, result, error } = e.data;
            if (success) {
              const { localEntries, diskEntries } = prepareSettingsImport(result);
              const diskResult = window.electronAPI?.saveConfigBatchSync?.(diskEntries);
              if (diskResult && !diskResult.success) {
                throw new Error(diskResult.error || 'Disk persistence failed');
              }
              Object.entries(localEntries).forEach(([key, value]) => {
                localStorage.setItem(key, value);
              });
              onShowToast(language === 'tr' ? 'Ayarlar içe aktarıldı. Uygulamayı yenileyin.' : 'Settings imported. Please refresh the app.');
            } else {
              onShowToast(language === 'tr' ? `İçe aktarma hatası: ${error}` : `Import error: ${error}`);
            }
          } catch (importError) {
            console.error('Settings import failed:', importError);
            onShowToast(language === 'tr' ? 'İçe aktarma hatası.' : 'Import error.');
          } finally {
            worker.terminate();
          }
        };
        worker.postMessage({ type: 'import', payload: reader.result as string });
      } catch {
        onShowToast(language === 'tr' ? 'İçe aktarma hatası.' : 'Import error.');
      }
    };
    reader.readAsText(file);
  };

  const handleManualPlaylistRefresh = async (playlist: SavedPlaylist) => {
    if (refreshingPlaylistId || isParsing) return;
    setRefreshingPlaylistId(playlist.id);
    try {
      await onRefreshPlaylist(playlist);
    } finally {
      setRefreshingPlaylistId(null);
    }
  };

  const renderPlaylistCard = (playlist: SavedPlaylist) => {
    const isActive = playlist.id === activePlaylistId;
    const isRefreshing = refreshingPlaylistId === playlist.id;
    const canAutoUpdate = Boolean(
      playlist.url || (playlist.xtreamUrl && playlist.xtreamUser && playlist.xtreamPass),
    );
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
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/8 bg-white/[0.02] px-3 text-[11px] font-semibold text-neutral-300 outline-none transition-colors duration-150 hover:bg-white/[0.08] hover:text-white active:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"
              disabled={isParsing || refreshingPlaylistId !== null}
              aria-busy={isRefreshing}
              onClick={() => void handleManualPlaylistRefresh(playlist)}
            >
              <RefreshCw size={13} aria-hidden="true" className={isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''} />
              <span>{isRefreshing
                ? (language === 'tr' ? 'Kontrol ediliyor' : 'Checking')
                : (language === 'tr' ? 'Güncellemeyi kontrol et' : 'Check for updates')}</span>
            </button>
            <HoldToConfirmButton
              onConfirm={() => onDeletePlaylist(playlist.id)}
              label={language === 'tr' ? 'Sil' : 'Delete'}
              confirmedLabel={language === 'tr' ? 'Silindi' : 'Deleted'}
              variant="danger"
              ariaLabel={language === 'tr' ? 'Listeyi Sil' : 'Delete Playlist'}
            />
          </div>
        </div>

        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Otomatik Güncelleme' : 'Auto Update'}</div>
          {canAutoUpdate ? (
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
          ) : (
            <p className="text-[11px] leading-relaxed text-neutral-500">
              {language === 'tr'
                ? 'Yerel dosyalar yalnızca yeniden içe aktarılarak güncellenebilir.'
                : 'Local files can only be updated by importing them again.'}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderHiddenGroup = (
    title: string,
    groups: string[],
    restore: (name: string) => void
  ) => {
    const q = categorySearch.trim().toLocaleLowerCase('tr-TR');
    const filtered = q
      ? groups.filter(g => g.toLocaleLowerCase('tr-TR').includes(q))
      : groups;

    return (
      <section className="border-b border-white/[0.07] last:border-b-0" aria-label={title}>
        <div className="flex items-baseline justify-between gap-4 py-4">
          <h3 className="text-xs font-semibold text-white">{title}</h3>
          <span className="text-[10px] tabular-nums text-white/45">
            {q ? `${filtered.length} / ${groups.length}` : groups.length}
          </span>
        </div>
        <div>
          {groups.length === 0 ? (
            <div className="py-6 text-sm text-white/45">
              {language === 'tr' ? 'Bu bölümde gizli kategori yok.' : 'There are no hidden categories in this section.'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-sm text-white/45">
              {language === 'tr' ? 'Aramanızla eşleşen kategori bulunamadı.' : 'No categories match your search.'}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.055]">
              {filtered.map(group => (
                <div
                  key={`${title}-${group}`}
                  className="group flex min-h-14 items-center justify-between gap-4 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm text-white/72 transition-colors group-hover:text-white" title={group}>{group}</span>
                  <button
                    type="button"
                    onClick={() => restore(group)}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-white/60 outline-none transition-colors duration-150 hover:bg-white/[0.05] hover:text-white active:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"
                    aria-label={`${group} — ${language === 'tr' ? 'göster' : 'show'}`}
                  >
                    <Eye size={13} aria-hidden="true" />
                    {language === 'tr' ? 'Göster' : 'Show'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
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
                      <input className={`${fieldStyle} mt-1.5 w-full md:w-full`} value={playlistFormName} onChange={(e) => setPlaylistFormName(e.target.value)} placeholder={t('settings.playlists.playlistNamePlaceholder')} />
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
              <PageHeader
                title={language === 'tr' ? 'Gizli Kategoriler' : 'Hidden Categories'}
                description={language === 'tr'
                  ? 'Daha önce ana ekranda veya listelerde gizlediğiniz kategorileri buradan geri getirebilirsiniz.'
                  : 'Restore categories that you previously hid on the home screen or in lists.'}
              />

              <div className="mb-7 border-b border-white/[0.07]">
                <div className="flex flex-col gap-4 pb-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="flex flex-wrap items-center gap-x-7" role="tablist" aria-label={language === 'tr' ? 'Gizli kategori türleri' : 'Hidden category types'}>
                    {categoryTabs.map((tab) => {
                      const isActive = categorySubTab === tab.id;
                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          key={tab.id}
                          onClick={() => setCategorySubTab(tab.id)}
                          className={`relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap text-xs font-semibold outline-none transition-colors duration-150 active:text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] ${isActive ? 'text-white' : 'text-white/60 hover:text-white/82'}`}
                        >
                          <span>{tab.label}</span>
                          <span className={`text-[10px] tabular-nums ${isActive ? 'text-white/60' : 'text-white/50'}`}>{tab.count}</span>
                          {isActive && <span className="absolute inset-x-0 bottom-[-17px] h-[2px] bg-[var(--accent-color)]" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                    <label className="relative block w-full sm:w-64">
                      <span className="sr-only">{language === 'tr' ? 'Gizli kategori ara' : 'Search hidden categories'}</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45" size={14} aria-hidden="true" />
                      <input
                        type="search"
                        value={categorySearch}
                        onChange={(event) => setCategorySearch(event.target.value)}
                        placeholder={language === 'tr' ? 'Kategori ara' : 'Search categories'}
                        className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.025] pl-9 pr-10 text-sm text-white outline-2 outline-transparent outline-offset-1 transition-colors duration-150 placeholder:text-white/45 hover:bg-white/[0.04] focus-visible:border-white/15 focus-visible:outline-[var(--accent-color)]"
                      />
                      {categorySearch && (
                        <button type="button" onClick={() => setCategorySearch('')} className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center rounded-md text-white/50 outline-none transition-colors duration-150 hover:text-white active:text-white/75 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent-color)]" aria-label={language === 'tr' ? 'Aramayı temizle' : 'Clear search'}>
                          <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </label>

                    <button
                      type="button"
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.09] px-4 text-xs font-semibold text-white/72 outline-none transition-colors duration-150 hover:bg-white/[0.05] hover:text-white active:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"
                      onClick={() => {
                        if (categorySubTab === 'all' || categorySubTab === 'live') onResetHiddenCategories();
                        if (categorySubTab === 'all' || categorySubTab === 'series') onResetHiddenSeriesCategories();
                        if (categorySubTab === 'all' || categorySubTab === 'movie') onResetHiddenMovieCategories();
                        setCategorySearch('');
                      }}
                      disabled={activeHiddenCount === 0}
                    >
                      <Eye size={13} aria-hidden="true" />
                      {language === 'tr' ? 'Tümünü göster' : 'Show all'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                {(categorySubTab === 'all' || categorySubTab === 'live') &&
                  renderHiddenGroup(language === 'tr' ? 'Canlı TV' : 'Live TV', safeHiddenCategories, onRestoreCategory)
                }
                {(categorySubTab === 'all' || categorySubTab === 'series') &&
                  renderHiddenGroup(language === 'tr' ? 'Diziler' : 'Series', safeHiddenSeriesCategories, onRestoreSeriesCategory)
                }
                {(categorySubTab === 'all' || categorySubTab === 'movie') &&
                  renderHiddenGroup(language === 'tr' ? 'Filmler' : 'Movies', safeHiddenMovieCategories, onRestoreMovieCategory)
                }
              </div>
            </>
          )}

          {activeTab.id === 'appearance' && (
            <>
              <PageHeader
                title={language === 'tr' ? 'Arayüz' : 'Interface'}
                description={language === 'tr'
                  ? 'Dil, kart boyutu ve genel arayüz ölçeğini yönetin.'
                  : 'Manage language, card size, and the overall interface scale.'}
              />
              <div>
                <SettingRow title={t('settings.appearance.language')} description={t('settings.appearance.languageDesc')}>
                  <CustomSelect
                    value={language}
                    onChange={(val) => {
                      setLanguage(val as 'tr' | 'en');
                      onShowToast(val === 'tr' ? 'Dil Türkçe olarak ayarlandı.' : 'Language set to English.');
                    }}
                    options={[
                      { value: 'tr', label: 'Türkçe' },
                      { value: 'en', label: 'English' }
                    ]}
                  />
                </SettingRow>

                <SettingRow title={t('settings.appearance.cardSize')} description={t('settings.appearance.cardSizeDesc')}>
                  <div className="inline-flex gap-0.5 rounded-lg border border-white/5 bg-black/30 p-0.5 select-none">
                    {[
                      { id: 'small', label: language === 'tr' ? 'Küçük' : 'Small' },
                      { id: 'medium', label: language === 'tr' ? 'Orta' : 'Medium' },
                      { id: 'large', label: language === 'tr' ? 'Büyük' : 'Large' }
                    ].map(size => {
                      const isActive = cardLayoutSize === size.id;
                      return (
                        <button
                          type="button"
                          key={size.id}
                          onClick={() => {
                            setCardLayoutSize(size.id);
                            onSaveSetting('cinema_card_layout_size', size.id);
                          }}
                          className={`h-7 rounded px-3.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] ${
                            isActive ? 'bg-white text-black shadow-sm font-black' : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {size.label}
                        </button>
                      );
                    })}
                  </div>
                </SettingRow>

                <SettingRow
                  title={language === 'tr' ? 'Arayüz Ölçeği' : 'UI Scale'}
                  description={language === 'tr' ? 'Uygulamanın genel yazı boyutunu ve arayüz elemanlarının ölçeğini ayarlayın.' : 'Adjust the overall font size and interface element scaling.'}
                >
                  <div className="inline-flex gap-0.5 rounded-lg border border-white/5 bg-black/30 p-0.5 select-none">
                    {[
                      { id: 'small', label: language === 'tr' ? 'Küçük' : 'Small' },
                      { id: 'medium', label: language === 'tr' ? 'Orta' : 'Medium' },
                      { id: 'large', label: language === 'tr' ? 'Büyük' : 'Large' }
                    ].map(size => {
                      const isActive = uiScale === size.id;
                      return (
                        <button
                          type="button"
                          key={size.id}
                          onClick={() => changeUiScale(size.id as 'small' | 'medium' | 'large')}
                          className={`h-7 rounded px-3.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] ${
                            isActive ? 'bg-white text-black shadow-sm font-black' : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {size.label}
                        </button>
                      );
                    })}
                  </div>
                </SettingRow>
              </div>
            </>
          )}

          {activeTab.id === 'playback' && (
            <>
              <PageHeader
                title={language === 'tr' ? 'Oynatma ve Bağlantı' : 'Playback & Connection'}
                description={language === 'tr'
                  ? 'İzleme deneyiminizi etkileyen temel seçenekleri yönetin.'
                  : 'Manage the essential options that affect your viewing experience.'}
              />
              <div>
                <SettingRow
                  title={language === 'tr' ? 'Oynatıcı' : 'Player'}
                  description={language === 'tr' ? 'İçeriklerin hangi oynatıcıyla açılacağını seçin.' : 'Choose which player opens your media.'}
                >
                  <CustomSelect
                    value={defaultPlayer}
                    onChange={(val) => {
                      setDefaultPlayer(val);
                      onSaveSetting('cinema_default_player', val);
                      onShowToast(`${t('settings.players.saveSuccess')} (${val.toUpperCase()})`);
                    }}
                    options={[
                      { value: 'internal', label: language === 'tr' ? 'Strmly Oynatıcı' : 'Strmly Player' },
                      { value: 'vlc', label: `VLC Player (${language === 'tr' ? 'Harici' : 'External'})` },
                      { value: 'mpv', label: `MPV Player (${language === 'tr' ? 'Harici' : 'External'})` }
                    ]}
                  />
                </SettingRow>

                <SettingRow
                  title={language === 'tr' ? 'Sonraki Bölümü Otomatik Oynat' : 'Autoplay Next Episode'}
                  description={language === 'tr' ? 'Bir bölüm bittiğinde sıradaki bölümü otomatik başlatır.' : 'Starts the next episode automatically when one ends.'}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoPlayNext}
                    aria-label={language === 'tr' ? 'Sonraki bölümü otomatik oynat' : 'Autoplay next episode'}
                    onClick={() => {
                      const next = !autoPlayNext;
                      setAutoPlayNext(next);
                      saveLocalSettingHelper(AUTOPLAY_NEXT_KEY, String(next));
                    }}
                    className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${autoPlayNext ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-white/[0.03] border-white/8'}`}
                  >
                    <span aria-hidden="true" className={`absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-150 ${autoPlayNext ? 'left-5.5 bg-black' : 'left-0.5 bg-neutral-400'}`} />
                  </button>
                </SettingRow>

                <SettingRow
                  title={language === 'tr' ? 'Kesintisiz Oynatma' : 'Smoother Playback'}
                  description={language === 'tr' ? 'Yavaş bağlantılarda takılmaları azaltmak için videoyu önceden yükler.' : 'Preloads video to reduce interruptions on slower connections.'}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bufferEnabled}
                    aria-label={language === 'tr' ? 'Kesintisiz oynatma' : 'Smoother playback'}
                    onClick={() => {
                      const next = !bufferEnabled;
                      setBufferEnabled(next);
                      saveLocalSettingHelper(BUFFER_ENABLED_KEY, String(next));
                    }}
                    className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${bufferEnabled ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-white/[0.03] border-white/8'}`}
                  >
                    <span aria-hidden="true" className={`absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-150 ${bufferEnabled ? 'left-5.5 bg-black' : 'left-0.5 bg-neutral-400'}`} />
                  </button>
                </SettingRow>

                <SettingRow
                  title={language === 'tr' ? 'Yeni içerikler nasıl eklensin?' : 'How should new content be applied?'}
                  description={language === 'tr'
                    ? 'Arka planda yenilenen IPTV listesinin ne zaman etkin kataloğa uygulanacağını seçin.'
                    : 'Choose when a refreshed IPTV playlist should replace the active catalog.'}
                  vertical
                >
                  <div role="radiogroup" aria-label={language === 'tr' ? 'IPTV liste güncelleme davranışı' : 'IPTV playlist update behavior'} className="grid gap-2 sm:grid-cols-3">
                    {[
                      { id: 'prompt', tr: 'Önce Sor', en: 'Ask First' },
                      { id: 'silent', tr: 'Boştayken Uygula', en: 'Apply When Idle' },
                      { id: 'manual', tr: 'Yalnızca Elle', en: 'Manual Only' },
                    ].map((option) => {
                      const selected = iptvUpdateMode === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setIptvUpdateMode(option.id as 'prompt' | 'silent' | 'manual')}
                          className={`min-h-10 rounded-xl border px-3 text-left text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] ${
                            selected
                              ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/12 text-white'
                              : 'border-white/[0.07] bg-white/[0.025] text-neutral-400 hover:border-white/15 hover:text-white'
                          }`}
                        >
                          {language === 'tr' ? option.tr : option.en}
                        </button>
                      );
                    })}
                  </div>
                </SettingRow>

                <details className="group mt-5 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block text-xs font-bold text-neutral-200">{language === 'tr' ? 'Gelişmiş Ayarlar' : 'Advanced Settings'}</span>
                      <span className="mt-1 block text-[11px] text-neutral-500">
                        {language === 'tr' ? 'Yalnızca bağlantı veya görüntü sorunu yaşarsanız değiştirin.' : 'Change these only when troubleshooting connection or display issues.'}
                      </span>
                    </span>
                    <ChevronDown size={15} aria-hidden="true" className="shrink-0 text-neutral-500 transition-transform duration-150 group-open:rotate-180" />
                  </summary>

                  <div className="border-t border-white/[0.05] px-4">
                    <SettingRow
                      title={language === 'tr' ? 'Ön Yükleme Süresi' : 'Preload Duration'}
                      description={language === 'tr' ? 'Kesintisiz oynatma açıkken hazırlanacak video süresi.' : 'The amount of video prepared when smoother playback is enabled.'}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          className={`${fieldStyle} !w-20 text-center disabled:cursor-not-allowed disabled:opacity-50`}
                          type="number"
                          min="5"
                          max="120"
                          disabled={!bufferEnabled}
                          value={bufferSize}
                          onChange={(event) => {
                            setBufferSize(event.target.value);
                            saveLocalSettingHelper(BUFFER_SIZE_KEY, event.target.value);
                          }}
                        />
                        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Saniye' : 'Seconds'}</span>
                      </div>
                    </SettingRow>

                    <SettingRow
                      title={language === 'tr' ? 'Bağlantıyı Bekleme Süresi' : 'Connection Wait Time'}
                      description={language === 'tr' ? 'Bir yayın açılırken bağlantı için beklenecek en uzun süre.' : 'The maximum time to wait while opening a stream.'}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          className={`${fieldStyle} !w-24 text-center`}
                          type="number"
                          min="3"
                          max="60"
                          value={connectionTimeout}
                          onChange={(event) => {
                            setConnectionTimeout(event.target.value);
                            saveLocalSettingHelper(CONNECTION_TIMEOUT_KEY, event.target.value);
                          }}
                        />
                        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Saniye' : 'Seconds'}</span>
                      </div>
                    </SettingRow>

                    <SettingRow
                      title={language === 'tr' ? 'Yeniden Deneme Sayısı' : 'Retry Attempts'}
                      description={language === 'tr' ? 'Bağlantı kesildiğinde kaç kez tekrar deneneceğini belirler.' : 'Sets how many times to retry after a connection is lost.'}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          className={`${fieldStyle} !w-24 text-center`}
                          type="number"
                          min="0"
                          max="10"
                          value={retryCount}
                          onChange={(event) => {
                            setRetryCount(event.target.value);
                            saveLocalSettingHelper(RETRY_COUNT_KEY, event.target.value);
                          }}
                        />
                        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Deneme' : 'Retries'}</span>
                      </div>
                    </SettingRow>

                    <SettingRow
                      title={language === 'tr' ? 'Ekran Kartını Kullan' : 'Use Graphics Card'}
                      description={language === 'tr' ? 'Daha akıcı görüntü sağlar. Donma veya siyah ekran yaşarsanız kapatmayı deneyin.' : 'Improves visual performance. Try turning it off if you see freezes or a black screen.'}
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={hwAccelerationEnabled}
                        aria-label={language === 'tr' ? 'Ekran kartını kullan' : 'Use graphics card'}
                        onClick={async () => {
                          const next = !hwAccelerationEnabled;
                          setHwAccelerationEnabled(next);
                          try {
                            localStorage.setItem('strmly_hw_acceleration_enabled', String(next));
                            if (window.electronAPI?.saveConfig) {
                              await window.electronAPI.saveConfig('disableHardwareAcceleration', !next);
                            }
                            const confirmText = language === 'tr'
                              ? 'Bu değişikliğin uygulanması için Strmly yeniden başlatılmalı. Şimdi yeniden başlatılsın mı?'
                              : 'Strmly must restart to apply this change. Restart now?';
                            if (window.confirm(confirmText) && window.electronAPI?.relaunchApp) {
                              window.electronAPI.relaunchApp();
                            }
                          } catch (error) {
                            console.error(error);
                          }
                        }}
                        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${hwAccelerationEnabled ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-white/[0.03] border-white/8'}`}
                      >
                        <span aria-hidden="true" className={`absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-150 ${hwAccelerationEnabled ? 'left-5.5 bg-black' : 'left-0.5 bg-neutral-400'}`} />
                      </button>
                    </SettingRow>
                  </div>
                </details>
              </div>
            </>
          )}



          {activeTab.id === 'data' && (
            <>
              <PageHeader title={language === 'tr' ? 'Veri Yönetimi' : 'Data Management'} description={language === 'tr' ? 'İzleme geçmişinizi, favorilerinizi ve yerel ayar yedeklerinizi yönetin.' : 'Manage your watch history, favorites, and local settings backups.'} />
              <div className="mb-5 grid gap-3.5 sm:grid-cols-3">
                <StatBox label={language === 'tr' ? 'İzleme Geçmişi' : 'Watch History'} value={safeRecentlyWatched.length} />
                <StatBox label={language === 'tr' ? 'Favorilerim' : 'Favorites'} value={safeGlobalFavorites.length} />
                <StatBox label={language === 'tr' ? 'Toplam İçerik' : 'Total Content'} value={itemStats.total} />
              </div>
              <div>
                <SettingRow title={language === 'tr' ? 'İzleme Geçmişi' : 'Watch History'} description={language === 'tr' ? 'Daha önce izlediğiniz veya kaldığınız yer bilgisi kaydedilen tüm içerikleri siler.' : 'Deletes all content for which watch progress was saved.'}>
                  <button type="button" className={dangerButton} onClick={onClearRecentlyWatched}>{language === 'tr' ? 'Geçmişi Temizle' : 'Clear History'}</button>
                </SettingRow>
                <SettingRow title={language === 'tr' ? 'Favorilerim' : 'Favorites'} description={language === 'tr' ? 'Favoriler listenize eklediğiniz tüm kanal, dizi ve film kayıtlarını sıfırlar.' : 'Resets every channel, series, and movie record in your favorites list.'}>
                  <button type="button" className={dangerButton} onClick={onClearFavorites}>{language === 'tr' ? 'Favorileri Temizle' : 'Clear Favorites'}</button>
                </SettingRow>
                <SettingRow title={language === 'tr' ? 'Yerel Ayar Yedekleme' : 'Local Settings Backup'} description={language === 'tr' ? 'Strmly ayarlarını JSON dosyası olarak dışarı aktarın veya geri yükleyin.' : 'Export Strmly settings as a JSON file or restore them from one.'}>
                  <div className="flex items-center gap-2">
                    <button type="button" className={secondaryButton} onClick={exportSettings}>{language === 'tr' ? 'Yedeği Dışa Aktar' : 'Export Backup'}</button>
                    <label className={secondaryButton}>
                      {language === 'tr' ? 'Yedeği İçe Aktar' : 'Import Backup'}
                      <input type="file" accept=".json" className="hidden" onChange={(e) => importSettings(e.target.files?.[0])} />
                    </label>
                  </div>
                </SettingRow>
              </div>
            </>
          )}

          {activeTab.id === 'about' && (
            <>
              <PageHeader
                title={language === 'tr' ? 'Strmly Hakkında' : 'About Strmly'}
                description={language === 'tr' ? 'Sürüm bilgisi, güncellemeler ve proje bağlantıları.' : 'Version information, updates, and project links.'}
              />
              <div className="relative flex flex-col items-center overflow-hidden py-8 text-center">
                <div className="group relative mb-4">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/25 bg-white text-black shadow-[0_0_50px_rgba(255,255,255,0.1)] transition-transform duration-150 group-hover:scale-[1.03]">
                    <img src="./icon.png" className="h-14 w-14 object-contain" alt="Strmly" />
                  </div>
                  <span className="absolute -bottom-2.5 left-1/2 w-max -translate-x-1/2 rounded-full border border-white/15 bg-neutral-900 px-3 py-0.5 text-[10px] font-black tracking-wider text-white shadow-lg">
                    v{appVersion}
                  </span>
                </div>

                <h3 className="mt-3 text-3xl font-black not-italic leading-none tracking-tight text-white">STRMLY</h3>
                <p className="mt-4 max-w-lg text-xs font-medium leading-relaxed text-neutral-400">
                  {language === 'tr'
                    ? 'Canlı yayınlarınızı, dizilerinizi ve filmlerinizi tek bir uygulamada düzenleyip izleyin.'
                    : 'Organize and watch your live channels, series, and movies in one application.'}
                </p>

                <div className="mt-8 flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 shadow-2xl">
                  <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row">
                    <a
                      href="https://github.com/ardakrt/strmly-player"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-bold text-neutral-200 outline-none transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.08] active:bg-white/[0.11] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"
                    >
                      <Globe size={14} aria-hidden="true" />
                      <span>GitHub</span>
                      <ExternalLink size={11} className="opacity-60" aria-hidden="true" />
                    </a>
                    <a
                      href="https://github.com/ardakrt/strmly-player/blob/main/LICENSE"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-bold text-neutral-200 outline-none transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.08] active:bg-white/[0.11] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"
                    >
                      <FileText size={14} aria-hidden="true" />
                      <span>{language === 'tr' ? 'Lisans' : 'License'}</span>
                      <ExternalLink size={11} className="opacity-60" aria-hidden="true" />
                    </a>
                  </div>

                  <div className="h-px w-full bg-white/5" aria-hidden="true" />

                  <div className="flex w-full flex-col items-center gap-3" aria-live="polite">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                        {language === 'tr' ? 'Uygulama güncellemesi' : 'Application update'}
                      </span>
                      {updateState.status !== 'idle' && updateState.status !== 'available' && (
                        <p className="mt-0.5 text-xs font-semibold text-neutral-300">{updateState.message}</p>
                      )}
                    </div>

                    {updateState.status === 'idle' && (
                      <button
                        type="button"
                        onClick={handleCheckUpdates}
                        className="h-11 w-full rounded-xl bg-white px-6 text-xs font-extrabold uppercase tracking-wider text-black outline-none transition-colors duration-150 hover:bg-neutral-200 active:bg-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"
                      >
                        {language === 'tr' ? 'Güncellemeleri denetle' : 'Check for updates'}
                      </button>
                    )}

                    {updateState.status === 'checking' && (
                      <div className="my-1 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" role="status" aria-label={language === 'tr' ? 'Güncellemeler denetleniyor' : 'Checking for updates'} />
                    )}

                    {updateState.status === 'available' && (
                      <div className="flex min-h-11 items-center gap-2 text-xs font-semibold text-neutral-300" role="status">
                        <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
                        {language === 'tr' ? 'Güncelleme arka planda hazırlanıyor' : 'Preparing the update in the background'}
                      </div>
                    )}

                    {updateState.status === 'downloading' && (
                      <div className="mt-1 flex w-full flex-col gap-2">
                        <div
                          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                          role="progressbar"
                          aria-label={language === 'tr' ? 'Güncelleme indirme ilerlemesi' : 'Update download progress'}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(updateState.progress ?? 0)}
                        >
                          <div className="h-full bg-[var(--accent-color)] transition-[width] duration-300" style={{ width: `${updateState.progress ?? 0}%` }} />
                        </div>
                        <span className="text-right text-[10px] font-extrabold text-neutral-500">
                          %{Math.round(updateState.progress ?? 0)} {language === 'tr' ? 'indiriliyor' : 'downloading'}
                        </span>
                      </div>
                    )}

                    {updateState.status === 'downloaded' && (
                      <button
                        type="button"
                        onClick={handleInstallUpdateHelper}
                        className="h-11 w-full rounded-xl bg-emerald-500 px-6 text-xs font-extrabold uppercase tracking-wider text-white outline-none transition-colors duration-150 hover:bg-emerald-600 active:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        {language === 'tr' ? 'Kur ve yeniden başlat' : 'Install and restart'}
                      </button>
                    )}

                    {(updateState.status === 'not-available' || updateState.status === 'error') && (
                      <button
                        type="button"
                        onClick={handleCheckUpdates}
                        className="h-11 w-full rounded-xl bg-white/10 px-6 text-xs font-extrabold uppercase tracking-wider text-white outline-none transition-colors duration-150 hover:bg-white/20 active:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"
                      >
                        {language === 'tr' ? 'Yeniden denetle' : 'Check again'}
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-6 select-none text-[10px] font-semibold text-neutral-600">
                  © 2026 Strmly
                </p>
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
