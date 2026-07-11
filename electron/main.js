const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  protocol,
  net,
  session,
  dialog,
  Notification,
} = require("electron");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { randomUUID } = require("crypto");
const { migrateProfileData } = require("./migration");
const {
  isSafeConfiguredDownloadFolder,
  isSafeDownloadFolderSelection,
  redactSensitiveText,
  redactSensitiveUrl,
} = require("./security");
const {
  fetchHttpsFromHost,
  registerTmdbHandlers,
  resolveHostIp,
} = require("./tmdb-service");
const {
  registerDownloadHandlers,
  stopAllDownloads,
  isInsideMediaLibrary,
} = require("./download-manager");

if (process.env.STRMLY_PERF_BENCH === "1") {
  app.setPath("userData", path.join(os.tmpdir(), "strmly-performance-benchmark"));
}

// Check config for hardware acceleration setting
let disableHW = process.env.STRMLY_DISABLE_HW_ACCELERATION === "1";
try {
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  const profilesDir = isDev
    ? path.join(app.getAppPath(), "profiles")
    : path.join(app.getPath("userData"), "profiles");
  const configPath = path.join(profilesDir, "iptv-player-config.json");
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.disableHardwareAcceleration === true) {
      disableHW = true;
    }
  }
} catch (e) {
  // Ignore config read error at startup
}

if (disableHW) {
  app.disableHardwareAcceleration();
  console.log(
    "GPU Hardware Acceleration has been disabled via settings/environment.",
  );
}

// Setup local file logger
const logFile = path.join(app.getPath("userData"), "app.log");
const previousLogFile = path.join(app.getPath("userData"), "app.previous.log");
const MAX_LOG_BYTES = 2 * 1024 * 1024;
try {
  if (fs.existsSync(logFile)) {
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_BYTES) {
      try {
        fs.rmSync(previousLogFile, { force: true });
      } catch {}
      fs.renameSync(logFile, previousLogFile);
    }
  }
  fs.appendFileSync(
    logFile,
    `\n--- Strmly session ${new Date().toISOString()} ---\n`,
    "utf8",
  );
} catch (e) {}

let logBuffer = [];
let logFlushTimer = null;
let logWriteQueue = Promise.resolve();

function flushLogBuffer() {
  if (logFlushTimer) {
    clearTimeout(logFlushTimer);
    logFlushTimer = null;
  }
  if (logBuffer.length === 0) return;
  const batch = logBuffer.join("");
  logBuffer = [];
  logWriteQueue = logWriteQueue
    .catch(() => undefined)
    .then(() => fs.promises.appendFile(logFile, batch, "utf8"));
}

function logToFile(...args) {
  try {
    const msg = args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        return typeof arg === "object" ? JSON.stringify(arg) : arg;
      })
      .join(" ")
      .replace(/(api_key=)[^&\s"]+/gi, "$1[redacted]")
      .replace(/("cinema_tmdb_key"\s*:\s*")[^"]+/gi, "$1[redacted]");
    const logLine = `[${new Date().toISOString()}] ${msg}\n`;
    logBuffer.push(logLine);
    if (!logFlushTimer) {
      logFlushTimer = setTimeout(flushLogBuffer, 250);
    }
  } catch (e) {}
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
console.log = (...args) => {
  originalLog(...args);
  logToFile("[INFO]", ...args);
};
console.warn = (...args) => {
  originalWarn(...args);
  logToFile("[WARN]", ...args);
};
console.error = (...args) => {
  originalError(...args);
  logToFile("[ERROR]", ...args);
};

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception in Main Process:", err);
  flushLogBuffer();
});
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "Unhandled Rejection in Main Process at:",
    promise,
    "reason:",
    reason,
  );
  flushLogBuffer();
});

// Register app-file:// protocol as privileged BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app-file",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// FFmpeg binary path (from ffmpeg-static package)
let ffmpegPath = undefined;
function normalizeFfmpegPath(candidatePath) {
  if (!candidatePath) return null;
  if (
    candidatePath.includes("app.asar") &&
    !candidatePath.includes("app.asar.unpacked")
  ) {
    return candidatePath.replace(/app\.asar/i, "app.asar.unpacked");
  }
  return candidatePath;
}

function canRunFfmpeg(candidatePath) {
  try {
    if (!candidatePath || candidatePath !== "ffmpeg") {
      if (!fs.existsSync(candidatePath)) return false;
      if (process.platform !== "win32") {
        try {
          fs.chmodSync(candidatePath, 0o755);
        } catch {}
      }
    }

    const probe = spawnSync(candidatePath, ["-version"], {
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    return probe.status === 0;
  } catch {
    return false;
  }
}

function getFfmpegPath() {
  if (ffmpegPath !== undefined) return ffmpegPath;

  const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidates = [];
  try {
    candidates.push(normalizeFfmpegPath(require("ffmpeg-static")));
  } catch {}
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, "ffmpeg-static", executableName),
    );
  }
  candidates.push(
    path.join(__dirname, "..", "node_modules", "ffmpeg-static", executableName),
  );
  candidates.push("ffmpeg");

  for (const candidatePath of candidates.filter(Boolean)) {
    if (canRunFfmpeg(candidatePath)) {
      console.log("FFmpeg found at:", candidatePath);
      ffmpegPath = candidatePath;
      return ffmpegPath;
    }
  }

  console.error(
    "FFmpeg unavailable. Checked paths:",
    candidates.filter(Boolean).join(", "),
  );
  ffmpegPath = null;
  return ffmpegPath;
}

// FFmpeg proxy state
let ffmpegProcess = null;
let proxyServer = null;
let proxyPort = 0;

