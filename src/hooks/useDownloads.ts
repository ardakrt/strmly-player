import { useCallback, useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { addDownloadItem } from './downloads/downloadAddAction';
import { syncDownloadsWithDisk } from './downloads/downloadDiskSync';
import { ensureDownloadIpcListeners } from './downloads/downloadIpcListeners';
import { createDownloadQueueActions } from './downloads/downloadQueueActions';
import {
  loadPersistedDownloads,
  persistDownloads,
} from './downloads/downloadPersistence';
import type {
  DownloadItem,
  DownloadPersistAdapter,
  DownloadQueueItem,
} from './downloads/downloadTypes';
export type { DownloadItem, DownloadStatus } from './downloads/downloadTypes';

// Key used with the app's profile-scoped setting storage (saveAppSetting/loadAppSetting),
// which automatically prefixes it per active profile and persists it durably
// (Electron config file + localStorage), not just in the browser's localStorage.
let downloadsState: DownloadItem[] = [];
let queue: DownloadQueueItem[] = [];
let activeDownloadId: string | null = null;
const listeners = new Set<() => void>();

// Tracks which profile's data currently lives in `downloadsState`.
// `undefined` = nothing hydrated yet (fresh app start).
let hydratedProfileId: string | null | undefined = undefined;
let hydratingProfileId: string | null | undefined = undefined;

// Set by whichever `useDownloads()` instance is currently mounted, so module-level
// helpers (outside of React) can persist through the app's real settings storage.
let persistAdapter: DownloadPersistAdapter | null = null;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastUiEmitAt = 0;
const UI_EMIT_MIN_MS = 300;
const SAVE_DEBOUNCE_MS = 1200;

function saveDownloadsNow(downloads: DownloadItem[]) {
  persistDownloads(downloads, persistAdapter);
}

function scheduleSaveDownloads(downloads: DownloadItem[], force = false) {
  if (force) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveDownloadsNow(downloads);
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDownloadsNow(downloadsState);
  }, SAVE_DEBOUNCE_MS);
}

function emitDownloads(options?: { forceSave?: boolean; throttleUi?: boolean }) {
  const forceSave = options?.forceSave ?? false;
  const throttleUi = options?.throttleUi ?? false;
  scheduleSaveDownloads(downloadsState, forceSave);

  const now = Date.now();
  if (throttleUi && now - lastUiEmitAt < UI_EMIT_MIN_MS) {
    // Still schedule a trailing UI emit so the final progress isn't stuck.
    window.setTimeout(() => {
      if (Date.now() - lastUiEmitAt >= UI_EMIT_MIN_MS) {
        lastUiEmitAt = Date.now();
        listeners.forEach((listener) => listener());
      }
    }, UI_EMIT_MIN_MS);
    return;
  }
  lastUiEmitAt = now;
  listeners.forEach((listener) => listener());
}

function setDownloads(
  updater: (downloads: DownloadItem[]) => DownloadItem[],
  options?: { forceSave?: boolean; throttleUi?: boolean },
) {
  downloadsState = updater(downloadsState);
  emitDownloads(options);
}

// Loads (and migrates, if needed) the downloads list for `profileId`, replacing
// whatever is currently in memory. If a different profile was active before,
// any of its in-flight activity is stopped first so it can't keep writing into
// what the UI now presents as the new profile's list.
async function hydrateDownloadsForProfile(
  profileId: string,
  adapter: DownloadPersistAdapter,
) {
  if (hydratingProfileId === profileId) return;
  const isProfileSwitch =
    hydratedProfileId !== undefined && hydratedProfileId !== profileId;
  hydratingProfileId = profileId;

  try {
    if (isProfileSwitch) {
      if (activeDownloadId) {
        try {
          await window.electronAPI?.cancelDownload?.(activeDownloadId);
        } catch {
          // Best-effort: the download will simply become an orphaned process
          // if this fails, which is no worse than before this hydration ran.
        }
        activeDownloadId = null;
      }
      queue = [];
    }

    downloadsState = await loadPersistedDownloads(adapter);
    hydratedProfileId = profileId;
    listeners.forEach((listener) => listener());
  } finally {
    if (hydratingProfileId === profileId) {
      hydratingProfileId = undefined;
    }
  }
}

