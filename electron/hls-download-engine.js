const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const {
  DEFAULT_DOWNLOAD_HEADERS,
  parseMediaPlaylistSegments,
  selectFromMasterPlaylist,
} = require("./download-media-utils");

function createHlsDownloadEngine({
  activeSegmentDownloads,
  checkFreeSpace,
  getFfmpegPath,
  log,
  sendProgress,
  stableTempDir,
  writeDownloadMeta,
}) {
async function downloadHlsSegmented(
  downloadId,
  streamUrl,
  outputPath,
  name,
  options,
) {
  const tempDir = stableTempDir(outputPath, streamUrl);
  const abortController = new AbortController();
  const entry = {
    abortController,
    tempDir,
    outputPath,
    concatProc: null,
  };
  activeSegmentDownloads.set(downloadId, entry);

  try {
    let playlistUrl = streamUrl;
    let text = "";

    const firstRes = await fetch(playlistUrl, {
      headers: DEFAULT_DOWNLOAD_HEADERS,
      signal: abortController.signal,
    });
    if (!firstRes.ok) {
      throw new Error(`Failed to fetch stream: ${firstRes.statusText}`);
    }
    text = await firstRes.text();
    if (!text.includes("#EXTM3U")) throw new Error("FALLBACK_NOT_HLS");
    if (text.includes("#EXT-X-KEY") && text.includes("AES-128")) {
      throw new Error("FALLBACK_ENCRYPTED");
    }

    if (text.includes("#EXT-X-STREAM-INF")) {
      const picked = selectFromMasterPlaylist(
        text,
        playlistUrl,
        options.maxHeight,
      );
      if (!picked) throw new Error("No usable HLS variant in master playlist");
      playlistUrl = picked.url;
      log(
        `[HLS DOWNLOAD] Master → ${picked.height || "?"}p bw=${picked.bandwidth || "?"}`,
      );
      writeDownloadMeta(outputPath, {
        variantUrl: playlistUrl,
        variantHeight: picked.height || 0,
      });
      const mediaRes = await fetch(playlistUrl, {
        headers: DEFAULT_DOWNLOAD_HEADERS,
        signal: abortController.signal,
      });
      if (!mediaRes.ok) {
        throw new Error(
          `Failed to fetch media playlist: ${mediaRes.statusText}`,
        );
      }
      text = await mediaRes.text();
      if (text.includes("#EXT-X-KEY") && text.includes("AES-128")) {
        throw new Error("FALLBACK_ENCRYPTED");
      }
    }

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const segments = parseMediaPlaylistSegments(text, playlistUrl);
    if (segments.length === 0) {
      throw new Error("No segment files found in HLS playlist");
    }
    console.log(`[HLS DOWNLOAD] Found ${segments.length} segments for ${name}`);
    log(`[HLS DOWNLOAD] Found ${segments.length} segments for ${name}`);

    const pending = [];
    let completedCount = 0;
    let totalBytesDownloaded = 0;
    for (const segment of segments) {
      const partPath = path.join(tempDir, `part_${segment.index}.ts`);
      if (fs.existsSync(partPath)) {
        try {
          const st = fs.statSync(partPath);
          if (st.size > 0) {
            completedCount += 1;
            totalBytesDownloaded += st.size;
            continue;
          }
        } catch {}
      }
      pending.push(segment);
    }
    if (completedCount > 0) {
      console.log(
        `[HLS DOWNLOAD] Resuming: ${completedCount}/${segments.length} on disk`,
      );
      log(
        `[HLS DOWNLOAD] Resuming: ${completedCount}/${segments.length} on disk`,
      );
    }

    const MAX_CONCURRENT = options.maxConcurrent;
    let activeCount = 0;
    let nextIndex = 0;
    let lastProgressTime = Date.now();
    let speedBytes = 0;
    let currentSpeed = "0 Mbps";
    let failed = null;
    let lastSpaceCheck = 0;
    const downloadStartedAt = Date.now();

    const emitProgress = () => {
      const progress = Math.min(
        99,
        Math.round((completedCount / segments.length) * 100),
      );
      const sizeMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(1);
      const elapsedSec = Math.max(
        0.001,
        (Date.now() - downloadStartedAt) / 1000,
      );
      const rate = completedCount / elapsedSec;
      const remaining = segments.length - completedCount;
      const etaSec = rate > 0 ? Math.round(remaining / rate) : 0;
      const timeLeft =
        remaining === 0
          ? "0s"
          : etaSec > 60
            ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s`
            : `${etaSec}s`;
      sendProgress({
        downloadId,
        progress,
        speed: currentSpeed,
        timeLeft,
        size: `${sizeMB} MB`,
        downloader: "segmented",
      });
    };

    // Report the on-disk checkpoint before requesting another segment. This
    // prevents the renderer from flashing back to 0% while a paused download
    // is being resumed.
    if (completedCount > 0) emitProgress();

    if (pending.length > 0) {
      await new Promise((resolve, reject) => {
        const pump = () => {
          if (failed) {
            reject(failed);
            return;
          }
          if (abortController.signal.aborted) {
            reject(new Error("ABORTED"));
            return;
          }
          if (completedCount === segments.length) {
            resolve();
            return;
          }

          while (
            activeCount < MAX_CONCURRENT &&
            nextIndex < pending.length &&
            !failed
          ) {
            const segment = pending[nextIndex];
            nextIndex += 1;
            activeCount += 1;
            (async () => {
              const partPath = path.join(tempDir, `part_${segment.index}.ts`);
              let attempt = 0;
              const maxAttempts = 5;
              let success = false;
              while (
                attempt < maxAttempts &&
                !success &&
                !abortController.signal.aborted &&
                !failed
              ) {
                try {
                  attempt += 1;
                  if (options.segmentDelayMs > 0) {
                    await new Promise((r) =>
                      setTimeout(r, options.segmentDelayMs),
                    );
                  }
                  const segRes = await fetch(segment.url, {
                    headers: DEFAULT_DOWNLOAD_HEADERS,
                    signal: abortController.signal,
                  });
                  if (!segRes.ok) throw new Error(`Status ${segRes.status}`);
                  const buffer = await segRes.arrayBuffer();
                  await fs.promises.writeFile(partPath, Buffer.from(buffer));
                  totalBytesDownloaded += buffer.byteLength;
                  speedBytes += buffer.byteLength;
                  success = true;
                } catch (err) {
                  if (abortController.signal.aborted) break;
                  if (attempt >= maxAttempts) {
                    failed = new Error(
                      `Failed segment ${segment.index} after ${maxAttempts} attempts: ${err.message}`,
                    );
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 400 * attempt));
                }
              }
              activeCount -= 1;
              if (success) {
                completedCount += 1;
                const now = Date.now();
                if (now - lastSpaceCheck > 4000) {
                  lastSpaceCheck = now;
                  const space = await checkFreeSpace(outputPath);
                  if (space < 30 * 1024 * 1024) {
                    failed = new Error("DISK_FULL");
                  }
                }
                const timeDiff = now - lastProgressTime;
                if (timeDiff >= 800) {
                  const mbps =
                    (speedBytes * 8) / (1024 * 1024 * (timeDiff / 1000));
                  currentSpeed = `${mbps.toFixed(1)} Mbps`;
                  speedBytes = 0;
                  lastProgressTime = now;
                  emitProgress();
                }
              }
              pump();
            })();
          }
        };
        pump();
      });
    } else {
      emitProgress();
    }

    if (abortController.signal.aborted) throw new Error("ABORTED");

    const listPath = path.join(tempDir, "list.txt");
    const listLines = segments
      .map((s) => {
        const p = path
          .join(tempDir, `part_${s.index}.ts`)
          .replace(/\\/g, "/")
          .replace(/'/g, "'\\''");
        return `file '${p}'`;
      })
      .join("\n");
    await fs.promises.writeFile(listPath, listLines);

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
    log("[HLS CONCAT] Command: " + ffmpegPath + " " + args.join(" "));

    await new Promise((resolveConcat, rejectConcat) => {
      const proc = spawn(ffmpegPath, args, { windowsHide: true });
      entry.concatProc = proc;
      try {
        os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {}
      proc.on("close", (code) => {
        entry.concatProc = null;
        if (abortController.signal.aborted) {
          rejectConcat(new Error("ABORTED"));
        } else if (code === 0) {
          resolveConcat();
        } else {
          rejectConcat(new Error(`FFmpeg concat exited with code ${code}`));
        }
      });
      proc.on("error", (err) => {
        entry.concatProc = null;
        rejectConcat(err);
      });
    });

    const stats = fs.statSync(outputPath);
    if (!stats || stats.size < 64 * 1024) {
      throw new Error("Concat output too small");
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    activeSegmentDownloads.delete(downloadId);
    return { success: true, filePath: outputPath };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const keep =
      msg === "ABORTED" ||
      abortController.signal.aborted ||
      !["FALLBACK_ENCRYPTED", "FALLBACK_NOT_HLS", "DISK_FULL"].includes(msg);
    if (!keep) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
    activeSegmentDownloads.delete(downloadId);
    if (msg === "FALLBACK_ENCRYPTED" || msg === "FALLBACK_NOT_HLS") throw err;
    if (msg === "DISK_FULL") return { success: false, error: "DISK_FULL" };
    if (msg === "ABORTED" || abortController.signal.aborted) {
      return { success: false, error: "CANCELLED" };
    }
    throw err;
  }
}

  return { downloadHlsSegmented };
}

module.exports = { createHlsDownloadEngine };