// Allow autoplay of audio/video without user gesture
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
// Disable media engagement checks that block audio
app.commandLine.appendSwitch(
  "disable-features",
  "PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies",
);
// Enable hardware acceleration for smoother video playback
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
// Disable the on-disk GPU shader cache. On some Windows setups (AV/EDR file
// locking, cloud-sync file handles, etc.) Chromium repeatedly fails to move
// this cache into place ("Unable to move the cache: Erişim engellendi"),
// which delays first paint and can look like a slow/black-screen startup.
// Shaders are still cached in memory for the session, so this has no real
// effect on playback performance.
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

let mainWindow;

// Prevent multiple instances from running simultaneously. Running two
// instances at once causes both processes to fight over the same GPU/disk
// cache directory, which triggers "Unable to move the cache: Erişim
// engellendi" errors and a slow/black-screen startup.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const isPerformanceBenchmark = process.env.STRMLY_PERF_BENCH === "1";
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Strmly",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#0A0A0B",
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true, // Enabled for security. Custom app-file:// protocol and CORS header injector allow safe loading.
      devTools: !app.isPackaged || process.env.STRMLY_OPEN_DEVTOOLS === "1",
      backgroundThrottling: !isPerformanceBenchmark,
    },
  });

  if (isPerformanceBenchmark) {
    mainWindow.webContents.once("did-finish-load", async () => {
      try {
        mainWindow.showInactive();
        const { runPerformanceBenchmark } = require("./performance-benchmark");
        const results = await runPerformanceBenchmark(mainWindow, {
          iterations: Number(process.env.STRMLY_PERF_ITERATIONS) || 12,
          warmups: Number(process.env.STRMLY_PERF_WARMUPS) || 2,
        });
        console.log(`STRMLY_PERF_RESULT=${JSON.stringify(results)}`);
        app.exit(0);
      } catch (error) {
        console.error("STRMLY_PERF_ERROR", error);
        app.exit(1);
      }
    });
  }

  // Handle mouse side buttons (back/forward) globally on the window
  mainWindow.on("app-command", (e, cmd) => {
    if (cmd === "browser-backward") {
      mainWindow.webContents.send("navigate-back");
    } else if (cmd === "browser-forward") {
      mainWindow.webContents.send("navigate-forward");
    }
  });

  // Show window when ready-to-show to prevent visual flash, with a 1s fallback
  let isShown = false;
  const showWindow = () => {
    if (!isPerformanceBenchmark && !isShown && mainWindow) {
      isShown = true;
      mainWindow.show();
      mainWindow.focus();
    }
  };
  mainWindow.once("ready-to-show", showWindow);
  setTimeout(showWindow, 1000);

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false);

  // Log all console messages from the renderer process
  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      logToFile(
        "[RENDERER]",
        `Level:${level} - ${message} (at ${sourceId}:${line})`,
      );
    },
  );

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[RENDERER] Failed to load URL: ${validatedURL} - Error: ${errorDescription} (${errorCode})`,
      );
    },
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        shell.openExternal(url);
      }
    } catch (err) {
      console.error("[SECURITY] Blocked invalid window open URL:", err.message);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
      console.error(`[SECURITY] Blocked renderer navigation to: ${url}`);
    }
  });

  mainWindow.webContents.on("crashed", (event, killed) => {
    console.error(`[RENDERER] Process crashed: killed=${killed}`);
    flushLogBuffer();
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.error("[RENDERER] Process gone:", details);
    flushLogBuffer();
  });

  mainWindow.on("unresponsive", () => {
    console.error("[RENDERER] Window became unresponsive");
  });

  // Set user agent to appear as a standard VLC player to IPTV providers
  mainWindow.webContents.setUserAgent("VLC/3.0.20 LibVLC/3.0.20");

  // In development, load Vite dev server. In production, load build folder.
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL(process.env.STRMLY_DEV_SERVER_URL || "http://localhost:5173");
    if (process.env.STRMLY_OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function normalizeDriveLetter(filePath) {
  if (
    process.platform === "win32" &&
    filePath &&
    filePath.length >= 2 &&
    filePath[1] === ":"
  ) {
    return filePath[0].toUpperCase() + filePath.substring(1);
  }
  return filePath;
}

function appFileUrlFromPath(filePath) {
  const { pathToFileURL } = require("url");
  return pathToFileURL(filePath)
    .toString()
    .replace(/^file:/i, "app-file:");
}

function resolveTmdbCacheFilePath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const marker = "/tmdb-cache/";
  const index = normalized.indexOf(marker);
  if (index === -1) return filePath;

  const suffix = normalized.slice(index + marker.length);
  const cacheDir = getTmdbCacheDir();
  return path.normalize(path.join(cacheDir, suffix));
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  // Set Application User Model ID for Windows Taskbar Icon grouping
  if (process.platform === "win32") {
    app.setAppUserModelId("com.strmly.iptv");
  }

  // Register custom protocol handle for app-file:// scheme
  const { pathToFileURL } = require("url");
  protocol.handle("app-file", async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      let filePath = decodeURIComponent(parsedUrl.pathname);
      if (process.platform === "win32") {
        if (/^\/[a-zA-Z]:\//.test(filePath)) {
          filePath = filePath.substring(1);
        } else if (/^[a-zA-Z]\//.test(filePath)) {
          filePath = filePath[0] + ":" + filePath.substring(1);
        }
      } else {
        filePath = filePath.replace(/^\/+/, "/");
      }
      filePath = path.normalize(filePath);
      filePath = resolveTmdbCacheFilePath(filePath);

      // Auto-recovery: If a TMDB cache image file is missing on disk, download it on the fly!
      const cacheDir = getTmdbCacheDir();
      if (!fs.existsSync(filePath)) {
        try {
          const relative = path.relative(cacheDir, filePath);
          const parts = relative.replace(/\\/g, "/").split("/");
          if (parts.length === 2) {
            const size = parts[0];
            const filename = parts[1];
            if (filename.startsWith("_") && filename.endsWith(".jpg")) {
              const tmdbImagePath = "/" + filename.slice(1).replace(/_/g, "/");
              console.log(`[App-File Handler] Auto-downloading missing TMDB image: ${size}${tmdbImagePath}`);
              
              const data = await fetchHttpsFromHost(
                "image.tmdb.org",
                `/t/p/${size}${tmdbImagePath}`,
                true
              );

              if (data && data.buffer) {
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }
                await fs.promises.writeFile(filePath, data.buffer);
                console.log(`[App-File Handler] Successfully auto-downloaded and cached: ${filePath}`);
              }
            }
          }
        } catch (downloadErr) {
          console.error(`[App-File Handler] Failed to auto-download TMDB image:`, downloadErr.message);
        }
      }

      if (!fs.existsSync(filePath)) {
        console.error(`[App-File Handler] File not found: ${filePath}`);
        return new Response("File not found", { status: 404 });
      }

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const cacheRoot = normalizeDriveLetter(
        await fs.promises.realpath(cacheDir),
      );
      const realFilePath = normalizeDriveLetter(
        await fs.promises.realpath(filePath),
      );
      const relativePath = path.relative(cacheRoot, realFilePath);
      const isInsideTmdbCache =
        !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
      // Downloaded/saved media (movies & series) lives in the user's media library
      // directory, not the TMDB cache, so it needs to be allowed here too so the
      // app's own player can stream local files back through this protocol.
      const isInsideLibrary = isInsideMediaLibrary(realFilePath);
      if (!isInsideTmdbCache && !isInsideLibrary) {
        console.error(
          `[App-File Handler] Blocked access outside allowed directories: ${realFilePath}`,
        );
        return new Response("Forbidden", { status: 403 });
      }

      // Forward Range headers so local video playback supports seeking.
      return net.fetch(pathToFileURL(realFilePath).toString(), {
        headers: request.headers,
      });
    } catch (err) {
      console.error("[App-File Handler] Error:", err.message);
      return new Response("Error loading file", { status: 500 });
    }
  });

  // Inject CORS headers on headers received to bypass CORS checks for IPTV links/streams
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      if (!mainWindow || details.webContentsId !== mainWindow.webContents.id) {
        callback({});
        return;
      }

      const headers = { ...details.responseHeaders };
      const setHeader = (name, value) => {
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === name.toLowerCase()) {
            delete headers[key];
          }
        }
        headers[name] = [value];
      };

      // Add/override Access-Control headers without creating duplicate values.
      setHeader("Access-Control-Allow-Origin", "*");
      setHeader("Access-Control-Allow-Headers", "*");
      setHeader("Access-Control-Allow-Methods", "*");

      callback({ responseHeaders: headers });
    },
  );

  // Start migration and config loading in the background to prevent startup freeze
  migrationPromise = migrateData();
  migrationPromise
    .then(() => ensureConfigLoaded())
    .catch((err) => console.error("Startup background load error:", err));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (configCache) {
    try {
      const configPath = getConfigPath();
      fs.writeFileSync(
        configPath,
        JSON.stringify(configCache, null, 2),
        "utf8",
      );
    } catch (err) {
      console.error("Config save on exit error:", err);
    }
  }

  if (logBuffer.length > 0) {
    try {
      fs.appendFileSync(logFile, logBuffer.join(""), "utf8");
      logBuffer = [];
    } catch {
      /* Best-effort shutdown logging. */
    }
  }

  stopAllDownloads();
  stopFfmpegProxy();
});

function appFileOrFileUrlToPath(rawUrl) {
  try {
    const normalized = String(rawUrl || "").replace(/^app-file:/i, "file:");
    const parsed = new URL(normalized);
    if (parsed.protocol !== "file:") return null;
    let filePath = decodeURIComponent(parsed.pathname || "");
    if (process.platform === "win32") {
      if (/^\/[a-zA-Z]:\//.test(filePath)) {
        filePath = filePath.substring(1);
      } else if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = filePath[0] + ":" + filePath.substring(1);
      }
    } else {
      filePath = filePath.replace(/^\/+/, "/");
    }
    return path.normalize(filePath);
  } catch {
    return null;
  }
}

function isLocalMediaUrl(rawUrl) {
  if (typeof rawUrl !== "string") return false;
  return (
    rawUrl.startsWith("app-file:") ||
    rawUrl.startsWith("file:") ||
    /^[a-zA-Z]:[\\/]/.test(rawUrl) ||
    rawUrl.startsWith("\\\\")
  );
}

function isAllowedMediaUrl(rawUrl) {
  if (typeof rawUrl !== "string") return false;
  try {
    if (isLocalMediaUrl(rawUrl)) {
      const localPath =
        appFileOrFileUrlToPath(rawUrl) ||
        (/^[a-zA-Z]:[\\/]/.test(rawUrl) || rawUrl.startsWith("\\\\")
          ? path.normalize(rawUrl)
          : null);
      return !!(localPath && fs.existsSync(localPath) && isInsideMediaLibrary(localPath));
    }
    const parsed = new URL(rawUrl);
    return ["http:", "https:", "rtmp:", "rtsp:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeConfigKey(key) {
  return (
    typeof key === "string" && /^[a-zA-Z0-9_-]+$/.test(key) && key.length <= 160
  );
}

function isSafeConfigEntries(entries) {
  return (
    entries &&
    typeof entries === "object" &&
    !Array.isArray(entries) &&
    Object.keys(entries).every(isSafeConfigKey)
  );
}

// IPC Handler to run external players
ipcMain.handle("play-external", async (event, { url, playerType }) => {
  console.log(
    `Attempting to play URL: ${redactSensitiveUrl(url)} using ${playerType}`,
  );

  if (!isAllowedMediaUrl(url)) {
    return { success: false, message: "Geçersiz medya URL'si." };
  }

  if (playerType === "vlc") {
    // Common Windows VLC installation paths
    const paths = [
      "vlc", // If in PATH
      "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
      "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
    ];

    let launched = false;
    for (const vlcPath of paths) {
      try {
        const child = spawn(vlcPath, [url], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.on("error", (error) => {
          if (error) {
            console.error(`Failed to launch VLC via path: ${vlcPath}`, error);
          }
        });
        child.unref();
        launched = true;
        break; // Stop after first attempt
      } catch (err) {
        console.error(err);
      }
    }
    return {
      success: launched,
      message: launched
        ? "VLC Başlatıldı."
        : "VLC bulunamadı. Lütfen VLC Player'ın kurulu olduğundan emin olun.",
    };
  } else if (playerType === "mpv") {
    // Try running mpv from PATH
    try {
      const child = spawn("mpv", [url], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", (error) => {
        if (error) {
          console.error("Failed to launch MPV", error);
        }
      });
      child.unref();
      return { success: true, message: "MPV Başlatıldı." };
    } catch (err) {
      return {
        success: false,
        message:
          "MPV bulunamadı. Lütfen MPV'nin PATH ortam değişkenine ekli olduğundan emin olun.",
      };
    }
  } else if (playerType === "browser") {
    // Open in default browser
    await shell.openExternal(url);
    return { success: true, message: "Tarayıcıda açıldı." };
  }

  return { success: false, message: "Bilinmeyen oynatıcı türü." };
});

// Config management paths
const getProfilesDir = () => {
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  let profilesDir;
  if (isDev) {
    profilesDir = path.join(app.getAppPath(), "profiles");
  } else {
    profilesDir = path.join(app.getPath("userData"), "profiles");
  }
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }
  return profilesDir;
};

const getConfigPath = () => {
  return path.join(getProfilesDir(), "iptv-player-config.json");
};

let configCache = null;
let configLoadPromise = null;
let configWriteQueue = Promise.resolve();
let migrationPromise = Promise.resolve();

const ensureConfigLoaded = async () => {
  if (configCache) return configCache;
  if (configLoadPromise) return configLoadPromise;

  configLoadPromise = (async () => {
    // Wait for async migration to finish before reading config
    await migrationPromise;
    const configPath = getConfigPath();
    try {
      const raw = await fs.promises.readFile(configPath, "utf8");
      configCache = JSON.parse(raw);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("Config load error, starting with an empty config:", err);
        try {
          await fs.promises.copyFile(
            configPath,
            `${configPath}.corrupted-${Date.now()}`,
          );
        } catch {
          /* The original file may not exist or may be unreadable. */
        }
      }
      configCache = {};
    }
    return configCache;
  })();

  return configLoadPromise;
};

const queueConfigWrite = () => {
  const configPath = getConfigPath();
  configWriteQueue = configWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const tempPath = `${configPath}.tmp`;
      await fs.promises.writeFile(
        tempPath,
        JSON.stringify(configCache || {}, null, 2),
        "utf8",
      );
      await fs.promises.rename(tempPath, configPath);
    });
  return configWriteQueue;
};

const getPlaylistsDir = () => {
  const playlistDir = path.join(getProfilesDir(), "playlists");
  if (!fs.existsSync(playlistDir)) {
    fs.mkdirSync(playlistDir, { recursive: true });
  }
  return playlistDir;
};

const getTmdbCacheDir = () => {
  const cacheDir = path.join(getProfilesDir(), "tmdb-cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
};

const getPlaylistItemsPath = (id) => {
  const safeId = String(id || "");
  if (!/^[a-zA-Z0-9_-]+$/.test(safeId)) {
    throw new Error("Invalid playlist id");
  }
  return path.join(getPlaylistsDir(), `playlist-${safeId}.json`);
};

async function migrateData() {
  try {
    await migrateProfileData({
      fs,
      path,
      isPackaged: app.isPackaged,
      userDataDir: app.getPath("userData"),
      profilesDir: getProfilesDir(),
      exeDir: path.dirname(process.execPath),
      log: (...args) => console.log(...args),
      error: (...args) => console.error(...args),
    });
  } catch (err) {
    console.error("Migration error:", err);
  }
}

ipcMain.handle("save-config", async (event, { key, value }) => {
  try {
    if (!isSafeConfigKey(key)) {
      return { success: false, error: "Invalid config key" };
    }
    const config = await ensureConfigLoaded();
    config[key] = value;
    await queueConfigWrite();
    return { success: true };
  } catch (err) {
    console.error("Config save error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.on("save-config-sync", (event, { key, value }) => {
  try {
    if (!isSafeConfigKey(key)) {
      event.returnValue = { success: false, error: "Invalid config key" };
      return;
    }
    const config = configCache || {};
    config[key] = value;
    configCache = config;
    queueConfigWrite();
    event.returnValue = { success: true };
  } catch (err) {
    console.error("Config save sync error:", err);
    event.returnValue = { success: false, error: err.message };
  }
});

ipcMain.on("save-config-batch-sync", (event, entries) => {
  try {
    if (!isSafeConfigEntries(entries)) {
      event.returnValue = { success: false, error: "Invalid config entries" };
      return;
    }
    const config = configCache || {};
    Object.assign(config, entries);
    configCache = config;
    queueConfigWrite();
    event.returnValue = { success: true };
  } catch (err) {
    console.error("Config batch save sync error:", err);
    event.returnValue = { success: false, error: err.message };
  }
});

ipcMain.handle("load-config", async (event, { key }) => {
  try {
    if (!isSafeConfigKey(key)) {
      return null;
    }
    const config = await ensureConfigLoaded();
    return config[key] !== undefined ? config[key] : null;
  } catch (err) {
    console.error("Config load error:", err);
    return null;
  }
});

// IPC Handlers for separate playlist items files
ipcMain.handle("save-playlist-items", async (event, { id, items }) => {
  try {
    const filePath = getPlaylistItemsPath(id);
    await fs.promises.writeFile(filePath, JSON.stringify(items), "utf8");
    return { success: true };
  } catch (err) {
    console.error("Playlist items save error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("load-playlist-items", async (event, { id }) => {
  try {
    const filePath = getPlaylistItemsPath(id);
    if (!fs.existsSync(filePath)) return [];
    const content = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Playlist items load error:", err);
    return [];
  }
});

ipcMain.handle("delete-playlist-items", async (event, { id }) => {
  try {
    const filePath = getPlaylistItemsPath(id);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return { success: true };
  } catch (err) {
    console.error("Playlist items delete error:", err);
    return { success: false, error: err.message };
  }
});

registerTmdbHandlers({ ipcMain, getTmdbCacheDir, appFileUrlFromPath });

// ── FFmpeg Audio Transcoding Proxy ──

async function prepareFfmpegInput(rawUrl) {
  try {
    // Local downloads (app-file:// / file:// / absolute path) → real filesystem path for FFmpeg.
    if (isLocalMediaUrl(rawUrl)) {
      const localPath =
        appFileOrFileUrlToPath(rawUrl) ||
        (/^[a-zA-Z]:[\\/]/.test(rawUrl) || rawUrl.startsWith("\\\\")
          ? path.normalize(rawUrl)
          : null);
      if (localPath && fs.existsSync(localPath) && isInsideMediaLibrary(localPath)) {
        return { inputUrl: localPath, hostHeader: null, isLocal: true };
      }
      return { inputUrl: rawUrl, hostHeader: null, isLocal: true };
    }

    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:") {
      return { inputUrl: rawUrl, hostHeader: null, isLocal: false };
    }

    const originalHostname = parsedUrl.hostname;
    const resolvedIp = await resolveHostIp(originalHostname);
    if (!resolvedIp || resolvedIp === originalHostname) {
      return { inputUrl: rawUrl, hostHeader: null, isLocal: false };
    }

    const hostHeader = parsedUrl.port
      ? `${originalHostname}:${parsedUrl.port}`
      : originalHostname;
    parsedUrl.hostname = resolvedIp;
    return { inputUrl: parsedUrl.toString(), hostHeader, isLocal: false };
  } catch {
    return { inputUrl: rawUrl, hostHeader: null, isLocal: false };
  }
}

function stopFfmpegProxy() {
  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill("SIGKILL");
    } catch {}
    ffmpegProcess = null;
  }
  if (proxyServer) {
    try {
      proxyServer.close();
    } catch {}
    proxyServer = null;
  }
  proxyPort = 0;
}

ipcMain.handle(
  "start-ffmpeg-proxy",
  async (
    event,
    {
      url,
      startTime,
      audioStreamId,
      transcodeMode = "full",
      contentType = "movie",
    },
  ) => {
    if (!getFfmpegPath()) {
      return { success: false, error: "FFmpeg bulunamadı." };
    }
    if (!isAllowedMediaUrl(url)) {
      return { success: false, error: "Geçersiz medya URL'si." };
    }

    stopFfmpegProxy();
    const { inputUrl, hostHeader } = await prepareFfmpegInput(url);
    const isLive = contentType === "live";
    const seekSeconds =
      startTime && Number.isFinite(Number(startTime)) && Number(startTime) > 0
        ? Math.floor(Number(startTime))
        : 0;
    // Mid-stream seeks already proved the source works — use a faster probe/encode path.
    const isSeekRestart = seekSeconds > 0;
    // Copy mode re-encodes audio only. Full mode re-encodes both for bad timestamps.
    const mode = transcodeMode === "copy" ? "copy" : "full";

    return new Promise((resolve) => {
      let resolved = false;
      let proxyReady = false;
      let ffmpegOutputReady = false;
      let startupTimer = null;
      let stderrTail = "";
      let pendingRes = null;
      let bufferChunks = [];
      let bufferBytes = 0;
      let headerChunks = [];
      let headerSize = 0;
      const MAX_HEADER_SIZE = 64 * 1024; // 64KB is plenty for empty moov MP4 headers
      const MAX_BUFFER_SIZE = 4 * 1024 * 1024;
      let isFirstRequest = true;

      // Return the local URL as soon as the proxy is listening so the player can
      // connect in parallel while FFmpeg seeks and produces the first fragment.
      // Waiting for the first stdout byte was adding ~1-3s of pure serial delay.
      const resolveProxyUrl = () => {
        if (proxyReady && !resolved) {
          resolved = true;
          resolve({
            success: true,
            port: proxyPort,
            url: `http://127.0.0.1:${proxyPort}/stream`,
          });
        }
      };

      const failBeforeReady = (message) => {
        if (!resolved) {
          resolved = true;
          if (startupTimer) clearTimeout(startupTimer);
          stopFfmpegProxy();
          resolve({ success: false, error: message });
          return;
        }
        // URL already handed to the player — close any waiting HTTP client.
        if (startupTimer) clearTimeout(startupTimer);
        if (pendingRes && !pendingRes.destroyed) {
          try {
            pendingRes.destroy();
          } catch {}
          pendingRes = null;
        }
        stopFfmpegProxy();
      };

      function startProxyServer() {
        proxyServer = http.createServer((req, res) => {
          console.log("[Proxy] Browser requested transcode stream");
          res.writeHead(200, {
            "Content-Type": "video/mp4",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            Connection: "keep-alive",
          });

          if (!isFirstRequest) {
            console.log("[Proxy] Reconnect detected, writing cached headers");
            for (const chunk of headerChunks) {
              res.write(chunk);
            }
          } else {
            isFirstRequest = false;
          }

          // Flush buffered chunks
          for (const chunk of bufferChunks) {
            res.write(chunk);
          }
          bufferChunks = [];
          bufferBytes = 0;
          pendingRes = res;

          req.on("close", () => {
            console.log("[Proxy] Browser closed request connection");
            if (pendingRes === res) {
              pendingRes = null;
            }
          });
        });

        proxyServer.listen(0, "127.0.0.1", () => {
          proxyPort = proxyServer.address().port;
          console.log(`[Proxy] Listening on port ${proxyPort}`);
          proxyReady = true;
          resolveProxyUrl();
        });

        proxyServer.on("error", (err) => {
          console.error("[Proxy] Server error:", err.message);
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: err.message });
          }
        });
      }

      // Start proxy server immediately so we can resolve the URL instantly
      startProxyServer();

      // VOD/series need larger probe windows and stable timestamps.
      // Live keeps low-latency flags. Seek restarts use a lighter profile so
      // jumping from e.g. 2:00 → 15:00 does not re-probe for several seconds.
      const args = [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-user_agent",
        "VLC/3.0.20 LibVLC/3.0.20",
        "-reconnect",
        "1",
        "-reconnect_at_eof",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        isLive ? "2" : "5",
      ];

      if (isLive) {
        args.push(
          "-fflags",
          "+nobuffer+genpts+discardcorrupt+fastseek",
          "-flags",
          "+low_delay",
          "-analyzeduration",
          "500000",
          "-probesize",
          "500000",
        );
      } else if (isSeekRestart) {
        // Fast seek: keyframe-ish jump, small probe, low first-frame latency.
        args.push(
          "-fflags",
          "+genpts+discardcorrupt+igndts+fastseek",
          "-analyzeduration",
          "1000000",
          "-probesize",
          "1000000",
          "-thread_queue_size",
          "512",
          "-noaccurate_seek",
        );
      } else {
        args.push(
          // igndts helps broken IPTV VOD timestamps; genpts rebuilds a timeline.
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-analyzeduration",
          "10000000",
          "-probesize",
          "10000000",
          "-thread_queue_size",
          "1024",
        );
      }

      // Input-side seek is faster for long episodes. PTS is reset after decode.
      if (seekSeconds > 0) {
        args.push("-ss", String(seekSeconds));
      }

      if (hostHeader) {
        args.push("-headers", `Host: ${hostHeader}\r\n`);
      }
      args.push("-i", inputUrl);
      args.push("-map", "0:v:0?");

      const mappedAudioId = Number(audioStreamId);
      if (Number.isFinite(mappedAudioId) && mappedAudioId >= 0) {
        args.push("-map", `0:${mappedAudioId}?`);
      } else {
        args.push("-map", "0:a:0?");
      }

      if (mode === "full") {
        // Seek restarts favor first-frame latency; cold start keeps slightly better quality.
        const preset = isLive || isSeekRestart ? "ultrafast" : "veryfast";
        const gop = isLive || isSeekRestart ? "30" : "48";
        args.push(
          "-vf",
          "setpts=PTS-STARTPTS,format=yuv420p",
          "-c:v",
          "libx264",
          "-preset",
          preset,
          "-tune",
          "zerolatency",
          "-profile:v",
          "baseline",
          "-level",
          "4.0",
          "-pix_fmt",
          "yuv420p",
          "-crf",
          isSeekRestart ? "26" : "23",
          "-g",
          gop,
          "-keyint_min",
          gop,
          "-sc_threshold",
          "0",
          "-bf",
          "0",
          "-fps_mode",
          "cfr",
          "-threads",
          "0",
        );
      } else {
        // Copy video, re-encode audio only (low CPU).
        args.push("-c:v", "copy");
      }

      // AAC encoder priming delay (~20-50ms) lags audio when video is copied.
      // Compensate in copy mode. Avoid aggressive min_comp values that stretch
      // audio over time and sound like progressive delay on long episodes.
      const audioFilter =
        mode === "full"
          ? "asetpts=PTS-STARTPTS,aresample=async=1000:first_pts=0"
          : "aresample=async=1000:first_pts=0,asetpts=PTS-STARTPTS-0.048/TB";

      args.push(
        "-c:a",
        "aac",
        "-b:a",
        isSeekRestart ? "128k" : "160k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-af",
        audioFilter,
        "-avoid_negative_ts",
        "make_zero",
        "-max_interleave_delta",
        "0",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-max_muxing_queue_size",
        "9999",
        "-f",
        "mp4",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        // Seek: smaller fragments → first playable chunk sooner.
        "-frag_duration",
        isLive || isSeekRestart ? "200000" : "500000",
        "-flush_packets",
        "1",
        "pipe:1",
      );

      console.log(
        `[Proxy] Starting FFmpeg mode=${mode} type=${contentType} seek=${seekSeconds}s fastSeek=${isSeekRestart}`,
      );
      console.log("[Proxy] FFmpeg args:", redactSensitiveText(args.join(" ")));

      ffmpegProcess = spawn(getFfmpegPath(), args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      ffmpegProcess.on("spawn", () => {
        console.log("FFmpeg spawned, waiting for output...");
      });

      // Seek restarts should fail fast if the source never answers.
      const startupMs = isLive ? 10000 : isSeekRestart ? 12000 : 20000;
      startupTimer = setTimeout(() => {
        failBeforeReady(
          `FFmpeg veri üretmedi. ${stderrTail || "Stream yanıt vermedi."}`,
        );
      }, startupMs);

      ffmpegProcess.stdout.on("data", (chunk) => {
        if (!ffmpegOutputReady) {
          ffmpegOutputReady = true;
          if (startupTimer) {
            clearTimeout(startupTimer);
            startupTimer = null;
          }
          console.log("[Proxy] First FFmpeg output received");
        }
        if (headerSize < MAX_HEADER_SIZE) {
          const remaining = MAX_HEADER_SIZE - headerSize;
          const toCopy =
            chunk.length <= remaining ? chunk : chunk.slice(0, remaining);
          headerChunks.push(toCopy);
          headerSize += toCopy.length;
        }

        if (pendingRes && !pendingRes.destroyed) {
          pendingRes.write(chunk);
        } else {
          bufferChunks.push(chunk);
          bufferBytes += chunk.length;
          while (bufferBytes > MAX_BUFFER_SIZE && bufferChunks.length > 0) {
            const dropped = bufferChunks.shift();
            bufferBytes -= dropped ? dropped.length : 0;
          }
        }
      });

      ffmpegProcess.stderr.on("data", (data) => {
        const msg = data.toString().trim();
        if (msg) {
          stderrTail = `${stderrTail}\n${msg}`.slice(-1200);
          console.log("FFmpeg:", redactSensitiveText(msg));
        }
      });

      ffmpegProcess.on("error", (err) => {
        console.error("FFmpeg spawn error:", err.message);
        failBeforeReady(`FFmpeg başlatılamadı: ${err.message}`);
      });

      ffmpegProcess.on("close", (code, signal) => {
        console.log("FFmpeg exited with code:", code, "signal:", signal);
        if (!resolved) {
          failBeforeReady(
            `FFmpeg erken kapandı (code: ${code ?? "null"}, signal: ${signal ?? "none"}). ${stderrTail || ""}`.trim(),
          );
          return;
        }
        if (startupTimer) clearTimeout(startupTimer);
        if (pendingRes && !pendingRes.destroyed) pendingRes.end();
      });
    });
  },
);

