const assert = require("assert");
const path = require("path");
const {
  buildSecureHttpsOptions,
  isSafeConfiguredDownloadFolder,
  isSafeDownloadFolderSelection,
  redactSensitiveText,
  redactSensitiveUrl,
} = require("../electron/security");

const httpsOptions = buildSecureHttpsOptions(
  "api.themoviedb.org",
  "203.0.113.10",
  "/3/movie/1",
  undefined,
);
assert.strictEqual(httpsOptions.hostname, "api.themoviedb.org");
assert.strictEqual(httpsOptions.servername, "api.themoviedb.org");
assert.strictEqual(httpsOptions.rejectUnauthorized, true);
assert.strictEqual(typeof httpsOptions.lookup, "function");
httpsOptions.lookup("api.themoviedb.org", {}, (error, address, family) => {
  assert.ifError(error);
  assert.strictEqual(address, "203.0.113.10");
  assert.strictEqual(family, 4);
});
httpsOptions.lookup("api.themoviedb.org", { all: true }, (error, addresses) => {
  assert.ifError(error);
  assert.deepStrictEqual(addresses, [{ address: "203.0.113.10", family: 4 }]);
});

const selectedFolder = path.join(path.parse(process.cwd()).root, "Users", "viewer", "Videos", "Strmly");
const pendingSelection = { token: "selection-token", folderPath: selectedFolder };
assert.strictEqual(
  isSafeDownloadFolderSelection(selectedFolder, "selection-token", pendingSelection),
  true,
);
assert.strictEqual(
  isSafeDownloadFolderSelection(selectedFolder, "wrong-token", pendingSelection),
  false,
);
assert.strictEqual(
  isSafeDownloadFolderSelection(path.parse(selectedFolder).root, "selection-token", {
    token: "selection-token",
    folderPath: path.parse(selectedFolder).root,
  }),
  false,
);
assert.strictEqual(isSafeConfiguredDownloadFolder(selectedFolder), true);
assert.strictEqual(isSafeConfiguredDownloadFolder(path.parse(selectedFolder).root), false);

const redactedXtream = redactSensitiveUrl(
  "https://iptv.example/series/alice/secret/42.mkv?token=session-token",
);
assert(!redactedXtream.includes("alice"));
assert(!redactedXtream.includes("secret"));
assert(!redactedXtream.includes("session-token"));
assert(redactedXtream.includes("redacted"));

const redactedTmdb = redactSensitiveUrl(
  "https://api.themoviedb.org/3/search/movie?api_key=0123456789abcdef&query=test",
);
assert(!redactedTmdb.includes("0123456789abcdef"));
assert(redactedTmdb.includes("query=test"));

const redactedLog = redactSensitiveText(
  "ffmpeg failed for https://iptv.example/live/alice/secret/42.ts after timeout",
);
assert(!redactedLog.includes("alice"));
assert(!redactedLog.includes("secret"));
assert(redactedLog.includes("after timeout"));

console.log("security regression tests passed");
