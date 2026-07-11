/**
 * Strmly download manager
 * - Media library paths, .part / .meta sidecars
 * - HLS multi-connection downloader (resume + master quality pick)
 * - FFmpeg remux path (browser-safe AAC when needed)
 * - Folder select / move IPC
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { createHash, randomUUID } = require("crypto");

const activeDownloads = new Map();
const activeSegmentDownloads = new Map();
let pendingDownloadsFolderSelection = null;
/** @type {null | Record<string, any>} */
let deps = null;

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

function sanitizeFileName(name) {
  const safeName = String(name || "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 200);
  return safeName || "Untitled";
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error("[DOWNLOAD] Failed to remove file:", filePath, err.message);
  }
}

function getPartMarkerPath(outputPath) {
  return `${outputPath}.part`;
}

function getMetaPath(outputPath) {
  return `${outputPath}.meta.json`;
}

function markDownloadStarted(outputPath) {
  try {
    fs.writeFileSync(getPartMarkerPath(outputPath), String(Date.now()), "utf8");
  } catch (err) {
    console.error("[DOWNLOAD] Failed to write progress marker:", err.message);
  }
}

function clearDownloadMarker(outputPath) {
  safeUnlink(getPartMarkerPath(outputPath));
}

function readDownloadMeta(outputPath) {
  try {
    const metaPath = getMetaPath(outputPath);
    if (!fs.existsSync(metaPath)) return null;
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

function writeDownloadMeta(outputPath, data) {
  try {
    const prev = readDownloadMeta(outputPath) || {};
    fs.writeFileSync(
      getMetaPath(outputPath),
      JSON.stringify({ ...prev, ...data }),
      "utf8",
    );
  } catch (err) {
    console.error("[DOWNLOAD] Failed to write metadata:", err.message);
  }
}

function getMediaLibraryBaseDir() {
  const cache = d().getConfigCache ? d().getConfigCache() : null;
  if (
    cache &&
    d().isSafeConfiguredDownloadFolder(cache.customDownloadsPath)
  ) {
    return path.resolve(cache.customDownloadsPath);
  }
  return path.join(d().app.getPath("videos"), "Strmly");
}

function getLegacyDownloadsBaseDir() {
  return path.join(d().app.getPath("downloads"), "Strmly");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isInsideDir(baseDir, filePath) {
  try {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(filePath);
    const relative = path.relative(resolvedBase, resolvedTarget);
    return (
      relative === "" ||
      (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
    );
  } catch {
    return false;
  }
}

function isInsideMediaLibrary(filePath) {
  if (!deps) return false;
  return (
    isInsideDir(getMediaLibraryBaseDir(), filePath) ||
    isInsideDir(getLegacyDownloadsBaseDir(), filePath)
  );
}

function cleanEmptyDirs(filePath) {
  try {
    const baseDir1 = getMediaLibraryBaseDir();
    const baseDir2 = getLegacyDownloadsBaseDir();
    let currentDir = path.dirname(filePath);
    while (isInsideMediaLibrary(currentDir)) {
      if (
        path.resolve(currentDir) === path.resolve(baseDir1) ||
        path.resolve(currentDir) === path.resolve(baseDir2)
      ) {
        break;
      }
      const files = fs.readdirSync(currentDir);
      if (files.length === 0) {
        fs.rmdirSync(currentDir);
        log("[DOWNLOAD] Cleaned empty directory:", currentDir);
        currentDir = path.dirname(currentDir);
      } else {
        break;
      }
    }
  } catch (err) {
    console.error("[DOWNLOAD] Failed to clean empty dirs:", err.message);
  }
}

function cleanupPartialDownload(outputPath) {
  if (!outputPath) return;
  safeUnlink(outputPath);
  safeUnlink(getMetaPath(outputPath));
  clearDownloadMarker(outputPath);
  cleanEmptyDirs(outputPath);
}

function isMediaFileComplete(filePath) {
  return fs.existsSync(filePath) && !fs.existsSync(getPartMarkerPath(filePath));
}

function resolveOutputPathForStream(basePath, streamUrl) {
  const ext = path.extname(basePath);
  const withoutExt = ext ? basePath.slice(0, -ext.length) : basePath;
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? basePath : `${withoutExt} (${n})${ext}`;
    if (
      !fs.existsSync(candidate) &&
      !fs.existsSync(getPartMarkerPath(candidate))
    ) {
      return candidate;
    }
    const meta = readDownloadMeta(candidate);
    if (!meta || meta.streamUrl === streamUrl) return candidate;
  }
  return basePath;
}

function parseDownloadMediaInfo(name) {
  const rawName = String(name || "").trim();
  const patterns = [
    /^(.*?)\s*[-_. ]\s*S(\d{1,2})\s*E(\d{1,3})(?:\D.*)?$/i,
    /^(.*?)\s*S(\d{1,2})\s*E(\d{1,3})(?:\D.*)?$/i,
    /^(.*?)\s*(\d{1,2})\.?\s*Sezon\s*(\d{1,3})\.?\s*Bölüm(?:\D.*)?$/i,
    /^(.*?)\s*(\d{1,2})x(\d{1,3})(?:\D.*)?$/i,
  ];
  for (const pattern of patterns) {
    const match = rawName.match(pattern);
    if (match) {
      return {
        title: sanitizeFileName(match[1].replace(/[-_.]+$/g, "").trim()),
        season: parseInt(match[2], 10),
        episode: parseInt(match[3], 10),
      };
    }
  }
  return { title: sanitizeFileName(rawName), season: 1, episode: 1 };
}

function getDownloadsDir(type, name, season, create = true) {
  const baseDir = getMediaLibraryBaseDir();
  if (type === "series") {
    const seriesName = sanitizeFileName(name);
    const seasonDir = season ? `Sezon ${season}` : "Sezon 1";
    const dir = path.join(baseDir, "Diziler", seriesName, seasonDir);
    return create ? ensureDir(dir) : dir;
  }
  const dir = path.join(baseDir, "Filmler");
  return create ? ensureDir(dir) : dir;
}

function getDownloadTarget(type, name, downloadId, createDirs = true) {
  const downloadType = type || "movie";
  const sourceName = sanitizeFileName(
    name ||
      String(downloadId || "")
        .replace("download-", "")
        .replace(/-\d+$/, ""),
  );
  const mediaInfo =
    downloadType === "series"
      ? parseDownloadMediaInfo(name || sourceName)
      : { title: sourceName, season: 1, episode: 1 };
  const downloadsDir = getDownloadsDir(
    downloadType,
    mediaInfo.title,
    mediaInfo.season,
    createDirs,
  );
  const fileName =
    downloadType === "series"
      ? `${mediaInfo.title} - S${String(mediaInfo.season).padStart(2, "0")}E${String(mediaInfo.episode).padStart(2, "0")}.mp4`
      : `${mediaInfo.title}.mp4`;
  return {
    downloadType,
    sourceName,
    mediaInfo,
    outputPath: path.join(downloadsDir, fileName),
  };
}

function getDownloadTargetCandidates(type, name, downloadId, streamUrl) {
  const target = getDownloadTarget(type, name, downloadId, false);
  const resolvedPrimary = streamUrl
    ? resolveOutputPathForStream(target.outputPath, streamUrl)
    : target.outputPath;
  const candidates = [resolvedPrimary];
  if (resolvedPrimary !== target.outputPath) candidates.push(target.outputPath);
  if (target.downloadType === "series") {
    candidates.push(
      path.join(
        getMediaLibraryBaseDir(),
        "Diziler",
        target.mediaInfo.title,
        path.basename(target.outputPath),
      ),
    );
    candidates.push(
      path.join(
        getLegacyDownloadsBaseDir(),
        "Diziler",
        target.mediaInfo.title,
        `Sezon ${target.mediaInfo.season}`,
        path.basename(target.outputPath),
      ),
    );
  } else {
    candidates.push(
      path.join(
        getLegacyDownloadsBaseDir(),
        "Filmler",
        path.basename(target.outputPath),
      ),
    );
  }
  return { outputPath: resolvedPrimary, candidates };
}

async function checkFreeSpace(dirPath) {
  try {
    let checkPath = dirPath;
    while (checkPath && !fs.existsSync(checkPath)) {
      const parent = path.dirname(checkPath);
      if (parent === checkPath) break;
      checkPath = parent;
    }
    if (fs.promises.statfs) {
      const stats = await fs.promises.statfs(checkPath);
      return stats.bavail * stats.bsize;
    }
  } catch (err) {
    console.error("Free space check failed:", err);
  }
  return Number.MAX_SAFE_INTEGER;
}

function stableTempDir(outputPath, streamUrl) {
  const hash = createHash("sha1")
    .update(String(streamUrl || "") + "|" + outputPath)
    .digest("hex")
    .slice(0, 12);
  return path.join(path.dirname(outputPath), `temp_${hash}`);
}

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

const BROWSER_UNSAFE_AUDIO = new Set([
  "ac3",
  "eac3",
  "dts",
  "truehd",
  "mlp",
  "pcm_s16le",
  "pcm_bluray",
  "pcm_s24le",
  "flac",
]);
const BROWSER_SAFE_AUDIO = new Set(["aac", "mp3", "opus", "vorbis", "mp4a"]);

const FFMPEG_HTTP_UA = "VLC/3.0.20 LibVLC/3.0.20";

/**
 * IPTV/play URLs often append a fake extension as a URL hash (e.g. `#.mkv`).
 * Hash is not sent to the server and confuses FFmpeg; strip it before download.
 */
function sanitizeDownloadUrl(rawUrl) {
  const s = String(rawUrl || "").trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    if (u.hash) u.hash = "";
    return u.toString();
  } catch {
    return s.replace(/#.*$/, "");
  }
}

function ffmpegInputArgs(streamUrl) {
  return [
    "-user_agent",
    FFMPEG_HTTP_UA,
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "30",
    "-rw_timeout",
    "15000000",
    "-i",
    streamUrl,
  ];
}

async function probeStreamTracks(streamUrl, ffmpegPath) {
  return new Promise((resolve) => {
    const proc = spawn(
      ffmpegPath,
      ["-hide_banner", ...ffmpegInputArgs(streamUrl)],
      { windowsHide: true },
    );
    let stderr = "";
    let settled = false;
    const finish = (tracks) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(tracks);
    };
    const timeout = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      // Ensure we don't hang forever if kill doesn't emit close promptly
      setTimeout(() => finish([]), 500);
    }, 8000);
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", () => {
      const tracks = [];
      const streamRegex =
        /Stream #0:(\d+)(?:\(([^)]+)\))?:\s*(Audio|Video|Subtitle):\s*([a-zA-Z0-9_]+)/gi;
      let match;
      while ((match = streamRegex.exec(stderr)) !== null) {
        tracks.push({
          index: `0:${match[1]}`,
          lang: match[2] ? match[2].toLowerCase() : null,
          type: match[3].toLowerCase(),
          codec: match[4] ? match[4].toLowerCase() : "unknown",
        });
      }
      finish(tracks);
    });
    proc.on("error", () => {
      finish([]);
    });
  });
}