ipcMain.handle("stop-ffmpeg-proxy", async () => {
  stopFfmpegProxy();
  return { success: true };
});

ipcMain.handle("relaunch-app", async () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("get-app-version", async () => {
  return app.getVersion();
});

ipcMain.handle("probe-audio-codec", async (event, { url }) => {
  if (!getFfmpegPath()) {
    return { success: false, error: "FFmpeg bulunamadı" };
  }
  if (!isAllowedMediaUrl(url)) {
    return { success: false, error: "Geçersiz medya URL'si." };
  }

  const { inputUrl, hostHeader } = await prepareFfmpegInput(url);

  return new Promise((resolve) => {
    let resolved = false;
    // Larger probe helps IPTV VOD series report accurate audio/video codecs.
    const args = ["-analyzeduration", "5000000", "-probesize", "5000000"];
    if (hostHeader) {
      args.push("-headers", `Host: ${hostHeader}\r\n`);
    }
    args.push("-i", inputUrl, "-hide_banner");

    const proc = spawn(getFfmpegPath(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderrOutput = "";
    let earlyResolveTimer = null;

    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      if (earlyResolveTimer) clearTimeout(earlyResolveTimer);
      try {
        proc.kill("SIGKILL");
      } catch {}
      resolve(payload);
    };

    const timeoutId = setTimeout(() => {
      const parsed = parseFfmpegProbeOutput(stderrOutput);
      if (parsed.success) {
        finish(parsed);
      } else {
        finish({
          success: false,
          error: "Probe timeout",
          codec: "unknown",
          videoCodec: parsed.videoCodec,
        });
      }
    }, 9000);

    proc.on("error", (err) => {
      console.error("Probe audio codec spawn error:", err);
      finish({ success: false, error: err.message, codec: "unknown" });
    });

    proc.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString();

      // Resolve once we have Input + Audio, and preferably Video too.
      const hasInput = stderrOutput.includes("Input #0");
      const hasAudio = /Audio:\s+[a-zA-Z0-9_]+/i.test(stderrOutput);
      const hasVideo = /Video:\s+[a-zA-Z0-9_]+/i.test(stderrOutput);
      if (!resolved && hasInput && hasAudio) {
        if (earlyResolveTimer) clearTimeout(earlyResolveTimer);
        // Wait a bit longer if video line has not arrived yet.
        earlyResolveTimer = setTimeout(
          () => {
            const parsed = parseFfmpegProbeOutput(stderrOutput);
            if (parsed.success) finish(parsed);
          },
          hasVideo ? 120 : 350,
        );
      }
    });

    proc.stdout.on("data", () => {});

    proc.on("close", () => {
      if (resolved) return;
      const parsed = parseFfmpegProbeOutput(stderrOutput);
      if (parsed.success) {
        finish(parsed);
      } else {
        finish({
          success: false,
          codec: "unknown",
          videoCodec: parsed.videoCodec,
          error: "No audio stream found",
        });
      }
    });
  });
});

