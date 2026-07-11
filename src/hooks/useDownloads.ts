import { useCallback, useEffect, useState } from "react";
import type { PlaylistItem } from "../utils/m3uParser";
import { useSettings } from "../context/SettingsContext";

export type DownloadStatus =
  "pending" | "downloading" | "completed" | "failed" | "paused";

export interface DownloadItem {
  id: string;
  name: string;
  group: string;
  type: "movie" | "series";
  streamUrl: string;
  logo?: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  timeLeft: string;
  size: string;
  filePath: string;
  /** app-file:// URL usable directly by the app's own player for local playback. */
  playUrl?: string;
  error?: string;
  addedAt: number;
  completedAt?: number;
  queuePosition?: number;
  /** Auto-retry attempts after failure (not counting user-initiated retries). */
  retryCount?: number;
}

interface QueueItem {
  id: string;
  url: string;
  type: "movie" | "series";
  name: string;
}

// Key used with the app's profile-scoped setting storage (saveAppSetting/loadAppSetting),
// which automatically prefixes it per active profile and persists it durably
// (Electron config file + localStorage), not just in the browser's localStorage.
const DOWNLOADS_SETTING_KEY = "strmly_downloads";
// Pre-profile-scoping key. Kept only to migrate a user's existing downloads
// (saved before downloads became profile-aware) into their current profile.
const LEGACY_LOCAL_STORAGE_KEY = "strmly_downloads";

let downloadsState: DownloadItem[] = [];
let queue: QueueItem[] = [];
let activeDownloadId: string | null = null;
let ipcListenersReady = false;
const printedDownloaders = new Set<string>();
const listeners = new Set<() => void>();

// Tracks which profile's data currently lives in `downloadsState`.
// `undefined` = nothing hydrated yet (fresh app start).
let hydratedProfileId: string | null | undefined = undefined;
let hydratingProfileId: string | null | undefined = undefined;

interface PersistAdapter {
  save: (key: string, value: unknown) => void;
  load: (key: string, isJson?: boolean) => Promise<unknown>;
}

// Set by whichever `useDownloads()` instance is currently mounted, so module-level
// helpers (outside of React) can persist through the app's real settings storage.
let persistAdapter: PersistAdapter | null = null;

