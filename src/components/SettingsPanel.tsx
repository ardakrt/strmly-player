import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  BarChart3,
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
  Trash2,
  UploadCloud,
  X,
  Search,
  Tv,
  Film,
  Video
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import type { SavedPlaylist } from '../types';

const ACCENT_COLORS = [
  { color: '#FFFFFF', name: 'Beyaz' },
  { color: '#3b82f6', name: 'Mavi' },
  { color: '#10b981', name: 'Yeşil' },
  { color: '#f59e0b', name: 'Sarı' },
  { color: '#8b5cf6', name: 'Mor' },
  { color: '#f43f5e', name: 'Kırmızı' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#ec4899', name: 'Pembe' }
];

const THEMES = [
  { id: 'space-black', label: 'OLED Siyah' },
  { id: 'deep-space', label: 'Gece Mavisi' },
  { id: 'slate-dark', label: 'Koyu Slate' },
  { id: 'forest-mint', label: 'Orman Yeşili' },
  { id: 'sunset-orange', label: 'Günbatımı Kızılı' },
  { id: 'midnight-purple', label: 'Gece Yarısı Moru' }
];

const UPDATE_OPTIONS = [
  { value: 6, label: '6 Saat' },
  { value: 12, label: '12 Saat' },
  { value: 24, label: '1 Gün' },
  { value: 168, label: '7 Gün' }
] as const;

const fieldStyle = 'h-9 w-full md:w-64 rounded-lg border border-white/5 bg-white/[0.02] px-3 text-xs text-white outline-none transition-all placeholder:text-neutral-600 focus:border-[var(--accent-color)] focus:bg-white/[0.04]';
const labelStyle = 'text-[13px] font-bold text-neutral-100 tracking-wide';
const helpStyle = 'text-xs leading-relaxed text-neutral-400 mt-1 font-light';
const primaryButton = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-color)] px-4 text-xs font-black uppercase tracking-wider text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
const secondaryButton = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-4 text-xs font-bold uppercase tracking-wider text-neutral-200 transition-all hover:bg-white/[0.06] hover:text-white active:scale-[0.98] disabled:opacity-50 cursor-pointer';
const dangerButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-500/15 bg-red-950/15 px-3 text-xs font-bold uppercase tracking-wider text-red-300 transition-all hover:bg-red-900/20 active:scale-[0.98] cursor-pointer';
const EMPTY_ARRAY: never[] = [];

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