function getAllAudioCodecs(stderrText) {
  const codecs = [];
  const regex = /Audio:\s+([a-zA-Z0-9_]+)/gi;
  let match;
  while ((match = regex.exec(stderrText)) !== null) {
    codecs.push(match[1].toLowerCase());
  }
  return codecs;
}

function getVideoCodecFromProbe(stderrText) {
  const match = stderrText.match(/Video:\s+([a-zA-Z0-9_]+)/i);
  return match ? match[1].toLowerCase() : undefined;
}

function getDurationFromProbe(stderrText) {
  const durationMatch = stderrText.match(/Duration:\s*(\d+):(\d+):(\d+)/i);
  if (!durationMatch) return 0;
  return (
    parseInt(durationMatch[1], 10) * 3600 +
    parseInt(durationMatch[2], 10) * 60 +
    parseInt(durationMatch[3], 10)
  );
}

function parseFfmpegProbeOutput(stderrOutput) {
  const audioMatch = stderrOutput.match(/Audio:\s+([a-zA-Z0-9_]+)/i);
  return {
    success: !!audioMatch || !!getVideoCodecFromProbe(stderrOutput),
    codec: audioMatch ? audioMatch[1].toLowerCase() : "unknown",
    videoCodec: getVideoCodecFromProbe(stderrOutput),
    duration: getDurationFromProbe(stderrOutput),
    audioStreams: getAudioStreamsInfo(stderrOutput),
    allCodecs: getAllAudioCodecs(stderrOutput),
  };
}

