import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Check,
  Database,
  EyeOff,
  HardDrive,
  Info,
  Palette,
  Download,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
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

import { EMPTY_ARRAY } from './SettingsControls';
import { SettingsDataTab } from './settings/SettingsDataTab';
import { SettingsAboutTab, type SettingsUpdateState } from './settings/SettingsAboutTab';
import { SettingsAppearanceTab } from './settings/SettingsAppearanceTab';
import { SettingsPlaybackTab } from './settings/SettingsPlaybackTab';
import { SettingsDownloadsTab } from './settings/SettingsDownloadsTab';
import { MoveDownloadsDialog, type MoveDownloadsProgress } from './settings/MoveDownloadsDialog';
import { SettingsCategoriesTab } from './settings/SettingsCategoriesTab';
import { SettingsPlaylistsTab } from './settings/SettingsPlaylistsTab';

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
    onUpdatePlaylistAutoUpdateInterval,
  } = useSettings();

  const { downloads } = useDownloads();

  const safePlaylists = Array.isArray(playlists) ? playlists : EMPTY_ARRAY;
  const safeHiddenCategories = Array.isArray(hiddenCategories) ? hiddenCategories : EMPTY_ARRAY;
  const safeHiddenSeriesCategories = Array.isArray(hiddenSeriesCategories) ? hiddenSeriesCategories : EMPTY_ARRAY;
  const safeHiddenMovieCategories = Array.isArray(hiddenMovieCategories) ? hiddenMovieCategories : EMPTY_ARRAY;

  const safeRecentlyWatched = Array.isArray(recentlyWatched) ? recentlyWatched : EMPTY_ARRAY;
  const safeGlobalFavorites = Array.isArray(globalFavorites) ? globalFavorites : EMPTY_ARRAY;

  const [refreshingPlaylistId, setRefreshingPlaylistId] = useState<string | null>(null);

  const [updateState, setUpdateState] = useState<SettingsUpdateState>({ status: 'idle', message: '' });
  const hasAutoCheckedUpdatesRef = useRef(false);

  const [downloadsFolder, setDownloadsFolder] = useState<string>('');
  const [showMoveDownloadsPrompt, setShowMoveDownloadsPrompt] = useState<boolean>(false);
  const [pendingDownloadsFolder, setPendingDownloadsFolder] = useState<string>('');
  const [pendingDownloadsFolderToken, setPendingDownloadsFolderToken] = useState<string>('');
  const [moveExistingDownloads, setMoveExistingDownloads] = useState<boolean>(true);
  const [isMovingDownloads, setIsMovingDownloads] = useState<boolean>(false);
  const [moveProgress, setMoveProgress] = useState<MoveDownloadsProgress | null>(null);
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

    const applyUpdateState = (data: any) => {
      setUpdateState(prev => ({
        ...prev,
        status: data.status,
        message: data.status === 'error' ? t('settings.updates.installFailed') : data.message,
        version: data.version || prev.version,
        progress: data.status === 'downloading' ? (prev.progress ?? 0) : data.status === 'downloaded' ? 100 : undefined
      }));
    };

    const unsubStatus = window.electronAPI.onUpdateStatus(applyUpdateState);

    const unsubProgress = window.electronAPI.onUpdateProgress((data: any) => {
      setUpdateState(prev => ({
        ...prev,
        status: 'downloading',
        progress: data.percent
      }));
    });

    window.electronAPI.getUpdateState?.().then(applyUpdateState).catch(() => {});

    return () => {
      if (unsubStatus) unsubStatus();
      if (unsubProgress) unsubProgress();
    };
  }, [t]);

  const handleCheckUpdates = useCallback(async () => {
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
      setUpdateState({ status: 'checking', message: t('settings.updates.checking') });
      const res = await window.electronAPI.checkForUpdates();
      if (res && !res.success) {
        console.error('Update check failed:', res.error);
        setUpdateState({ status: 'error', message: t('settings.updates.checkFailed') });
      }
    } else {
      setUpdateState({ status: 'error', message: t('settings.updates.apiUnavailable') });
    }
  }, [t]);

  const handleInstallUpdate = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.installUpdate) {
      setUpdateState({ status: 'error', message: t('settings.updates.apiUnavailable') });
      return;
    }

    setUpdateState(prev => ({
      ...prev,
      status: prev.status === 'downloaded' ? 'downloaded' : 'downloading',
      message: t('settings.updates.downloading'),
      progress: prev.progress ?? 0,
    }));
    try {
      const result = await api.installUpdate();
      if (result.success) return;
      setUpdateState(prev => ({
        ...prev,
        status: 'error',
        message: t('settings.updates.installFailed'),
      }));
    } catch {
      setUpdateState(prev => ({
        ...prev,
        status: 'error',
        message: t('settings.updates.installFailed'),
      }));
    }
  }, [t]);

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
          onShowToast(t('settings.backup.exportError'));
        }
        worker.terminate();
      };
      worker.postMessage({ type: 'export', payload: settings });
    } catch {
      onShowToast(t('settings.backup.exportError'));
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
              onShowToast(t('settings.backup.importSuccess'));
            } else {
              console.error('Settings import worker failed:', error);
              onShowToast(t('settings.backup.importError'));
            }
          } catch (importError) {
            console.error('Settings import failed:', importError);
            onShowToast(t('settings.backup.importError'));
          } finally {
            worker.terminate();
          }
        };
        worker.postMessage({ type: 'import', payload: reader.result as string });
      } catch {
        onShowToast(t('settings.backup.importError'));
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
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 min-h-[600px]">
        <aside className="p-1 flex flex-col gap-1 select-none w-full shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 px-3 mb-2 hidden lg:block">{language === 'tr' ? 'Menü' : 'Menu'}</span>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const selected = activeTab.id === tab.id;
            return (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveSettingsTab(tab.id)}
                className={`flex h-11 items-center gap-3 rounded-xl px-3.5 text-left text-xs font-bold transition-all duration-200 cursor-pointer ${
                  selected
                    ? 'bg-white text-black shadow-md'
                    : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={15} className={selected ? 'text-black' : 'text-neutral-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>
        <section className="p-1 overflow-y-auto max-h-[78vh] custom-scrollbar">

          {activeTab.id === 'downloads' && (
            <SettingsDownloadsTab
              language={language}
              t={t}
              downloadCount={downloads.length}
              completedCount={downloads.filter((download) => download.status === 'completed').length}
              downloadsFolder={downloadsFolder}
              segmentConcurrency={segmentConcurrency}
              downloadMaxHeight={downloadMaxHeight}
              onOpenDownloads={() => onNavigate?.('İndirilenler')}
              onSelectDownloadsFolder={async () => {
                if (!window.electronAPI?.selectDownloadsFolder) return;
                const result = await window.electronAPI.selectDownloadsFolder();
                if (!result.canceled && result.filePath && result.selectionToken) {
                  setPendingDownloadsFolder(result.filePath);
                  setPendingDownloadsFolderToken(result.selectionToken);
                  setShowMoveDownloadsPrompt(true);
                }
              }}
              onChangeSegmentConcurrency={(value) => {
                setSegmentConcurrency(value);
                onSaveSetting('cinema_download_segment_concurrency', value);
                onShowToast(language === 'tr' ? `Segment paralelliği: ${value}` : `Segment concurrency: ${value}`);
              }}
              onChangeDownloadMaxHeight={(value) => {
                setDownloadMaxHeight(value);
                onSaveSetting('cinema_download_max_height', value);
                onShowToast(language === 'tr' ? `İndirme kalitesi: ${value}p` : `Download quality: ${value}p`);
              }}
            />
          )}
          {activeTab.id === 'playlists' && (
            <SettingsPlaylistsTab
              language={language}
              t={t}
              playlists={safePlaylists}
              activePlaylistId={activePlaylistId}
              refreshingPlaylistId={refreshingPlaylistId}
              showAddForm={showAddPlaylistForm}
              playlistMode={playlistMode}
              formName={playlistFormName}
              m3uUrl={m3uUrl}
              xtreamUrl={xtreamUrl}
              xtreamUser={xtreamUser}
              xtreamPass={xtreamPass}
              isParsing={isParsing}
              onToggleAddForm={() => setShowAddPlaylistForm(!showAddPlaylistForm)}
              onChangePlaylistMode={setPlaylistMode}
              onChangeFormName={setPlaylistFormName}
              onChangeM3uUrl={setM3uUrl}
              onChangeXtreamUrl={setXtreamUrl}
              onChangeXtreamUser={setXtreamUser}
              onChangeXtreamPass={setXtreamPass}
              onLoadFromUrl={onPlaylistLoadFromUrl}
              onLoadLocal={onPlaylistLoadLocal}
              onXtreamLoad={onXtreamLoad}
              onSelectPlaylist={onSelectPlaylist}
              onDeletePlaylist={onDeletePlaylist}
              onRefreshPlaylist={handleManualPlaylistRefresh}
              onUpdateAutoInterval={onUpdatePlaylistAutoUpdateInterval}
            />
          )}
          {activeTab.id === 'categories' && (
            <SettingsCategoriesTab
              language={language}
              t={t}
              hiddenCategories={safeHiddenCategories}
              hiddenSeriesCategories={safeHiddenSeriesCategories}
              hiddenMovieCategories={safeHiddenMovieCategories}
              onRestoreCategory={onRestoreCategory}
              onRestoreSeriesCategory={onRestoreSeriesCategory}
              onRestoreMovieCategory={onRestoreMovieCategory}
              onResetHiddenCategories={onResetHiddenCategories}
              onResetHiddenSeriesCategories={onResetHiddenSeriesCategories}
              onResetHiddenMovieCategories={onResetHiddenMovieCategories}
            />
          )}
          {activeTab.id === 'appearance' && (
            <SettingsAppearanceTab
              language={language}
              t={t}
              cardLayoutSize={cardLayoutSize}
              uiScale={uiScale}
              onChangeLanguage={(nextLanguage) => {
                setLanguage(nextLanguage);
                onShowToast(nextLanguage === 'tr' ? 'Dil Türkçe olarak ayarlandı.' : 'Language set to English.');
              }}
              onChangeCardLayoutSize={(size) => {
                setCardLayoutSize(size);
                onSaveSetting('cinema_card_layout_size', size);
              }}
              onChangeUiScale={changeUiScale}
            />
          )}

          {activeTab.id === 'playback' && (
            <SettingsPlaybackTab
              language={language}
              t={t}
              defaultPlayer={defaultPlayer}
              autoPlayNext={autoPlayNext}
              bufferEnabled={bufferEnabled}
              iptvUpdateMode={iptvUpdateMode}
              bufferSize={bufferSize}
              connectionTimeout={connectionTimeout}
              retryCount={retryCount}
              hwAccelerationEnabled={hwAccelerationEnabled}
              onChangeDefaultPlayer={(value) => {
                setDefaultPlayer(value);
                onSaveSetting('cinema_default_player', value);
                onShowToast(`${t('settings.players.saveSuccess')} (${value.toUpperCase()})`);
              }}
              onToggleAutoPlayNext={() => {
                const next = !autoPlayNext;
                setAutoPlayNext(next);
                saveLocalSettingHelper(AUTOPLAY_NEXT_KEY, String(next));
              }}
              onToggleBuffer={() => {
                const next = !bufferEnabled;
                setBufferEnabled(next);
                saveLocalSettingHelper(BUFFER_ENABLED_KEY, String(next));
              }}
              onChangeUpdateMode={setIptvUpdateMode}
              onChangeBufferSize={(value) => {
                setBufferSize(value);
                saveLocalSettingHelper(BUFFER_SIZE_KEY, value);
              }}
              onChangeConnectionTimeout={(value) => {
                setConnectionTimeout(value);
                saveLocalSettingHelper(CONNECTION_TIMEOUT_KEY, value);
              }}
              onChangeRetryCount={(value) => {
                setRetryCount(value);
                saveLocalSettingHelper(RETRY_COUNT_KEY, value);
              }}
              onToggleHardwareAcceleration={async () => {
                const next = !hwAccelerationEnabled;
                setHwAccelerationEnabled(next);
                try {
                  localStorage.setItem('strmly_hw_acceleration_enabled', String(next));
                  if (window.electronAPI?.saveConfig) await window.electronAPI.saveConfig('disableHardwareAcceleration', !next);
                  if (window.confirm(t('settings.details.restartPrompt')) && window.electronAPI?.relaunchApp) window.electronAPI.relaunchApp();
                } catch (error) {
                  console.error(error);
                }
              }}
            />
          )}



          {activeTab.id === 'data' && (
            <SettingsDataTab
              language={language}
              t={t}
              watchHistoryCount={safeRecentlyWatched.length}
              favoritesCount={safeGlobalFavorites.length}
              totalContent={itemStats.total}
              onClearRecentlyWatched={onClearRecentlyWatched}
              onClearFavorites={onClearFavorites}
              onExportSettings={exportSettings}
              onImportSettings={importSettings}
            />
          )}

          {activeTab.id === 'about' && (
            <SettingsAboutTab
              language={language}
              t={t}
              appVersion={appVersion}
              updateState={updateState}
              onCheckUpdates={handleCheckUpdates}
              onInstallUpdate={handleInstallUpdate}
            />
          )}
        </section>
      </div>
      {showMoveDownloadsPrompt && (
        <MoveDownloadsDialog
          language={language}
          t={t}
          folderPath={pendingDownloadsFolder}
          activeAccent={activeAccent}
          moveExisting={moveExistingDownloads}
          isMoving={isMovingDownloads}
          progress={moveProgress}
          onToggleMoveExisting={() => setMoveExistingDownloads((current) => !current)}
          onCancel={() => {
            setShowMoveDownloadsPrompt(false);
            setPendingDownloadsFolder('');
            setPendingDownloadsFolderToken('');
          }}
          onApply={async () => {
            if (!window.electronAPI?.setDownloadsFolder) return;
            setIsMovingDownloads(true);
            setMoveProgress({ percent: 0, currentFile: '', filesMoved: 0, totalFiles: 0 });
            try {
              const result = await window.electronAPI.setDownloadsFolder({
                folderPath: pendingDownloadsFolder,
                moveExisting: moveExistingDownloads,
                selectionToken: pendingDownloadsFolderToken,
              });
              if (result?.success) {
                setDownloadsFolder(pendingDownloadsFolder);
                onShowToast(language === 'tr' ? 'İndirme konumu güncellendi!' : 'Download directory updated!');
              } else {
                console.error('Failed to move downloads folder:', result?.error);
                onShowToast(t('feedback.downloads.moveFailed'));
              }
            } catch (error) {
              console.error('Failed to move downloads folder:', error);
              onShowToast(t('feedback.downloads.moveFailed'));
            } finally {
              setIsMovingDownloads(false);
              setShowMoveDownloadsPrompt(false);
              setPendingDownloadsFolder('');
              setPendingDownloadsFolderToken('');
              setMoveProgress(null);
            }
          }}
        />
      )}
    </div>
  );
};
