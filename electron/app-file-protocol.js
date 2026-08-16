const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function normalizeDriveLetter(filePath) {
  if (
    process.platform === "win32" &&
    filePath &&
    filePath.length >= 2 &&
    filePath[1] === ":"
  ) {
    return filePath[0].toUpperCase() + filePath.substring(1);
  }
  return filePath;
}

function appFileUrlFromPath(filePath) {
  return pathToFileURL(filePath).toString().replace(/^file:/i, "app-file:");
}

function registerAppFileScheme(protocol) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app-file",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

function parseAppFilePath(requestUrl) {
  const parsedUrl = new URL(requestUrl);
  let filePath = decodeURIComponent(parsedUrl.pathname || "");
  if (process.platform === "win32") {
    const host = String(parsedUrl.host || parsedUrl.hostname || "");
    if (/^[a-zA-Z]:?$/i.test(host)) {
      const drive = host.replace(":", "").toUpperCase() + ":";
      const rest = filePath.startsWith("/") ? filePath : `/${filePath}`;
      filePath = drive + rest;
    } else if (/^\/[a-zA-Z]:[\\/]/.test(filePath)) {
      filePath = filePath.substring(1);
    } else if (/^[a-zA-Z]\//.test(filePath)) {
      filePath = filePath[0] + ":" + filePath.substring(1);
    }
    filePath = filePath.replace(/\//g, path.sep);
  } else {
    filePath = filePath.replace(/^\/+/, "/");
  }
  return path.normalize(filePath);
}

async function fileExists(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function registerAppFileHandler({
  protocol,
  net,
  fetchHttpsFromHost,
  getTmdbCacheDir,
  isInsideMediaLibrary,
  offline = false,
}) {
  protocol.handle("app-file", async (request) => {
    try {
      let filePath = parseAppFilePath(request.url);
      const cacheDir = getTmdbCacheDir();
      const normalized = filePath.replace(/\\/g, "/");
      const marker = "/tmdb-cache/";
      const markerIndex = normalized.indexOf(marker);
      if (markerIndex !== -1) {
        filePath = path.normalize(
          path.join(cacheDir, normalized.slice(markerIndex + marker.length)),
        );
      }

      if (!offline && !(await fileExists(filePath))) {
        try {
          const relative = path.relative(cacheDir, filePath);
          const parts = relative.replace(/\\/g, "/").split("/");
          if (parts.length === 2) {
            const [size, filename] = parts;
            if (filename.startsWith("_") && filename.endsWith(".jpg")) {
              const tmdbImagePath =
                "/" + filename.slice(1).replace(/_/g, "/");
              console.log(
                `[App-File Handler] Auto-downloading missing TMDB image: ${size}${tmdbImagePath}`,
              );
              const data = await fetchHttpsFromHost(
                "image.tmdb.org",
                `/t/p/${size}${tmdbImagePath}`,
                true,
              );
              if (data?.buffer) {
                await fs.promises.mkdir(path.dirname(filePath), {
                  recursive: true,
                });
                await fs.promises.writeFile(filePath, data.buffer);
                console.log(
                  `[App-File Handler] Successfully auto-downloaded and cached: ${filePath}`,
                );
              }
            }
          }
        } catch (downloadErr) {
          console.error(
            "[App-File Handler] Failed to auto-download TMDB image:",
            downloadErr.message,
          );
        }
      }

      if (!(await fileExists(filePath))) {
        console.error(`[App-File Handler] File not found: ${filePath}`);
        return new Response("File not found", { status: 404 });
      }

      await fs.promises.mkdir(cacheDir, { recursive: true });
      const cacheRoot = normalizeDriveLetter(
        await fs.promises.realpath(cacheDir),
      );
      const realFilePath = normalizeDriveLetter(
        await fs.promises.realpath(filePath),
      );
      const relativePath = path.relative(cacheRoot, realFilePath);
      const isInsideTmdbCache =
        !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
      if (!isInsideTmdbCache && !isInsideMediaLibrary(realFilePath)) {
        console.error(
          `[App-File Handler] Blocked access outside allowed directories: ${realFilePath}`,
        );
        return new Response("Forbidden", { status: 403 });
      }

      const fileResponse = await net.fetch(pathToFileURL(realFilePath).toString(), {
        headers: request.headers,
      });
      if (!isInsideTmdbCache) return fileResponse;

      const responseHeaders = new Headers(fileResponse.headers);
      responseHeaders.set(
        "Cache-Control",
        "public, max-age=31536000, immutable",
      );
      return new Response(fileResponse.body, {
        status: fileResponse.status,
        statusText: fileResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      console.error("[App-File Handler] Error:", err.message);
      return new Response("Error loading file", { status: 500 });
    }
  });
}

module.exports = {
  appFileUrlFromPath,
  normalizeDriveLetter,
  parseAppFilePath,
  registerAppFileHandler,
  registerAppFileScheme,
};
