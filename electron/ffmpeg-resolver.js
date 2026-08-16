const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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

function createFfmpegResolver({ resourcesPath, appDir }) {
  let ffmpegPath;

  return function getFfmpegPath() {
    if (ffmpegPath !== undefined) return ffmpegPath;

    const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const candidates = [];
    if (process.env.STRMLY_FFMPEG_PATH) {
      candidates.push(path.resolve(process.env.STRMLY_FFMPEG_PATH));
    }
    // The ffmpeg-static Linux 7.0.2 binary can segfault on otherwise valid
    // IPTV HTTP inputs. Prefer the distribution build, which is maintained
    // against the host kernel/libraries, and retain the bundled binary only
    // as an offline fallback. Windows keeps the portable binary first.
    if (process.platform !== "win32") candidates.push("ffmpeg");
    try {
      candidates.push(normalizeFfmpegPath(require("ffmpeg-static")));
    } catch {}
    if (resourcesPath) {
      candidates.push(path.join(resourcesPath, "ffmpeg-static", executableName));
    }
    candidates.push(path.join(appDir, "node_modules", "ffmpeg-static", executableName));
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
  };
}

module.exports = {
  canRunFfmpeg,
  createFfmpegResolver,
  normalizeFfmpegPath,
};
