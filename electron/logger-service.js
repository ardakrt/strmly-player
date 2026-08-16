const fs = require("fs");
const path = require("path");

function installLogger({ app }) {
  const logFile = path.join(app.getPath("userData"), "app.log");
  const previousLogFile = path.join(app.getPath("userData"), "app.previous.log");
  const maxLogBytes = 2 * 1024 * 1024;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > maxLogBytes) {
      try {
        fs.rmSync(previousLogFile, { force: true });
      } catch (err) {
        originalWarn("[Logger] Could not remove previous log file:", err ? err.message : err);
      }
      fs.renameSync(logFile, previousLogFile);
    }
    fs.appendFileSync(
      logFile,
      `\n--- Strmly session ${new Date().toISOString()} ---\n`,
      "utf8",
    );
  } catch (err) {
    originalWarn("[Logger] Initial log setup failed:", err ? err.message : err);
  }

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
      .catch((err) => {
        originalWarn("[Logger] Async log file append failed:", err ? err.message : err);
      })
      .then(() => fs.promises.appendFile(logFile, batch, "utf8"));
  }

  function logToFile(...args) {
    try {
      const msg = args
        .map((arg) => {
          if (arg instanceof Error) return arg.stack || arg.message;
          return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
        })
        .join(" ")
        .replace(/(api_key=)[^&\s"]+/gi, "$1[redacted]")
        .replace(/("cinema_tmdb_key"\s*:\s*")[^"]+/gi, "$1[redacted]");
      logBuffer.push(`[${new Date().toISOString()}] ${msg}\n`);
      if (!logFlushTimer) logFlushTimer = setTimeout(flushLogBuffer, 250);
    } catch (err) {
      originalWarn("[Logger] Formatting log entry failed:", err ? err.message : err);
    }
  }

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
    originalError("Uncaught Exception in Main Process:", err);
    flushLogBuffer();
  });
  process.on("unhandledRejection", (reason, promise) => {
    originalError(
      "Unhandled Rejection in Main Process at:",
      promise,
      "reason:",
      reason,
    );
    flushLogBuffer();
  });

  function flushSync() {
    if (logBuffer.length === 0) return;
    try {
      fs.appendFileSync(logFile, logBuffer.join(""), "utf8");
      logBuffer = [];
    } catch (err) {
      originalWarn("[Logger] Synchronous log flush failed:", err ? err.message : err);
    }
  }

  return { flushLogBuffer, flushSync, logToFile };
}

module.exports = { installLogger };
