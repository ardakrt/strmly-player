const fs = require("fs");
const path = require("path");
const { migrateProfileData } = require("./migration");
const { recoverXtreamCredentials } = require("./playlist-credentials");

function isSafeConfigKey(key) {
  return (
    typeof key === "string" &&
    !["__proto__", "prototype", "constructor"].includes(key) &&
    /^[a-zA-Z0-9_-]+$/.test(key) &&
    key.length <= 160
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

function createProfileStorage({ app, ipcMain }) {
  let configCache = null;
  let configLoadPromise = null;
  let configWriteQueue = Promise.resolve();
  let migrationPromise = Promise.resolve();

  const getProfilesDir = () => {
    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
    const profilesDir =
      process.env.STRMLY_PERF_BENCH === "1" || !isDev
        ? path.join(app.getPath("userData"), "profiles")
        : path.join(app.getAppPath(), "profiles");
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    return profilesDir;
  };

  const getConfigPath = () =>
    path.join(getProfilesDir(), "iptv-player-config.json");

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

  const migrateData = async () => {
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
  };

  const ensureConfigLoaded = async () => {
    if (configCache) return configCache;
    if (configLoadPromise) return configLoadPromise;

    configLoadPromise = (async () => {
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
            // The original file may not exist or may be unreadable.
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

  ipcMain.handle("save-config", async (_event, { key, value }) => {
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

  ipcMain.handle("load-config", async (_event, { key }) => {
    try {
      if (!isSafeConfigKey(key)) return null;
      const config = await ensureConfigLoaded();
      return config[key] !== undefined ? config[key] : null;
    } catch (err) {
      console.error("Config load error:", err);
      return null;
    }
  });

  ipcMain.handle(
    "recover-playlist-credentials",
    async (_event, { profileId, playlistId }) => {
      try {
        const safeProfileId = String(profileId || "");
        const safePlaylistId = String(playlistId || "");
        if (
          !/^[a-zA-Z0-9_-]+$/.test(safeProfileId) ||
          !/^[a-zA-Z0-9_-]+$/.test(safePlaylistId)
        ) {
          return { success: false, error: "Invalid profile or playlist id" };
        }

        const config = await ensureConfigLoaded();
        const playlist = recoverXtreamCredentials(
          config,
          safeProfileId,
          safePlaylistId,
        );
        if (!playlist) return { success: false };
        await queueConfigWrite();
        return { success: true, playlist };
      } catch (err) {
        console.error("Playlist credential recovery error:", err);
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle("delete-profile-data", async (_event, { profileId }) => {
    try {
      const safeProfileId = String(profileId || "");
      if (!/^[a-zA-Z0-9_-]+$/.test(safeProfileId)) {
        return { success: false, error: "Invalid profile id" };
      }
      const config = await ensureConfigLoaded();
      const prefix = `profile_${safeProfileId}_`;
      let deletedKeys = 0;
      for (const key of Object.keys(config)) {
        if (key.startsWith(prefix)) {
          delete config[key];
          deletedKeys += 1;
        }
      }
      if (deletedKeys > 0) await queueConfigWrite();
      return { success: true, deletedKeys };
    } catch (err) {
      console.error("Profile data delete error:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("save-playlist-items", async (_event, { id, items }) => {
    try {
      const filePath = getPlaylistItemsPath(id);
      await fs.promises.writeFile(filePath, JSON.stringify(items), "utf8");
      return { success: true };
    } catch (err) {
      console.error("Playlist items save error:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("load-playlist-items", async (_event, { id }) => {
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

  ipcMain.handle("delete-playlist-items", async (_event, { id }) => {
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

  const initialize = () => {
    migrationPromise = migrateData();
    return migrationPromise.then(() => ensureConfigLoaded());
  };

  const flushSync = () => {
    if (!configCache) return;
    try {
      fs.writeFileSync(
        getConfigPath(),
        JSON.stringify(configCache, null, 2),
        "utf8",
      );
    } catch (err) {
      console.error("Config save on exit error:", err);
    }
  };

  return {
    ensureConfigLoaded,
    flushSync,
    getConfigCache: () => configCache,
    getTmdbCacheDir,
    initialize,
    queueConfigWrite,
  };
}

module.exports = { createProfileStorage };
