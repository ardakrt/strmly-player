/**
 * Strmly download manager
 * - Media library paths, .part / .meta sidecars
 * - HLS multi-connection downloader (resume + master quality pick)
 * - FFmpeg remux path (browser-safe AAC when needed)
 * - Folder select / move IPC
 */
const path = require("path");
const fs = require("fs");
const { createDownloadLibrary } = require("./download-library");
const { registerDownloadFolderHandlers } = require("./download-folder-service");
const { createFfmpegDownloadEngine } = require("./ffmpeg-download-engine");
const { createHlsDownloadEngine } = require("./hls-download-engine");
const {
  sanitizeDownloadUrl,
} = require("./download-media-utils");

const activeDownloads = new Map();
const activeSegmentDownloads = new Map();
/** @type {null | Record<string, any>} */
let deps = null;
let downloadLibrary = null;
let downloadHlsSegmented;
let runFfmpegDownload;

function d() {
  if (!deps) {
    throw new Error(
      "download-manager not initialized — call registerDownloadHandlers first",
    );
  }
  return deps;
}

function log(...args) {
  if (d().logToFile) d().logToFile(...args);
}

function mw() {
  return d().getMainWindow ? d().getMainWindow() : null;
}

function sendProgress(payload) {
  const win = mw();
  if (win && win.webContents) win.webContents.send("download-progress", payload);
}

function sendComplete(payload) {
  const win = mw();
  if (win && win.webContents) win.webContents.send("download-complete", payload);
}

function sendMoveProgress(state) {
  const win = mw();
  if (win && win.webContents) {
    try {
      win.webContents.send("move-downloads-progress", state);
    } catch {}
  }
}

function notifyDone(name, language) {
  const Notification = d().Notification;
  if (!Notification || !Notification.isSupported()) return;
  try {
    const tr = !language || language === "tr";
    new Notification({
      title: tr ? "Strmly İndirme Tamamlandı" : "Strmly Download Complete",
      body: tr
        ? `"${name || "Medya"}" başarıyla kaydedildi.`
        : `"${name || "Media"}" was saved successfully.`,
      silent: false,
    }).show();
  } catch (e) {
    console.error("Failed to show download notification:", e);
  }
}
let checkFreeSpace;
let cleanEmptyDirs;
let cleanupPartialDownload;
let clearDownloadMarker;
let ensureDir;
let getDownloadTarget;
let getDownloadTargetCandidates;
let getLegacyDownloadsBaseDir;
let getMediaLibraryBaseDir;
let getMetaPath;
let getPartMarkerPath;
let isInsideMediaLibrary;
let isMediaFileComplete;
let markDownloadStarted;
let readDownloadMeta;
let safeUnlink;
let stableTempDir;
let writeDownloadMeta;

function getDownloadOptions(config) {
  const conc = Number(config?.cinema_download_segment_concurrency);
  const maxH = Number(config?.cinema_download_max_height);
  const delay = Number(config?.cinema_download_segment_delay_ms);
  return {
    maxConcurrent: Number.isFinite(conc)
      ? Math.min(8, Math.max(1, Math.floor(conc)))
      : 6,
    maxHeight: Number.isFinite(maxH) && maxH > 0 ? maxH : 1080,
    segmentDelayMs:
      Number.isFinite(delay) && delay > 0 ? Math.min(5000, delay) : 0,
    language: config?.cinema_language || "tr",
  };
}

function lookupSavedMedia({ downloadId, type, name, streamUrl }) {
  const { candidates } = getDownloadTargetCandidates(
    type,
    name,
    downloadId,
    streamUrl,
  );
  const existingPath = candidates.find(
    (c) => isInsideMediaLibrary(c) && isMediaFileComplete(c),
  );
  if (!existingPath) return { exists: false };
  const stats = fs.statSync(existingPath);
  return {
    exists: true,
    filePath: existingPath,
    playUrl: d().appFileUrlFromPath(existingPath),
    size: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
  };
}