function getAudioStreamsInfo(stderrText) {
  const streams = [];
  const regex = /Stream #0:(\d+)(?:\(([^)]+)\))?:\s*Audio:\s*([a-zA-Z0-9_]+)/gi;
  let match;
  let audioIdx = 0;
  while ((match = regex.exec(stderrText)) !== null) {
    const streamId = parseInt(match[1], 10);
    const lang = match[2] || "";
    const codec = match[3].toLowerCase();

    let name = "";
    const langLower = lang.toLowerCase();
    if (langLower === "tur" || langLower === "tr") name = "Türkçe";
    else if (langLower === "eng" || langLower === "en") name = "English";
    else if (langLower === "fre" || langLower === "fra" || langLower === "fr")
      name = "Fransızca";
    else if (langLower === "ger" || langLower === "deu" || langLower === "de")
      name = "Almanca";
    else if (langLower === "spa" || langLower === "es") name = "İspanyolca";
    else if (langLower === "ita" || langLower === "it") name = "İtalyanca";
    else if (langLower === "rus" || langLower === "ru") name = "Rusça";
    else name = lang ? lang.toUpperCase() : `Ses Kanalı ${audioIdx + 1}`;

    streams.push({
      id: audioIdx,
      streamId: streamId,
      name: name,
      lang: lang,
      codec: codec,
    });
    audioIdx++;
  }
  return streams;
}