function updateQueuePositions() {
  setDownloads((downloads) =>
    downloads.map((download) => {
      const queueIndex = queue.findIndex((item) => item.id === download.id);
      if (queueIndex === -1) {
        return download.queuePosition
          ? { ...download, queuePosition: undefined }
          : download;
      }
      return { ...download, queuePosition: queueIndex + 1, status: "pending" };
    }),
  );
}

async function startNextDownload() {
  if (activeDownloadId || queue.length === 0) return;

  const next = queue.shift();
  if (!next) return;

  activeDownloadId = next.id;
  updateQueuePositions();
  setDownloads((downloads) =>
    downloads.map((download) =>
      download.id === next.id
        ? {
            ...download,
            status: "downloading",
            speed: "",
            timeLeft: "",
            queuePosition: undefined,
            error: undefined,
          }
        : download,
    ),
  );

  const currentLang = typeof localStorage !== 'undefined' && localStorage.getItem('cinema_language') === 'en' ? 'en' : 'tr';

  if (!window.electronAPI?.downloadStream) {
    setDownloads((downloads) =>
      downloads.map((download) =>
        download.id === next.id
          ? {
              ...download,
              status: "failed",
              error:
                currentLang === "tr"
                  ? "Electron API bulunamadı. Uygulamayı Electron modunda çalıştırın."
                  : "Electron API not found. Run the app in Electron mode.",
            }
          : download,
      ),
    );
    activeDownloadId = null;
    void startNextDownload();
    return;
  }

  try {
    const result = await window.electronAPI.downloadStream({
      downloadId: next.id,
      streamUrl: next.url,
      type: next.type,
      name: next.name,
    });

    if (!result?.success) {
      const current = downloadsState.find(
        (download) => download.id === next.id,
      );
      // CANCELLED often means user paused / playback paused downloads — keep paused.
      if (current?.status !== "paused" && result?.error !== "CANCELLED") {
        if (result?.error === "DISK_FULL") {
          window.dispatchEvent(
            new CustomEvent("show-toast", {
              detail: { message: "Disk alanı yetersiz! / Disk space is full!" },
            }),
          );
        }
        const errMsg =
          result?.error === "DISK_FULL"
            ? currentLang === "tr"
              ? "Disk alanı yetersiz! / Disk space is full!"
              : "Disk space is full!"
            : result?.error || (currentLang === "tr" ? "İndirme başarısız oldu." : "Download failed.");
        setDownloads(
          (downloads) =>
            downloads.map((download) =>
              download.id === next.id
                ? {
                    ...download,
                    status: "failed",
                    error: errMsg,
                  }
                : download,
            ),
          { forceSave: true },
        );
        scheduleAutoRetry(next.id, result?.error);
      } else if (result?.error === "CANCELLED" && current?.status === "downloading") {
        setDownloads(
          (downloads) =>
            downloads.map((download) =>
              download.id === next.id
                ? {
                    ...download,
                    status: "paused",
                    speed: "",
                    timeLeft: "",
                    queuePosition: undefined,
                  }
                : download,
            ),
          { forceSave: true },
        );
      }
    }

    if (result?.success && result.filePath) {
      setDownloads(
        (downloads) =>
          downloads.map((download) =>
            download.id === next.id
              ? {
                  ...download,
                  status: "completed",
                  progress: 100,
                  speed: "",
                  timeLeft: "",
                  size: result.size || download.size,
                  filePath: result.filePath || download.filePath,
                  playUrl: result.playUrl || download.playUrl,
                  completedAt: Date.now(),
                  queuePosition: undefined,
                  retryCount: 0,
                  error: undefined,
                }
              : download,
          ),
        { forceSave: true },
      );
    }
  } catch (error) {
    const current = downloadsState.find((download) => download.id === next.id);
    if (current?.status !== "paused") {
      setDownloads(
        (downloads) =>
          downloads.map((download) =>
            download.id === next.id
              ? {
                  ...download,
                  status: "failed",
                  error:
                    error instanceof Error
                      ? error.message
                      : currentLang === "tr"
                        ? "Bilinmeyen indirme hatası."
                        : "Unknown download error.",
                }
              : download,
          ),
        { forceSave: true },
      );
      scheduleAutoRetry(next.id);
    }
  } finally {
    if (activeDownloadId === next.id) {
      activeDownloadId = null;
    }
    updateQueuePositions();
    void startNextDownload();
  }
}

const MAX_AUTO_RETRIES = 2;

