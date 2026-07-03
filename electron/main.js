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
const http = require("http");
const { migrateProfileData } = require("./migration");

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
    },
  });

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
    if (!isShown && mainWindow) {
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
    mainWindow.loadURL("http://localhost:5173");
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

  // Stop any in-flight downloads and clean up their partial output so a
  // killed/orphaned ffmpeg process never keeps writing after the app exits,
  // and so half-written files are never mistaken for completed downloads.
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
        fs.rmSync(segDl.tempDir, { recursive: true, force: true });
      } catch {}
      cleanupPartialDownload(segDl.outputPath);
    }
    activeSegmentDownloads.clear();
  } catch (err) {
    console.error(
      "Failed to stop active segment downloads on quit:",
      err.message,
    );
  }

  stopFfmpegProxy();
});

function isAllowedMediaUrl(rawUrl) {
  if (typeof rawUrl !== "string") return false;
  try {
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
  console.log(`Attempting to play URL: ${url} using ${playerType}`);

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

// DNS over HTTPS (DoH) bypass resolver for TMDB API and image CDN
const resolvedHostIps = {};

async function resolveHostIp(hostname) {
  if (resolvedHostIps[hostname]) return resolvedHostIps[hostname];

  const providers = [
    `https://dns.google/resolve?name=${hostname}&type=A`,
    `https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`,
    `https://dns.quad9.net/dns-query?name=${hostname}&type=A`,
  ];

  const fetchWithTimeout = async (url, ms = 1500) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/dns-json" },
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      const ip = data.Answer?.find((ans) => ans.type === 1)?.data;
      if (ip) return ip;
      throw new Error("No A record found");
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  try {
    const ip = await Promise.any(
      providers.map((url) => fetchWithTimeout(url, 1500)),
    );
    resolvedHostIps[hostname] = ip;
    console.log(`Resolved ${hostname} to ${ip} via parallel DoH`);
    return ip;
  } catch (e) {
    console.warn(`Parallel DoH resolution failed for ${hostname}:`, e.message);
    return hostname;
  }
}

const https = require("https");
const apiAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  keepAliveMsecs: 60000,
});
const imageAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  keepAliveMsecs: 60000,
});

