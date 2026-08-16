const fs = require("fs");
const path = require("path");

function createMainLogger({ userDataPath }) {
  const logFile = path.join(userDataPath, "app.log");
  const previousLogFile = path.join(userDataPath, "app.previous.log");
  const maxLogBytes = 2 * 1024 * 1024;
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > maxLogBytes) {
      try { fs.rmSync(previousLogFile, { force: true }); } catch {}
      fs.renameSync(logFile, previousLogFile);
    }
    fs.appendFileSync(logFile, `\n--- Strmly session ${new Date().toISOString()} ---\n`, "utf8");
  } catch {}

  let logBuffer = [];
  let logFlushTimer = null;
  let logWriteQueue = Promise.resolve();

  const takeBatch = () => {
    if (logFlushTimer) {
      clearTimeout(logFlushTimer);
      logFlushTimer = null;
    }
    if (logBuffer.length === 0) return "";
    const batch = logBuffer.join("");
    logBuffer = [];
    return batch;
  };

  const flush = () => {
    const batch = takeBatch();
    if (!batch) return;
    logWriteQueue = logWriteQueue.catch(() => undefined).then(() => fs.promises.appendFile(logFile, batch, "utf8"));
  };

  const flushSync = () => {
    const batch = takeBatch();
    if (!batch) return;
    try { fs.appendFileSync(logFile, batch, "utf8"); } catch {}
  };

  const log = (...args) => {
    try {
      const message = args.map((arg) => arg instanceof Error ? (arg.stack || arg.message) : typeof arg === "object" ? JSON.stringify(arg) : arg)
        .join(" ")
        .replace(/(api_key=)[^&\s"]+/gi, "$1[redacted]")
        .replace(/("cinema_tmdb_key"\s*:\s*")[^"]+/gi, "$1[redacted]");
      logBuffer.push(`[${new Date().toISOString()}] ${message}\n`);
      if (!logFlushTimer) logFlushTimer = setTimeout(flush, 250);
    } catch {}
  };

  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args) => { original.log(...args); log("[INFO]", ...args); };
  console.warn = (...args) => { original.warn(...args); log("[WARN]", ...args); };
  console.error = (...args) => { original.error(...args); log("[ERROR]", ...args); };

  process.on("uncaughtException", (error) => { console.error("Uncaught Exception in Main Process:", error); flush(); });
  process.on("unhandledRejection", (reason, promise) => { console.error("Unhandled Rejection in Main Process at:", promise, "reason:", reason); flush(); });

  return { log, flush, flushSync };
}

module.exports = { createMainLogger };