ipcMain.handle("check-ffmpeg", async () => {
  const p = getFfmpegPath();
  return { available: !!p, path: p || null };
});

// --- AUTO-UPDATE INTEGRATION ---
// Auto-updates are configured through electron-updater and the package publish settings.
let autoUpdaterInstance = null;
function getAutoUpdater() {
  if (autoUpdaterInstance) return autoUpdaterInstance;

  const { autoUpdater } = require("electron-updater");
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus("update-status", {
      status: "checking",
      message: "Güncellemeler denetleniyor...",
    });
  });

  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus("update-status", {
      status: "available",
      version: info.version,
      message: `Yeni sürüm bulundu (v${info.version}). İndirmek için onay verin.`,
    });
  });

  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus("update-status", {
      status: "not-available",
      message: "Uygulama güncel.",
    });
  });

  autoUpdater.on("error", (err) => {
    sendUpdateStatus("update-status", {
      status: "error",
      message: `Güncelleme hatası: ${err.message}`,
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    sendUpdateStatus("update-progress", {
      percent: Math.round(progressObj.percent),
      speed: Math.round(progressObj.bytesPerSecond / 1024) + " KB/s",
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus("update-status", {
      status: "downloaded",
      version: info.version,
      message: `Sürüm v${info.version} hazır. Yüklemek için yeniden başlatın.`,
    });
  });

  autoUpdaterInstance = autoUpdater;
  return autoUpdaterInstance;
}

function sendUpdateStatus(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

ipcMain.handle("check-for-updates", async () => {
  try {
    await getAutoUpdater().checkForUpdates();
    return { success: true };
  } catch (err) {
    console.error("Check for updates failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("download-update", async () => {
  try {
    sendUpdateStatus("update-status", {
      status: "downloading",
      message: "Güncelleme indiriliyor...",
    });
    await getAutoUpdater().downloadUpdate();
    return { success: true };
  } catch (err) {
    console.error("Download update failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("install-update", async () => {
  try {
    getAutoUpdater().quitAndInstall();
    return { success: true };
  } catch (err) {
    console.error("Install update failed:", err);
    return { success: false, error: err.message };
  }
});


// Download management (extracted to electron/download-manager.js)
registerDownloadHandlers({
  app,
  ipcMain,
  shell,
  dialog,
  Notification,
  getFfmpegPath,
  logToFile,
  appFileUrlFromPath,
  ensureConfigLoaded,
  queueConfigWrite,
  getConfigCache: () => configCache,
  getMainWindow: () => mainWindow,
  isSafeConfiguredDownloadFolder,
  isSafeDownloadFolderSelection,
  redactSensitiveText,
  redactSensitiveUrl,
});

