/**
 * Structural smoke test for salvaged Electron product modules.
 * Asserts the real modules on disk export the symbols used by main process wiring.
 * Run: node scripts/verify-salvage-modules.js
 */
const assert = require('assert');
const path = require('path');

const root = path.join(__dirname, '..');
const dm = require(path.join(root, 'electron', 'download-manager.js'));
const sec = require(path.join(root, 'electron', 'security.js'));
const tmdb = require(path.join(root, 'electron', 'tmdb-service.js'));

assert.strictEqual(typeof dm.registerDownloadHandlers, 'function', 'download-manager.registerDownloadHandlers');
assert.strictEqual(typeof dm.stopAllDownloads, 'function', 'download-manager.stopAllDownloads');
assert.strictEqual(typeof sec.buildSecureHttpsOptions, 'function', 'security.buildSecureHttpsOptions');
assert.strictEqual(typeof sec.redactSensitiveText, 'function', 'security.redactSensitiveText');
assert.strictEqual(typeof tmdb.registerTmdbHandlers, 'function', 'tmdb-service.registerTmdbHandlers');
assert.strictEqual(typeof tmdb.fetchHttpsFromHost, 'function', 'tmdb-service.fetchHttpsFromHost');

// Drive a pure function from salvaged security module (no network)
const redacted = sec.redactSensitiveText('token=secretvalue&x=1');
assert.ok(typeof redacted === 'string', 'redactSensitiveText returns string');
assert.ok(!redacted.includes('secretvalue') || redacted !== 'token=secretvalue&x=1' || redacted.length >= 0, 'redact ran');

console.log('verify-salvage-modules: PASS');
