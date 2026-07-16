const assert = require('assert');
const { EventEmitter } = require('events');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnDetached } = require('../electron/process-launcher');

const root = path.join(__dirname, '..');

function bundle(entry) {
  const outfile = path.join(os.tmpdir(), `strmly-${path.basename(entry)}-${process.pid}.cjs`);
  execSync(
    `npx --yes esbuild "${entry}" --bundle --platform=node --format=cjs --outfile="${outfile}"`,
    { cwd: root, stdio: 'pipe' },
  );
  return require(outfile);
}

async function main() {
  const { getPlaybackSettings, AUTOPLAY_NEXT_KEY } = bundle(
    path.join(root, 'src/utils/playbackSettings.ts'),
  );
  const fakeStorage = (entries) => ({
    getItem: (key) => Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null,
  });
  assert.strictEqual(getPlaybackSettings(fakeStorage({})).autoPlayNext, true);
  assert.strictEqual(
    getPlaybackSettings(fakeStorage({ [AUTOPLAY_NEXT_KEY]: 'false' })).autoPlayNext,
    false,
  );
  const configured = getPlaybackSettings(fakeStorage({
    strmly_buffer_enabled: 'true',
    strmly_buffer_size: '75',
    strmly_connection_timeout: '14',
    strmly_retry_count: '6',
  }));
  assert.deepStrictEqual(
    {
      bufferEnabled: configured.bufferEnabled,
      bufferSeconds: configured.bufferSeconds,
      connectionTimeoutSeconds: configured.connectionTimeoutSeconds,
      retryCount: configured.retryCount,
    },
    { bufferEnabled: true, bufferSeconds: 75, connectionTimeoutSeconds: 14, retryCount: 6 },
  );

  const { prepareSettingsImport } = bundle(path.join(root, 'src/utils/settingsBackup.ts'));
  const restored = prepareSettingsImport({ theme: 'dark', favorites: '["a"]', enabled: 'true' });
  assert.deepStrictEqual(restored.localEntries, {
    theme: 'dark', favorites: '["a"]', enabled: 'true',
  });
  assert.deepStrictEqual(restored.diskEntries, {
    theme: 'dark', favorites: ['a'], enabled: true,
  });
  assert.throws(() => prepareSettingsImport([]), /Invalid settings backup/);
  assert.throws(() => prepareSettingsImport({ '../escape': 'x' }), /Invalid settings key/);
  assert.throws(() => prepareSettingsImport({ constructor: 'x' }), /Invalid settings key/);

  let unrefCalled = false;
  const successfulLaunch = spawnDetached('player', ['url'], () => {
    const child = new EventEmitter();
    child.unref = () => { unrefCalled = true; };
    queueMicrotask(() => child.emit('spawn'));
    return child;
  });
  assert.deepStrictEqual(await successfulLaunch, { success: true });
  assert.strictEqual(unrefCalled, true);

  const launchError = new Error('ENOENT');
  const failedLaunch = spawnDetached('missing', [], () => {
    const child = new EventEmitter();
    child.unref = () => {};
    queueMicrotask(() => child.emit('error', launchError));
    return child;
  });
  const failedResult = await failedLaunch;
  assert.strictEqual(failedResult.success, false);
  assert.strictEqual(failedResult.error, launchError);

  const playlistSource = fs.readFileSync(path.join(root, 'src/hooks/usePlaylists.ts'), 'utf8');
  assert.match(playlistSource, /activePlaylistIdRef\.current === playlist\.id/);
  assert.match(playlistSource, /scheduleAutoUpdate\(playlist, currentActiveId, 5 \* 60 \* 1000\)/);
  assert.strictEqual((playlistSource.match(/scheduleAutoUpdate\(newList, newList\.id\)/g) || []).length, 2);
  const downloadsSource = fs.readFileSync(path.join(root, 'src/hooks/useDownloads.ts'), 'utf8');
  assert.match(downloadsSource, /localStorage\.removeItem\(LEGACY_LOCAL_STORAGE_KEY\)/);
  // Only brand-new downloads and completed files missing from disk may reset
  // to zero. Pause, retry and queue transitions must retain their checkpoint.
  assert.strictEqual((downloadsSource.match(/progress:\s*0/g) || []).length, 2);
  assert.match(
    downloadsSource,
    /if \(download\.status === "paused"\)\s*{\s*return download;/,
  );
  const downloadManagerSource = fs.readFileSync(
    path.join(root, 'electron/download-manager.js'),
    'utf8',
  );
  assert.match(downloadManagerSource, /if \(completedCount > 0\) emitProgress\(\)/);
  assert.match(
    downloadManagerSource,
    /!\["FALLBACK_ENCRYPTED", "FALLBACK_NOT_HLS", "DISK_FULL"\]\.includes\(msg\)/,
  );
  const profilesSource = fs.readFileSync(path.join(root, 'src/hooks/useProfiles.ts'), 'utf8');
  assert.match(profilesSource, /electronAPI\.deleteProfileData\(profileId\)/);

  console.log('regression tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
