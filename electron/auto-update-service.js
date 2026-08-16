function registerAutoUpdateHandlers({ app, ipcMain, getMainWindow }) {
  // Auto-updates are configured through electron-updater and the package publish settings.
  let autoUpdaterInstance = null;
  let currentUpdateState = { status: "idle", message: "" };
  let installDownloadedUpdateAutomatically = false;
  let updateDownloadPromise = null;
  
  function normalizeUpdateReleaseNotes(value) {
    const raw = Array.isArray(value)
      ? value.map((entry) => typeof entry === "string" ? entry : entry?.note || "").join("\n")
      : typeof value === "string" ? value : "";
  
    return raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<li\b[^>]*>/gi, "• ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|li|ul|ol|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 2400);
  }
  
  function getAutoUpdater() {
    if (autoUpdaterInstance) return autoUpdaterInstance;
  
    const { autoUpdater } = require("electron-updater");
    autoUpdater.logger = console;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.autoRunAppAfterInstall = true;
    autoUpdater.disableWebInstaller = true;
  
    autoUpdater.on("checking-for-update", () => {
      sendUpdateStatus("update-status", {
        status: "checking",
        message: "Güncellemeler denetleniyor...",
      });
    });
  
    autoUpdater.on("update-available", (info) => {
      const releaseNotes = normalizeUpdateReleaseNotes(info?.releaseNotes);
      sendUpdateStatus("update-status", {
        status: "available",
        version: info.version,
        releaseNotes,
        message: `Yeni sürüm bulundu (v${info.version}).`,
      });
    });
  
    autoUpdater.on("update-not-available", () => {
      installDownloadedUpdateAutomatically = false;
      sendUpdateStatus("update-status", {
        status: "not-available",
        message: "Uygulama güncel.",
      });
    });
  
    autoUpdater.on("error", (err) => {
      installDownloadedUpdateAutomatically = false;
      updateDownloadPromise = null;
      console.error("Auto-updater error:", err);
      sendUpdateStatus("update-status", {
        status: "error",
        message: "Güncelleme tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.",
      });
    });
  
    autoUpdater.on("download-progress", (progressObj) => {
      sendUpdateStatus("update-progress", {
        percent: Math.round(progressObj.percent),
        speed: Math.round(progressObj.bytesPerSecond / 1024) + " KB/s",
      });
    });
  
    autoUpdater.on("update-downloaded", (info) => {
      updateDownloadPromise = null;
      const releaseNotes = normalizeUpdateReleaseNotes(info?.releaseNotes);
      sendUpdateStatus("update-status", {
        status: "downloaded",
        version: info.version,
        releaseNotes,
        message: installDownloadedUpdateAutomatically
          ? `Sürüm v${info.version} hazır. Uygulama güncelleniyor...`
          : `Sürüm v${info.version} hazır. Yüklemek için yeniden başlatın.`,
      });
      if (installDownloadedUpdateAutomatically) {
        installDownloadedUpdateAutomatically = false;
        setTimeout(() => getAutoUpdater().quitAndInstall(true, true), 1200);
      }
    });
  
    autoUpdaterInstance = autoUpdater;
    return autoUpdaterInstance;
  }
  
  function downloadAppUpdate({ installWhenReady = false } = {}) {
    if (installWhenReady) installDownloadedUpdateAutomatically = true;
    if (updateDownloadPromise) return updateDownloadPromise;
  
    sendUpdateStatus("update-status", {
      status: "downloading",
      message: "Güncelleme indiriliyor...",
    });
    updateDownloadPromise = getAutoUpdater().downloadUpdate().finally(() => {
      updateDownloadPromise = null;
    });
    return updateDownloadPromise;
  }
  
  function sendUpdateStatus(channel, data) {
    if (channel === "update-status") {
      currentUpdateState = { ...currentUpdateState, ...data };
    }
    const mainWindow = getMainWindow();
    if (mainWindow?.webContents) mainWindow.webContents.send(channel, data);
  }
  
  ipcMain.handle("check-for-updates", async () => {
    try {
      await getAutoUpdater().checkForUpdates();
      return { success: true };
    } catch (err) {
      console.error("Check for updates failed:", err);
      return { success: false, error: "Güncellemeler denetlenemedi." };
    }
  });
  
  ipcMain.handle("download-update", async () => {
    try {
      await downloadAppUpdate();
      return { success: true };
    } catch (err) {
      console.error("Download update failed:", err);
      return { success: false, error: "Güncelleme indirilemedi." };
    }
  });
  
  ipcMain.handle("install-update", async () => {
    try {
      if (currentUpdateState.status === "downloaded") {
        getAutoUpdater().quitAndInstall(true, true);
        return { success: true };
      }
  
      if (currentUpdateState.status === "available" || currentUpdateState.status === "downloading") {
        await downloadAppUpdate({ installWhenReady: true });
        return { success: true };
      }
  
      return { success: false, error: "Güncelleme yüklemeye hazır değil." };
    } catch (err) {
      installDownloadedUpdateAutomatically = false;
      console.error("Install update failed:", err);
      return { success: false, error: "Güncelleme kurulamadı. Lütfen yeniden deneyin." };
    }
  });
  
  let startupUpdateCheckTimer = null;
  function scheduleStartupUpdateCheck() {
    if (startupUpdateCheckTimer) clearTimeout(startupUpdateCheckTimer);
    startupUpdateCheckTimer = setTimeout(async () => {
      try {
        if (!app.isPackaged) return;
        await getAutoUpdater().checkForUpdates();
      } catch (e) {
        console.warn("Startup update check failed:", e);
      }
    }, 3000);
  }
  
  ipcMain.handle("get-update-state", async () => {
    return currentUpdateState;
  });
  
  
  
  return { scheduleStartupUpdateCheck };
}

module.exports = { registerAutoUpdateHandlers };