function resolveAbsoluteUrl(maybeRelative, baseUrl) {
  if (!maybeRelative) return null;
  if (
    maybeRelative.startsWith("http://") ||
    maybeRelative.startsWith("https://")
  ) {
    return maybeRelative;
  }
  try {
    return new URL(maybeRelative, baseUrl).href;
  } catch {
    return null;
  }
}

function selectFromMasterPlaylist(text, baseUrl, maxHeight) {
  const lines = text.split(/\r?\n/);
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const next = lines[i + 1]?.trim();
    if (!next || next.startsWith("#")) continue;
    const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
    const height = resMatch ? parseInt(resMatch[2], 10) : 0;
    const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
    const url = resolveAbsoluteUrl(next, baseUrl);
    if (url) variants.push({ url, height, bandwidth });
  }
  if (variants.length === 0) return null;
  const eligible = variants.filter((v) => !v.height || v.height <= maxHeight);
  const pool = eligible.length > 0 ? eligible : variants;
  pool.sort(
    (a, b) => b.height - a.height || b.bandwidth - a.bandwidth,
  );
  return pool[0];
}

function parseMediaPlaylistSegments(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  const segments = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF:")) continue;
    const nextLine = lines[i + 1]?.trim();
    if (nextLine && !nextLine.startsWith("#")) {
      const segmentUrl = resolveAbsoluteUrl(nextLine, baseUrl);
      if (segmentUrl) segments.push({ url: segmentUrl, index: segments.length });
    }
  }
  return segments;
}

