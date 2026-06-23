const { app, BrowserWindow, ipcMain, shell, protocol, net, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const { migrateProfileData } = require('./migration');

// Keep hardware acceleration enabled by default for smooth scrolling/video.
// Set STRMLY_DISABLE_HW_ACCELERATION=1 only when diagnosing GPU-specific blank windows.
if (process.env.STRMLY_DISABLE_HW_ACCELERATION === '1') {
  app.disableHardwareAcceleration();
}

// Setup local file logger
const logFile = path.join(app.getPath('userData'), 'app.log');
const previousLogFile = path.join(app.getPath('userData'), 'app.previous.log');
const MAX_LOG_BYTES = 2 * 1024 * 1024;
try {
  if (fs.existsSync(logFile)) {
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_BYTES) {
      try { fs.rmSync(previousLogFile, { force: true }); } catch {}
      fs.renameSync(logFile, previousLogFile);
    }
  }
  fs.appendFileSync(logFile, `\n--- Strmly session ${new Date().toISOString()} ---\n`, 'utf8');
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
  const batch = logBuffer.join('');
  logBuffer = [];
  logWriteQueue = logWriteQueue
    .catch(() => undefined)
    .then(() => fs.promises.appendFile(logFile, batch, 'utf8'));
}

function logToFile(...args) {
  try {
    const msg = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.message;
      }
      return typeof arg === 'object' ? JSON.stringify(arg) : arg;
    }).join(' ')
      .replace(/(api_key=)[^&\s"]+/gi, '$1[redacted]')
      .replace(/("cinema_tmdb_key"\s*:\s*")[^"]+/gi, '$1[redacted]');
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
  logToFile('[INFO]', ...args);
};
console.warn = (...args) => {
  originalWarn(...args);
  logToFile('[WARN]', ...args);
};
console.error = (...args) => {
  originalError(...args);
  logToFile('[ERROR]', ...args);
};

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception in Main Process:', err);
  flushLogBuffer();
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in Main Process at:', promise, 'reason:', reason);
  flushLogBuffer();
});

// Register app-file:// protocol as privileged BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-file', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// FFmpeg binary path (from ffmpeg-static package)
let ffmpegPath = undefined;
function getFfmpegPath() {
  if (ffmpegPath !== undefined) return ffmpegPath;
  try {
    let resolvedPath = require('ffmpeg-static');
    
    // In packaged/production builds, resolve path to app.asar.unpacked
    if (resolvedPath && resolvedPath.includes('app.asar') && !resolvedPath.includes('app.asar.unpacked')) {
      resolvedPath = resolvedPath.replace(/app\.asar/i, 'app.asar.unpacked');
    }

    if (resolvedPath && fs.existsSync(resolvedPath)) {
      console.log('FFmpeg found at:', resolvedPath);
      ffmpegPath = resolvedPath;
    } else {
      ffmpegPath = null;
    }
  } catch {
    ffmpegPath = null;
  }
  return ffmpegPath;
}

// FFmpeg proxy state
let ffmpegProcess = null;
let proxyServer = null;
let proxyPort = 0;

