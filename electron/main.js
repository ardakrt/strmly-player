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
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const { randomUUID } = require("crypto");
const { createMainLogger } = require("./main-logger");
const { registerAutoUpdateHandlers } = require("./auto-update-service");
const { createProfileStorage } = require("./profile-storage");
const { registerMediaProxyService } = require("./media-proxy-service");
const { spawnDetached } = require("./process-launcher");
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
  const benchmarkUserData = process.env.STRMLY_PERF_USER_DATA
    ? path.resolve(process.env.STRMLY_PERF_USER_DATA)
    : path.join(os.tmpdir(), "strmly-performance-benchmark");
  app.setPath("userData", benchmarkUserData);
  // Keep Chromium's paint/timer cadence stable for the explicit benchmark.
  // Windows may otherwise classify an inactive test window as occluded and
  // throttle requestAnimationFrame to roughly one frame every two seconds.
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
}
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// Check config for hardware acceleration setting
let disableHW = process.env.STRMLY_DISABLE_HW_ACCELERATION === "1";
try {
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  const profilesDir = process.env.STRMLY_PERF_BENCH === "1" || !isDev
    ? path.join(app.getPath("userData"), "profiles")
    : path.join(app.getAppPath(), "profiles");
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

const { log: logToFile, flush: flushLogBuffer, flushSync: flushLogBufferSync } = createMainLogger({
  userDataPath: app.getPath("userData"),
});

// Register custom protocols as privileged BEFORE app is ready.
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
  {
    scheme: "tmdb-image",
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
  if (process.env.STRMLY_FFMPEG_PATH) {
    candidates.push(path.resolve(process.env.STRMLY_FFMPEG_PATH));
  }
  // Linux distribution FFmpeg is more reliable for IPTV HTTP inputs than the
  // ffmpeg-static 7.0.2 build, which can exit with SIGSEGV on valid streams.
  if (process.platform !== "win32") candidates.push("ffmpeg");
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
  if (process.platform === "win32") candidates.push("ffmpeg");

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
const { scheduleStartupUpdateCheck } = registerAutoUpdateHandlers({
  app,
  ipcMain,
  getMainWindow: () => mainWindow,
});
const {
  ensureConfigLoaded,
  flushSync: flushConfigSync,
  getConfigCache,
  getTmdbCacheDir,
  initialize: initializeProfileStorage,
  queueConfigWrite,
} = createProfileStorage({ app, ipcMain });

// Prevent multiple instances from running simultaneously. Running two
// instances at once causes both processes to fight over the same GPU/disk
// cache directory, which triggers "Unable to move the cache: Erişim
// engellendi" errors and a slow/black-screen startup.
// Perf bench must not lose the single-instance lock race against a leftover Electron.
const gotSingleInstanceLock = process.env.STRMLY_PERF_BENCH === "1"
  ? true
  : app.requestSingleInstanceLock();
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
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0A0A0B",
      symbolColor: "#ffffff",
      height: 38,
    },
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
    mainWindow.webContents.session.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
  }

  if (isPerformanceBenchmark) {
    mainWindow.webContents.once("did-finish-load", async () => {
      try {
        mainWindow.show();
        mainWindow.focus();
        const { runPerformanceBenchmark } = require("./performance-benchmark");
        const results = await runPerformanceBenchmark(mainWindow, {
          iterations: Number(process.env.STRMLY_PERF_ITERATIONS) || 30,
          warmups: Number(process.env.STRMLY_PERF_WARMUPS) || 2,
        });
        console.log(`STRMLY_PERF_RESULT=${JSON.stringify(results)}`);
        app.quit();
      } catch (error) {
        console.log(`STRMLY_PERF_ERROR=${error?.stack || error}`);
        process.exitCode = 1;
        app.quit();
      }
    });
  }

  // Handle mouse side buttons (back/forward) globally on the window
  mainWindow.on("app-command", (e, cmd) => {
    if (cmd === "browser-backward" || cmd === "back" || cmd === "app-command-back") {
      mainWindow.webContents.send("navigate-back");
    } else if (cmd === "browser-forward" || cmd === "forward" || cmd === "app-command-forward") {
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
    (event) => {
      const { level, message, lineNumber, sourceId } = event;
      logToFile(
        "[RENDERER]",
        `Level:${level} - ${message} (at ${sourceId}:${lineNumber})`,
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
  if (isPerformanceBenchmark) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else if (isDev) {
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

  // Stream TMDB artwork through Electron so the renderer can use Chromium's
  // HTTP cache without creating permanent artwork files on disk.
  protocol.handle("tmdb-image", async (request) => {
    try {
      const url = new URL(request.url);
      const size = url.hostname;
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
      if (!allowedSizes.has(size) || !url.pathname.startsWith("/")) {
        return new Response("Invalid TMDB image request", { status: 400 });
      }

      const data = await fetchHttpsFromHost(
        "image.tmdb.org",
        `/t/p/${size}${url.pathname}`,
        true,
      );
      return new Response(data.buffer, {
        status: 200,
        headers: {
          "Content-Type": data.contentType || "image/jpeg",
          "Cache-Control":
            "public, max-age=604800, stale-while-revalidate=86400",
        },
      });
    } catch (error) {
      console.error("TMDB image stream failed:", error.message);
      return new Response("TMDB image unavailable", { status: 502 });
    }
  });

  // Register custom protocol handle for app-file:// scheme
  const { pathToFileURL } = require("url");
  protocol.handle("app-file", async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      let filePath = decodeURIComponent(parsedUrl.pathname || "");
      if (process.platform === "win32") {
        // pathToFileURL → app-file:///E:/path  → pathname "/E:/path"
        // Some parsers yield app-file://E:/path → host "E:" + pathname "/path"
        // which otherwise becomes "\path" and loses the drive letter.
        const host = String(parsedUrl.host || parsedUrl.hostname || "");
        if (/^[a-zA-Z]:?$/i.test(host)) {
          const drive = host.replace(":", "").toUpperCase() + ":";
          const rest = filePath.startsWith("/") ? filePath : `/${filePath}`;
          filePath = drive + rest;
        } else if (/^\/[a-zA-Z]:[\\/]/.test(filePath) || /^\/[a-zA-Z]:\//.test(filePath)) {
          filePath = filePath.substring(1);
        } else if (/^[a-zA-Z]\//.test(filePath)) {
          filePath = filePath[0] + ":" + filePath.substring(1);
        }
        filePath = filePath.replace(/\//g, path.sep);
      } else {
        filePath = filePath.replace(/^\/+/, "/");
      }
      filePath = path.normalize(filePath);
      filePath = resolveTmdbCacheFilePath(filePath);

      // Helper for non-blocking file existence checks
      const fileExistsAsync = async (targetPath) => {
        try {
          await fs.promises.access(targetPath);
          return true;
        } catch {
          return false;
        }
      };

      // Auto-recovery: If a TMDB cache image file is missing on disk, download it on the fly!
      const cacheDir = getTmdbCacheDir();
      if (
        process.env.STRMLY_PERF_BENCH !== "1" &&
        !(await fileExistsAsync(filePath))
      ) {
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
                if (!(await fileExistsAsync(dir))) {
                  await fs.promises.mkdir(dir, { recursive: true });
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

      if (!(await fileExistsAsync(filePath))) {
        console.error(`[App-File Handler] File not found: ${filePath}`);
        return new Response("File not found", { status: 404 });
      }

      if (!(await fileExistsAsync(cacheDir))) {
        await fs.promises.mkdir(cacheDir, { recursive: true });
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
  initializeProfileStorage()
    .catch((err) => console.error("Startup background load error:", err));

  createWindow();
  scheduleStartupUpdateCheck();

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
  flushConfigSync();

  flushLogBufferSync();

  stopAllDownloads();
  stopFfmpegProxy();
});

function appFileOrFileUrlToPath(rawUrl) {
  try {
    // Keep host (drive letter) when parsing Windows app-file://E:/... forms.
    const raw = String(rawUrl || "");
    const parsed = new URL(
      raw.startsWith("app-file:")
        ? raw.replace(/^app-file:/i, "file:")
        : raw,
    );
    if (parsed.protocol !== "file:") return null;
    let filePath = decodeURIComponent(parsed.pathname || "");
    if (process.platform === "win32") {
      const host = String(parsed.host || parsed.hostname || "");
      if (/^[a-zA-Z]:?$/i.test(host)) {
        const drive = host.replace(":", "").toUpperCase() + ":";
        const rest = filePath.startsWith("/") ? filePath : `/${filePath}`;
        filePath = drive + rest;
      } else if (/^\/[a-zA-Z]:[\\/]/.test(filePath) || /^\/[a-zA-Z]:\//.test(filePath)) {
        filePath = filePath.substring(1);
      } else if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = filePath[0] + ":" + filePath.substring(1);
      }
      filePath = filePath.replace(/\//g, path.sep);
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

    let lastError = null;
    for (const vlcPath of paths) {
      const result = await spawnDetached(vlcPath, [url]);
      if (result.success) {
        return { success: true, message: "VLC Başlatıldı." };
      }
      lastError = result.error;
    }
    if (lastError) console.error("Failed to launch VLC:", lastError.message);
    return {
      success: false,
      message: "VLC bulunamadı. Lütfen VLC Player'ın kurulu olduğundan emin olun.",
    };
  } else if (playerType === "mpv") {
    const result = await spawnDetached("mpv", [url]);
    if (result.success) {
      return { success: true, message: "MPV Başlatıldı." };
    }
    console.error("Failed to launch MPV:", result.error?.message);
    return {
      success: false,
      message:
        "MPV bulunamadı. Lütfen MPV'nin PATH ortam değişkenine ekli olduğundan emin olun.",
    };
  } else if (playerType === "browser") {
    // Open in default browser
    await shell.openExternal(url);
    return { success: true, message: "Tarayıcıda açıldı." };
  }

  return { success: false, message: "Bilinmeyen oynatıcı türü." };
});

registerTmdbHandlers({
  ipcMain,
  getTmdbCacheDir,
  appFileUrlFromPath,
  offline: process.env.STRMLY_PERF_BENCH === "1",
});

const { stopFfmpegProxy } = registerMediaProxyService({
  app,
  ipcMain,
  getFfmpegPath,
  isAllowedMediaUrl,
  isInsideMediaLibrary,
  isLocalMediaUrl,
  resolveLocalMediaPath: (rawUrl) =>
    appFileOrFileUrlToPath(rawUrl) ||
    (/^[a-zA-Z]:[\\/]/.test(rawUrl) || rawUrl.startsWith("\\\\")
      ? path.normalize(rawUrl)
      : null),
  resolveHostIp,
  redactSensitiveText,
});

// --- AUTO-UPDATE INTEGRATION ---
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
  getConfigCache,
  getMainWindow: () => mainWindow,
  isSafeConfiguredDownloadFolder,
  isSafeDownloadFolderSelection,
  redactSensitiveText,
  redactSensitiveUrl,
});