function CustomSelect({ value, onChange, options, className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full md:w-64 select-none ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 pr-9 text-xs text-white outline-none flex items-center justify-between transition-all hover:bg-white/[0.04] hover:border-white/20 active:scale-[0.98] text-left"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={14} className={`text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-neutral-950 p-1 backdrop-blur-xl shadow-2xl animate-fade-in scrollbar-thin">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs font-semibold rounded-md transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-[var(--accent-color)] text-black font-black'
                    : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="truncate pr-2">{option.label}</span>
                {isSelected && <Check size={12} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 border-b border-white/5 pb-4">
      <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400 font-medium">{description}</p>
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
  vertical = false
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  vertical?: boolean;
}) {
  if (vertical) {
    return (
      <div className="flex flex-col gap-3 py-5 border-b border-white/[0.04] last:border-b-0">
        <div>
          <div className={labelStyle}>{title}</div>
          {description && <p className={helpStyle}>{description}</p>}
        </div>
        <div className="w-full mt-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-5 border-b border-white/[0.04] last:border-b-0">
      <div className="max-w-xl">
        <div className={labelStyle}>{title}</div>
        {description && <p className={helpStyle}>{description}</p>}
      </div>
      <div className="w-full md:w-auto shrink-0 flex justify-end">
        {children}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 text-center hover:bg-white/[0.02] transition-all duration-200 select-none">
      <div className="text-xl font-black text-white leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-6 text-center">
      <div className="p-3 rounded-full bg-white/[0.02] border border-white/5 text-neutral-500 mb-3">
        <Icon size={20} />
      </div>
      <div className="text-xs font-bold text-neutral-200">{title}</div>
      <div className="mt-1 max-w-xs text-[11px] leading-relaxed text-neutral-500">{description}</div>
    </div>
  );
}

export const SettingsPanel = () => {
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
    items, isCheckingHealth, checkerLog, runPlaylistDiagnostics,
    onPlaylistLoadFromUrl, onPlaylistLoadLocal, onXtreamLoad,
    onSelectPlaylist, onDeletePlaylist,
    onRestoreCategory, onRestoreSeriesCategory, onRestoreMovieCategory,
    onResetHiddenCategories, onResetHiddenSeriesCategories, onResetHiddenMovieCategories,
    onSaveSetting, onShowToast,
    onClearRecentlyWatched, onClearFavorites,
    onRefreshPlaylist,
    onUpdatePlaylistAutoUpdateInterval
  } = useSettings();

  const safePlaylists = Array.isArray(playlists) ? playlists : EMPTY_ARRAY;
  const safeHiddenCategories = Array.isArray(hiddenCategories) ? hiddenCategories : EMPTY_ARRAY;
  const safeHiddenSeriesCategories = Array.isArray(hiddenSeriesCategories) ? hiddenSeriesCategories : EMPTY_ARRAY;
  const safeHiddenMovieCategories = Array.isArray(hiddenMovieCategories) ? hiddenMovieCategories : EMPTY_ARRAY;
  const safeItems = Array.isArray(items) ? items : EMPTY_ARRAY;
  const safeCheckerLog = Array.isArray(checkerLog) ? checkerLog : EMPTY_ARRAY;
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
  const [transcodeMode, setTranscodeMode] = useState(() => {
    try { return localStorage.getItem('strmly_transcode_mode') || 'copy'; } catch { return 'copy'; }
  });
  const [bufferEnabled, setBufferEnabled] = useState(() => {
    try { return localStorage.getItem('strmly_buffer_enabled') === 'true'; } catch { return false; }
  });
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
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'playback', label: t('settings.tabs.playback'), icon: Check },
    { id: 'network', label: t('settings.tabs.network'), icon: UploadCloud },
    { id: 'stats', label: t('settings.tabs.stats'), icon: BarChart3 },
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

  const topGroups = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of safeItems) {
      const group = item.group || (language === 'tr' ? 'Diğer' : 'Other');
      counts[group] = (counts[group] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [safeItems, language]);

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
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strmly-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast(language === 'tr' ? 'Ayarlar dışa aktarıldı.' : 'Settings exported.');
    } catch {
      onShowToast(language === 'tr' ? 'Dışa aktarma hatası.' : 'Export error.');
    }
  };

  const importSettings = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const settings = JSON.parse(reader.result as string);
        Object.entries(settings).forEach(([key, value]) => {
          localStorage.setItem(key, String(value));
        });
        onShowToast(language === 'tr' ? 'Ayarlar içe aktarıldı. Uygulamayı yenileyin.' : 'Settings imported. Please refresh the app.');
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
          <button className="min-w-0 text-left cursor-pointer flex-1 group/play" onClick={() => onSelectPlaylist(playlist.id)}>
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
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              disabled={isParsing}
              onClick={() => onRefreshPlaylist(playlist)}
              title={language === 'tr' ? 'Listeyi Güncelle' : 'Update Playlist'}
            >
              <RefreshCw size={12} className={isParsing && isActive ? 'animate-spin text-[var(--accent-color)]' : ''} />
            </button>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/15 bg-red-950/15 text-red-300 hover:bg-red-900/20 transition-all active:scale-95 cursor-pointer"
              onClick={() => onDeletePlaylist(playlist.id)}
              title={language === 'tr' ? 'Listeyi Sil' : 'Delete Playlist'}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Otomatik Güncelleme' : 'Auto Update'}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {UPDATE_OPTIONS.map(option => (
              <button
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
                  <button
                    onClick={() => restore(group)}
                    className="inline-flex h-7.5 items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/10 transition-all cursor-pointer shrink-0"
                    title={language === 'tr' ? 'Kategoriyi Göster' : 'Show Category'}
                  >
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
    <div className="settings-redesign pb-10 text-[14px] leading-relaxed text-neutral-200">
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
              <button
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

          {activeTab.id === 'playlists' && (
            <>
              <PageHeader 
                title={t('settings.playlists.title')} 
                description={language === 'tr' ? 'M3U ve Xtream kaynaklarını ekleyin, aktif listeyi seçin ve otomatik güncelleme aralığını belirleyin.' : 'Add M3U and Xtream sources, select the active playlist, and set the auto-update interval.'} 
              />
              <div className="mb-5 flex justify-end">
                <button className={showAddPlaylistForm ? secondaryButton : primaryButton} onClick={() => setShowAddPlaylistForm(!showAddPlaylistForm)}>
                  {showAddPlaylistForm ? <X size={14} /> : <Plus size={14} />}
                  {showAddPlaylistForm ? t('common.close') : t('settings.playlists.addPlaylist')}
                </button>
              </div>

              {showAddPlaylistForm && (
                <div className="rounded-2xl border border-white/5 p-5 mb-5 bg-white/[0.005] animate-scale-in">
                  <div className="mb-4 inline-grid grid-cols-2 w-full max-w-[200px] rounded-lg border border-white/8 bg-black/40 p-0.5">
                    <button
                      className={`h-7.5 rounded text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        playlistMode === 'xtream'
                          ? 'bg-white text-black shadow-sm font-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      onClick={() => setPlaylistMode('xtream')}
                    >
                      Xtream
                    </button>
                    <button
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
                          <button className={primaryButton} disabled={isParsing || !m3uUrl.trim()} onClick={onPlaylistLoadFromUrl}>
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
                        <button className={`${primaryButton} md:col-span-2 mt-1`} disabled={isParsing || !xtreamUrl.trim() || !xtreamUser.trim() || !xtreamPass.trim()} onClick={onXtreamLoad}>
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
                <button
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

                <button
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

                <button
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
                  <button
                    onClick={() => setCategorySubTab('all')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      categorySubTab === 'all'
                        ? 'bg-white/[0.06] text-[var(--accent-color)] border border-white/10 shadow-sm font-black'
                        : 'text-neutral-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    {language === 'tr' ? 'Tümü' : 'All'} ({categoryTotal})
                  </button>
                  <button
                    onClick={() => setCategorySubTab('live')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      categorySubTab === 'live'
                        ? 'bg-white/[0.06] text-[var(--accent-color)] border border-white/10 shadow-sm font-black'
                        : 'text-neutral-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    {language === 'tr' ? 'Canlı TV' : 'Live TV'} ({safeHiddenCategories.length})
                  </button>
                  <button
                    onClick={() => setCategorySubTab('series')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      categorySubTab === 'series'
                        ? 'bg-white/[0.06] text-[var(--accent-color)] border border-white/10 shadow-sm font-black'
                        : 'text-neutral-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    {language === 'tr' ? 'Diziler' : 'Series'} ({safeHiddenSeriesCategories.length})
                  </button>
                  <button
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
                      <button 
                        onClick={() => setCategorySearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <button
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
                  >
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
                      }
                      
                      return (
                        <button
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
                             theme.id === 'midnight-purple' ? (language === 'tr' ? 'Gece Yarısı Moru' : 'Midnight Purple') : theme.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </SettingRow>

                <SettingRow title={t('settings.appearance.accentColor')} description={t('settings.appearance.accentDesc')} vertical={true}>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_COLORS.map(item => (
                      <button
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
                        <button
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
                        <button
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
                        <button
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
                  <button
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
                  <button
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
                  <button
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
                    <button
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
                  title={language === 'tr' ? "Dönüştürme (Transcode) Performansı" : "Transcoding Performance"}
                  description={language === 'tr' 
                    ? "Desteklenmeyen ses formatlarına sahip (AC3/DTS vb.) yayınlarda sesin nasıl yeniden kodlanacağını belirler. Hızlı modu CPU tüketmez." 
                    : "Determines how audio is re-encoded for streams with unsupported audio formats (like AC3/DTS). Fast mode uses almost zero CPU."}
                >
                  <CustomSelect
                    value={transcodeMode}
                    onChange={(val) => {
                      setTranscodeMode(val);
                      saveLocalSetting('strmly_transcode_mode', val);
                    }}
                    options={[
                      {
                        value: 'copy',
                        label: language === 'tr' ? 'Hızlı (Sadece Ses Kodlanır, Düşük CPU)' : 'Fast (Transcode Audio Only, Low CPU)'
                      },
                      {
                        value: 'full',
                        label: language === 'tr' ? 'Uyumlu (Ses ve Video Kodlanır, Yüksek CPU)' : 'Compatible (Transcode Audio & Video, High CPU)'
                      }
                    ]}
                  />
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

          {activeTab.id === 'stats' && (
            <>
              <PageHeader title="Sağlık ve Analiz" description="Çalma listenizdeki içerik dağılımını görün ve yayınların erişilebilirlik testlerini yapın." />
              <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr] items-start">
                <div className="rounded-2xl border border-white/5 bg-white/[0.005]">
                  <div className="grid grid-cols-3 gap-2 p-3 border-b border-white/5">
                    <StatBox label="Canlı" value={itemStats.live} />
                    <StatBox label="Film" value={itemStats.movie} />
                    <StatBox label="Dizi" value={itemStats.series} />
                  </div>
                  <div className="p-4.5">
                    <div className="mb-3.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">En Yoğun Kategoriler</div>
                    <div className="space-y-3.5">
                      {topGroups.map(([group, count]) => (
                        <div key={group}>
                          <div className="flex justify-between gap-3 text-xs font-medium">
                            <span className="truncate text-neutral-300">{group}</span>
                            <span className="text-neutral-500 font-bold">{count}</span>
                          </div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-[var(--accent-color)] transition-all duration-500"
                              style={{ width: `${Math.max(8, (count / (topGroups[0]?.[1] || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.005] overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/5 p-4.5 bg-black/15">
                    <div>
                      <div className="text-xs font-bold text-white tracking-wide">Yayın Kontrolü</div>
                      <div className={helpStyle}>Çalma listenizdeki ilk 20 kanalın bağlantı testini yapar.</div>
                    </div>
                    <button className={primaryButton} disabled={isCheckingHealth} onClick={runPlaylistDiagnostics}>
                      {isCheckingHealth ? 'Test Ediliyor' : 'Testi Başlat'}
                    </button>
                  </div>
                  
                  <div className="p-4.5">
                    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#000]/40">
                      <div className="flex items-center gap-1.5 bg-black/30 px-3.5 py-2 border-b border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/80" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/80" />
                        <span className="text-[8px] uppercase font-bold tracking-widest text-neutral-500 ml-1 select-none">Tanılama Terminali</span>
                      </div>
                      <div className="max-h-[180px] min-h-[140px] overflow-y-auto p-3.5 font-mono text-[10px] leading-5 text-neutral-400 bg-neutral-950/20 hide-scrollbar">
                        {safeCheckerLog.length === 0 ? (
                          <div className="text-neutral-600 italic select-none">// Test başlatıldığında çıktılar burada görünecektir...</div>
                        ) : (
                          safeCheckerLog.map((line, index) => {
                            let colorClass = 'text-neutral-400';
                            if (line.includes('✓') || line.includes('EVRİMİÇİ') || line.includes('ONLINE')) colorClass = 'text-emerald-400 font-medium';
                            else if (line.includes('HATA') || line.includes('EVRİMDIŞI') || line.includes('OFFLINE')) colorClass = 'text-rose-400 font-medium';
                            else if (line.includes('test ediliyor') || line.includes('başlatılıyor')) colorClass = 'text-cyan-400';
                            return (
                              <div key={index} className={`flex items-start gap-1.5 ${colorClass}`}>
                                <span className="text-neutral-600 select-none">{'>'}</span>
                                <span>{line}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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
                  <button className={dangerButton} onClick={onClearRecentlyWatched}>Geçmişi Temizle</button>
                </SettingRow>
                <SettingRow title="Favorilerim" description="Favoriler listenize eklediğiniz tüm kanal, dizi ve film kayıtlarını sıfırlar.">
                  <button className={dangerButton} onClick={onClearFavorites}>Favorileri Temizle</button>
                </SettingRow>
                <SettingRow title="Yerel Ayar Yedekleme" description="Strmly ayarlarını JSON dosyası olarak dışarı aktarın veya geri yükleyin.">
                  <div className="flex items-center gap-2">
                    <button className={secondaryButton} onClick={exportSettings}>Yedeği Dışa Aktar</button>
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
              <div className="relative overflow-hidden flex flex-col items-center text-center py-4">
                <div className="relative w-16 h-16 rounded-[20px] bg-white text-black flex items-center justify-center shadow-md mb-4 border border-white/20 hover:scale-105 transition-all duration-300">
                  <img src="./icon.png" className="w-10 h-10 object-contain" alt="Strmly Logo" />
                </div>

                <h3 className="text-2xl font-black tracking-tight text-white leading-none">STRMLY</h3>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--accent-color)] mt-1.5">Strmly</p>
                <p className="mt-3.5 max-w-sm text-xs leading-relaxed text-neutral-400 font-medium">
                  Strmly, en sevdiğiniz canlı yayınları, dizileri ve filmleri son derece akıcı cam arayüzü ve yüksek performanslı oynatma motoruyla izlemeniz için geliştirilmiş yeni nesil IPTV oynatıcıdır.
                </p>

                <div className="mt-8 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-white/5 pt-6">
                  <div className="rounded-xl border border-white/5 bg-white/[0.005] p-3">
                    <div className="text-base font-black text-white">1.5.7</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-500">Versiyon</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.005] p-3">
                    <div className="text-base font-black text-white">Electron</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-500">Platform</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.005] p-3">
                    <div className="text-base font-black text-white">React 19</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-500">Teknoloji</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.005] p-3">
                    <div className="text-base font-black text-white">TMDB v3</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-500">Meta Veri</div>
                  </div>
                </div>
                <div className="w-full max-w-sm mt-8 border-t border-white/5 pt-6 flex flex-col items-center gap-4">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Uygulama Güncellemesi</span>
                    {updateState.status !== 'idle' && (
                      <p className="text-xs font-semibold text-neutral-300 mt-1">{updateState.message}</p>
                    )}
                  </div>

                  {updateState.status === 'idle' && (
                    <button
                      onClick={handleCheckUpdates}
                      className="px-6 py-2.5 bg-white hover:bg-neutral-200 text-black font-extrabold text-xs uppercase rounded-full shadow-lg transition-transform active:scale-95 transform cursor-pointer"
                    >
                      Güncelleştirmeleri Denetle
                    </button>
                  )}

                  {updateState.status === 'checking' && (
                    <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin mt-1" />
                  )}

                  {updateState.status === 'available' && (
                    <button
                      onClick={handleDownloadUpdate}
                      className="px-6 py-2.5 bg-white hover:bg-neutral-200 text-black font-extrabold text-xs uppercase rounded-full shadow-lg transition-transform active:scale-95 transform cursor-pointer"
                    >
                      Güncellemeyi İndir
                    </button>
                  )}

                  {updateState.status === 'downloading' && (
                    <div className="w-full max-w-xs flex flex-col gap-2 mt-1">
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-[var(--accent-color)] h-full transition-all duration-300" style={{ width: `${updateState.progress ?? 0}%` }} />
                      </div>
                      <span className="text-[10px] text-neutral-500 font-extrabold text-right">% {updateState.progress ?? 0} İndiriliyor</span>
                    </div>
                  )}

                  {updateState.status === 'downloaded' && (
                    <button
                      onClick={handleInstallUpdate}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs uppercase rounded-full shadow-lg transition-all active:scale-95 transform cursor-pointer animate-pulse mt-1"
                    >
                      Güncellemeyi Kur ve Yeniden Başlat
                    </button>
                  )}

                  {(updateState.status === 'not-available' || updateState.status === 'error') && (
                    <button
                      onClick={handleCheckUpdates}
                      className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs uppercase rounded-full shadow-md transition-transform active:scale-95 transform cursor-pointer"
                    >
                      Yeniden Denetle
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
