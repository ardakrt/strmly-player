const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

function registerMediaProxyService({
  app,
  ipcMain,
  getFfmpegPath,
  isAllowedMediaUrl,
  isInsideMediaLibrary,
  isLocalMediaUrl,
  resolveLocalMediaPath,
  resolveHostIp,
  redactSensitiveText,
}) {
  let ffmpegProcess = null;
  let proxyServer = null;
  let proxyPort = 0;

// ── FFmpeg Audio Transcoding Proxy ──

async function prepareFfmpegInput(rawUrl) {
  try {
    // Local downloads (app-file:// / file:// / absolute path) → real filesystem path for FFmpeg.
    if (isLocalMediaUrl(rawUrl)) {
      const localPath = resolveLocalMediaPath(rawUrl);
      if (localPath && fs.existsSync(localPath) && isInsideMediaLibrary(localPath)) {
        return { inputUrl: localPath, hostHeader: null, isLocal: true };
      }
      return { inputUrl: rawUrl, hostHeader: null, isLocal: true };
    }

    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:") {
      return { inputUrl: rawUrl, hostHeader: null, isLocal: false };
    }

    const originalHostname = parsedUrl.hostname;
    const resolvedIp = await resolveHostIp(originalHostname);
    if (!resolvedIp || resolvedIp === originalHostname) {
      return { inputUrl: rawUrl, hostHeader: null, isLocal: false };
    }

    const hostHeader = parsedUrl.port
      ? `${originalHostname}:${parsedUrl.port}`
      : originalHostname;
    parsedUrl.hostname = resolvedIp;
    return { inputUrl: parsedUrl.toString(), hostHeader, isLocal: false };
  } catch {
    return { inputUrl: rawUrl, hostHeader: null, isLocal: false };
  }
}

function stopFfmpegProxy() {
  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill("SIGKILL");
    } catch {}
    ffmpegProcess = null;
  }
  if (proxyServer) {
    try {
      proxyServer.close();
    } catch {}
    proxyServer = null;
  }
  proxyPort = 0;
}

