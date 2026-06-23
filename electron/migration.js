async function copyFileIfMissing(fs, path, src, dest, log, error) {
  try {
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
      log(`Migrated file from ${src} to ${dest}`);
    }
  } catch (err) {
    error(`Failed to migrate file from ${src}:`, err);
  }
}

async function copyPlaylistDirIfPresent(fs, path, srcDir, destDir, log, error) {
  try {
    if (!fs.existsSync(srcDir)) return;
    await fs.promises.mkdir(destDir, { recursive: true });
    const files = await fs.promises.readdir(srcDir);
    for (const file of files) {
      const src = path.join(srcDir, file);
      const dest = path.join(destDir, file);
      const stat = await fs.promises.stat(src);
      if (stat.isFile() && !fs.existsSync(dest)) {
        await fs.promises.copyFile(src, dest);
        log(`Migrated playlist from ${src} to ${dest}`);
      }
    }
  } catch (err) {
    error(`Failed to migrate playlists from ${srcDir}:`, err);
  }
}

async function migrateProfileData({
  fs,
  path,
  isPackaged,
  userDataDir,
  profilesDir,
  exeDir,
  log = () => {},
  error = () => {}
}) {
  await fs.promises.mkdir(profilesDir, { recursive: true });

  const targetConfig = path.join(profilesDir, 'iptv-player-config.json');
  const targetPlaylists = path.join(profilesDir, 'playlists');

  if (isPackaged && exeDir) {
    const oldProdProfilesDir = path.join(exeDir, 'profiles');
    if (oldProdProfilesDir !== profilesDir && fs.existsSync(oldProdProfilesDir)) {
      log(`Checking old installation profiles directory for migration: ${oldProdProfilesDir}`);
      await copyFileIfMissing(
        fs,
        path,
        path.join(oldProdProfilesDir, 'iptv-player-config.json'),
        targetConfig,
        log,
        error
      );
      await copyPlaylistDirIfPresent(
        fs,
        path,
        path.join(oldProdProfilesDir, 'playlists'),
        targetPlaylists,
        log,
        error
      );
    }
  }

  await copyFileIfMissing(
    fs,
    path,
    path.join(userDataDir, 'iptv-player-config.json'),
    targetConfig,
    log,
    error
  );
  await copyPlaylistDirIfPresent(
    fs,
    path,
    path.join(userDataDir, 'playlists'),
    targetPlaylists,
    log,
    error
  );
}

module.exports = {
  migrateProfileData
};