// Allow autoplay of audio/video without user gesture
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Disable media engagement checks that block audio
app.commandLine.appendSwitch('disable-features', 'PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies');
// Enable hardware acceleration for smoother video playback
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Strmly",
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: "#0A0A0B",
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true, // Enabled for security. Custom app-file:// protocol and CORS header injector allow safe loading.
      devTools: !app.isPackaged || process.env.STRMLY_OPEN_DEVTOOLS === '1'
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
  mainWindow.once('ready-to-show', showWindow);
  setTimeout(showWindow, 1000);

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false);

  // Log all console messages from the renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logToFile('[RENDERER]', `Level:${level} - ${message} (at ${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[RENDERER] Failed to load URL: ${validatedURL} - Error: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch (err) {
      console.error('[SECURITY] Blocked invalid window open URL:', err.message);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
      console.error(`[SECURITY] Blocked renderer navigation to: ${url}`);
    }
  });

  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error(`[RENDERER] Process crashed: killed=${killed}`);
    flushLogBuffer();
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[RENDERER] Process gone:', details);
    flushLogBuffer();
  });

  mainWindow.on('unresponsive', () => {
    console.error('[RENDERER] Window became unresponsive');
  });

  // Set user agent to appear as a standard Xtream player to IPTV providers
  mainWindow.webContents.setUserAgent('9XtreamPlayer LibVLC/3.0.22-rc1');

  // In development, load Vite dev server. In production, load build folder.
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    if (process.env.STRMLY_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Register custom protocol handle for app-file:// scheme
  const { pathToFileURL } = require('url');
  protocol.handle('app-file', async (request) => {
    try {
      let rawPath = request.url.replace(/^app-file:\/+/i, '');
      let filePath = decodeURIComponent(rawPath);
      if (process.platform === 'win32' && /^[a-zA-Z]\//.test(filePath)) {
        filePath = filePath[0] + ':' + filePath.substring(1);
      }
      filePath = path.normalize(filePath);

      if (!fs.existsSync(filePath)) {
        console.error(`[App-File Handler] File not found: ${filePath}`);
        return new Response('File not found', { status: 404 });
      }

      const cacheRoot = await fs.promises.realpath(getTmdbCacheDir());
      const realFilePath = await fs.promises.realpath(filePath);
      const relativePath = path.relative(cacheRoot, realFilePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        console.error(`[App-File Handler] Blocked access outside TMDB cache: ${realFilePath}`);
        return new Response('Forbidden', { status: 403 });
      }

      return net.fetch(pathToFileURL(realFilePath).toString());
    } catch (err) {
      console.error("[App-File Handler] Error:", err.message);
      return new Response('Error loading file', { status: 500 });
    }
  });

  // Inject CORS headers on headers received to bypass CORS checks for IPTV links/streams
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
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
    setHeader('Access-Control-Allow-Origin', '*');
    setHeader('Access-Control-Allow-Headers', '*');
    setHeader('Access-Control-Allow-Methods', '*');

    callback({ responseHeaders: headers });
  });

  // Start migration and config loading in the background to prevent startup freeze
  migrationPromise = migrateData();
  migrationPromise
    .then(() => ensureConfigLoaded())
    .catch((err) => console.error("Startup background load error:", err));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (logBuffer.length > 0) {
    try {
      fs.appendFileSync(logFile, logBuffer.join(''), 'utf8');
      logBuffer = [];
    } catch { /* Best-effort shutdown logging. */ }
  }
  stopFfmpegProxy();
});

function isAllowedMediaUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return ['http:', 'https:', 'rtmp:', 'rtsp:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeConfigKey(key) {
  return typeof key === 'string' && /^[a-zA-Z0-9_-]+$/.test(key) && key.length <= 160;
}

function isSafeConfigEntries(entries) {
  return entries && typeof entries === 'object' && !Array.isArray(entries) && Object.keys(entries).every(isSafeConfigKey);
}

