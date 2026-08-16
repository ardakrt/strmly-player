const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const {
  BROWSER_SAFE_AUDIO,
  BROWSER_UNSAFE_AUDIO,
  ffmpegInputArgs,
  probeStreamTracks,
  sanitizeDownloadUrl,
} = require("./download-media-utils");

function createFfmpegDownloadEngine({
  activeDownloads,
  appFileUrlFromPath,
  checkFreeSpace,
  cleanupPartialDownload,
  clearDownloadMarker,
  log,
  notifyDone,
  redactSensitiveText,
  redactSensitiveUrl,
  sendComplete,
  sendProgress,
}) {
async function runFfmpegDownload({
  downloadId,
  streamUrl,
  outputPath,
  name,
  ffmpegPath,
  options,
}) {
  const inputUrl = sanitizeDownloadUrl(streamUrl);
  if (inputUrl !== streamUrl) {
    log(
      "[DOWNLOAD] Stripped URL fragment for FFmpeg:",
      redactSensitiveUrl(streamUrl),
      "→",
      redactSensitiveUrl(inputUrl),
    );
  }

  let mapArgs = [];
  let selectedAudioCodec = "unknown";
  let selectedVideoCodec = "unknown";
  let mappedSubtitle = false;
  try {
    console.log("[DOWNLOAD] Probing stream tracks…", name);
    log("[DOWNLOAD] Probing stream tracks…", name);
    const tracks = await probeStreamTracks(inputUrl, ffmpegPath);
    log(`[DOWNLOAD] Probed tracks for ${name}: ${JSON.stringify(tracks)}`);
    console.log(
      "[DOWNLOAD] Probe done:",
      name,
      "tracks=",
      tracks.length,
    );
    const videoTrack = tracks.find((t) => t.type === "video");
    const audioTracks = tracks.filter((t) => t.type === "audio");
    const subtitleTracks = tracks.filter((t) => t.type === "subtitle");
    if (videoTrack) {
      mapArgs.push("-map", videoTrack.index);
      selectedVideoCodec = videoTrack.codec || "unknown";
    } else {
      mapArgs.push("-map", "0:v:0?");
    }

    if (audioTracks.length > 0) {
      const prefLang = options.language || "tr";
      const targetLangs = new Set(
        prefLang === "tr"
          ? ["tur", "tr", "turkish", "turkey"]
          : ["eng", "en", "english"]
      );
      let matchedAudio = audioTracks.find(
        (t) => t.lang && targetLangs.has(t.lang),
      );
      if (!matchedAudio) {
        const fallback = new Set(
          prefLang === "tr"
            ? ["eng", "en", "english"]
            : ["tur", "tr", "turkish", "turkey"]
        );
        matchedAudio = audioTracks.find(
          (t) => t.lang && fallback.has(t.lang),
        );
      }
      if (!matchedAudio) matchedAudio = audioTracks[0];
      if (matchedAudio) {
        mapArgs.push("-map", matchedAudio.index);
        selectedAudioCodec = matchedAudio.codec || "unknown";
      }
    } else {
      mapArgs.push("-map", "0:a:0?");
    }

    if (subtitleTracks.length > 0) {
      const prefLang = options.language || "tr";
      const targetLangs = new Set(
        prefLang === "tr"
          ? ["tur", "tr", "turkish", "turkey"]
          : ["eng", "en", "english"]
      );
      const codecExclusions = new Set(["hdmv_pgs_subtitle", "dvd_subtitle", "dvdsub", "pgssub"]);
      const matchedSub = subtitleTracks.find(
        (t) =>
          t.lang &&
          targetLangs.has(t.lang) &&
          !codecExclusions.has(t.codec || ""),
      );
      if (matchedSub) {
        mapArgs.push("-map", matchedSub.index);
        mappedSubtitle = true;
      }
    }
  } catch (err) {
    log("[DOWNLOAD] Probing failed, using default maps:", err.message);
    mapArgs = ["-map", "0:v:0?", "-map", "0:a:0?"];
  }

  const needsAudioTranscode =
    BROWSER_UNSAFE_AUDIO.has(selectedAudioCodec) ||
    (selectedAudioCodec !== "unknown" &&
      !BROWSER_SAFE_AUDIO.has(selectedAudioCodec));
  log(
    `[DOWNLOAD] Codecs video=${selectedVideoCodec} audio=${selectedAudioCodec} audioTranscode=${needsAudioTranscode}`,
  );

  return new Promise((resolve) => {
    // No +faststart here: it rewrites the whole file after copy and freezes UI at ~100%.
    // Copy remux is enough for offline play via app-file://.
    const args = [
      ...ffmpegInputArgs(inputUrl),
      ...mapArgs,
      "-c:v",
      "copy",
      ...(needsAudioTranscode
        ? ["-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000"]
        : ["-c:a", "copy"]),
      ...(mappedSubtitle ? ["-c:s", "mov_text"] : ["-sn"]),
      "-progress",
      "pipe:1",
      "-nostats",
      "-y",
      outputPath,
    ];
    log(
      "[DOWNLOAD] FFmpeg command:",
      ffmpegPath,
      redactSensitiveText(args.join(" ")),
    );
    console.log(
      "[DOWNLOAD] Starting FFmpeg remux for",
      name,
      "→",
      path.basename(outputPath),
    );

    let proc;
    try {
      proc = spawn(ffmpegPath, args, {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      try {
        os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {}
    } catch (err) {
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
    let lastProgress = -1;
    let stderrBuffer = "";
    let lastSizeProgressAt = 0;

    const emitFfmpegProgress = async (rawProgress, phase) => {
      // Cap at 99 until process exits successfully — avoids "100% forever" while still writing.
      const progress = Math.max(0, Math.min(99, Math.round(rawProgress)));
      if (progress === lastProgress && phase !== "size") return;
      lastProgress = progress;
      const download = activeDownloads.get(downloadId);
      const elapsed =
        (Date.now() - (download?.startTime || Date.now())) / 1000;
      const remaining =
        progress > 0 ? Math.round((elapsed / progress) * (100 - progress)) : 0;
      const timeLeft =
        remaining > 60
          ? `${Math.floor(remaining / 60)}m ${remaining % 60}s`
          : `${Math.max(0, remaining)}s`;
      try {
        const stats = fs.existsSync(outputPath)
          ? fs.statSync(outputPath)
          : { size: 0 };
        const now = Date.now();
        if (
          download &&
          (!download.lastSpaceCheck || now - download.lastSpaceCheck > 5000)
        ) {
          download.lastSpaceCheck = now;
          const space = await checkFreeSpace(outputPath);
          if (space < 30 * 1024 * 1024) {
            download.isDiskFull = true;
            try {
              proc.kill("SIGKILL");
            } catch {}
            return;
          }
        }
        let speed = "";
        if (download && (now - download.lastTime) / 1000 > 0.5) {
          const bytesPerSecond =
            (stats.size - download.lastBytes) /
            ((now - download.lastTime) / 1000);
          if (bytesPerSecond > 0) {
            speed = `${((bytesPerSecond * 8) / (1024 * 1024)).toFixed(1)} Mbps`;
          }
          download.lastBytes = stats.size;
          download.lastTime = now;
        }
        sendProgress({
          downloadId,
          progress,
          speed,
          timeLeft,
          size: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
          downloader: "ffmpeg",
          phase: phase || "download",
        });
      } catch {
        /* ignore stat races */
      }
    };

    // Heartbeat: when Duration is unknown, still show size growth so UI is not stuck.
    const sizeTicker = setInterval(() => {
      if (!activeDownloads.has(downloadId)) return;
      try {
        if (!fs.existsSync(outputPath)) return;
        const stats = fs.statSync(outputPath);
        if (stats.size <= 0) return;
        const now = Date.now();
        if (now - lastSizeProgressAt < 1500) return;
        lastSizeProgressAt = now;
        if (duration > 0) return;
        // Logarithmic-ish growth toward 95 without claiming completion
        const mb = stats.size / (1024 * 1024);
        const est = Math.min(95, Math.floor(10 + Math.log10(mb + 1) * 28));
        void emitFfmpegProgress(est, "size");
      } catch {
        /* ignore */
      }
    }, 2000);

    proc.stdout.on("data", (data) => {
      const lines = data.toString().split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith("out_time_ms=") || line.startsWith("out_time_us=")) {
          const raw = parseInt(line.split("=")[1], 10);
          // FFmpeg historically labels us as out_time_ms; out_time_us is microseconds too.
          const timeSec = Number.isFinite(raw) ? raw / 1e6 : 0;
          if (duration > 0 && timeSec > 0) {
            void emitFfmpegProgress((timeSec / duration) * 100, "time");
          }
        } else if (line.startsWith("out_time=") && duration > 0) {
          // out_time=HH:MM:SS.microseconds
          const m = line.match(/out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (m) {
            const timeSec =
              parseInt(m[1], 10) * 3600 +
              parseInt(m[2], 10) * 60 +
              parseFloat(m[3]);
            void emitFfmpegProgress((timeSec / duration) * 100, "time");
          }
        }
      }
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderrBuffer += text;
      if (stderrBuffer.length > 32000) {
        stderrBuffer = stderrBuffer.slice(-16000);
      }
      const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+)/);
      if (durationMatch) {
        duration =
          parseInt(durationMatch[1], 10) * 3600 +
          parseInt(durationMatch[2], 10) * 60 +
          parseInt(durationMatch[3], 10);
        log(`[DOWNLOAD] Stream duration for ${name}: ${duration}s`);
      }
    });

    proc.on("close", (code) => {
      clearInterval(sizeTicker);
      const wasDiskFull = activeDownloads.get(downloadId)?.isDiskFull;
      activeDownloads.delete(downloadId);
      if (wasDiskFull) {
        cleanupPartialDownload(outputPath);
        sendProgress({
          downloadId,
          progress: 0,
          speed: "0",
          timeLeft: "0",
          size: "0",
          error: "DISK_FULL",
          downloader: "ffmpeg",
        });
        return resolve({ success: false, error: "DISK_FULL" });
      }
      if (code === 0) {
        try {
          const stats = fs.statSync(outputPath);
          if (!stats || stats.size < 64 * 1024) {
            cleanupPartialDownload(outputPath);
            return resolve({
              success: false,
              error: "İndirilen dosya çok küçük veya bozuk.",
            });
          }
          clearDownloadMarker(outputPath);
          const playUrl = appFileUrlFromPath(outputPath);
          sendProgress({
            downloadId,
            progress: 100,
            speed: "",
            timeLeft: "0",
            size: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
            downloader: "ffmpeg",
          });
          sendComplete({ downloadId, filePath: outputPath, playUrl });
          notifyDone(name, options.language);
          console.log(
            "[DOWNLOAD] FFmpeg finished OK:",
            name,
            `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
          );
          return resolve({ success: true, filePath: outputPath, playUrl });
        } catch {
          cleanupPartialDownload(outputPath);
          return resolve({
            success: false,
            error: "Download completed but file not found",
          });
        }
      }
      cleanupPartialDownload(outputPath);
      const safeStderr = redactSensitiveText(stderrBuffer).slice(-400);
      console.error("[DOWNLOAD] FFmpeg failed:", code, safeStderr);
      log("[DOWNLOAD] FFmpeg failed:", code, safeStderr);
      resolve({
        success: false,
        error: `FFmpeg exited with code ${code}: ${safeStderr}`,
      });
    });

    proc.on("error", (err) => {
      clearInterval(sizeTicker);
      activeDownloads.delete(downloadId);
      cleanupPartialDownload(outputPath);
      resolve({ success: false, error: err.message });
    });
  });
}



  return { runFfmpegDownload };
}

module.exports = { createFfmpegDownloadEngine };