async function fetchHttpsFromHost(hostname, requestPath, asBuffer = false) {
  const ip = await resolveHostIp(hostname);

  return new Promise((resolve, reject) => {
    const isIp = ip !== hostname;

    const options = {
      hostname: ip,
      port: 443,
      path: requestPath,
      method: "GET",
      headers: {
        Host: hostname,
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
      },
      servername: hostname,
      rejectUnauthorized: !isIp,
      agent: hostname === "image.tmdb.org" ? imageAgent : apiAgent,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Request failed with status ${res.statusCode}`));
          return;
        }

        if (asBuffer) {
          resolve({
            buffer: body,
            contentType: res.headers["content-type"] || "image/jpeg",
          });
          return;
        }

        try {
          resolve(JSON.parse(body.toString("utf8")));
        } catch (e) {
          reject(new Error("Failed to parse TMDB response"));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.end();
  });
}

async function fetchFromTmdb(apiPath) {
  return fetchHttpsFromHost("api.themoviedb.org", apiPath);
}

const tmdbMainRequests = new Map();
const tmdbMainQueue = [];
const MAX_TMDB_MAIN_REQUESTS = 8;
let activeTmdbMainRequests = 0;

function queueTmdbMainRequest(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeTmdbMainRequests += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeTmdbMainRequests -= 1;
          const next = tmdbMainQueue.shift();
          if (next) next();
        });
    };
    if (activeTmdbMainRequests < MAX_TMDB_MAIN_REQUESTS) run();
    else tmdbMainQueue.push(run);
  });
}

ipcMain.handle("fetch-tmdb", async (event, { path: apiPath }) => {
  if (
    typeof apiPath !== "string" ||
    !apiPath.startsWith("/3/") ||
    apiPath.length > 1200
  ) {
    return { error: "Invalid TMDB path" };
  }

  // Helper function to query the request queue / cache map
  const executeFetch = async (pathToCheck) => {
    const existing = tmdbMainRequests.get(pathToCheck);
    if (existing) return existing;

    const request = queueTmdbMainRequest(() =>
      fetchFromTmdb(pathToCheck),
    ).finally(() => tmdbMainRequests.delete(pathToCheck));
    tmdbMainRequests.set(pathToCheck, request);
    return await request;
  };

  try {
    // 1. Try with the requested path (containing frontend/user's API key)
    const result = await executeFetch(apiPath);
    return result;
  } catch (err) {
    const errMsg = err.message || "";
    // 2. If it fails with 401 (Unauthorized) or 403 (Forbidden), auto-retry with default key
    if (errMsg.includes("status 401") || errMsg.includes("status 403")) {
      console.warn(
        `TMDB fetch failed (401/403) for path: ${apiPath}. Retrying with working default key...`,
      );
      try {
        const urlObj = new URL("https://api.themoviedb.org" + apiPath);
        urlObj.searchParams.set("api_key", "c7e12a2b1d8e1851399f4b92dc124332");
        const fallbackPath = urlObj.pathname + urlObj.search;

        const fallbackResult = await executeFetch(fallbackPath);
        console.log(`TMDB fallback retry succeeded for path: ${fallbackPath}`);
        return fallbackResult;
      } catch (fallbackErr) {
        console.error(
          `TMDB fallback retry also failed for path ${apiPath}:`,
          fallbackErr,
        );
        return { error: fallbackErr.message };
      }
    }

    console.error(`TMDB fetch error for path ${apiPath}:`, err);
    return { error: err.message };
  }
});

ipcMain.handle(
  "fetch-tmdb-image",
  async (event, { path: imagePath, size = "w500" }) => {
    try {
      const allowedSizes = new Set([
        "w92",
        "w154",
        "w185",
        "w300",
        "w342",
        "w500",
        "w780",
        "original",
      ]);
      if (
        !imagePath ||
        typeof imagePath !== "string" ||
        !imagePath.startsWith("/")
      ) {
        return { error: "Invalid TMDB image path" };
      }
      if (!allowedSizes.has(size)) {
        return { error: "Invalid TMDB image size" };
      }

      const cacheDir = path.join(getTmdbCacheDir(), size);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Replace slashes to create a safe flat filename
      const safeFileName = imagePath.replace(/\//g, "_");
      const localFilePath = path.join(cacheDir, safeFileName);

      // If cached on disk, return the app-file:/// URL directly
      if (fs.existsSync(localFilePath)) {
        return { localUrl: appFileUrlFromPath(localFilePath) };
      }

      const data = await fetchHttpsFromHost(
        "image.tmdb.org",
        `/t/p/${size}${imagePath}`,
        true,
      );

      // Save to cache directory asynchronously
      await fs.promises.writeFile(localFilePath, data.buffer);

      return {
        localUrl: appFileUrlFromPath(localFilePath),
      };
    } catch (err) {
      console.error("TMDB image fetch error:", err);
      return { error: err.message };
    }
  },
);

// ── FFmpeg Audio Transcoding Proxy ──

async function prepareFfmpegInput(rawUrl) {
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:") {
      return { inputUrl: rawUrl, hostHeader: null };
    }

    const originalHostname = parsedUrl.hostname;
    const resolvedIp = await resolveHostIp(originalHostname);
    if (!resolvedIp || resolvedIp === originalHostname) {
      return { inputUrl: rawUrl, hostHeader: null };
    }

    const hostHeader = parsedUrl.port
      ? `${originalHostname}:${parsedUrl.port}`
      : originalHostname;
    parsedUrl.hostname = resolvedIp;
    return { inputUrl: parsedUrl.toString(), hostHeader };
  } catch {
    return { inputUrl: rawUrl, hostHeader: null };
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
  async (event, { url, startTime, audioStreamId, transcodeMode = "full" }) => {
    if (!getFfmpegPath()) {
      return { success: false, error: "FFmpeg bulunamadı." };
    }
    if (!isAllowedMediaUrl(url)) {
      return { success: false, error: "Geçersiz medya URL'si." };
    }

    stopFfmpegProxy();
    const { inputUrl, hostHeader } = await prepareFfmpegInput(url);

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

      const resolveSuccessIfReady = () => {
        if (proxyReady && ffmpegOutputReady && !resolved) {
          resolved = true;
          if (startupTimer) clearTimeout(startupTimer);
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
        }
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
          resolveSuccessIfReady();
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

      // Re-encode video and audio together in fallback mode or copy video.
      // Copying video while re-encoding audio is faster (uses almost 0 CPU),
      // but some IPTV/VOD files with bad timestamps play better in full transcode mode.
      const args = [
        "-loglevel",
        "warning",
        "-fflags",
        "+nobuffer+genpts+discardcorrupt",
        "-flags",
        "+low_delay",
        "-user_agent",
        "VLC/3.0.20 LibVLC/3.0.20",
        "-reconnect",
        "1",
        "-reconnect_at_eof",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "2",
        "-analyzeduration",
        "100000",
        "-probesize",
        "150000",
      ];

      if (startTime && startTime > 0) {
        args.push("-ss", Math.floor(startTime).toString());
      }

      if (hostHeader) {
        args.push("-headers", `Host: ${hostHeader}\r\n`);
      }
      args.push("-i", inputUrl);
      args.push("-map", "0:v:0");
      if (audioStreamId !== undefined && audioStreamId !== null) {
        args.push("-map", `0:${audioStreamId}`);
      } else {
        args.push("-map", "0:a?");
      }

      if (transcodeMode === "full") {
        args.push(
          "-vf",
          "setpts=PTS-STARTPTS,format=yuv420p",
          "-c:v",
          "libx264",
          // This stream is consumed only by the local player. Favor first-frame
          // latency and low CPU usage over compression efficiency.
          "-preset",
          "ultrafast",
          "-tune",
          "zerolatency",
          "-crf",
          "23",
          "-g",
          "30",
          "-keyint_min",
          "30",
          "-sc_threshold",
          "0",
          "-threads",
          "0",
        );
      } else {
        // 'copy' mode (default)
        args.push("-c:v", "copy");
      }

      const audioFilter =
        transcodeMode === "full"
          ? "asetpts=PTS-STARTPTS,aresample=async=1:min_comp=0.01:min_hard_comp=0.02"
          : "aresample=async=1:min_comp=0.01:min_hard_comp=0.02";

      args.push(
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-af",
        audioFilter,
        "-avoid_negative_ts",
        "make_zero",
        "-max_muxing_queue_size",
        "2048",
        "-f",
        "mp4",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-frag_duration",
        "200000",
        "-flush_packets",
        "1",
        "pipe:1",
      );

      ffmpegProcess = spawn(getFfmpegPath(), args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      ffmpegProcess.on("spawn", () => {
        console.log("FFmpeg spawned, waiting for output...");
      });

      startupTimer = setTimeout(() => {
        failBeforeReady(
          `FFmpeg veri üretmedi. ${stderrTail || "Stream yanıt vermedi."}`,
        );
      }, 10000);

      ffmpegProcess.stdout.on("data", (chunk) => {
        ffmpegOutputReady = true;
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

        resolveSuccessIfReady();
      });

      ffmpegProcess.stderr.on("data", (data) => {
        const msg = data.toString().trim();
        if (msg) {
          stderrTail = `${stderrTail}\n${msg}`.slice(-1200);
          console.log("FFmpeg:", msg);
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
    const args = ["-analyzeduration", "1000000", "-probesize", "1000000"];
    if (hostHeader) {
      args.push("-headers", `Host: ${hostHeader}\r\n`);
    }
    args.push("-i", inputUrl, "-hide_banner");

    const proc = spawn(getFfmpegPath(), args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderrOutput = "";

    proc.on("error", (err) => {
      console.error("Probe audio codec spawn error:", err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ success: false, error: err.message, codec: "unknown" });
      }
    });

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          proc.kill("SIGKILL");
        } catch {}

        // Parse whatever we collected so far before resolving timeout
        const match = stderrOutput.match(/Audio:\s+([a-zA-Z0-9_]+)/i);
        const durationMatch = stderrOutput.match(
          /Duration:\s*(\d+):(\d+):(\d+)/i,
        );
        let durationSec = 0;
        if (durationMatch) {
          durationSec =
            parseInt(durationMatch[1], 10) * 3600 +
            parseInt(durationMatch[2], 10) * 60 +
            parseInt(durationMatch[3], 10);
        }

        if (match) {
          resolve({
            success: true,
            codec: match[1].toLowerCase(),
            duration: durationSec,
            audioStreams: getAudioStreamsInfo(stderrOutput),
          });
        } else {
          resolve({ success: false, error: "Probe timeout", codec: "unknown" });
        }
      }
    }, 2500);

    proc.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString();
    });

    proc.stdout.on("data", () => {});

    proc.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        const match = stderrOutput.match(/Audio:\s+([a-zA-Z0-9_]+)/i);
        const durationMatch = stderrOutput.match(
          /Duration:\s*(\d+):(\d+):(\d+)/i,
        );
        let durationSec = 0;
        if (durationMatch) {
          durationSec =
            parseInt(durationMatch[1], 10) * 3600 +
            parseInt(durationMatch[2], 10) * 60 +
            parseInt(durationMatch[3], 10);
        }

        if (match) {
          resolve({
            success: true,
            codec: match[1].toLowerCase(),
            duration: durationSec,
            audioStreams: getAudioStreamsInfo(stderrOutput),
          });
        } else {
          resolve({
            success: false,
            codec: "unknown",
            error: "No audio stream found",
          });
        }
      }
    });

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ success: false, error: err.message, codec: "unknown" });
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

// Download management
const activeDownloads = new Map();
const activeSegmentDownloads = new Map();

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
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("[DOWNLOAD] Failed to remove file:", filePath, err.message);
  }
}

function getPartMarkerPath(outputPath) {
  return `${outputPath}.part`;
}

// Marks an output file as "in progress". Its presence is the source of truth
// for whether a file on disk is a finished, playable download or a leftover
// from an interrupted/crashed/killed download that should not be trusted.
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

// Removes a partially-written output file (and its marker) after a
// cancellation or failure so it can never be mistaken for a completed
// download and never lingers on disk wasting space.
function cleanupPartialDownload(outputPath) {
  if (!outputPath) return;
  safeUnlink(outputPath);
  
  const metaPath = getMetaPath(outputPath);
  safeUnlink(metaPath);

  clearDownloadMarker(outputPath);
  cleanEmptyDirs(outputPath);
}

function cleanEmptyDirs(filePath) {
  try {
    const baseDir1 = getMediaLibraryBaseDir();
    const baseDir2 = getLegacyDownloadsBaseDir();
    
    let currentDir = path.dirname(filePath);
    
    while (isInsideMediaLibrary(currentDir)) {
      if (path.resolve(currentDir) === path.resolve(baseDir1) || 
          path.resolve(currentDir) === path.resolve(baseDir2)) {
        break;
      }
      
      const files = fs.readdirSync(currentDir);
      if (files.length === 0) {
        fs.rmdirSync(currentDir);
        logToFile("[DOWNLOAD] Cleaned empty directory:", currentDir);
        currentDir = path.dirname(currentDir);
      } else {
        break;
      }
    }
  } catch (err) {
    console.error("[DOWNLOAD] Failed to clean empty dirs:", err.message);
  }
}

function isMediaFileComplete(filePath) {
  return fs.existsSync(filePath) && !fs.existsSync(getPartMarkerPath(filePath));
}

function getMetaPath(outputPath) {
  return `${outputPath}.meta.json`;
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
    fs.writeFileSync(getMetaPath(outputPath), JSON.stringify(data), "utf8");
  } catch (err) {
    console.error("[DOWNLOAD] Failed to write metadata:", err.message);
  }
}

// Finds a free (or matching) output path for a given stream so two different
// sources that happen to produce the same file name never overwrite each
// other. If `basePath` is already occupied by a different stream (per its
// metadata sidecar), a numbered suffix is used instead. Files saved before
// this mechanism existed have no sidecar and are treated as a match so
// existing libraries keep being recognized rather than being duplicated.
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
    if (!meta || meta.streamUrl === streamUrl) {
      return candidate;
    }
  }
  return basePath;
}

async function downloadHlsSegmented(
  downloadId,
  streamUrl,
  outputPath,
  name,
  prefLang,
  event,
) {
  const tempDir = path.join(path.dirname(outputPath), `temp_${downloadId}`);
  const abortController = new AbortController();
  activeSegmentDownloads.set(downloadId, {
    abortController,
    tempDir,
    outputPath,
  });

  try {
    const response = await fetch(streamUrl, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch stream: ${response.statusText}`);
    }

    let firstChunk = null;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      try {
        const { value } = await reader.read();
        firstChunk = value;
      } finally {
        try { await reader.cancel(); } catch {}
      }
    } else if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
      for await (const chunk of response.body) {
        firstChunk = chunk;
        break;
      }
    }

    if (!firstChunk) {
      throw new Error('Empty response body');
    }

    const firstChunkText = new TextDecoder().decode(firstChunk);
    if (!firstChunkText.includes('#EXTM3U')) {
      throw new Error('FALLBACK_NOT_HLS');
    }

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const hlsRes = await fetch(streamUrl, { signal: abortController.signal });
    if (!hlsRes.ok) {
      throw new Error(`Failed to fetch HLS playlist: ${hlsRes.statusText}`);
    }
    const text = await hlsRes.text();

    if (text.includes("#EXT-X-KEY") && text.includes("AES-128")) {
      throw new Error("FALLBACK_ENCRYPTED");
    }

    const lines = text.split("\n");
    const segments = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("#EXTINF:")) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && !nextLine.startsWith("#")) {
          let segmentUrl = nextLine;
          if (
            !segmentUrl.startsWith("http://") &&
            !segmentUrl.startsWith("https://")
          ) {
            segmentUrl = new URL(segmentUrl, streamUrl).href;
          }
          segments.push({ url: segmentUrl, index: segments.length });
        }
      }
    }

    if (segments.length === 0) {
      throw new Error("No segment files found in HLS playlist");
    }

    console.log(`[HLS DOWNLOAD] Found ${segments.length} segments for ${name}`);
    logToFile(`[HLS DOWNLOAD] Found ${segments.length} segments for ${name}`);

    const MAX_CONCURRENT = 6;
    let activeCount = 0;
    let nextIndex = 0;
    let completedCount = 0;
    let totalBytesDownloaded = 0;
    let lastProgressTime = Date.now();
    let speedBytes = 0;
    let currentSpeed = "0 Mbps";

    await new Promise((resolve, reject) => {
      const startNextTask = async () => {
        if (abortController.signal.aborted) {
          reject(new Error("ABORTED"));
          return;
        }

        if (completedCount === segments.length) {
          resolve();
          return;
        }

        while (activeCount < MAX_CONCURRENT && nextIndex < segments.length) {
          const task = segments[nextIndex++];
          activeCount++;

          (async (segment) => {
            const partPath = path.join(tempDir, `part_${segment.index}.ts`);
            let attempt = 0;
            const maxAttempts = 3;
            let success = false;

            while (
              attempt < maxAttempts &&
              !success &&
              !abortController.signal.aborted
            ) {
              try {
                attempt++;
                const segRes = await fetch(segment.url, {
                  signal: abortController.signal,
                });
                if (!segRes.ok) throw new Error(`Status ${segRes.status}`);

                const buffer = await segRes.arrayBuffer();
                fs.writeFileSync(partPath, Buffer.from(buffer));
                totalBytesDownloaded += buffer.byteLength;
                speedBytes += buffer.byteLength;

                success = true;
              } catch (err) {
                if (attempt >= maxAttempts) {
                  reject(
                    new Error(
                      `Failed segment ${segment.index} after ${maxAttempts} attempts: ${err.message}`,
                    ),
                  );
                  return;
                }
                await new Promise((r) => setTimeout(r, 1000));
              }
            }

            activeCount--;
            completedCount++;

            const now = Date.now();
            const timeDiff = now - lastProgressTime;
            if (timeDiff >= 1000) {
              const mbps = (speedBytes * 8) / (1024 * 1024 * (timeDiff / 1000));
              currentSpeed = `${mbps.toFixed(1)} Mbps`;
              speedBytes = 0;
              lastProgressTime = now;

              const progress = Math.min(
                99,
                Math.round((completedCount / segments.length) * 100),
              );
              const sizeMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(1);

              if (event && event.sender) {
                event.sender.send("download-progress", {
                  downloadId,
                  progress,
                  speed: currentSpeed,
                  timeLeft:
                    completedCount > 0
                      ? `${Math.round(((segments.length - completedCount) * (timeDiff / 1000)) / (completedCount - (completedCount - MAX_CONCURRENT)))}s`
                      : "--",
                  size: `${sizeMB} MB`,
                  downloader: "segmented",
                });
              }
            }

            startNextTask();
          })(task);
        }
      };

      startNextTask();
    });

    const listPath = path.join(tempDir, "list.txt");
    const listLines = segments
      .map((s) => `file 'part_${s.index}.ts'`)
      .join("\n");
    fs.writeFileSync(listPath, listLines);

    const ffmpegPath = getFfmpegPath();
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
    logToFile("[HLS CONCAT] Command: " + ffmpegPath + " " + args.join(" "));

    await new Promise((resolveConcat, rejectConcat) => {
      const proc = spawn(ffmpegPath, args, { windowsHide: true });
      proc.on("close", (code) => {
        if (code === 0) {
          resolveConcat();
        } else {
          rejectConcat(new Error(`FFmpeg concat exited with code ${code}`));
        }
      });
      proc.on("error", (err) => {
        rejectConcat(err);
      });
    });

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    activeSegmentDownloads.delete(downloadId);
    return { success: true, filePath: outputPath };
  } catch (err) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    activeSegmentDownloads.delete(downloadId);

    if (err.message === "FALLBACK_ENCRYPTED" || err.message === "FALLBACK_NOT_HLS") {
      throw err;
    }

    if (err.message === "ABORTED" || abortController.signal.aborted) {
      return { success: false, error: "CANCELLED" };
    }

    throw err;
  }
}

