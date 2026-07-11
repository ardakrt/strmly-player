const path = require("path");
const nodeNet = require("net");

const SENSITIVE_QUERY_KEYS = new Set([
  "api_key",
  "apikey",
  "access_token",
  "auth",
  "key",
  "pass",
  "password",
  "token",
  "user",
  "username",
]);

function buildSecureHttpsOptions(hostname, resolvedAddress, requestPath, agent) {
  const options = {
    hostname,
    port: 443,
    path: requestPath,
    method: "GET",
    headers: {
      Host: hostname,
      "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
    },
    servername: hostname,
    rejectUnauthorized: true,
    agent,
  };

  if (resolvedAddress && resolvedAddress !== hostname) {
    const family = nodeNet.isIP(resolvedAddress);
    if (!family) throw new Error("Resolved host address is not a valid IP");
    options.lookup = (_lookupHostname, lookupOptions, callback) => {
      if (lookupOptions && lookupOptions.all) {
        callback(null, [{ address: resolvedAddress, family }]);
        return;
      }
      callback(null, resolvedAddress, family);
    };
  }

  return options;
}

function redactSensitiveUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl) return "";

  try {
    const parsed = new URL(rawUrl);
    if (parsed.username) parsed.username = "redacted";
    if (parsed.password) parsed.password = "redacted";

    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, "redacted");
      }
    }

    const pathParts = parsed.pathname.split("/");
    const mediaSegmentIndex = pathParts.findIndex((part) =>
      ["live", "movie", "series"].includes(part.toLowerCase()),
    );
    if (mediaSegmentIndex >= 0 && pathParts.length > mediaSegmentIndex + 2) {
      pathParts[mediaSegmentIndex + 1] = "redacted";
      pathParts[mediaSegmentIndex + 2] = "redacted";
      parsed.pathname = pathParts.join("/");
    }

    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

function redactSensitiveText(value) {
  return String(value || "").replace(
    /\b(?:https?|rtmp|rtsp):\/\/[^\s"'<>]+/gi,
    (url) => redactSensitiveUrl(url),
  );
}

function isSafeConfiguredDownloadFolder(folderPath) {
  if (typeof folderPath !== "string" || !path.isAbsolute(folderPath)) {
    return false;
  }
  const resolvedFolder = path.resolve(folderPath);
  return resolvedFolder !== path.parse(resolvedFolder).root;
}

function isSafeDownloadFolderSelection(folderPath, selectionToken, pendingSelection) {
  if (
    typeof folderPath !== "string" ||
    !path.isAbsolute(folderPath) ||
    typeof selectionToken !== "string" ||
    !selectionToken ||
    !pendingSelection ||
    selectionToken !== pendingSelection.token
  ) {
    return false;
  }

  const resolvedFolder = path.resolve(folderPath);
  const resolvedPending = path.resolve(pendingSelection.folderPath);
  return (
    resolvedFolder === resolvedPending &&
    isSafeConfiguredDownloadFolder(resolvedFolder)
  );
}

module.exports = {
  buildSecureHttpsOptions,
  isSafeConfiguredDownloadFolder,
  isSafeDownloadFolderSelection,
  redactSensitiveText,
  redactSensitiveUrl,
};
