const { spawn } = require("child_process");

const BROWSER_UNSAFE_AUDIO = new Set([
  "ac3",
  "eac3",
  "dts",
  "truehd",
  "mlp",
  "pcm_s16le",
  "pcm_bluray",
  "pcm_s24le",
  "flac",
]);
const BROWSER_SAFE_AUDIO = new Set(["aac", "mp3", "opus", "vorbis", "mp4a"]);

const FFMPEG_HTTP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const DEFAULT_DOWNLOAD_HEADERS = {
  "User-Agent": FFMPEG_HTTP_UA,
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
};

function sanitizeDownloadUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return value;
  try {
    const url = new URL(value);
    if (url.hash) url.hash = "";
    return url.toString();
  } catch {
    return value.replace(/#.*$/, "");
  }
}

function ffmpegInputArgs(streamUrl) {
  return [
    "-headers",
    `User-Agent: ${FFMPEG_HTTP_UA}\r\nAccept: */*\r\n`,
    "-user_agent",
    FFMPEG_HTTP_UA,
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "30",
    "-i",
    streamUrl,
  ];
}

async function probeStreamTracks(streamUrl, ffmpegPath) {
  return new Promise((resolve) => {
    const proc = spawn(
      ffmpegPath,
      ["-hide_banner", ...ffmpegInputArgs(streamUrl)],
      { windowsHide: true },
    );
    let stderr = "";
    let settled = false;
    const finish = (tracks) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(tracks);
    };
    const timeout = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      setTimeout(() => finish([]), 500);
    }, 8000);
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", () => {
      const tracks = [];
      const streamRegex =
        /Stream #0:(\d+)(?:\(([^)]+)\))?:\s*(Audio|Video|Subtitle):\s*([a-zA-Z0-9_]+)/gi;
      let match;
      while ((match = streamRegex.exec(stderr)) !== null) {
        tracks.push({
          index: `0:${match[1]}`,
          lang: match[2] ? match[2].toLowerCase() : null,
          type: match[3].toLowerCase(),
          codec: match[4] ? match[4].toLowerCase() : "unknown",
        });
      }
      finish(tracks);
    });
    proc.on("error", () => finish([]));
  });
}

function resolveAbsoluteUrl(maybeRelative, baseUrl) {
  if (!maybeRelative) return null;
  if (
    maybeRelative.startsWith("http://") ||
    maybeRelative.startsWith("https://")
  ) {
    return maybeRelative;
  }
  try {
    return new URL(maybeRelative, baseUrl).href;
  } catch {
    return null;
  }
}

function selectFromMasterPlaylist(text, baseUrl, maxHeight) {
  const lines = text.split(/\r?\n/);
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const next = lines[i + 1]?.trim();
    if (!next || next.startsWith("#")) continue;
    const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
    const height = resMatch ? parseInt(resMatch[2], 10) : 0;
    const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
    const url = resolveAbsoluteUrl(next, baseUrl);
    if (url) variants.push({ url, height, bandwidth });
  }
  if (variants.length === 0) return null;
  const eligible = variants.filter((variant) => !variant.height || variant.height <= maxHeight);
  const pool = eligible.length > 0 ? eligible : variants;
  pool.sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth);
  return pool[0];
}

function parseMediaPlaylistSegments(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  const segments = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF:")) continue;
    const nextLine = lines[i + 1]?.trim();
    if (nextLine && !nextLine.startsWith("#")) {
      const segmentUrl = resolveAbsoluteUrl(nextLine, baseUrl);
      if (segmentUrl) segments.push({ url: segmentUrl, index: segments.length });
    }
  }
  return segments;
}

module.exports = {
  BROWSER_SAFE_AUDIO,
  BROWSER_UNSAFE_AUDIO,
  DEFAULT_DOWNLOAD_HEADERS,
  ffmpegInputArgs,
  parseMediaPlaylistSegments,
  probeStreamTracks,
  sanitizeDownloadUrl,
  selectFromMasterPlaylist,
};