async function downloadHlsSegmented(
  downloadId,
  streamUrl,
  outputPath,
  name,
  options,
) {
  const tempDir = stableTempDir(outputPath, streamUrl);
  const abortController = new AbortController();
  const entry = {
    abortController,
    tempDir,
    outputPath,
    concatProc: null,
  };
  activeSegmentDownloads.set(downloadId, entry);

  try {
    let playlistUrl = streamUrl;
    let text = "";

    const firstRes = await fetch(playlistUrl, {
      signal: abortController.signal,
    });
    if (!firstRes.ok) {
      throw new Error(`Failed to fetch stream: ${firstRes.statusText}`);
    }
    text = await firstRes.text();
    if (!text.includes("#EXTM3U")) throw new Error("FALLBACK_NOT_HLS");
    if (text.includes("#EXT-X-KEY") && text.includes("AES-128")) {
      throw new Error("FALLBACK_ENCRYPTED");
    }

    if (text.includes("#EXT-X-STREAM-INF")) {
      const picked = selectFromMasterPlaylist(
        text,
        playlistUrl,
        options.maxHeight,
      );
      if (!picked) throw new Error("No usable HLS variant in master playlist");
      playlistUrl = picked.url;
      log(
        `[HLS DOWNLOAD] Master → ${picked.height || "?"}p bw=${picked.bandwidth || "?"}`,
      );
      writeDownloadMeta(outputPath, {
        variantUrl: playlistUrl,
        variantHeight: picked.height || 0,
      });
      const mediaRes = await fetch(playlistUrl, {
        signal: abortController.signal,
      });
      if (!mediaRes.ok) {
        throw new Error(
          `Failed to fetch media playlist: ${mediaRes.statusText}`,
        );
      }
      text = await mediaRes.text();
      if (text.includes("#EXT-X-KEY") && text.includes("AES-128")) {
        throw new Error("FALLBACK_ENCRYPTED");
      }
    }

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const segments = parseMediaPlaylistSegments(text, playlistUrl);
    if (segments.length === 0) {
      throw new Error("No segment files found in HLS playlist");
    }
    console.log(`[HLS DOWNLOAD] Found ${segments.length} segments for ${name}`);
    log(`[HLS DOWNLOAD] Found ${segments.length} segments for ${name}`);

    const pending = [];
    let completedCount = 0;
    let totalBytesDownloaded = 0;
    for (const segment of segments) {
      const partPath = path.join(tempDir, `part_${segment.index}.ts`);
      if (fs.existsSync(partPath)) {
        try {
          const st = fs.statSync(partPath);
          if (st.size > 0) {
            completedCount += 1;
            totalBytesDownloaded += st.size;
            continue;
          }
        } catch {}
      }
      pending.push(segment);
    }
    if (completedCount > 0) {
      console.log(
        `[HLS DOWNLOAD] Resuming: ${completedCount}/${segments.length} on disk`,
      );
      log(
        `[HLS DOWNLOAD] Resuming: ${completedCount}/${segments.length} on disk`,
      );
    }

    const MAX_CONCURRENT = options.maxConcurrent;
    let activeCount = 0;
    let nextIndex = 0;
    let lastProgressTime = Date.now();
    let speedBytes = 0;
    let currentSpeed = "0 Mbps";
    let failed = null;
    let lastSpaceCheck = 0;
    const downloadStartedAt = Date.now();

    const emitProgress = () => {
      const progress = Math.min(
        99,
        Math.round((completedCount / segments.length) * 100),
      );
      const sizeMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(1);
      const elapsedSec = Math.max(
        0.001,
        (Date.now() - downloadStartedAt) / 1000,
      );
      const rate = completedCount / elapsedSec;
      const remaining = segments.length - completedCount;
      const etaSec = rate > 0 ? Math.round(remaining / rate) : 0;
      const timeLeft =
        remaining === 0
          ? "0s"
          : etaSec > 60
            ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s`
            : `${etaSec}s`;
      sendProgress({
        downloadId,
        progress,
        speed: currentSpeed,
        timeLeft,
        size: `${sizeMB} MB`,
        downloader: "segmented",
      });
    };

    if (pending.length > 0) {
      await new Promise((resolve, reject) => {
        const pump = () => {
          if (failed) {
            reject(failed);
            return;
          }
          if (abortController.signal.aborted) {
            reject(new Error("ABORTED"));
            return;
          }
          if (completedCount === segments.length) {
            resolve();
            return;
          }

          while (
            activeCount < MAX_CONCURRENT &&
            nextIndex < pending.length &&
            !failed
          ) {
            const segment = pending[nextIndex];
            nextIndex += 1;
            activeCount += 1;
            (async () => {
              const partPath = path.join(tempDir, `part_${segment.index}.ts`);
              let attempt = 0;
              const maxAttempts = 5;
              let success = false;
              while (
                attempt < maxAttempts &&
                !success &&
                !abortController.signal.aborted &&
                !failed
              ) {
                try {
                  attempt += 1;
                  if (options.segmentDelayMs > 0) {
                    await new Promise((r) =>
                      setTimeout(r, options.segmentDelayMs),
                    );
                  }
                  const segRes = await fetch(segment.url, {
                    signal: abortController.signal,
                  });
                  if (!segRes.ok) throw new Error(`Status ${segRes.status}`);
                  const buffer = await segRes.arrayBuffer();
                  await fs.promises.writeFile(partPath, Buffer.from(buffer));
                  totalBytesDownloaded += buffer.byteLength;
                  speedBytes += buffer.byteLength;
                  success = true;
                } catch (err) {
                  if (abortController.signal.aborted) break;
                  if (attempt >= maxAttempts) {
                    failed = new Error(
                      `Failed segment ${segment.index} after ${maxAttempts} attempts: ${err.message}`,
                    );
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 400 * attempt));
                }
              }
              activeCount -= 1;
              if (success) {
                completedCount += 1;
                const now = Date.now();
                if (now - lastSpaceCheck > 4000) {
                  lastSpaceCheck = now;
                  const space = await checkFreeSpace(outputPath);
                  if (space < 30 * 1024 * 1024) {
                    failed = new Error("DISK_FULL");
                  }
                }
                const timeDiff = now - lastProgressTime;
                if (timeDiff >= 800) {
                  const mbps =
                    (speedBytes * 8) / (1024 * 1024 * (timeDiff / 1000));
                  currentSpeed = `${mbps.toFixed(1)} Mbps`;
                  speedBytes = 0;
                  lastProgressTime = now;
                  emitProgress();
                }
              }
              pump();
            })();
          }
        };
        pump();
      });
    } else {
      emitProgress();
    }

    if (abortController.signal.aborted) throw new Error("ABORTED");

    const listPath = path.join(tempDir, "list.txt");
    const listLines = segments
      .map((s) => {
        const p = path
          .join(tempDir, `part_${s.index}.ts`)
          .replace(/\\/g, "/")
          .replace(/'/g, "'\\''");
        return `file '${p}'`;
      })
      .join("\n");
    await fs.promises.writeFile(listPath, listLines);

    const ffmpegPath = d().getFfmpegPath();
    const args = [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    ];
    console.log("[HLS CONCAT] Command:", ffmpegPath, args.join(" "));
    log("[HLS CONCAT] Command: " + ffmpegPath + " " + args.join(" "));

    await new Promise((resolveConcat, rejectConcat) => {
      const proc = spawn(ffmpegPath, args, { windowsHide: true });
      entry.concatProc = proc;
      try {
        os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {}
      proc.on("close", (code) => {
        entry.concatProc = null;
        if (abortController.signal.aborted) {
          rejectConcat(new Error("ABORTED"));
        } else if (code === 0) {
          resolveConcat();
        } else {
          rejectConcat(new Error(`FFmpeg concat exited with code ${code}`));
        }
      });
      proc.on("error", (err) => {
        entry.concatProc = null;
        rejectConcat(err);
      });
    });

    const stats = fs.statSync(outputPath);
    if (!stats || stats.size < 64 * 1024) {
      throw new Error("Concat output too small");
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    activeSegmentDownloads.delete(downloadId);
    return { success: true, filePath: outputPath };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const keep = msg === "ABORTED" || abortController.signal.aborted;
    if (!keep) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
    activeSegmentDownloads.delete(downloadId);
    if (msg === "FALLBACK_ENCRYPTED" || msg === "FALLBACK_NOT_HLS") throw err;
    if (msg === "DISK_FULL") return { success: false, error: "DISK_FULL" };
    if (msg === "ABORTED" || abortController.signal.aborted) {
      return { success: false, error: "CANCELLED" };
    }
    throw err;
  }
}

async function runFfmpegDownload({
  downloadId,
  streamUrl,
  outputPath,
  name,
  ffmpegPath,
  options,
}) {
  const inputUrl = sanitizeDownloadUrl(streamUrl);
  if (inputUrl !== streamUrl) {
    log(
      "[DOWNLOAD] Stripped URL fragment for FFmpeg:",
      d().redactSensitiveUrl(streamUrl),
      "→",
      d().redactSensitiveUrl(inputUrl),
    );
  }

  let mapArgs = [];
  let selectedAudioCodec = "unknown";
  let selectedVideoCodec = "unknown";
  let mappedSubtitle = false;
  try {
    console.log("[DOWNLOAD] Probing stream tracks…", name);
    log("[DOWNLOAD] Probing stream tracks…", name);
    const tracks = await probeStreamTracks(inputUrl, ffmpegPath);
    log(`[DOWNLOAD] Probed tracks for ${name}: ${JSON.stringify(tracks)}`);
    console.log(
      "[DOWNLOAD] Probe done:",
      name,
      "tracks=",
      tracks.length,
    );
    const videoTrack = tracks.find((t) => t.type === "video");
    const audioTracks = tracks.filter((t) => t.type === "audio");
    const subtitleTracks = tracks.filter((t) => t.type === "subtitle");
    if (videoTrack) {
      mapArgs.push("-map", videoTrack.index);
      selectedVideoCodec = videoTrack.codec || "unknown";
    } else {
      mapArgs.push("-map", "0:v:0?");
    }

    if (audioTracks.length > 0) {
      const prefLang = options.language || "tr";
      const targetLangs = new Set(
        prefLang === "tr"
          ? ["tur", "tr", "turkish", "turkey"]
          : ["eng", "en", "english"]
      );
      let matchedAudio = audioTracks.find(
        (t) => t.lang && targetLangs.has(t.lang),
      );
      if (!matchedAudio) {
        const fallback = new Set(
          prefLang === "tr"
            ? ["eng", "en", "english"]
            : ["tur", "tr", "turkish", "turkey"]
        );
        matchedAudio = audioTracks.find(
          (t) => t.lang && fallback.has(t.lang),
        );
      }
      if (!matchedAudio) matchedAudio = audioTracks[0];
      if (matchedAudio) {
        mapArgs.push("-map", matchedAudio.index);
        selectedAudioCodec = matchedAudio.codec || "unknown";
      }
    } else {
      mapArgs.push("-map", "0:a:0?");
    }

    if (subtitleTracks.length > 0) {
      const prefLang = options.language || "tr";
      const targetLangs = new Set(
        prefLang === "tr"
          ? ["tur", "tr", "turkish", "turkey"]
          : ["eng", "en", "english"]
      );
      const codecExclusions = new Set(["hdmv_pgs_subtitle", "dvd_subtitle", "dvdsub", "pgssub"]);
      const matchedSub = subtitleTracks.find(
        (t) =>
          t.lang &&
          targetLangs.has(t.lang) &&
          !codecExclusions.has(t.codec || ""),
      );
      if (matchedSub) {
        mapArgs.push("-map", matchedSub.index);
        mappedSubtitle = true;
      }
    }
  } catch (err) {
    log("[DOWNLOAD] Probing failed, using default maps:", err.message);
    mapArgs = ["-map", "0:v:0?", "-map", "0:a:0?"];
  }

  const needsAudioTranscode =
    BROWSER_UNSAFE_AUDIO.has(selectedAudioCodec) ||
    (selectedAudioCodec !== "unknown" &&
      !BROWSER_SAFE_AUDIO.has(selectedAudioCodec));
  log(
    `[DOWNLOAD] Codecs video=${selectedVideoCodec} audio=${selectedAudioCodec} audioTranscode=${needsAudioTranscode}`,
  );

  return new Promise((resolve) => {
    // No +faststart here: it rewrites the whole file after copy and freezes UI at ~100%.
    // Copy remux is enough for offline play via app-file://.
    const args = [
      ...ffmpegInputArgs(inputUrl),
      ...mapArgs,
      "-c:v",
      "copy",
      ...(needsAudioTranscode
        ? ["-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000"]
        : ["-c:a", "copy"]),
      ...(mappedSubtitle ? ["-c:s", "mov_text"] : ["-sn"]),
      "-progress",
      "pipe:1",
      "-nostats",
      "-y",
      outputPath,
    ];
    log(
      "[DOWNLOAD] FFmpeg command:",
      ffmpegPath,
      d().redactSensitiveText(args.join(" ")),
    );
    console.log(
      "[DOWNLOAD] Starting FFmpeg remux for",
      name,
      "→",
      path.basename(outputPath),
    );

    let proc;
    try {
      proc = spawn(ffmpegPath, args, {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      try {
        os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {}
    } catch (err) {
      return resolve({
        success: false,
        error: `Failed to start FFmpeg: ${err.message}`,
      });
    }

    activeDownloads.set(downloadId, {
      process: proc,
      outputPath,
      startTime: Date.now(),
      lastBytes: 0,
      lastTime: Date.now(),
    });
    let duration = 0;
    let lastProgress = -1;
    let stderrBuffer = "";
    let lastSizeProgressAt = 0;

    const emitFfmpegProgress = async (rawProgress, phase) => {
      // Cap at 99 until process exits successfully — avoids "100% forever" while still writing.
      const progress = Math.max(0, Math.min(99, Math.round(rawProgress)));
      if (progress === lastProgress && phase !== "size") return;
      lastProgress = progress;
      const download = activeDownloads.get(downloadId);
      const elapsed =
        (Date.now() - (download?.startTime || Date.now())) / 1000;
      const remaining =
        progress > 0 ? Math.round((elapsed / progress) * (100 - progress)) : 0;
      const timeLeft =
        remaining > 60
          ? `${Math.floor(remaining / 60)}m ${remaining % 60}s`
          : `${Math.max(0, remaining)}s`;
      try {
        const stats = fs.existsSync(outputPath)
          ? fs.statSync(outputPath)
          : { size: 0 };
        const now = Date.now();
        if (
          download &&
          (!download.lastSpaceCheck || now - download.lastSpaceCheck > 5000)
        ) {
          download.lastSpaceCheck = now;
          const space = await checkFreeSpace(outputPath);
          if (space < 30 * 1024 * 1024) {
            download.isDiskFull = true;
            try {
              proc.kill("SIGKILL");
            } catch {}
            return;
          }
        }
        let speed = "";
        if (download && (now - download.lastTime) / 1000 > 0.5) {
          const bytesPerSecond =
            (stats.size - download.lastBytes) /
            ((now - download.lastTime) / 1000);
          if (bytesPerSecond > 0) {
            speed = `${((bytesPerSecond * 8) / (1024 * 1024)).toFixed(1)} Mbps`;
          }
          download.lastBytes = stats.size;
          download.lastTime = now;
        }
        sendProgress({
          downloadId,
          progress,
          speed,
          timeLeft,
          size: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
          downloader: "ffmpeg",
          phase: phase || "download",
        });
      } catch {
        /* ignore stat races */
      }
    };

    // Heartbeat: when Duration is unknown, still show size growth so UI is not stuck.
    const sizeTicker = setInterval(() => {
      if (!activeDownloads.has(downloadId)) return;
      try {
        if (!fs.existsSync(outputPath)) return;
        const stats = fs.statSync(outputPath);
        if (stats.size <= 0) return;
        const now = Date.now();
        if (now - lastSizeProgressAt < 1500) return;
        lastSizeProgressAt = now;
        if (duration > 0) return;
        // Logarithmic-ish growth toward 95 without claiming completion
        const mb = stats.size / (1024 * 1024);
        const est = Math.min(95, Math.floor(10 + Math.log10(mb + 1) * 28));
        void emitFfmpegProgress(est, "size");
      } catch {
        /* ignore */
      }
    }, 2000);

    proc.stdout.on("data", (data) => {
      const lines = data.toString().split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith("out_time_ms=") || line.startsWith("out_time_us=")) {
          const raw = parseInt(line.split("=")[1], 10);
          // FFmpeg historically labels us as out_time_ms; out_time_us is microseconds too.
          const timeSec = Number.isFinite(raw) ? raw / 1e6 : 0;
          if (duration > 0 && timeSec > 0) {
            void emitFfmpegProgress((timeSec / duration) * 100, "time");
          }
        } else if (line.startsWith("out_time=") && duration > 0) {
          // out_time=HH:MM:SS.microseconds
          const m = line.match(/out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (m) {
            const timeSec =
              parseInt(m[1], 10) * 3600 +
              parseInt(m[2], 10) * 60 +
              parseFloat(m[3]);
            void emitFfmpegProgress((timeSec / duration) * 100, "time");
          }
        }
      }
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderrBuffer += text;
      if (stderrBuffer.length > 32000) {
        stderrBuffer = stderrBuffer.slice(-16000);
      }
      const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+)/);
      if (durationMatch) {
        duration =
          parseInt(durationMatch[1], 10) * 3600 +
          parseInt(durationMatch[2], 10) * 60 +
          parseInt(durationMatch[3], 10);
        log(`[DOWNLOAD] Stream duration for ${name}: ${duration}s`);
      }
    });

    proc.on("close", (code) => {
      clearInterval(sizeTicker);
      const wasDiskFull = activeDownloads.get(downloadId)?.isDiskFull;
      activeDownloads.delete(downloadId);
      if (wasDiskFull) {
        cleanupPartialDownload(outputPath);
        sendProgress({
          downloadId,
          progress: 0,
          speed: "0",
          timeLeft: "0",
          size: "0",
          error: "DISK_FULL",
          downloader: "ffmpeg",
        });
        return resolve({ success: false, error: "DISK_FULL" });
      }
      if (code === 0) {
        try {
          const stats = fs.statSync(outputPath);
          if (!stats || stats.size < 64 * 1024) {
            cleanupPartialDownload(outputPath);
            return resolve({
              success: false,
              error: "İndirilen dosya çok küçük veya bozuk.",
            });
          }
          clearDownloadMarker(outputPath);
          const playUrl = d().appFileUrlFromPath(outputPath);
          sendProgress({
            downloadId,
            progress: 100,
            speed: "",
            timeLeft: "0",
            size: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
            downloader: "ffmpeg",
          });
          sendComplete({ downloadId, filePath: outputPath, playUrl });
          notifyDone(name, options.language);
          console.log(
            "[DOWNLOAD] FFmpeg finished OK:",
            name,
            `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
          );
          return resolve({ success: true, filePath: outputPath, playUrl });
        } catch {
          cleanupPartialDownload(outputPath);
          return resolve({
            success: false,
            error: "Download completed but file not found",
          });
        }
      }
      cleanupPartialDownload(outputPath);
      const safeStderr = d().redactSensitiveText(stderrBuffer).slice(-400);
      console.error("[DOWNLOAD] FFmpeg failed:", code, safeStderr);
      log("[DOWNLOAD] FFmpeg failed:", code, safeStderr);
      resolve({
        success: false,
        error: `FFmpeg exited with code ${code}: ${safeStderr}`,
      });
    });

    proc.on("error", (err) => {
      clearInterval(sizeTicker);
      activeDownloads.delete(downloadId);
      cleanupPartialDownload(outputPath);
      resolve({ success: false, error: err.message });
    });
  });
}

