const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrateProfileData } = require('../electron/migration');

async function writeJson(filePath, data) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(data), 'utf8');
}

async function readJson(filePath) {
  return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
}

async function run() {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'strmly-migration-'));
  const userDataDir = path.join(tmp, 'userData');
  const profilesDir = path.join(userDataDir, 'profiles');
  const exeDir = path.join(tmp, 'install');

  await writeJson(path.join(userDataDir, 'iptv-player-config.json'), { source: 'legacy-user-data' });
  await writeJson(path.join(userDataDir, 'playlists', 'playlist-a.json'), [{ id: 'a' }]);

  await migrateProfileData({
    fs,
    path,
    isPackaged: false,
    userDataDir,
    profilesDir
  });

  assert.deepStrictEqual(
    await readJson(path.join(profilesDir, 'iptv-player-config.json')),
    { source: 'legacy-user-data' }
  );
  assert.deepStrictEqual(
    await readJson(path.join(profilesDir, 'playlists', 'playlist-a.json')),
    [{ id: 'a' }]
  );

  await writeJson(path.join(profilesDir, 'iptv-player-config.json'), { source: 'existing-target' });
  await writeJson(path.join(exeDir, 'profiles', 'iptv-player-config.json'), { source: 'old-install' });
  await writeJson(path.join(exeDir, 'profiles', 'playlists', 'playlist-b.json'), [{ id: 'b' }]);

  await migrateProfileData({
    fs,
    path,
    isPackaged: true,
    userDataDir,
    profilesDir,
    exeDir
  });

  assert.deepStrictEqual(
    await readJson(path.join(profilesDir, 'iptv-player-config.json')),
    { source: 'existing-target' },
    'Migration must not overwrite existing target config'
  );
  assert.deepStrictEqual(
    await readJson(path.join(profilesDir, 'playlists', 'playlist-b.json')),
    [{ id: 'b' }]
  );

  await fs.promises.rm(tmp, { recursive: true, force: true });
}

run()
  .then(() => {
    console.log('migration tests passed');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