function sanitizeLoadedDownloads(parsed: unknown): DownloadItem[] {
  if (!Array.isArray(parsed)) return [];

  // Group items by streamUrl to find duplicates
  const groups: Record<string, DownloadItem[]> = {};
  (parsed as DownloadItem[]).forEach((item) => {
    if (!item?.streamUrl) return;
    if (!groups[item.streamUrl]) {
      groups[item.streamUrl] = [];
    }
    groups[item.streamUrl].push(item);
  });

  const uniqueItems: DownloadItem[] = [];
  Object.keys(groups).forEach((url) => {
    const items = groups[url];

    // Sort items by status quality: completed > downloading > pending > paused > failed
    items.sort((a, b) => {
      const score = (status: string) => {
        if (status === "completed") return 5;
        if (status === "downloading") return 4;
        if (status === "pending") return 3;
        if (status === "paused") return 2;
        return 1; // failed
      };
      return score(b.status) - score(a.status);
    });

    const bestItem = { ...items[0] };

    // An item that was actively downloading/queued when the app last closed
    // was interrupted, not actually saved — surface it as paused/resumable.
    if (bestItem.status === "downloading" || bestItem.status === "pending") {
      bestItem.status = "paused";
      bestItem.queuePosition = undefined;
    }

    uniqueItems.push(bestItem);
  });

  return uniqueItems;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastUiEmitAt = 0;
const UI_EMIT_MIN_MS = 300;
const SAVE_DEBOUNCE_MS = 1200;

function saveDownloadsNow(downloads: DownloadItem[]) {
  if (persistAdapter) {
    persistAdapter.save(DOWNLOADS_SETTING_KEY, downloads);
    return;
  }
  // No profile context available yet (should be rare) — fall back to a plain
  // localStorage write so nothing is silently lost.
  try {
    localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(downloads));
  } catch (error) {
    console.error("Failed to save downloads:", error);
  }
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
  adapter: PersistAdapter,
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

    let stored = await adapter.load(DOWNLOADS_SETTING_KEY, true);

    if (!stored || (Array.isArray(stored) && stored.length === 0)) {
      // One-time migration from the pre-profile-scoping global key.
      try {
        const legacyRaw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
        if (legacyRaw) {
          const legacyParsed = JSON.parse(legacyRaw);
          if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
            stored = legacyParsed;
            adapter.save(DOWNLOADS_SETTING_KEY, legacyParsed);
          }
        }
      } catch {
        // Ignore malformed legacy data.
      }
    }

    downloadsState = sanitizeLoadedDownloads(stored);
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
            progress: 0,
            speed: "",
            timeLeft: "",
            queuePosition: undefined,
            error: undefined,
          }
        : download,
    ),
  );

  if (!window.electronAPI?.downloadStream) {
    setDownloads((downloads) =>
      downloads.map((download) =>
        download.id === next.id
          ? {
              ...download,
              status: "failed",
              error:
                "Electron API bulunamadı. Uygulamayı Electron modunda çalıştırın.",
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
            ? "Disk alanı yetersiz! / Disk space is full!"
            : result?.error || "İndirme başarısız oldu.";
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
                      : "Bilinmeyen indirme hatası.",
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

function ensureIpcListeners() {
  if (ipcListenersReady) return;
  ipcListenersReady = true;

  window.electronAPI?.onDownloadProgress?.((data) => {
    if (data.downloader && !printedDownloaders.has(data.downloadId)) {
      printedDownloaders.add(data.downloadId);
      console.log(
        `%c[Strmly Downloader]%c Starting download %c${data.downloadId}%c via %c${
          data.downloader === "segmented"
            ? "🚀 MULTI-CONNECTION HLS SEGMENTED DOWNLOADER"
            : "📼 STANDARD FFmpeg SINGLE-THREAD DOWNLOADER"
        }`,
        "color: #ffffff; background: #3b82f6; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
        "color: #94a3b8; font-weight: normal;",
        "color: #60a5fa; font-weight: bold;",
        "color: #94a3b8; font-weight: normal;",
        data.downloader === "segmented"
          ? "color: #34d399; font-weight: bold;"
          : "color: #f59e0b; font-weight: bold;",
      );
    }

    const isError = data.error === "DISK_FULL";
    setDownloads(
      (downloads) =>
        downloads.map((download) => {
          if (download.id === data.downloadId) {
            if (isError) {
              window.dispatchEvent(
                new CustomEvent("show-toast", {
                  detail: {
                    message:
                      "Disk alanı yetersiz! İndirme durduruldu. / Disk space is full!",
                  },
                }),
              );
              return {
                ...download,
                status: "failed",
                error: "Disk alanı yetersiz! / Disk space is full!",
                speed: "",
                timeLeft: "",
              };
            }
            return {
              ...download,
              progress: data.progress,
              speed: data.speed,
              timeLeft: data.timeLeft,
              size: data.size,
              status: "downloading",
            };
          }
          return download;
        }),
      isError ? { forceSave: true } : { throttleUi: true },
    );
  });

  window.electronAPI?.onDownloadComplete?.((data) => {
    setDownloads(
      (downloads) =>
        downloads.map((download) =>
          download.id === data.downloadId
            ? {
                ...download,
                status: "completed",
                progress: 100,
                speed: "",
                timeLeft: "",
                filePath: data.filePath,
                playUrl: data.playUrl || download.playUrl,
                completedAt: Date.now(),
                queuePosition: undefined,
                retryCount: 0,
                error: undefined,
              }
            : download,
        ),
      { forceSave: true },
    );
  });
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
                progress: 0,
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

export function useDownloads() {
  const { activeProfileId, onSaveSetting, onLoadSetting } = useSettings();
  const [downloads, setLocalDownloads] = useState(downloadsState);

  useEffect(() => {
    ensureIpcListeners();
    const listener = () => setLocalDownloads([...downloadsState]);
    listeners.add(listener);
    listener();

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
    const syncDownloadsWithDisk = async () => {
      const api = window.electronAPI;
      if (!api || !api.getSavedMediaInfo) return;
      const getSavedMediaInfo = api.getSavedMediaInfo;

      let changed = false;
      const updated = await Promise.all(
        downloadsState.map(async (d) => {
          try {
            const info = await getSavedMediaInfo({
              downloadId: d.id,
              type: d.type,
              name: d.name,
              streamUrl: d.streamUrl,
            });

            if (info?.exists && info.filePath) {
              if (d.status !== "completed") {
                changed = true;
                return {
                  ...d,
                  status: "completed" as const,
                  progress: 100,
                  speed: "",
                  timeLeft: "",
                  size: info.size || d.size,
                  filePath: info.filePath,
                  playUrl: info.playUrl || d.playUrl,
                  completedAt: d.completedAt || Date.now(),
                };
              }
            } else {
              if (d.status === "completed") {
                changed = true;
                return {
                  ...d,
                  status: "paused" as const,
                  progress: 0,
                  filePath: "",
                  playUrl: undefined,
                  size: "",
                };
              }
            }
          } catch (e) {
            console.warn("Sync lookup failed for item:", d.name, e);
          }
          return d;
        }),
      );

      if (changed) {
        setDownloads(() => updated);
      }
    };

    void syncDownloadsWithDisk();
  }, [activeProfileId]);

  const addDownload = useCallback(async (item: PlaylistItem) => {
    const type = item.type === "series" ? "series" : "movie";
    const existing = downloadsState.find(
      (download) => download.streamUrl === item.url,
    );

    if (existing) {
      if (
        existing.status === "pending" ||
        existing.status === "downloading" ||
        existing.status === "completed"
      ) {
        return existing.id;
      }
      if (existing.status === "paused" || existing.status === "failed") {
        queue = queue.filter((q) => q.id !== existing.id);
        queue.push({
          id: existing.id,
          url: existing.streamUrl,
          type: existing.type,
          name: existing.name,
        });
        setDownloads((current) =>
          current.map((d) =>
            d.id === existing.id
              ? {
                  ...d,
                  status: "pending",
                  progress: 0,
                  speed: "",
                  timeLeft: "",
                  error: undefined,
                }
              : d,
          ),
        );
        updateQueuePositions();
        void startNextDownload();
        return existing.id;
      }
    }

    const id = `download-${item.id}-${Date.now()}`;

    try {
      if (window.electronAPI?.getSavedMediaInfo) {
        const savedMedia = await window.electronAPI.getSavedMediaInfo({
          downloadId: id,
          type,
          name: item.name,
          streamUrl: item.url,
        });

        if (savedMedia?.exists && savedMedia.filePath) {
          const completedDownload: DownloadItem = {
            id,
            name: item.name,
            group: item.group,
            type,
            streamUrl: item.url,
            logo: item.logo,
            status: "completed",
            progress: 100,
            speed: "",
            timeLeft: "",
            size: savedMedia.size || "",
            filePath: savedMedia.filePath,
            playUrl: savedMedia.playUrl,
            addedAt: Date.now(),
            completedAt: Date.now(),
          };
          setDownloads((current) => [
            completedDownload,
            ...current.filter((download) => download.streamUrl !== item.url),
          ]);
          return id;
        }

        setDownloads((current) =>
          current.filter(
            (download) =>
              !(
                download.streamUrl === item.url &&
                download.status === "completed"
              ),
          ),
        );
      }
    } catch (error) {
      console.warn("Saved media lookup failed, continuing with save:", error);
    }

    const newDownload: DownloadItem = {
      id,
      name: item.name,
      group: item.group,
      type,
      streamUrl: item.url,
      logo: item.logo,
      status: "pending",
      progress: 0,
      speed: "",
      timeLeft: "",
      size: "",
      filePath: "",
      addedAt: Date.now(),
    };

    queue.push({ id, url: item.url, type, name: item.name });
    setDownloads((current) => [newDownload, ...current]);
    updateQueuePositions();
    void startNextDownload();

    return id;
  }, []);

  const cancelDownload = useCallback((downloadId: string) => {
    queue = queue.filter((item) => item.id !== downloadId);
    if (activeDownloadId === downloadId) {
      void window.electronAPI?.cancelDownload?.(downloadId);
    }
    setDownloads((current) =>
      current.map((download) =>
        download.id === downloadId
          ? {
              ...download,
              status: "paused",
              speed: "",
              timeLeft: "",
              queuePosition: undefined,
            }
          : download,
      ),
    );
    updateQueuePositions();
    void startNextDownload();
  }, []);

  const retryDownload = useCallback((downloadId: string) => {
    const download = downloadsState.find((item) => item.id === downloadId);
    if (!download) return;

    queue = queue.filter((item) => item.id !== downloadId);
    queue.push({
      id: download.id,
      url: download.streamUrl,
      type: download.type,
      name: download.name,
    });
    setDownloads((current) =>
      current.map((item) =>
        item.id === downloadId
          ? {
              ...item,
              status: "pending",
              progress: 0,
              speed: "",
              timeLeft: "",
              error: undefined,
            }
          : item,
      ),
    );
    updateQueuePositions();
    void startNextDownload();
  }, []);

  const deleteDownload = useCallback((downloadId: string) => {
    const download = downloadsState.find((item) => item.id === downloadId);
    if (!download) return;

    if (download.status === "downloading") {
      void window.electronAPI?.cancelDownload?.(downloadId);
    }
    queue = queue.filter((item) => item.id !== downloadId);
    if (download.filePath) {
      void window.electronAPI?.deleteFile?.(download.filePath);
    }
    setDownloads((current) => current.filter((item) => item.id !== downloadId));
    updateQueuePositions();
  }, []);

  const clearAll = useCallback(() => {
    downloadsState.forEach((download) => {
      if (download.status === "downloading") {
        void window.electronAPI?.cancelDownload?.(download.id);
      }
      if (download.filePath) {
        void window.electronAPI?.deleteFile?.(download.filePath);
      }
    });
    queue = [];
    setDownloads(() => []);
  }, []);

  // Opens a completed download in the OS's default player. Prefer playing
  // through the app's own player (see DownloadsView) when possible; this
  // remains as a fallback/explicit "open externally" action.
  const playDownload = useCallback((downloadId: string) => {
    const download = downloadsState.find((item) => item.id === downloadId);
    if (download?.filePath) {
      void window.electronAPI?.playFile?.(download.filePath);
    }
  }, []);

  const prioritizeDownload = useCallback((downloadId: string) => {
    const index = queue.findIndex((item) => item.id === downloadId);
    if (index === -1) return;

    const [item] = queue.splice(index, 1);
    queue.unshift(item);

    if (activeDownloadId && activeDownloadId !== downloadId) {
      const active = downloadsState.find((d) => d.id === activeDownloadId);
      if (active) {
        void window.electronAPI?.cancelDownload?.(activeDownloadId);
        queue.splice(1, 0, {
          id: active.id,
          url: active.streamUrl,
          type: active.type,
          name: active.name,
        });
        setDownloads((current) =>
          current.map((d) =>
            d.id === activeDownloadId
              ? { ...d, status: "pending", speed: "", timeLeft: "" }
              : d,
          ),
        );
      }
    }

    updateQueuePositions();
    void startNextDownload();
  }, []);

  const pauseAll = useCallback(() => pauseAllDownloads(), []);

  const resumeAll = useCallback(() => {
    const toResume = downloadsState.filter(
      (d) => d.status === "paused" || d.status === "failed",
    );
    toResume.forEach((d) => {
      if (!queue.some((q) => q.id === d.id)) {
        queue.push({ id: d.id, url: d.streamUrl, type: d.type, name: d.name });
      }
    });
    setDownloads((current) =>
      current.map((d) =>
        d.status === "paused" || d.status === "failed"
          ? {
              ...d,
              status: "pending",
              progress: 0,
              speed: "",
              timeLeft: "",
              error: undefined,
            }
          : d,
      ),
    );
    updateQueuePositions();
    void startNextDownload();
  }, []);

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
    cancelDownload,
    retryDownload,
    deleteDownload,
    clearAll,
    playDownload,
    isDownloading,
    getDownloadByStreamUrl,
    prioritizeDownload,
    pauseAll,
    resumeAll,
  };
}