async function probeStreamTracks(streamUrl, ffmpegPath) {
  return new Promise((resolve) => {
    const args = ["-i", streamUrl];
    const proc = spawn(ffmpegPath, args, { windowsHide: true });

    let stderr = "";
    const timeout = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
    }, 4500);

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", () => {
      clearTimeout(timeout);

      const tracks = [];
      const lines = stderr.split("\n");
      const streamRegex =
        /Stream #0:(\d+)(?:\(([^)]+)\))?:\s*(Audio|Video|Subtitle)/i;

      for (const line of lines) {
        const match = line.match(streamRegex);
        if (match) {
          tracks.push({
            index: `0:${match[1]}`,
            lang: match[2] ? match[2].toLowerCase() : null,
            type: match[3].toLowerCase(),
          });
        }
      }
      resolve(tracks);
    });

    proc.on("error", () => {
      clearTimeout(timeout);
      resolve([]);
    });
  });
}

function getMediaLibraryBaseDir() {
  if (configCache && configCache.customDownloadsPath) {
    return configCache.customDownloadsPath;
  }
  return path.join(app.getPath("videos"), "Strmly");
}

function getLegacyDownloadsBaseDir() {
  return path.join(app.getPath("downloads"), "Strmly");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
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
  return (
    isInsideDir(getMediaLibraryBaseDir(), filePath) ||
    isInsideDir(getLegacyDownloadsBaseDir(), filePath)
  );
}