ipcMain.handle(
  "start-ffmpeg-proxy",
  async (
    event,
    {
      url,
      startTime,
      audioStreamId,
      transcodeMode = "full",
      contentType = "movie",
    },
  ) => {
    if (!getFfmpegPath()) {
      return { success: false, error: "FFmpeg bulunamadı." };
    }
    if (!isAllowedMediaUrl(url)) {
      return { success: false, error: "Geçersiz medya URL'si." };
    }

    stopFfmpegProxy();
    const {
      inputUrl,
      hostHeader,
      isLocal = false,
    } = await prepareFfmpegInput(url);
    const isLive = contentType === "live";
    const seekSeconds =
      startTime && Number.isFinite(Number(startTime)) && Number(startTime) > 0
        ? Math.floor(Number(startTime))
        : 0;
    // Mid-stream seeks already proved the source works — use a faster probe/encode path.
    const isSeekRestart = seekSeconds > 0;
    // Copy mode re-encodes audio only. Full mode re-encodes both for bad timestamps.
    // Local library files are already remuxed on download — never full re-encode (slow + wasteful).
    const mode = isLocal
      ? "copy"
      : transcodeMode === "copy"
        ? "copy"
        : "full";

    return new Promise((resolve) => {
      let resolved = false;
      let proxyReady = false;
      let ffmpegOutputReady = false;
      let startupTimer = null;
      let stderrTail = "";
      let pendingRes = null;
      let bufferChunks = [];
      let bufferBytes = 0;
      let headerChunks = [];
      let headerSize = 0;
      const MAX_HEADER_SIZE = 64 * 1024; // 64KB is plenty for empty moov MP4 headers
      const MAX_BUFFER_SIZE = 4 * 1024 * 1024;
      let isFirstRequest = true;

      // Return the local URL as soon as the proxy is listening so the player can
      // connect in parallel while FFmpeg seeks and produces the first fragment.
      // Waiting for the first stdout byte was adding ~1-3s of pure serial delay.
      const resolveProxyUrl = () => {
        if (proxyReady && !resolved) {
          resolved = true;
          resolve({
            success: true,
            port: proxyPort,
            url: `http://127.0.0.1:${proxyPort}/stream`,
          });
        }
      };

      const failBeforeReady = (message) => {
        if (!resolved) {
          resolved = true;
          if (startupTimer) clearTimeout(startupTimer);
          stopFfmpegProxy();
          resolve({ success: false, error: message });
          return;
        }
        // URL already handed to the player — close any waiting HTTP client.
        if (startupTimer) clearTimeout(startupTimer);
        if (pendingRes && !pendingRes.destroyed) {
          try {
            pendingRes.destroy();
          } catch {}
          pendingRes = null;
        }
        stopFfmpegProxy();
      };

      function startProxyServer() {
        proxyServer = http.createServer((req, res) => {
          console.log("[Proxy] Browser requested transcode stream");
          res.writeHead(200, {
            "Content-Type": "video/mp4",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            Connection: "keep-alive",
          });

          if (!isFirstRequest) {
            console.log("[Proxy] Reconnect detected, writing cached headers");
            for (const chunk of headerChunks) {
              res.write(chunk);
            }
          } else {
            isFirstRequest = false;
          }

          // Flush buffered chunks
          for (const chunk of bufferChunks) {
            res.write(chunk);
          }
          bufferChunks = [];
          bufferBytes = 0;
          pendingRes = res;

          req.on("close", () => {
            console.log("[Proxy] Browser closed request connection");
            if (pendingRes === res) {
              pendingRes = null;
            }
          });
        });

        proxyServer.listen(0, "127.0.0.1", () => {
          proxyPort = proxyServer.address().port;
          console.log(`[Proxy] Listening on port ${proxyPort}`);
          proxyReady = true;
          resolveProxyUrl();
        });

        proxyServer.on("error", (err) => {
          console.error("[Proxy] Server error:", err.message);
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: err.message });
          }
        });
      }

      // Start proxy server immediately so we can resolve the URL instantly
      startProxyServer();

      // VOD/series need larger probe windows and stable timestamps.
      // Live keeps low-latency flags. Seek restarts use a lighter profile so
      // jumping from e.g. 2:00 → 15:00 does not re-probe for several seconds.
      // IMPORTANT: -user_agent / -reconnect are HTTP demuxer options only.
      // Applying them to local files makes FFmpeg fail with "Option user_agent not found".
      const args = ["-hide_banner", "-loglevel", "warning"];

      if (!isLocal) {
        args.push(
          "-user_agent",
          "VLC/3.0.20 LibVLC/3.0.20",
          "-reconnect",
          "1",
          "-reconnect_at_eof",
          "1",
          "-reconnect_streamed",
          "1",
          "-reconnect_delay_max",
          isLive ? "2" : "5",
        );
      }

      if (isLive) {
        args.push(
          "-fflags",
          "+nobuffer+genpts+discardcorrupt+fastseek",
          "-flags",
          "+low_delay",
          "-analyzeduration",
          "500000",
          "-probesize",
          "500000",
        );
      } else if (isLocal) {
        // Local library file: small probe, no network reconnect flags.
        args.push(
          "-fflags",
          "+genpts+discardcorrupt",
          "-analyzeduration",
          isSeekRestart ? "500000" : "2000000",
          "-probesize",
          isSeekRestart ? "500000" : "2000000",
          "-thread_queue_size",
          "512",
        );
        if (isSeekRestart) {
          args.push("-noaccurate_seek");
        }
      } else if (isSeekRestart) {
        // Fast seek: keyframe-ish jump, small probe, low first-frame latency.
        args.push(
          "-fflags",
          "+genpts+discardcorrupt+igndts+fastseek",
          "-analyzeduration",
          "1000000",
          "-probesize",
          "1000000",
          "-thread_queue_size",
          "512",
          "-noaccurate_seek",
        );
      } else {
        args.push(
          // igndts helps broken IPTV VOD timestamps; genpts rebuilds a timeline.
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-analyzeduration",
          "10000000",
          "-probesize",
          "10000000",
          "-thread_queue_size",
          "1024",
        );
      }

      // Input-side seek is faster for long episodes. PTS is reset after decode.
      if (seekSeconds > 0) {
        args.push("-ss", String(seekSeconds));
      }

      if (hostHeader && !isLocal) {
        args.push("-headers", `Host: ${hostHeader}\r\n`);
      }
      args.push("-i", inputUrl);
      args.push("-map", "0:v:0?");

      const mappedAudioId = Number(audioStreamId);
      if (Number.isFinite(mappedAudioId) && mappedAudioId > 0) {
        args.push("-map", `0:${mappedAudioId}?`);
      } else {
        args.push("-map", "0:a:0?");
      }

      if (mode === "full") {
        // Seek restarts favor first-frame latency; cold start keeps slightly better quality.
        const preset = isLive || isSeekRestart ? "ultrafast" : "veryfast";
        const gop = isLive || isSeekRestart ? "30" : "48";
        args.push(
          "-vf",
          "setpts=PTS-STARTPTS,format=yuv420p",
          "-c:v",
          "libx264",
          "-preset",
          preset,
          "-tune",
          "zerolatency",
          "-profile:v",
          "baseline",
          "-level",
          "4.0",
          "-pix_fmt",
          "yuv420p",
          "-crf",
          isSeekRestart ? "26" : "23",
          "-g",
          gop,
          "-keyint_min",
          gop,
          "-sc_threshold",
          "0",
          "-bf",
          "0",
          "-fps_mode",
          "cfr",
          "-threads",
          "0",
        );
      } else {
        // Copy video, re-encode audio only (low CPU) — except pure local remux below.
        args.push("-c:v", "copy");
      }

      // Local library files are already remuxed for the browser (H.264 + AAC).
      // Re-encoding AAC→AAC with aresample/asetpts adds lip-sync lag that Windows
      // Media Player does not have. Pure stream copy preserves source timing.
      const pureLocalRemux = isLocal && mode === "copy";

      if (pureLocalRemux) {
        args.push("-c:a", "copy");
      } else {
        // AAC encoder priming delay (~20-50ms) lags audio when video is copied.
        // Compensate in copy mode. Avoid aggressive min_comp values that stretch
        // audio over time and sound like progressive delay on long episodes.
        const audioFilter =
          mode === "full"
            ? "asetpts=PTS-STARTPTS,aresample=async=1000:first_pts=0"
            : "aresample=async=1000:first_pts=0,asetpts=PTS-STARTPTS-0.048/TB";

        args.push(
          "-c:a",
          "aac",
          "-b:a",
          isSeekRestart ? "128k" : "160k",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-af",
          audioFilter,
        );
      }

      args.push(
        "-avoid_negative_ts",
        "make_zero",
        "-max_interleave_delta",
        "0",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-max_muxing_queue_size",
        "9999",
        "-f",
        "mp4",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        // Seek: smaller fragments → first playable chunk sooner.
        "-frag_duration",
        isLive || isSeekRestart ? "200000" : "500000",
        "-flush_packets",
        "1",
        "pipe:1",
      );

      console.log(
        `[Proxy] Starting FFmpeg mode=${mode} type=${contentType} seek=${seekSeconds}s fastSeek=${isSeekRestart}`,
      );
      console.log("[Proxy] FFmpeg args:", redactSensitiveText(args.join(" ")));

      ffmpegProcess = spawn(getFfmpegPath(), args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      ffmpegProcess.on("spawn", () => {
        console.log("FFmpeg spawned, waiting for output...");
      });

      // Seek restarts should fail fast if the source never answers.
      const startupMs = isLive ? 10000 : isSeekRestart ? 12000 : 20000;
      startupTimer = setTimeout(() => {
        failBeforeReady(
          `FFmpeg veri üretmedi. ${stderrTail || "Stream yanıt vermedi."}`,
        );
      }, startupMs);

      ffmpegProcess.stdout.on("data", (chunk) => {
        if (!ffmpegOutputReady) {
          ffmpegOutputReady = true;
          if (startupTimer) {
            clearTimeout(startupTimer);
            startupTimer = null;
          }
          console.log("[Proxy] First FFmpeg output received");
        }
        if (headerSize < MAX_HEADER_SIZE) {
          const remaining = MAX_HEADER_SIZE - headerSize;
          const toCopy =
            chunk.length <= remaining ? chunk : chunk.slice(0, remaining);
          headerChunks.push(toCopy);
          headerSize += toCopy.length;
        }

        if (pendingRes && !pendingRes.destroyed) {
          pendingRes.write(chunk);
        } else {
          bufferChunks.push(chunk);
          bufferBytes += chunk.length;
          while (bufferBytes > MAX_BUFFER_SIZE && bufferChunks.length > 0) {
            const dropped = bufferChunks.shift();
            bufferBytes -= dropped ? dropped.length : 0;
          }
        }
      });

      ffmpegProcess.stderr.on("data", (data) => {
        const msg = data.toString().trim();
        if (msg) {
          stderrTail = `${stderrTail}\n${msg}`.slice(-1200);
          console.log("FFmpeg:", redactSensitiveText(msg));
        }
      });

      ffmpegProcess.on("error", (err) => {
        console.error("FFmpeg spawn error:", err.message);
        failBeforeReady(`FFmpeg başlatılamadı: ${err.message}`);
      });

      ffmpegProcess.on("close", (code, signal) => {
        console.log("FFmpeg exited with code:", code, "signal:", signal);
        if (!resolved) {
          failBeforeReady(
            `FFmpeg erken kapandı (code: ${code ?? "null"}, signal: ${signal ?? "none"}). ${stderrTail || ""}`.trim(),
          );
          return;
        }
        if (startupTimer) clearTimeout(startupTimer);
        if (pendingRes && !pendingRes.destroyed) pendingRes.end();
      });
    });
  },
);

