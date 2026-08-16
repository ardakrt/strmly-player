const path = require("path");

function createWindowService({
  app,
  BrowserWindow,
  shell,
  logToFile,
  flushLogBuffer,
}) {
  let mainWindow = null;

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
        webSecurity: true,
        devTools: !app.isPackaged || process.env.STRMLY_OPEN_DEVTOOLS === "1",
        backgroundThrottling: !isPerformanceBenchmark,
      },
    });

    if (isPerformanceBenchmark) {
      mainWindow.webContents.session.webRequest.onBeforeRequest(
        { urls: ["http://*/*", "https://*/*"] },
        (_details, callback) => callback({ cancel: true }),
      );
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

    mainWindow.on("app-command", (_event, command) => {
      if (["browser-backward", "back", "app-command-back"].includes(command)) {
        mainWindow.webContents.send("navigate-back");
      } else if (
        ["browser-forward", "forward", "app-command-forward"].includes(command)
      ) {
        mainWindow.webContents.send("navigate-forward");
      }
    });

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
    mainWindow.setMenuBarVisibility(false);

    mainWindow.webContents.on("console-message", (event) => {
      const { level, message, lineNumber, sourceId } = event;
      logToFile(
        "[RENDERER]",
        `Level:${level} - ${message} (at ${sourceId}:${lineNumber})`,
      );
    });
    mainWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        console.error(
          `[RENDERER] Failed to load URL: ${validatedURL} - Error: ${errorDescription} (${errorCode})`,
        );
      },
    );
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url);
        if (["http:", "https:"].includes(parsed.protocol)) {
          shell.openExternal(url);
        }
      } catch (err) {
        console.error("[SECURITY] Blocked invalid window open URL:", err.message);
      }
      return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
      if (url !== mainWindow?.webContents.getURL()) {
        event.preventDefault();
        console.error(`[SECURITY] Blocked renderer navigation to: ${url}`);
      }
    });
    mainWindow.webContents.on("crashed", (_event, killed) => {
      console.error(`[RENDERER] Process crashed: killed=${killed}`);
      flushLogBuffer();
    });
    mainWindow.webContents.on("render-process-gone", (_event, details) => {
      console.error("[RENDERER] Process gone:", details);
      flushLogBuffer();
    });
    mainWindow.on("unresponsive", () => {
      console.error("[RENDERER] Window became unresponsive");
    });
    mainWindow.webContents.setUserAgent("VLC/3.0.20 LibVLC/3.0.20");

    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
    if (isPerformanceBenchmark) {
      mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    } else if (isDev) {
      mainWindow.loadURL(
        process.env.STRMLY_DEV_SERVER_URL || "http://localhost:5173",
      );
      if (process.env.STRMLY_OPEN_DEVTOOLS === "1") {
        mainWindow.webContents.openDevTools();
      }
    } else {
      mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
    return mainWindow;
  }

  return { createWindow, getMainWindow: () => mainWindow };
}

function registerRendererCors({ session, getMainWindow }) {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      const mainWindow = getMainWindow();
      if (!mainWindow || details.webContentsId !== mainWindow.webContents.id) {
        callback({});
        return;
      }

      const headers = { ...details.responseHeaders };
      const setHeader = (name, value) => {
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === name.toLowerCase()) delete headers[key];
        }
        headers[name] = [value];
      };
      setHeader("Access-Control-Allow-Origin", "*");
      setHeader("Access-Control-Allow-Headers", "*");
      setHeader("Access-Control-Allow-Methods", "*");
      callback({ responseHeaders: headers });
    },
  );
}

module.exports = { createWindowService, registerRendererCors };