function scheduleAutoRetry(downloadId: string, error?: string) {
  if (error === "DISK_FULL" || error === "CANCELLED") return;
  const item = downloadsState.find((d) => d.id === downloadId);
  if (!item) return;
  const retries = item.retryCount || 0;
  if (retries >= MAX_AUTO_RETRIES) return;

  const delayMs = 2000 * (retries + 1);
  window.setTimeout(() => {
    const current = downloadsState.find((d) => d.id === downloadId);
    if (!current || current.status !== "failed") return;
    queue = queue.filter((q) => q.id !== downloadId);
    queue.push({
      id: current.id,
      url: current.streamUrl,
      type: current.type,
      name: current.name,
    });
    setDownloads(
      (downloads) =>
        downloads.map((d) =>
          d.id === downloadId
            ? {
                ...d,
                status: "pending",
                speed: "",
                timeLeft: "",
                error: undefined,
                retryCount: (d.retryCount || 0) + 1,
              }
            : d,
        ),
      { forceSave: true },
    );
    updateQueuePositions();
    void startNextDownload();
  }, delayMs);
}

export function pauseAllDownloads() {
  const activeId = activeDownloadId;
  activeDownloadId = null;
  if (activeId) {
    void window.electronAPI?.cancelDownload?.(activeId);
  }
  queue = [];
  setDownloads(
    (current) =>
      current.map((download) =>
        download.status === "downloading" || download.status === "pending"
          ? {
              ...download,
              status: "paused",
              speed: "",
              timeLeft: "",
              queuePosition: undefined,
            }
          : download,
      ),
    { forceSave: true },
  );
}

const queueActions = createDownloadQueueActions({
  getDownloads: () => downloadsState,
  getQueue: () => queue,
  setQueue: (nextQueue) => {
    queue = nextQueue;
  },
  getActiveDownloadId: () => activeDownloadId,
  setDownloads,
  updateQueuePositions,
  startNextDownload: () => void startNextDownload(),
});

export function useDownloads() {
  const { activeProfileId, onSaveSetting, onLoadSetting } = useSettings();
  const [downloads, setLocalDownloads] = useState(downloadsState);

  useEffect(() => {
    ensureDownloadIpcListeners(setDownloads);
    const listener = () => setLocalDownloads([...downloadsState]);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Keep the module-level persistence adapter pointed at the latest settings
  // functions so downloads are saved through the same durable, per-profile
  // storage as the rest of the app's settings (not a raw, shared localStorage key).
  useEffect(() => {
    persistAdapter = {
      save: (key, value) => {
        void onSaveSetting(key, value);
      },
      load: (key, isJson) => onLoadSetting(key, isJson),
    };
  }, [onSaveSetting, onLoadSetting]);

  // Load (or reload, on profile switch) this profile's own downloads list.
  useEffect(() => {
    if (!activeProfileId) return;
    if (
      hydratedProfileId === activeProfileId ||
      hydratingProfileId === activeProfileId
    )
      return;
    void hydrateDownloadsForProfile(activeProfileId, {
      save: (key, value) => {
        void onSaveSetting(key, value);
      },
      load: (key, isJson) => onLoadSetting(key, isJson),
    });
  }, [activeProfileId, onSaveSetting, onLoadSetting]);

  useEffect(() => {
    const syncWithDisk = async () => {
      const result = await syncDownloadsWithDisk(downloadsState);
      if (result.changed) setDownloads(() => result.downloads);
    };

    void syncWithDisk();
  }, [activeProfileId]);

  const addDownload = useCallback(
    (item: Parameters<typeof addDownloadItem>[0]) =>
      addDownloadItem(item, {
        getDownloads: () => downloadsState,
        removeQueued: (downloadId) => {
          queue = queue.filter((queued) => queued.id !== downloadId);
        },
        enqueue: (queued) => queue.push(queued),
        setDownloads,
        updateQueuePositions,
        startNextDownload: () => void startNextDownload(),
      }),
    [],
  );

  const pauseAll = useCallback(() => pauseAllDownloads(), []);

  const isDownloading = useCallback((streamUrl: string) => {
    return downloadsState.some(
      (download) =>
        download.streamUrl === streamUrl &&
        (download.status === "pending" || download.status === "downloading"),
    );
  }, []);

  const getDownloadByStreamUrl = useCallback((streamUrl: string) => {
    return downloadsState.find((download) => download.streamUrl === streamUrl);
  }, []);

  return {
    downloads,
    addDownload,
    ...queueActions,
    isDownloading,
    getDownloadByStreamUrl,
    pauseAll,
  };
}
