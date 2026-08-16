const fs = require("fs");
const path = require("path");
const { spawnDetached } = require("./process-launcher");

function appFileOrFileUrlToPath(rawUrl) {
  try {
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
      } else if (/^\/[a-zA-Z]:[\\/]/.test(filePath)) {
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

function createMediaUrlService({ isInsideMediaLibrary }) {
  function resolveLocalMediaPath(rawUrl) {
    if (!isLocalMediaUrl(rawUrl)) return null;
    return (
      appFileOrFileUrlToPath(rawUrl) ||
      (/^[a-zA-Z]:[\\/]/.test(rawUrl) || rawUrl.startsWith("\\\\")
        ? path.normalize(rawUrl)
        : null)
    );
  }

  function isAllowedMediaUrl(rawUrl) {
    if (typeof rawUrl !== "string") return false;
    try {
      if (isLocalMediaUrl(rawUrl)) {
        const localPath = resolveLocalMediaPath(rawUrl);
        return !!(
          localPath &&
          fs.existsSync(localPath) &&
          isInsideMediaLibrary(localPath)
        );
      }
      const parsed = new URL(rawUrl);
      return ["http:", "https:", "rtmp:", "rtsp:"].includes(
        parsed.protocol,
      );
    } catch {
      return false;
    }
  }

  return {
    isAllowedMediaUrl,
    isLocalMediaUrl,
    resolveLocalMediaPath,
  };
}

function registerExternalPlayerHandler({
  ipcMain,
  shell,
  isAllowedMediaUrl,
  redactSensitiveUrl,
}) {
  ipcMain.handle("play-external", async (_event, { url, playerType }) => {
    console.log(
      `Attempting to play URL: ${redactSensitiveUrl(url)} using ${playerType}`,
    );

    if (!isAllowedMediaUrl(url)) {
      return { success: false, message: "Geçersiz medya URL'si." };
    }

    if (playerType === "vlc") {
      const paths = [
        "vlc",
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
        message:
          "VLC bulunamadı. Lütfen VLC Player'ın kurulu olduğundan emin olun.",
      };
    }

    if (playerType === "mpv") {
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
    }

    if (playerType === "browser") {
      try {
        const parsed = new URL(url);
        if (["http:", "https:"].includes(parsed.protocol)) {
          await shell.openExternal(url);
          return { success: true, message: "Tarayıcıda açıldı." };
        }
      } catch {}
      return { success: false, message: "Geçersiz veya desteklenmeyen bağlantı adresi." };
    }

    return { success: false, message: "Bilinmeyen oynatıcı türü." };
  });
}

module.exports = {
  appFileOrFileUrlToPath,
  createMediaUrlService,
  isLocalMediaUrl,
  registerExternalPlayerHandler,
};
