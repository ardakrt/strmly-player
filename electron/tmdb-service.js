const fs = require("fs");
const path = require("path");
const { buildSecureHttpsOptions, redactSensitiveUrl } = require("./security");
// DNS over HTTPS (DoH) bypass resolver for TMDB API and image CDN
const resolvedHostIps = {};

async function resolveHostIp(hostname) {
  if (resolvedHostIps[hostname]) return resolvedHostIps[hostname];

  const providers = [
    `https://dns.google/resolve?name=${hostname}&type=A`,
    `https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`,
    `https://dns.quad9.net/dns-query?name=${hostname}&type=A`,
  ];

  const fetchWithTimeout = async (url, ms = 1500) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/dns-json" },
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      const ip = data.Answer?.find((ans) => ans.type === 1)?.data;
      if (ip) return ip;
      throw new Error("No A record found");
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  try {
    const ip = await Promise.any(
      providers.map((url) => fetchWithTimeout(url, 1500)),
    );
    resolvedHostIps[hostname] = ip;
    console.log(`Resolved ${hostname} to ${ip} via parallel DoH`);
    return ip;
  } catch (e) {
    console.warn(`Parallel DoH resolution failed for ${hostname}:`, e.message);
    return hostname;
  }
}

const https = require("https");
const apiAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  keepAliveMsecs: 60000,
});
const imageAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  keepAliveMsecs: 60000,
});

async function fetchHttpsFromHost(hostname, requestPath, asBuffer = false) {
  const ip = await resolveHostIp(hostname);

  return new Promise((resolve, reject) => {
    const options = buildSecureHttpsOptions(
      hostname,
      ip,
      requestPath,
      hostname === "image.tmdb.org" ? imageAgent : apiAgent,
    );

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Request failed with status ${res.statusCode}`));
          return;
        }

        if (asBuffer) {
          resolve({
            buffer: body,
            contentType: res.headers["content-type"] || "image/jpeg",
          });
          return;
        }

        try {
          resolve(JSON.parse(body.toString("utf8")));
        } catch (e) {
          reject(new Error("Failed to parse TMDB response"));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.end();
  });
}

async function fetchFromTmdb(apiPath) {
  return fetchHttpsFromHost("api.themoviedb.org", apiPath);
}

const tmdbMainRequests = new Map();
const tmdbMainQueue = [];
const MAX_TMDB_MAIN_REQUESTS = 8;
let activeTmdbMainRequests = 0;

function queueTmdbMainRequest(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeTmdbMainRequests += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeTmdbMainRequests -= 1;
          const next = tmdbMainQueue.shift();
          if (next) next();
        });
    };
    if (activeTmdbMainRequests < MAX_TMDB_MAIN_REQUESTS) run();
    else tmdbMainQueue.push(run);
  });
}

function registerTmdbHandlers({ ipcMain, getTmdbCacheDir, appFileUrlFromPath }) {
  ipcMain.handle("fetch-tmdb", async (event, { path: apiPath }) => {
    if (
      typeof apiPath !== "string" ||
      !apiPath.startsWith("/3/") ||
      apiPath.length > 1200
    ) {
      return { error: "Invalid TMDB path" };
    }

    // Helper function to query the request queue / cache map
    const executeFetch = async (pathToCheck) => {
      const existing = tmdbMainRequests.get(pathToCheck);
      if (existing) return existing;

      const request = queueTmdbMainRequest(() =>
        fetchFromTmdb(pathToCheck),
      ).finally(() => tmdbMainRequests.delete(pathToCheck));
      tmdbMainRequests.set(pathToCheck, request);
      return await request;
    };

    try {
      // 1. Try with the requested path (containing frontend/user's API key)
      const result = await executeFetch(apiPath);
      return result;
    } catch (err) {
      const safeUrl = redactSensitiveUrl(
        `https://api.themoviedb.org${apiPath}`,
      );
      console.error(`TMDB fetch error for URL ${safeUrl}:`, err.message);
      return { error: err.message };
    }
  });

  ipcMain.handle(
    "fetch-tmdb-image",
    async (event, { path: imagePath, size = "w500" }) => {
      try {
        const allowedSizes = new Set([
          "w92",
          "w154",
          "w185",
          "w300",
          "w342",
          "w500",
          "w780",
          "original",
        ]);
        if (
          !imagePath ||
          typeof imagePath !== "string" ||
          !imagePath.startsWith("/")
        ) {
          return { error: "Invalid TMDB image path" };
        }
        if (!allowedSizes.has(size)) {
          return { error: "Invalid TMDB image size" };
        }

        const cacheDir = path.join(getTmdbCacheDir(), size);
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }

        // Replace slashes to create a safe flat filename
        const safeFileName = imagePath.replace(/\//g, "_");
        const localFilePath = path.join(cacheDir, safeFileName);

        // If cached on disk, return the app-file:/// URL directly
        if (fs.existsSync(localFilePath)) {
          return { localUrl: appFileUrlFromPath(localFilePath) };
        }

        const data = await fetchHttpsFromHost(
          "image.tmdb.org",
          `/t/p/${size}${imagePath}`,
          true,
        );

        // Save to cache directory asynchronously
        await fs.promises.writeFile(localFilePath, data.buffer);

        return {
          localUrl: appFileUrlFromPath(localFilePath),
        };
      } catch (err) {
        console.error("TMDB image fetch error:", err);
        return { error: err.message };
      }
    },
  );
}

module.exports = { fetchHttpsFromHost, registerTmdbHandlers, resolveHostIp };