function parseDownloadMediaInfo(name) {
  const rawName = String(name || "").trim();
  const patterns = [
    /^(.*?)\s*[-_. ]\s*S(\d{1,2})\s*E(\d{1,3})(?:\D.*)?$/i,
    /^(.*?)\s*S(\d{1,2})\s*E(\d{1,3})(?:\D.*)?$/i,
    /^(.*?)\s*(\d{1,2})\.?\s*Sezon\s*(\d{1,3})\.?\s*BÃ¶lÃ¼m(?:\D.*)?$/i,
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
  const outputPath = path.join(downloadsDir, fileName);
  return { downloadType, sourceName, mediaInfo, outputPath };
}

function getDownloadTargetCandidates(type, name, downloadId, streamUrl) {
  const target = getDownloadTarget(type, name, downloadId, false);
  const resolvedPrimary = streamUrl
    ? resolveOutputPathForStream(target.outputPath, streamUrl)
    : target.outputPath;
  const candidates = [resolvedPrimary];
  if (resolvedPrimary !== target.outputPath) {
    candidates.push(target.outputPath);
  }

  if (target.downloadType === "series") {
    const fallbackDir = path.join(
      getMediaLibraryBaseDir(),
      "Diziler",
      target.mediaInfo.title,
    );
    candidates.push(
      path.join(fallbackDir, target.outputPath.split(path.sep).pop()),
    );
    const legacyDir = path.join(
      getLegacyDownloadsBaseDir(),
      "Diziler",
      target.mediaInfo.title,
      `Sezon ${target.mediaInfo.season}`,
    );
    candidates.push(
      path.join(legacyDir, target.outputPath.split(path.sep).pop()),
    );
  } else {
    const legacyDir = path.join(getLegacyDownloadsBaseDir(), "Filmler");
    candidates.push(
      path.join(legacyDir, target.outputPath.split(path.sep).pop()),
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

ipcMain.handle(
  "get-saved-media-info",
  async (event, { downloadId, type, name, streamUrl }) => {
    try {
      const { candidates } = getDownloadTargetCandidates(
        type,
        name,
        downloadId,
        streamUrl,
      );
      const existingPath = candidates.find(
        (candidate) =>
          isInsideMediaLibrary(candidate) && isMediaFileComplete(candidate),
      );
      if (existingPath) {
        const stats = fs.statSync(existingPath);
        return {
          exists: true,
          filePath: existingPath,
          playUrl: appFileUrlFromPath(existingPath),
          size: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
        };
      }
      return { exists: false };
    } catch (err) {
      logToFile("[DOWNLOAD] Saved media lookup error:", err.message);
      return { exists: false, error: err.message };
    }
  },
);

ipcMain.handle(
  "download-stream",
  async (event, { downloadId, streamUrl, type, name }) => {
    console.log(
      "[DOWNLOAD] Handler called:",
      downloadId,
      streamUrl,
      type,
      name,
    );
    logToFile("[DOWNLOAD] Handler called:", downloadId, streamUrl, type, name);

    const ffmpegPath = getFfmpegPath();
    console.log("[DOWNLOAD] FFmpeg path:", ffmpegPath);
    logToFile("[DOWNLOAD] FFmpeg path:", ffmpegPath);

    if (!ffmpegPath) {
      console.error("[DOWNLOAD] FFmpeg not available");
      logToFile("[DOWNLOAD] FFmpeg not available");
      return { success: false, error: "FFmpeg not available" };
    }

    const lookup = getDownloadTargetCandidates(
      type,
      name,
      downloadId,
      streamUrl,
    );
    const { outputPath, candidates } = lookup;
    const target = getDownloadTarget(type, name, downloadId, true);
    if (!isInsideMediaLibrary(outputPath)) {
      return { success: false, error: "Invalid download path" };
    }

    const existingPath = candidates.find(
      (candidate) =>
        isInsideMediaLibrary(candidate) && isMediaFileComplete(candidate),
    );
    if (existingPath) {
      const stats = fs.statSync(existingPath);
      return {
        success: true,
        skipped: true,
        filePath: existingPath,
        playUrl: appFileUrlFromPath(existingPath),
        size: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
      };
    }

    console.log("[DOWNLOAD] Output path:", outputPath);
    logToFile("[DOWNLOAD] Starting download:", downloadId, "->", outputPath);

    const freeSpace = await checkFreeSpace(outputPath);
    if (freeSpace < 100 * 1024 * 1024) {
      // Less than 100 MB free
      logToFile("[DOWNLOAD] Start cancelled due to low disk space (< 100MB)");
      return { success: false, error: "DISK_FULL" };
    }

    // Mark this output as in-progress and record which stream it belongs to,
    // so an interrupted/crashed download is never mistaken for a finished one
    // and a different source with the same computed name never collides with it.
    markDownloadStarted(outputPath);
    writeDownloadMeta(outputPath, {
      streamUrl,
      name: name || "",
      type: target.downloadType,
      savedAt: Date.now(),
    });

    // Try segmented HLS downloader first (only if it is an HLS playlist URL)
    if (streamUrl.toLowerCase().includes("m3u8")) {
      try {
        const config = await ensureConfigLoaded();
        const prefLang = config.cinema_language || "tr";
        const segmentedResult = await downloadHlsSegmented(
          downloadId,
          streamUrl,
          outputPath,
          name,
          prefLang,
          event,
        );
        if (segmentedResult.success) {
          clearDownloadMarker(outputPath);
          const stats = fs.statSync(outputPath);
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(1) + " MB";

          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("download-complete", {
              downloadId,
              filePath: outputPath,
              playUrl: appFileUrlFromPath(outputPath),
            });
          }
          if (Notification.isSupported()) {
            try {
              new Notification({
                title: "Strmly İndirme Tamamlandı",
                body: `"${name || "Medya"}" başarıyla kaydedildi.`,
                silent: false,
              }).show();
            } catch (ne) {
              console.error("Failed to show native notification:", ne);
            }
          }
          return {
            success: true,
            filePath: outputPath,
            playUrl: appFileUrlFromPath(outputPath),
          };
        } else if (segmentedResult.error === "CANCELLED") {
          cleanupPartialDownload(outputPath);
          return { success: false, error: "CANCELLED" };
        }
      } catch (err) {
        if (err.message === "FALLBACK_ENCRYPTED") {
          console.log(
            "[HLS DOWNLOAD] Stream is AES-128 encrypted, falling back to standard FFmpeg downloader.",
          );
          logToFile(
            "[HLS DOWNLOAD] Stream is AES-128 encrypted, falling back to standard FFmpeg downloader.",
          );
        } else if (err.message === "FALLBACK_NOT_HLS") {
          console.log(
            "[HLS DOWNLOAD] Stream is not HLS (e.g. direct MKV/MP4 stream), falling back to standard FFmpeg downloader.",
          );
          logToFile(
            "[HLS DOWNLOAD] Stream is not HLS (e.g. direct MKV/MP4 stream), falling back to standard FFmpeg downloader.",
          );
        } else {
          console.error(
            "[HLS DOWNLOAD] Segmented HLS downloader failed, falling back to standard FFmpeg downloader:",
            err,
          );
          logToFile(
            `[HLS DOWNLOAD] Segmented HLS downloader failed, falling back: ${err.message}`,
          );
        }
      }
    } else {
      console.log(
        "[DOWNLOAD] Stream URL does not contain m3u8. Skipping segmented downloader and using standard FFmpeg downloader.",
      );
      logToFile(
        "[DOWNLOAD] Stream URL does not contain m3u8. Skipping segmented downloader and using standard FFmpeg downloader.",
      );
    }

    let mapArgs = [];
    try {
      const tracks = await probeStreamTracks(streamUrl, ffmpegPath);
      console.log(`[DOWNLOAD] Probed tracks for ${name}:`, tracks);
      logToFile(
        `[DOWNLOAD] Probed tracks for ${name}: ${JSON.stringify(tracks)}`,
      );

      const videoTrack = tracks.find((t) => t.type === "video");
      const audioTracks = tracks.filter((t) => t.type === "audio");
      const subtitleTracks = tracks.filter((t) => t.type === "subtitle");

      if (videoTrack) {
        mapArgs.push("-map", videoTrack.index);
      } else {
        mapArgs.push("-map", "0:v:0?");
      }

      if (audioTracks.length > 0) {
        const config = await ensureConfigLoaded();
        const prefLang = config.cinema_language || "tr";
        const targetLangs =
          prefLang === "tr"
            ? ["tur", "tr", "turkish", "turkey"]
            : ["eng", "en", "english"];

        let matchedAudio = audioTracks.find(
          (t) => t.lang && targetLangs.includes(t.lang),
        );
        if (!matchedAudio) {
          const fallbackLangs =
            prefLang === "tr"
              ? ["eng", "en", "english"]
              : ["tur", "tr", "turkish", "turkey"];
          matchedAudio = audioTracks.find(
            (t) => t.lang && fallbackLangs.includes(t.lang),
          );
        }
        if (!matchedAudio) {
          matchedAudio = audioTracks[0];
        }
        if (matchedAudio) {
          mapArgs.push("-map", matchedAudio.index);
        }
      } else {
        mapArgs.push("-map", "0:a:0?");
      }

      if (subtitleTracks.length > 0) {
        const config = await ensureConfigLoaded();
        const prefLang = config.cinema_language || "tr";
        const targetLangs =
          prefLang === "tr"
            ? ["tur", "tr", "turkish", "turkey"]
            : ["eng", "en", "english"];

        const matchedSub = subtitleTracks.find(
          (t) => t.lang && targetLangs.includes(t.lang),
        );
        if (matchedSub) {
          mapArgs.push("-map", matchedSub.index);
        }
      }
    } catch (err) {
      console.error("[DOWNLOAD] Probing failed, using default maps:", err);
      logToFile("[DOWNLOAD] Probing failed, using default maps:", err.message);
      mapArgs = ["-map", "0:v:0?", "-map", "0:a:0?"];
    }

    return new Promise((resolve) => {
      const args = [
        "-i",
        streamUrl,
        ...mapArgs,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "-progress",
        "pipe:1",
        "-y",
        outputPath,
      ];

      console.log("[DOWNLOAD] FFmpeg args:", args.join(" "));
      logToFile("[DOWNLOAD] FFmpeg command:", ffmpegPath, args.join(" "));

      let proc;
      try {
        proc = spawn(ffmpegPath, args, {
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err) {
        console.error("[DOWNLOAD] Failed to spawn FFmpeg:", err);
        logToFile("[DOWNLOAD] Failed to spawn FFmpeg:", err.message);
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
      let lastProgress = 0;
      let stderrBuffer = "";
      proc.stdout.on("data", async (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.startsWith("out_time_ms=")) {
            const timeMs = parseInt(line.split("=")[1]) / 1000000;
            if (duration > 0) {
              const progress = Math.min(
                100,
                Math.round((timeMs / duration) * 100),
              );
              if (progress !== lastProgress) {
                lastProgress = progress;
                const elapsed =
                  (Date.now() - activeDownloads.get(downloadId)?.startTime) /
                  1000;
                const remaining =
                  progress > 0
                    ? Math.round((elapsed / progress) * (100 - progress))
                    : 0;
                const timeLeft =
                  remaining > 60
                    ? `${Math.floor(remaining / 60)}m ${remaining % 60}s`
                    : `${remaining}s`;

                // Calculate current file size and speed
                try {
                  const stats = fs.statSync(outputPath);
                  const currentSize = stats.size;
                  const download = activeDownloads.get(downloadId);
                  const now = Date.now();
                  const timeDiff = (now - download.lastTime) / 1000;
                  const sizeDiff = currentSize - download.lastBytes;

                  // Check disk space during download every 5 seconds
                  if (
                    download &&
                    (!download.lastSpaceCheck ||
                      now - download.lastSpaceCheck > 5000)
                  ) {
                    download.lastSpaceCheck = now;
                    const space = await checkFreeSpace(outputPath);
                    if (space < 30 * 1024 * 1024) {
                      // Less than 30 MB free
                      logToFile(
                        "[DOWNLOAD] Low space detected during download, cancelling",
                      );
                      download.isDiskFull = true;
                      proc.kill("SIGKILL");
                      return;
                    }
                  }

                  let speed = "";
                  if (timeDiff > 0.5) {
                    const bytesPerSecond = sizeDiff / timeDiff;
                    const mbps = (bytesPerSecond * 8) / (1024 * 1024);
                    speed = `${mbps.toFixed(1)} Mbps`;
                    download.lastBytes = currentSize;
                    download.lastTime = now;
                  }

                  const sizeMB = (currentSize / (1024 * 1024)).toFixed(1);
                  console.log(`[DOWNLOAD] Progress: ${progress}% ${speed}`);
                  if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send("download-progress", {
                      downloadId,
                      progress,
                      speed,
                      timeLeft,
                      size: `${sizeMB} MB`,
                      downloader: "ffmpeg",
                    });
                  }
                } catch (e) {
                  // File might not exist yet
                }
              }
            }
          } else if (line.startsWith("duration=")) {
            duration = parseFloat(line.split("=")[1]) || 0;
          }
        }
      });

      proc.stderr.on("data", (data) => {
        stderrBuffer += data.toString();
        const durationMatch = data
          .toString()
          .match(/Duration:\s*(\d+):(\d+):(\d+)/);
        if (durationMatch) {
          duration =
            parseInt(durationMatch[1]) * 3600 +
            parseInt(durationMatch[2]) * 60 +
            parseInt(durationMatch[3]);
          console.log("[DOWNLOAD] Duration:", duration, "seconds");
          logToFile("[DOWNLOAD] Duration:", duration, "seconds");
        }
      });

      proc.on("close", (code) => {
        console.log("[DOWNLOAD] Process closed with code:", code);
        logToFile("[DOWNLOAD] Process closed with code:", code);
        const wasDiskFull = activeDownloads.get(downloadId)?.isDiskFull;
        activeDownloads.delete(downloadId);

        if (wasDiskFull) {
          cleanupPartialDownload(outputPath);
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("download-progress", {
              downloadId,
              progress: 0,
              speed: "0",
              timeLeft: "0",
              size: "0",
              error: "DISK_FULL",
              downloader: "ffmpeg",
            });
          }
          resolve({ success: false, error: "DISK_FULL" });
          return;
        }

        if (code === 0) {
          try {
            clearDownloadMarker(outputPath);
            const stats = fs.statSync(outputPath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(1) + " MB";
            console.log("[DOWNLOAD] Completed:", downloadId, sizeMB);
            logToFile("[DOWNLOAD] Completed:", downloadId, sizeMB);

            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send("download-complete", {
                downloadId,
                filePath: outputPath,
                playUrl: appFileUrlFromPath(outputPath),
              });
            }
            if (Notification.isSupported()) {
              try {
                new Notification({
                  title: "Strmly İndirme Tamamlandı",
                  body: `"${name || "Medya"}" başarıyla kaydedildi.`,
                  silent: false,
                }).show();
              } catch (ne) {
                console.error("Failed to show native notification:", ne);
              }
            }
            resolve({
              success: true,
              filePath: outputPath,
              playUrl: appFileUrlFromPath(outputPath),
            });
          } catch (err) {
            console.error("[DOWNLOAD] Failed to get file stats:", err);
            cleanupPartialDownload(outputPath);
            resolve({
              success: false,
              error: "Download completed but file not found",
            });
          }
        } else {
          cleanupPartialDownload(outputPath);
          console.error("[DOWNLOAD] Failed:", downloadId, "exit code:", code);
          console.error("[DOWNLOAD] Stderr:", stderrBuffer.slice(-500));
          logToFile(
            "[DOWNLOAD] Failed:",
            downloadId,
            "exit code:",
            code,
            "stderr:",
            stderrBuffer.slice(-500),
          );
          resolve({
            success: false,
            error: `FFmpeg exited with code ${code}: ${stderrBuffer.slice(-200)}`,
          });
        }
      });

      proc.on("error", (err) => {
        console.error("[DOWNLOAD] Process error:", err);
        logToFile("[DOWNLOAD] Error:", downloadId, err.message);
        activeDownloads.delete(downloadId);
        cleanupPartialDownload(outputPath);
        resolve({ success: false, error: err.message });
      });
    });
  },
);

ipcMain.handle("cancel-download", async (event, { downloadId }) => {
  const segDl = activeSegmentDownloads.get(downloadId);
  if (segDl) {
    try {
      segDl.abortController.abort();
      activeSegmentDownloads.delete(downloadId);
      setTimeout(() => {
        try {
          fs.rmSync(segDl.tempDir, { recursive: true, force: true });
        } catch {}
        cleanupPartialDownload(segDl.outputPath);
      }, 500);
      return { success: true };
    } catch {}
  }

  const download = activeDownloads.get(downloadId);
  if (download && download.process) {
    download.process.kill("SIGKILL");
    activeDownloads.delete(downloadId);
    cleanupPartialDownload(download.outputPath);
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle("delete-file", async (event, { filePath }) => {
  try {
    if (!isInsideMediaLibrary(filePath)) {
      return { success: false, error: "Invalid file path" };
    }
    
    // 1. Delete the video file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logToFile("[DOWNLOAD] Deleted file:", filePath);
    }
    
    // 2. Delete the metadata file sidecar
    const metaPath = getMetaPath(filePath);
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
      logToFile("[DOWNLOAD] Deleted metadata file:", metaPath);
    }

    // 3. Delete part marker if exists
    const partMarker = getPartMarkerPath(filePath);
    if (fs.existsSync(partMarker)) {
      fs.unlinkSync(partMarker);
    }

    // 4. Clean up any empty parent directories
    cleanEmptyDirs(filePath);

    return { success: true };
  } catch (err) {
    logToFile("[DOWNLOAD] Delete error:", err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("play-file", async (event, { filePath }) => {
  try {
    if (!isInsideMediaLibrary(filePath)) {
      return { success: false, error: "Invalid file path" };
    }
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File not found" };
    }
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    logToFile("[DOWNLOAD] Play error:", err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("open-downloads-folder", async () => {
  try {
    const config = await ensureConfigLoaded();
    const downloadsDir = ensureDir(
      config.customDownloadsPath || path.join(app.getPath("videos"), "Strmly"),
    );
    await shell.openPath(downloadsDir);
    return { success: true };
  } catch (err) {
    logToFile("[DOWNLOAD] Open downloads folder error:", err.message);
    return { success: false, error: err.message };
  }
});

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

// Recursively count regular files under a directory for move progress reporting.
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

// Emit move progress to the renderer. Sends null `totalFiles` when the total is
// unknown (e.g. counting failed), so the frontend can avoid rendering a stale
// "x / 0" counter.
function sendMoveDownloadsProgress(state) {
  if (!mainWindow || !mainWindow.webContents) return;
  try {
    mainWindow.webContents.send("move-downloads-progress", state);
  } catch {
    // Best-effort: the window may have been closed mid-transfer.
  }
}

async function moveDirectoryContents(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const totalFiles = await countFilesRecursive(src);
  let filesMoved = 0;

  const moveEntry = async (entrySrc, entryDest) => {
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
        const percent =
          totalFiles > 0
            ? Math.min(100, Math.round((filesMoved / totalFiles) * 100))
            : 0;
        sendMoveDownloadsProgress({
          progress: percent,
          currentFile: entry.name,
          filesMoved,
          totalFiles,
        });
      }
    }
  };

  await moveEntry(src, dest);
}

ipcMain.handle("select-downloads-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  return { canceled: false, filePath: result.filePaths[0] };
});

ipcMain.handle(
  "set-downloads-folder",
  async (event, { folderPath, moveExisting }) => {
    try {
      const config = await ensureConfigLoaded();
      const oldPath =
        config.customDownloadsPath ||
        path.join(app.getPath("videos"), "Strmly");
      const newPath = folderPath;

      if (oldPath === newPath) {
        return { success: true };
      }

      if (moveExisting && fs.existsSync(oldPath)) {
        logToFile(
          `[DOWNLOAD] Moving existing downloads from ${oldPath} to ${newPath}`,
        );
        sendMoveDownloadsProgress({
          progress: 0,
          currentFile: "",
          filesMoved: 0,
          totalFiles: 0,
        });
        await moveDirectoryContents(oldPath, newPath);
        sendMoveDownloadsProgress({
          progress: 100,
          currentFile: "",
          filesMoved: 0,
          totalFiles: 0,
        });
      }

      config.customDownloadsPath = newPath;
      await queueConfigWrite();
      return { success: true };
    } catch (err) {
      logToFile("[DOWNLOAD] Set downloads folder error:", err.message);
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle("get-downloads-folder", async () => {
  const config = await ensureConfigLoaded();
  return (
    config.customDownloadsPath || path.join(app.getPath("videos"), "Strmly")
  );
});