// IPC Handler to run external players
ipcMain.handle('play-external', async (event, { url, playerType }) => {
  console.log(`Attempting to play URL: ${url} using ${playerType}`);

  if (!isAllowedMediaUrl(url)) {
    return { success: false, message: "Geçersiz medya URL'si." };
  }
  
  if (playerType === 'vlc') {
    // Common Windows VLC installation paths
    const paths = [
      'vlc', // If in PATH
      'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
      'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
    ];

    let launched = false;
    for (const vlcPath of paths) {
      try {
        const child = spawn(vlcPath, [url], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        child.on('error', (error) => {
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
    return { success: launched, message: launched ? "VLC Başlatıldı." : "VLC bulunamadı. Lütfen VLC Player'ın kurulu olduğundan emin olun." };
  } else if (playerType === 'mpv') {
    // Try running mpv from PATH
    try {
      const child = spawn('mpv', [url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.on('error', (error) => {
        if (error) {
          console.error("Failed to launch MPV", error);
        }
      });
      child.unref();
      return { success: true, message: "MPV Başlatıldı." };
    } catch (err) {
      return { success: false, message: "MPV bulunamadı. Lütfen MPV'nin PATH ortam değişkenine ekli olduğundan emin olun." };
    }
  } else if (playerType === 'browser') {
    // Open in default browser
    await shell.openExternal(url);
    return { success: true, message: "Tarayıcıda açıldı." };
  }

  return { success: false, message: "Bilinmeyen oynatıcı türü." };
});

// Config management paths
const getProfilesDir = () => {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  let profilesDir;
  if (isDev) {
    profilesDir = path.join(app.getAppPath(), 'profiles');
  } else {
    profilesDir = path.join(app.getPath('userData'), 'profiles');
  }
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }
  return profilesDir;
};

const getConfigPath = () => {
  return path.join(getProfilesDir(), 'iptv-player-config.json');
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
      const raw = await fs.promises.readFile(configPath, 'utf8');
      configCache = JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Config load error, starting with an empty config:', err);
        try {
          await fs.promises.copyFile(configPath, `${configPath}.corrupted-${Date.now()}`);
        } catch { /* The original file may not exist or may be unreadable. */ }
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
      await fs.promises.writeFile(tempPath, JSON.stringify(configCache || {}, null, 2), 'utf8');
      await fs.promises.rename(tempPath, configPath);
    });
  return configWriteQueue;
};

const getPlaylistsDir = () => {
  const playlistDir = path.join(getProfilesDir(), 'playlists');
  if (!fs.existsSync(playlistDir)) {
    fs.mkdirSync(playlistDir, { recursive: true });
  }
  return playlistDir;
};

const getTmdbCacheDir = () => {
  const cacheDir = path.join(getProfilesDir(), 'tmdb-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
};

const getPlaylistItemsPath = (id) => {
  const safeId = String(id || '');
  if (!/^[a-zA-Z0-9_-]+$/.test(safeId)) {
    throw new Error('Invalid playlist id');
  }
  return path.join(getPlaylistsDir(), `playlist-${safeId}.json`);
};

async function migrateData() {
  try {
    await migrateProfileData({
      fs,
      path,
      isPackaged: app.isPackaged,
      userDataDir: app.getPath('userData'),
      profilesDir: getProfilesDir(),
      exeDir: path.dirname(process.execPath),
      log: (...args) => console.log(...args),
      error: (...args) => console.error(...args)
    });
  } catch (err) {
    console.error("Migration error:", err);
  }
}

ipcMain.handle('save-config', async (event, { key, value }) => {
  try {
    if (!isSafeConfigKey(key)) {
      return { success: false, error: 'Invalid config key' };
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

ipcMain.on('save-config-sync', (event, { key, value }) => {
  try {
    if (!isSafeConfigKey(key)) {
      event.returnValue = { success: false, error: 'Invalid config key' };
      return;
    }
    const configPath = getConfigPath();
    const config = configCache || {};
    config[key] = value;
    configCache = config;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    event.returnValue = { success: true };
  } catch (err) {
    console.error("Config save sync error:", err);
    event.returnValue = { success: false, error: err.message };
  }
});

ipcMain.on('save-config-batch-sync', (event, entries) => {
  try {
    if (!isSafeConfigEntries(entries)) {
      event.returnValue = { success: false, error: 'Invalid config entries' };
      return;
    }
    const config = configCache || {};
    Object.assign(config, entries);
    configCache = config;
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8');
    event.returnValue = { success: true };
  } catch (err) {
    console.error('Config batch save sync error:', err);
    event.returnValue = { success: false, error: err.message };
  }
});

ipcMain.handle('load-config', async (event, { key }) => {
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
ipcMain.handle('save-playlist-items', async (event, { id, items }) => {
  try {
    const filePath = getPlaylistItemsPath(id);
    await fs.promises.writeFile(filePath, JSON.stringify(items), 'utf8');
    return { success: true };
  } catch (err) {
    console.error("Playlist items save error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-playlist-items', async (event, { id }) => {
  try {
    const filePath = getPlaylistItemsPath(id);
    if (!fs.existsSync(filePath)) return [];
    const content = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error("Playlist items load error:", err);
    return [];
  }
});

ipcMain.handle('delete-playlist-items', async (event, { id }) => {
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
    `https://dns.quad9.net/dns-query?name=${hostname}&type=A`
  ];

  const fetchWithTimeout = async (url, ms = 1500) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { 
        headers: { 'accept': 'application/dns-json' },
        signal: controller.signal 
      });
      clearTimeout(id);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      const ip = data.Answer?.find(ans => ans.type === 1)?.data;
      if (ip) return ip;
      throw new Error("No A record found");
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  try {
    const ip = await Promise.any(providers.map(url => fetchWithTimeout(url, 1500)));
    resolvedHostIps[hostname] = ip;
    console.log(`Resolved ${hostname} to ${ip} via parallel DoH`);
    return ip;
  } catch (e) {
    console.warn(`Parallel DoH resolution failed for ${hostname}:`, e.message);
    return hostname;
  }
}

const https = require('https');
const apiAgent = new https.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 60000 });
const imageAgent = new https.Agent({ keepAlive: true, maxSockets: 64, keepAliveMsecs: 60000 });

async function fetchHttpsFromHost(hostname, requestPath, asBuffer = false) {
  const ip = await resolveHostIp(hostname);
  
  return new Promise((resolve, reject) => {
    const isIp = ip !== hostname;
    
    const options = {
      hostname: ip,
      port: 443,
      path: requestPath,
      method: 'GET',
      headers: {
        'Host': hostname,
        'User-Agent': '9XtreamPlayer LibVLC/3.0.22-rc1'
      },
      servername: hostname,
      rejectUnauthorized: !isIp,
      agent: hostname === 'image.tmdb.org' ? imageAgent : apiAgent
    };
    
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Request failed with status ${res.statusCode}`));
          return;
        }

        if (asBuffer) {
          resolve({ buffer: body, contentType: res.headers['content-type'] || 'image/jpeg' });
          return;
        }

        try {
          resolve(JSON.parse(body.toString('utf8')));
        } catch (e) {
          reject(new Error("Failed to parse TMDB response"));
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function fetchFromTmdb(apiPath) {
  return fetchHttpsFromHost('api.themoviedb.org', apiPath);
}

const tmdbMainRequests = new Map();
const tmdbMainQueue = [];
const MAX_TMDB_MAIN_REQUESTS = 8;
let activeTmdbMainRequests = 0;

function queueTmdbMainRequest(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeTmdbMainRequests += 1;
      task().then(resolve, reject).finally(() => {
        activeTmdbMainRequests -= 1;
        const next = tmdbMainQueue.shift();
        if (next) next();
      });
    };
    if (activeTmdbMainRequests < MAX_TMDB_MAIN_REQUESTS) run();
    else tmdbMainQueue.push(run);
  });
}

ipcMain.handle('fetch-tmdb', async (event, { path: apiPath }) => {
  if (typeof apiPath !== 'string' || !apiPath.startsWith('/3/') || apiPath.length > 1200) {
    return { error: 'Invalid TMDB path' };
  }

  const existing = tmdbMainRequests.get(apiPath);
  if (existing) return existing;

  const request = queueTmdbMainRequest(() => fetchFromTmdb(apiPath))
    .catch((err) => {
      console.error("TMDB fetch error:", err);
      return { error: err.message };
    })
    .finally(() => tmdbMainRequests.delete(apiPath));
  tmdbMainRequests.set(apiPath, request);

  try {
    return await request;
  } catch (err) {
    console.error("TMDB fetch error:", err);
    return { error: err.message };
  }
});

ipcMain.handle('fetch-tmdb-image', async (event, { path: imagePath, size = 'w500' }) => {
  try {
    const allowedSizes = new Set(['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original']);
    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith('/')) {
      return { error: 'Invalid TMDB image path' };
    }
    if (!allowedSizes.has(size)) {
      return { error: 'Invalid TMDB image size' };
    }

    const cacheDir = path.join(getTmdbCacheDir(), size);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Replace slashes to create a safe flat filename
    const safeFileName = imagePath.replace(/\//g, '_');
    const localFilePath = path.join(cacheDir, safeFileName);

    // If cached on disk, return the app-file:/// URL directly
    if (fs.existsSync(localFilePath)) {
      return { localUrl: `app-file:///${localFilePath.replace(/\\/g, '/')}` };
    }

    const data = await fetchHttpsFromHost('image.tmdb.org', `/t/p/${size}${imagePath}`, true);
    
    // Save to cache directory asynchronously
    await fs.promises.writeFile(localFilePath, data.buffer);

    return {
      localUrl: `app-file:///${localFilePath.replace(/\\/g, '/')}`
    };
  } catch (err) {
    console.error("TMDB image fetch error:", err);
    return { error: err.message };
  }
});

// ── FFmpeg Audio Transcoding Proxy ──

async function prepareFfmpegInput(rawUrl) {
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== 'http:') {
      return { inputUrl: rawUrl, hostHeader: null };
    }

    const originalHostname = parsedUrl.hostname;
    const resolvedIp = await resolveHostIp(originalHostname);
    if (!resolvedIp || resolvedIp === originalHostname) {
      return { inputUrl: rawUrl, hostHeader: null };
    }

    const hostHeader = parsedUrl.port ? `${originalHostname}:${parsedUrl.port}` : originalHostname;
    parsedUrl.hostname = resolvedIp;
    return { inputUrl: parsedUrl.toString(), hostHeader };
  } catch {
    return { inputUrl: rawUrl, hostHeader: null };
  }
}

function stopFfmpegProxy() {
  if (ffmpegProcess) {
    try { ffmpegProcess.kill('SIGKILL'); } catch {}
    ffmpegProcess = null;
  }
  if (proxyServer) {
    try { proxyServer.close(); } catch {}
    proxyServer = null;
  }
  proxyPort = 0;
}

ipcMain.handle('start-ffmpeg-proxy', async (event, { url, startTime, audioStreamId, transcodeMode }) => {
  if (!getFfmpegPath()) {
    return { success: false, error: 'FFmpeg bulunamadı.' };
  }
  if (!isAllowedMediaUrl(url)) {
    return { success: false, error: 'Geçersiz medya URL\'si.' };
  }

  stopFfmpegProxy();
  const { inputUrl, hostHeader } = await prepareFfmpegInput(url);

  return new Promise((resolve) => {
    let resolved = false;
    let pendingRes = null;
    let bufferChunks = [];
    let bufferBytes = 0;
    let headerChunks = [];
    let headerSize = 0;
    const MAX_HEADER_SIZE = 64 * 1024; // 64KB is plenty for empty moov MP4 headers
    const MAX_BUFFER_SIZE = 4 * 1024 * 1024;
    let isFirstRequest = true;

    function startProxyServer() {
      proxyServer = http.createServer((req, res) => {
        console.log('[Proxy] Browser requested transcode stream');
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
          'Connection': 'keep-alive'
        });

        if (!isFirstRequest) {
          console.log('[Proxy] Reconnect detected, writing cached headers');
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

        req.on('close', () => {
          console.log('[Proxy] Browser closed request connection');
          if (pendingRes === res) {
            pendingRes = null;
          }
        });
      });

      proxyServer.listen(0, '127.0.0.1', () => {
        proxyPort = proxyServer.address().port;
        console.log(`[Proxy] Listening on port ${proxyPort}`);
        if (!resolved) {
          resolved = true;
          resolve({ success: true, port: proxyPort, url: `http://127.0.0.1:${proxyPort}/stream` });
        }
      });

      proxyServer.on('error', (err) => {
        console.error('[Proxy] Server error:', err.message);
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
      '-loglevel', 'warning',
      '-fflags', '+nobuffer+genpts+discardcorrupt+fastseek',
      '-flags', '+low_delay',
      '-avioflags', 'direct',
      '-user_agent', '9XtreamPlayer LibVLC/3.0.22-rc1',
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '2',
      '-analyzeduration', '100000',
      '-probesize', '150000'
    ];

    if (startTime && startTime > 0) {
      args.push('-ss', Math.floor(startTime).toString());
    }

    if (hostHeader) {
      args.push('-headers', `Host: ${hostHeader}\r\n`);
    }
    args.push('-i', inputUrl);
    args.push('-map', '0:v:0');
    if (audioStreamId !== undefined && audioStreamId !== null) {
      args.push('-map', `0:${audioStreamId}`);
    } else {
      args.push('-map', '0:a?');
    }

    if (transcodeMode === 'full') {
      args.push(
        '-vf', 'setpts=PTS-STARTPTS,format=yuv420p',
        '-c:v', 'libx264',
        // This stream is consumed only by the local player. Favor first-frame
        // latency and low CPU usage over compression efficiency.
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-crf', '23',
        '-g', '30',
        '-keyint_min', '30',
        '-sc_threshold', '0',
        '-threads', '0'
      );
    } else {
      // 'copy' mode (default)
      args.push(
        '-c:v', 'copy'
      );
    }

    args.push(
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-ac', '2',
      '-af', 'aresample=async=1000:first_pts=0:min_hard_comp=0.100000',
      '-avoid_negative_ts', 'make_zero',
      '-max_interleave_delta', '0',
      '-max_muxing_queue_size', '2048',
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-frag_duration', '200000',
      '-flush_packets', '1',
      '-muxdelay', '0',
      '-muxpreload', '0',
      'pipe:1'
    );

    ffmpegProcess = spawn(getFfmpegPath(), args, { stdio: ['pipe', 'pipe', 'pipe'] });

    ffmpegProcess.stdout.on('data', (chunk) => {
      if (headerSize < MAX_HEADER_SIZE) {
        const remaining = MAX_HEADER_SIZE - headerSize;
        const toCopy = chunk.length <= remaining ? chunk : chunk.slice(0, remaining);
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

    ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('FFmpeg:', msg);
    });

    ffmpegProcess.on('error', (err) => {
      console.error('FFmpeg spawn error:', err.message);
    });

    ffmpegProcess.on('close', (code, signal) => {
      console.log('FFmpeg exited with code:', code, 'signal:', signal);
      if (pendingRes && !pendingRes.destroyed) pendingRes.end();
    });
  });
});

ipcMain.handle('stop-ffmpeg-proxy', async () => {
  stopFfmpegProxy();
  return { success: true };
});

ipcMain.handle('probe-audio-codec', async (event, { url }) => {
  if (!getFfmpegPath()) {
    return { success: false, error: 'FFmpeg bulunamadı' };
  }
  if (!isAllowedMediaUrl(url)) {
    return { success: false, error: 'Geçersiz medya URL\'si.' };
  }

  const { inputUrl, hostHeader } = await prepareFfmpegInput(url);

  return new Promise((resolve) => {
    let resolved = false;
    const args = [
      '-analyzeduration', '1000000',
      '-probesize', '1000000'
    ];
    if (hostHeader) {
      args.push('-headers', `Host: ${hostHeader}\r\n`);
    }
    args.push('-i', inputUrl, '-hide_banner');

    const proc = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrOutput = '';

    proc.on('error', (err) => {
      console.error('Probe audio codec spawn error:', err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ success: false, error: err.message, codec: 'unknown' });
      }
    });

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { proc.kill('SIGKILL'); } catch {}
        
        // Parse whatever we collected so far before resolving timeout
        const match = stderrOutput.match(/Audio:\s+([a-zA-Z0-9_]+)/i);
        const durationMatch = stderrOutput.match(/Duration:\s*(\d+):(\d+):(\d+)/i);
        let durationSec = 0;
        if (durationMatch) {
          durationSec = parseInt(durationMatch[1], 10) * 3600 + 
                         parseInt(durationMatch[2], 10) * 60 + 
                         parseInt(durationMatch[3], 10);
        }

        if (match) {
          resolve({ 
            success: true, 
            codec: match[1].toLowerCase(), 
            duration: durationSec,
            audioStreams: getAudioStreamsInfo(stderrOutput) 
          });
        } else {
          resolve({ success: false, error: 'Probe timeout', codec: 'unknown' });
        }
      }
    }, 2500);

    proc.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });

    proc.stdout.on('data', () => {});

    proc.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        const match = stderrOutput.match(/Audio:\s+([a-zA-Z0-9_]+)/i);
        const durationMatch = stderrOutput.match(/Duration:\s*(\d+):(\d+):(\d+)/i);
        let durationSec = 0;
        if (durationMatch) {
          durationSec = parseInt(durationMatch[1], 10) * 3600 + 
                         parseInt(durationMatch[2], 10) * 60 + 
                         parseInt(durationMatch[3], 10);
        }

        if (match) {
          resolve({ 
            success: true, 
            codec: match[1].toLowerCase(), 
            duration: durationSec,
            audioStreams: getAudioStreamsInfo(stderrOutput) 
          });
        } else {
          resolve({ success: false, codec: 'unknown', error: 'No audio stream found' });
        }
      }
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ success: false, error: err.message, codec: 'unknown' });
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
    const lang = match[2] || '';
    const codec = match[3].toLowerCase();
    
    let name = '';
    const langLower = lang.toLowerCase();
    if (langLower === 'tur' || langLower === 'tr') name = 'Türkçe';
    else if (langLower === 'eng' || langLower === 'en') name = 'English';
    else if (langLower === 'fre' || langLower === 'fra' || langLower === 'fr') name = 'Fransızca';
    else if (langLower === 'ger' || langLower === 'deu' || langLower === 'de') name = 'Almanca';
    else if (langLower === 'spa' || langLower === 'es') name = 'İspanyolca';
    else if (langLower === 'ita' || langLower === 'it') name = 'İtalyanca';
    else if (langLower === 'rus' || langLower === 'ru') name = 'Rusça';
    else name = lang ? lang.toUpperCase() : `Ses Kanalı ${audioIdx + 1}`;

    streams.push({
      id: audioIdx,
      streamId: streamId,
      name: name,
      lang: lang,
      codec: codec
    });
    audioIdx++;
  }
  return streams;
}

ipcMain.handle('check-ffmpeg', async () => {
  const p = getFfmpegPath();
  return { available: !!p, path: p || null };
});

// --- AUTO-UPDATE INTEGRATION ---
// Auto-updates are configured through electron-updater and the package publish settings.
let autoUpdaterInstance = null;
function getAutoUpdater() {
  if (autoUpdaterInstance) return autoUpdaterInstance;

  const { autoUpdater } = require('electron-updater');
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('update-status', { status: 'checking', message: 'Güncellemeler denetleniyor...' });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('update-status', { 
      status: 'available', 
      version: info.version, 
      message: `Yeni sürüm bulundu (v${info.version}). Güncelleme indiriliyor...` 
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus('update-status', { status: 'not-available', message: 'Uygulama güncel.' });
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus('update-status', { status: 'error', message: `Güncelleme hatası: ${err.message}` });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdateStatus('update-progress', {
      percent: Math.round(progressObj.percent),
      speed: Math.round(progressObj.bytesPerSecond / 1024) + ' KB/s'
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('update-status', { 
      status: 'downloaded', 
      version: info.version, 
      message: `Sürüm v${info.version} hazır. Yüklemek için yeniden başlatın.` 
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

ipcMain.handle('check-for-updates', async () => {
  try {
    await getAutoUpdater().checkForUpdates();
    return { success: true };
  } catch (err) {
    console.error('Check for updates failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-update', async () => {
  try {
    getAutoUpdater().quitAndInstall();
    return { success: true };
  } catch (err) {
    console.error('Install update failed:', err);
    return { success: false, error: err.message };
  }
});

// Automatically check for updates on startup after 5 seconds
app.whenReady().then(() => {
  setTimeout(() => {
    getAutoUpdater().checkForUpdatesAndNotify().catch(err => {
      console.error('Failed to run startup update check:', err);
    });
  }, 5000);
});