ipcMain.handle("stop-ffmpeg-proxy", async () => {
  stopFfmpegProxy();
  return { success: true };
});

ipcMain.handle("relaunch-app", async () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("get-app-version", async () => {
  return app.getVersion();
});

ipcMain.handle("probe-audio-codec", async (event, { url }) => {
  if (!getFfmpegPath()) {
    return { success: false, error: "FFmpeg bulunamadı" };
  }
  if (!isAllowedMediaUrl(url)) {
    return { success: false, error: "Geçersiz medya URL'si." };
  }

  const { inputUrl, hostHeader } = await prepareFfmpegInput(url);

  return new Promise((resolve) => {
    let resolved = false;
    // Larger probe helps IPTV VOD series report accurate audio/video codecs.
    const args = ["-analyzeduration", "5000000", "-probesize", "5000000"];
    if (hostHeader) {
      args.push("-headers", `Host: ${hostHeader}\r\n`);
    }
    args.push("-i", inputUrl, "-hide_banner");

    const proc = spawn(getFfmpegPath(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderrOutput = "";
    let earlyResolveTimer = null;

    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      if (earlyResolveTimer) clearTimeout(earlyResolveTimer);
      try {
        proc.kill("SIGKILL");
      } catch {}
      resolve(payload);
    };

    const timeoutId = setTimeout(() => {
      const parsed = parseFfmpegProbeOutput(stderrOutput);
      if (parsed.success) {
        finish(parsed);
      } else {
        finish({
          success: false,
          error: "Probe timeout",
          codec: "unknown",
          videoCodec: parsed.videoCodec,
        });
      }
    }, 9000);

    proc.on("error", (err) => {
      console.error("Probe audio codec spawn error:", err);
      finish({ success: false, error: err.message, codec: "unknown" });
    });

    proc.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString();

      // Resolve once we have Input + Audio, and preferably Video too.
      const hasInput = stderrOutput.includes("Input #0");
      const hasAudio = /Audio:\s+[a-zA-Z0-9_]+/i.test(stderrOutput);
      const hasVideo = /Video:\s+[a-zA-Z0-9_]+/i.test(stderrOutput);
      if (!resolved && hasInput && hasAudio) {
        if (earlyResolveTimer) clearTimeout(earlyResolveTimer);
        // Wait a bit longer if video line has not arrived yet.
        earlyResolveTimer = setTimeout(
          () => {
            const parsed = parseFfmpegProbeOutput(stderrOutput);
            if (parsed.success) finish(parsed);
          },
          hasVideo ? 120 : 350,
        );
      }
    });

    proc.stdout.on("data", () => {});

    proc.on("close", () => {
      if (resolved) return;
      const parsed = parseFfmpegProbeOutput(stderrOutput);
      if (parsed.success) {
        finish(parsed);
      } else {
        finish({
          success: false,
          codec: "unknown",
          videoCodec: parsed.videoCodec,
          error: "No audio stream found",
        });
      }
    });
  });
});

