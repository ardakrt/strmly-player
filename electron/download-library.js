const path = require("path");
const fs = require("fs");
const { createHash } = require("crypto");

function createDownloadLibrary({
  app,
  getConfigCache,
  isSafeConfiguredDownloadFolder,
  log,
}) {
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
  const cache = getConfigCache ? getConfigCache() : null;
  if (
    cache &&
    isSafeConfiguredDownloadFolder(cache.customDownloadsPath)
  ) {
    return path.resolve(cache.customDownloadsPath);
  }
  return path.join(app.getPath("videos"), "Strmly");
}

function getLegacyDownloadsBaseDir() {
  return path.join(app.getPath("downloads"), "Strmly");
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
    /^(.*?)\s*[-_. ]\s*(\d{1,2})\.?\s*Sezon(?:\D.*)?$/i,
    /^(.*?)\s*(\d{1,2})x(\d{1,3})(?:\D.*)?$/i,
  ];
  for (const pattern of patterns) {
    const match = rawName.match(pattern);
    if (match) {
      return {
        title: sanitizeFileName(match[1].replace(/[-_.]+$/g, "").trim()),
        season: parseInt(match[2], 10),
        episode: match[3] ? parseInt(match[3], 10) : 1,
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

  return {
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
  };
}

module.exports = { createDownloadLibrary };