function registerDownloadHandlers(dependencies) {
  deps = dependencies;
  const { ipcMain } = deps;
  downloadLibrary = createDownloadLibrary({
    app: deps.app,
    getConfigCache: deps.getConfigCache,
    isSafeConfiguredDownloadFolder: deps.isSafeConfiguredDownloadFolder,
    log,
  });
  ({
    checkFreeSpace,
    cleanEmptyDirs,
    cleanupPartialDownload,
    clearDownloadMarker,
    ensureDir,
    getDownloadTarget,
    getDownloadTargetCandidates,
    getLegacyDownloadsBaseDir,
    getMediaLibraryBaseDir,
    getMetaPath,
    getPartMarkerPath,
    isInsideMediaLibrary,
    isMediaFileComplete,
    markDownloadStarted,
    readDownloadMeta,
    safeUnlink,
    stableTempDir,
    writeDownloadMeta,
  } = downloadLibrary);
  ({ downloadHlsSegmented } = createHlsDownloadEngine({
    activeSegmentDownloads,
    checkFreeSpace,
    getFfmpegPath: deps.getFfmpegPath,
    log,
    sendProgress,
    stableTempDir,
    writeDownloadMeta,
  }));
  ({ runFfmpegDownload } = createFfmpegDownloadEngine({
    activeDownloads,
    appFileUrlFromPath: deps.appFileUrlFromPath,
    checkFreeSpace,
    cleanupPartialDownload,
    clearDownloadMarker,
    log,
    notifyDone,
    redactSensitiveText: deps.redactSensitiveText,
    redactSensitiveUrl: deps.redactSensitiveUrl,
    sendComplete,
    sendProgress,
  }));

  ipcMain.handle("get-saved-media-info", async (_e, params) => {
    try {
      return lookupSavedMedia(params || {});
    } catch (err) {
      log("[DOWNLOAD] Saved media lookup error:", err.message);
      return { exists: false, error: err.message };
    }
  });

  ipcMain.handle("get-saved-media-info-batch", async (_e, { items }) => {
    try {
      if (!Array.isArray(items)) return { results: [] };
      return {
        results: items.map((item) => {
          try {
            return {
              key: item.key || item.streamUrl || item.name,
              ...lookupSavedMedia(item),
            };
          } catch (err) {
            return {
              key: item.key || item.streamUrl || item.name,
              exists: false,
              error: err.message,
            };
          }
        }),
      };
    } catch (err) {
      return { results: [], error: err.message };
    }
  });

  ipcMain.handle(
    "download-stream",
    async (event, { downloadId, streamUrl, type, name }) => {
      const cleanedUrl = sanitizeDownloadUrl(streamUrl);
      console.log(
        "[DOWNLOAD] Handler called:",
        downloadId,
        d().redactSensitiveUrl(cleanedUrl),
        type,
        name,
      );
      log(
        "[DOWNLOAD] Handler called:",
        downloadId,
        d().redactSensitiveUrl(cleanedUrl),
        type,
        name,
      );

      const ffmpegPath = d().getFfmpegPath();
      if (!ffmpegPath) return { success: false, error: "FFmpeg not available" };

      const lookup = getDownloadTargetCandidates(
        type,
        name,
        downloadId,
        cleanedUrl,
      );
      const { outputPath, candidates } = lookup;
      const target = getDownloadTarget(type, name, downloadId, true);
      if (!isInsideMediaLibrary(outputPath)) {
        return { success: false, error: "Invalid download path" };
      }

      const existingPath = candidates.find(
        (c) => isInsideMediaLibrary(c) && isMediaFileComplete(c),
      );
      if (existingPath) {
        const stats = fs.statSync(existingPath);
        return {
          success: true,
          skipped: true,
          filePath: existingPath,
          playUrl: d().appFileUrlFromPath(existingPath),
          size: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
        };
      }

      const freeSpace = await checkFreeSpace(outputPath);
      if (freeSpace < 100 * 1024 * 1024) {
        return { success: false, error: "DISK_FULL" };
      }

      markDownloadStarted(outputPath);
      writeDownloadMeta(outputPath, {
        streamUrl: cleanedUrl,
        name: name || "",
        type: target.downloadType,
        savedAt: Date.now(),
      });

      const config = await d().ensureConfigLoaded();
      const options = getDownloadOptions(config);

      if (String(cleanedUrl).toLowerCase().includes("m3u8")) {
        try {
          const segmentedResult = await downloadHlsSegmented(
            downloadId,
            cleanedUrl,
            outputPath,
            name,
            options,
          );
          if (segmentedResult.success) {
            clearDownloadMarker(outputPath);
            const playUrl = d().appFileUrlFromPath(outputPath);
            sendComplete({ downloadId, filePath: outputPath, playUrl });
            notifyDone(name, options.language);
            return { success: true, filePath: outputPath, playUrl };
          }
          if (segmentedResult.error === "CANCELLED") {
            safeUnlink(outputPath);
            return { success: false, error: "CANCELLED" };
          }
          if (segmentedResult.error === "DISK_FULL") {
            cleanupPartialDownload(outputPath);
            return { success: false, error: "DISK_FULL" };
          }
        } catch (err) {
          if (
            err.message === "FALLBACK_ENCRYPTED" ||
            err.message === "FALLBACK_NOT_HLS"
          ) {
            log("[HLS DOWNLOAD] Falling back to FFmpeg:", err.message);
          } else {
            console.error(
              "[HLS DOWNLOAD] Segmented failed, FFmpeg fallback:",
              err,
            );
            log(`[HLS DOWNLOAD] Segmented failed, fallback: ${err.message}`);
          }
        }
      }

      return runFfmpegDownload({
        downloadId,
        streamUrl: cleanedUrl,
        outputPath,
        name,
        ffmpegPath,
        options,
      });
    },
  );

  ipcMain.handle("cancel-download", async (_e, { downloadId }) => {
    const segDl = activeSegmentDownloads.get(downloadId);
    if (segDl) {
      try {
        segDl.abortController.abort();
      } catch {}
      try {
        if (segDl.concatProc) segDl.concatProc.kill("SIGKILL");
      } catch {}
      activeSegmentDownloads.delete(downloadId);
      safeUnlink(segDl.outputPath);
      markDownloadStarted(segDl.outputPath);
      return { success: true, resumable: true };
    }
    const download = activeDownloads.get(downloadId);
    if (download && download.process) {
      try {
        download.process.kill("SIGKILL");
      } catch {}
      activeDownloads.delete(downloadId);
      cleanupPartialDownload(download.outputPath);
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle("delete-file", async (_e, { filePath }) => {
    try {
      if (!isInsideMediaLibrary(filePath)) {
        return { success: false, error: "Invalid file path" };
      }
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      safeUnlink(getMetaPath(filePath));
      safeUnlink(getPartMarkerPath(filePath));
      // Wipe resume temp dirs for this file
      try {
        const tempDir = stableTempDir(
          filePath,
          readDownloadMeta(filePath)?.streamUrl || "",
        );
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
      cleanEmptyDirs(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("play-file", async (_e, { filePath }) => {
    try {
      if (!isInsideMediaLibrary(filePath)) {
        return { success: false, error: "Invalid file path" };
      }
      if (!fs.existsSync(filePath)) {
        return { success: false, error: "File not found" };
      }
      await d().shell.openPath(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  registerDownloadFolderHandlers({
    dialog: deps.dialog,
    ensureConfigLoaded: deps.ensureConfigLoaded,
    ensureDir,
    getMainWindow: deps.getMainWindow,
    getMediaLibraryBaseDir,
    ipcMain,
    isSafeDownloadFolderSelection: deps.isSafeDownloadFolderSelection,
    queueConfigWrite: deps.queueConfigWrite,
    sendMoveProgress,
    shell: deps.shell,
  });
}

function stopAllDownloads() {
  try {
    for (const download of activeDownloads.values()) {
      try {
        download.process.kill("SIGKILL");
      } catch {}
      cleanupPartialDownload(download.outputPath);
    }
    activeDownloads.clear();
  } catch (err) {
    console.error("Failed to stop active downloads on quit:", err.message);
  }
  try {
    for (const segDl of activeSegmentDownloads.values()) {
      try {
        segDl.abortController.abort();
      } catch {}
      try {
        if (segDl.concatProc) segDl.concatProc.kill("SIGKILL");
      } catch {}
      try {
        fs.rmSync(segDl.tempDir, { recursive: true, force: true });
      } catch {}
      cleanupPartialDownload(segDl.outputPath);
    }
    activeSegmentDownloads.clear();
  } catch (err) {
    console.error("Failed to stop segment downloads on quit:", err.message);
  }
}

/** Used by main.js before deps are registered only if deps set; safe wrapper. */
function isInsideMediaLibrarySafe(filePath) {
  try {
    return downloadLibrary ? downloadLibrary.isInsideMediaLibrary(filePath) : false;
  } catch {
    return false;
  }
}

module.exports = {
  registerDownloadHandlers,
  stopAllDownloads,
  isInsideMediaLibrary: isInsideMediaLibrarySafe,
  getMediaLibraryBaseDir: (...args) => downloadLibrary?.getMediaLibraryBaseDir(...args),
  getLegacyDownloadsBaseDir: (...args) => downloadLibrary?.getLegacyDownloadsBaseDir(...args),
  ensureDir: (...args) => downloadLibrary?.ensureDir(...args),
  sanitizeDownloadUrl,
};