function getAllAudioCodecs(stderrText) {
  const codecs = [];
  const regex = /Audio:\s+([a-zA-Z0-9_-]+)/gi;
  let match;
  while ((match = regex.exec(stderrText)) !== null) {
    codecs.push(match[1].toLowerCase());
  }
  return codecs;
}

function getVideoCodecFromProbe(stderrText) {
  const match = stderrText.match(/Video:\s+([a-zA-Z0-9_-]+)/i);
  return match ? match[1].toLowerCase() : undefined;
}

function getDurationFromProbe(stderrText) {
  const durationMatch = stderrText.match(/Duration:\s*(\d+):(\d+):(\d+)/i);
  if (!durationMatch) return 0;
  return (
    parseInt(durationMatch[1], 10) * 3600 +
    parseInt(durationMatch[2], 10) * 60 +
    parseInt(durationMatch[3], 10)
  );
}

function parseFfmpegProbeOutput(stderrOutput) {
  const audioMatch = stderrOutput.match(/Audio:\s+([a-zA-Z0-9_-]+)/i);
  return {
    success: !!audioMatch || !!getVideoCodecFromProbe(stderrOutput),
    codec: audioMatch ? audioMatch[1].toLowerCase() : "unknown",
    videoCodec: getVideoCodecFromProbe(stderrOutput),
    duration: getDurationFromProbe(stderrOutput),
    audioStreams: getAudioStreamsInfo(stderrOutput),
    subtitleStreams: getSubtitleStreamsInfo(stderrOutput),
    allCodecs: getAllAudioCodecs(stderrOutput),
  };
}