async function moveFileCrossDevice(srcPath, destPath) {
  try {
    await fs.promises.rename(srcPath, destPath);
  } catch (err) {
    if (err.code === "EXDEV") {
      await fs.promises.copyFile(srcPath, destPath);
      await fs.promises.unlink(srcPath);
    } else {
      throw err;
    }
  }
}

async function countFilesRecursive(dir) {
  let count = 0;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countFilesRecursive(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

async function moveDirectoryContents(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const totalFiles = await countFilesRecursive(src);
  let filesMoved = 0;
  const moveEntry = async (entrySrc, entryDest) => {
    if (!fs.existsSync(entryDest)) fs.mkdirSync(entryDest, { recursive: true });
    const entries = await fs.promises.readdir(entrySrc, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const srcPath = path.join(entrySrc, entry.name);
      const destPath = path.join(entryDest, entry.name);
      if (entry.isDirectory()) {
        await moveEntry(srcPath, destPath);
        try {
          fs.rmdirSync(srcPath);
        } catch {}
      } else if (entry.isFile()) {
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch {}
        }
        await moveFileCrossDevice(srcPath, destPath);
        filesMoved += 1;
        sendMoveProgress({
          progress:
            totalFiles > 0
              ? Math.min(100, Math.round((filesMoved / totalFiles) * 100))
              : 0,
          currentFile: entry.name,
          filesMoved,
          totalFiles,
        });
      }
    }
  };
  await moveEntry(src, dest);
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

  ipcMain.handle("open-downloads-folder", async () => {
    try {
      await d().ensureConfigLoaded();
      const downloadsDir = ensureDir(getMediaLibraryBaseDir());
      await d().shell.openPath(downloadsDir);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("select-downloads-folder", async () => {
    const result = await d().dialog.showOpenDialog(mw(), {
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      pendingDownloadsFolderSelection = null;
      return { canceled: true };
    }
    pendingDownloadsFolderSelection = {
      token: randomUUID(),
      folderPath: path.resolve(result.filePaths[0]),
    };
    return {
      canceled: false,
      filePath: pendingDownloadsFolderSelection.folderPath,
      selectionToken: pendingDownloadsFolderSelection.token,
    };
  });

  ipcMain.handle(
    "set-downloads-folder",
    async (_e, { folderPath, moveExisting, selectionToken }) => {
      try {
        const selectedFolder = pendingDownloadsFolderSelection;
        pendingDownloadsFolderSelection = null;
        if (
          !d().isSafeDownloadFolderSelection(
            folderPath,
            selectionToken,
            selectedFolder,
          )
        ) {
          return {
            success: false,
            error: "Invalid download folder selection",
          };
        }
        const config = await d().ensureConfigLoaded();
        const oldPath = getMediaLibraryBaseDir();
        const newPath = path.resolve(folderPath);
        if (oldPath === newPath) return { success: true };
        if (moveExisting && fs.existsSync(oldPath)) {
          sendMoveProgress({
            progress: 0,
            currentFile: "",
            filesMoved: 0,
            totalFiles: 0,
          });
          await moveDirectoryContents(oldPath, newPath);
          sendMoveProgress({
            progress: 100,
            currentFile: "",
            filesMoved: 0,
            totalFiles: 0,
          });
        }
        config.customDownloadsPath = newPath;
        await d().queueConfigWrite();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle("get-downloads-folder", async () => {
    await d().ensureConfigLoaded();
    return getMediaLibraryBaseDir();
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
    return isInsideMediaLibrary(filePath);
  } catch {
    return false;
  }
}

module.exports = {
  registerDownloadHandlers,
  stopAllDownloads,
  isInsideMediaLibrary: isInsideMediaLibrarySafe,
  getMediaLibraryBaseDir,
  getLegacyDownloadsBaseDir,
  ensureDir,
  sanitizeDownloadUrl,
};