function getAudioStreamsInfo(stderrText) {
  const streams = [];
  const regex = /Stream #0:(\d+)(?:\[[^\]]+\])?(?:\(([^)]+)\))?(?:\[[^\]]+\])?:\s*Audio:\s*([a-zA-Z0-9_-]+)/gi;
  let match;
  let audioIdx = 0;
  while ((match = regex.exec(stderrText)) !== null) {
    const streamId = parseInt(match[1], 10);
    const lang = match[2] || "";
    const codec = match[3].toLowerCase();

    let name = "";
    const langLower = lang.toLowerCase();
    if (langLower === "tur" || langLower === "tr") name = "Türkçe";
    else if (langLower === "eng" || langLower === "en") name = "English";
    else if (langLower === "fre" || langLower === "fra" || langLower === "fr")
      name = "Fransızca";
    else if (langLower === "ger" || langLower === "deu" || langLower === "de")
      name = "Almanca";
    else if (langLower === "spa" || langLower === "es") name = "İspanyolca";
    else if (langLower === "ita" || langLower === "it") name = "İtalyanca";
    else if (langLower === "rus" || langLower === "ru") name = "Rusça";
    else name = lang ? lang.toUpperCase() : `Ses Kanalı ${audioIdx + 1}`;

    streams.push({
      id: audioIdx,
      streamId: streamId,
      name: name,
      lang: lang,
      codec: codec,
    });
    audioIdx++;
  }
  return streams;
}

function getSubtitleStreamsInfo(stderrText) {
  const streams = [];
  const regex = /Stream #0:(\d+)(?:\[[^\]]+\])?(?:\(([^)]+)\))?(?:\[[^\]]+\])?:\s*Subtitle:\s*([a-zA-Z0-9_-]+)/gi;
  let match;
  let subIdx = 0;
  while ((match = regex.exec(stderrText)) !== null) {
    const streamId = parseInt(match[1], 10);
    const lang = match[2] || "";
    const codec = match[3].toLowerCase();

    let name = "";
    const langLower = lang.toLowerCase();
    if (langLower === "tur" || langLower === "tr") name = "Türkçe";
    else if (langLower === "eng" || langLower === "en") name = "English";
    else if (langLower === "fre" || langLower === "fra" || langLower === "fr") name = "Fransızca";
    else if (langLower === "ger" || langLower === "deu" || langLower === "de") name = "Almanca";
    else if (langLower === "spa" || langLower === "es") name = "İspanyolca";
    else if (langLower === "ita" || langLower === "it") name = "İtalyanca";
    else if (langLower === "rus" || langLower === "ru") name = "Rusça";
    else name = lang ? lang.toUpperCase() : `Altyazı ${subIdx + 1}`;

    streams.push({
      id: subIdx,
      streamId: streamId,
      name: name,
      lang: lang,
      codec: codec,
    });
    subIdx++;
  }
  return streams;
}

ipcMain.handle("check-ffmpeg", async () => {
  const p = getFfmpegPath();
  return { available: !!p, path: p || null };
});


  return { stopFfmpegProxy };
}

module.exports = { registerMediaProxyService };
