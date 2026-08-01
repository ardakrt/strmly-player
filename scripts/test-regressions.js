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
  assert.match(playlistSource, /playlist\.contentRevision === parsedPlaylist\.revision/);
  assert.match(playlistSource, /startTransition\(\(\) => setItems\(parsedItems\)\)/);
  assert.match(playlistSource, /updateInFlightRef\.current\.has\(playlist\.id\)/);
  assert.match(playlistSource, /saved Xtream connection details could not be read/);
  assert.match(playlistSource, /recoverPlaylistCredentials/);
  assert.match(playlistSource, /encodeURIComponent\(playlist\.xtreamUser!\)/);
  assert.strictEqual((playlistSource.match(/scheduleAutoUpdate\(newList, newList\.id\)/g) || []).length, 2);
  const settingsContextSource = fs.readFileSync(path.join(root, 'src/hooks/useAppSettingsContextValue.ts'), 'utf8');
  assert.match(settingsContextSource, /return autoUpdatePlaylist\(playlist, activePlaylistId, true\)/);
  const playlistSettingsPanelSource = fs.readFileSync(path.join(root, 'src/components/SettingsPanel.tsx'), 'utf8');
  assert.match(playlistSettingsPanelSource, /Güncellemeyi kontrol et/);
  assert.match(playlistSettingsPanelSource, /refreshingPlaylistId === playlist\.id/);
  const appProviderSource = fs.readFileSync(path.join(root, 'src/hooks/useAppProvider.ts'), 'utf8');
  assert.match(appProviderSource, /if \(loaded && isSeriesReady && isHomeReady\)/);
  const appBootSource = fs.readFileSync(path.join(root, 'src/hooks/useAppBoot.ts'), 'utf8');
  assert.doesNotMatch(appBootSource, /api\.checkForUpdates\(/);
  assert.match(appBootSource, /splash\.preparingExperience[\s\S]*splash\.openingApp/);
  const electronMainSource = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
  const credentialRecovery = require(path.join(root, 'electron/playlist-credentials.js'));
  const recoveryConfig = {
    profile_active_cinema_playlists: [{
      id: 'target', name: 'Arda Xtream', playlistMode: 'xtream', channelCount: 1000, groupCount: 12,
    }],
    profile_legacy_cinema_playlists: [{
      id: 'legacy', name: 'Arda', playlistMode: 'xtream', channelCount: 990, groupCount: 12,
      xtreamUrl: 'https://provider.invalid', xtreamUser: 'user', xtreamPass: 'pass',
    }],
  };
  const recoveredPlaylist = credentialRecovery.recoverXtreamCredentials(recoveryConfig, 'active', 'target');
  assert.strictEqual(recoveredPlaylist.xtreamUser, 'user');
  assert.strictEqual(recoveryConfig.profile_active_cinema_playlists[0].xtreamPass, 'pass');
  assert.strictEqual(
    credentialRecovery.recoverXtreamCredentials({
      profile_active_cinema_playlists: [{ id: 'target', name: 'One', playlistMode: 'xtream' }],
      profile_old_cinema_playlists: [{ id: 'old', name: 'Two', playlistMode: 'xtream', xtreamUrl: 'u', xtreamUser: 'n', xtreamPass: 'p' }],
    }, 'active', 'target'),
    null,
  );
  assert.match(electronMainSource, /autoUpdater\.autoDownload = true/);
  assert.match(electronMainSource, /autoUpdater\.autoInstallOnAppQuit = true/);
  assert.strictEqual((electronMainSource.match(/scheduleStartupUpdateCheck\(\)/g) || []).length, 2);
  assert.match(electronMainSource, /installDownloadedUpdateAutomatically = true/);
  assert.match(electronMainSource, /quitAndInstall\(false, true\)/);
  assert.match(electronMainSource, /ipcMain\.handle\("get-update-state"/);
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
  const settingsPanelSource = fs.readFileSync(path.join(root, 'src/components/SettingsPanel.tsx'), 'utf8');
  assert.match(settingsPanelSource, /role="radiogroup"/);
  assert.match(settingsPanelSource, /role="radio"/);
  assert.match(settingsPanelSource, /aria-checked=\{selected\}/);
  assert.match(settingsPanelSource, /Yeni içerikler nasıl eklensin\?/);

  const splashSource = fs.readFileSync(path.join(root, 'src/components/SplashScreen.tsx'), 'utf8');
  const staticSplashSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const splashCssSource = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
  const mainSource = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
  const appGateSource = fs.readFileSync(path.join(root, 'src/components/AppGate.tsx'), 'utf8');
  for (const className of [
    'cinema-boot__identity',
    'cinema-boot__brand',
    'cinema-boot__mark',
    'cinema-boot__status',
    'cinema-boot__progress',
  ]) {
    assert.match(splashSource, new RegExp(className));
    assert.match(staticSplashSource, new RegExp(className));
  }
  assert.match(splashSource, /src="\.\/icon\.png"/);
  assert.match(staticSplashSource, /src="\.\/icon\.png"/);
  assert.match(staticSplashSource, /href="\.\/tokens\.css"/);
  assert.match(splashSource, /id="app-boot-splash"/);
  assert.match(staticSplashSource, /id="boot-splash"/);
  assert.doesNotMatch(mainSource, /import ['"]\.\.\/tokens\.css['"]/);
  assert.match(appGateSource, /activeProfileId !== null && !boot\.hasInitialBooted/);
  assert.doesNotMatch(appGateSource, /isParsing=\{isParsing \|\| \(activeProfileId !== null/);
  assert.match(splashSource, /\{splashStatus\}/);
  assert.match(splashSource, /aria-atomic="true"/);
  assert.match(splashSource, /cinema-boot__identity[\s\S]*cinema-boot__status[\s\S]*<\/main>/);
  assert.match(staticSplashSource, /cinema-boot__identity[\s\S]*cinema-boot__status[\s\S]*<\/main>/);
  assert.match(splashCssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.cinema-boot__progress/);
  assert.doesNotMatch(splashSource, /cinema-boot__(?:__)?(?:topbar|stage|catalog|mark-shell|product|aperture|emblem)/);
  assert.doesNotMatch(staticSplashSource, /cinema-boot__(?:__)?(?:topbar|stage|catalog|mark-shell|product|aperture|emblem)/);
  assert.doesNotMatch(splashSource, /animate-pulse-slow|transition-all|splash-progress/);
  assert.doesNotMatch(splashSource, /signal-room|masthead|corner|wordmark/);

  const detailModalSource = fs.readFileSync(path.join(root, 'src/hooks/useDetailModal.ts'), 'utf8');
  assert.doesNotMatch(detailModalSource, /getMockDetails|vote_average\s*\|\||['"]2026['"]/);
  assert.match(detailModalSource, /setTmdbData\(null\)/);
  const helpersSource = fs.readFileSync(path.join(root, 'src/utils/helpers.ts'), 'utf8');
  assert.doesNotMatch(helpersSource, /getMockDetails|Mock TMDB Data generator/);
  const channelModalSource = fs.readFileSync(path.join(root, 'src/components/ChannelModal.tsx'), 'utf8');
  assert.doesNotMatch(channelModalSource, /4K ULTRA HD|DOLBY ATMOS|matchScore/);
  const homeDataSource = fs.readFileSync(path.join(root, 'src/hooks/useHomeData.ts'), 'utf8');
  assert.doesNotMatch(homeDataSource, /getStableMatchPercentage/);
  assert.match(homeDataSource, /getLocalCalendarDaySeed\(\)/);
  assert.match(homeDataSource, /enrichFromTmdb/);
  assert.match(homeDataSource, /getTmdbShowcaseScore/);
  assert.match(homeDataSource, /setTop10Movies/);
  assert.match(homeDataSource, /setTop10Series/);
  assert.doesNotMatch(homeDataSource, /rating:\s*0\.1|source\.slice\(0,\s*SHOWCASE_COUNT\)/);
  const homeViewSource = fs.readFileSync(path.join(root, 'src/components/HomeView.tsx'), 'utf8');
  assert.match(homeViewSource, /Top 10 Filmler/);
  assert.match(homeViewSource, /Top 10 Diziler/);
  assert.match(homeViewSource, /top10-rank-overlay/);
  assert.match(homeViewSource, /top10-card--rank-one/);
  assert.match(homeViewSource, /top10-card--double/);
  assert.doesNotMatch(homeViewSource, /top10-rank-badge|padStart\(2/);
  assert.doesNotMatch(homeViewSource, /glass-top10-number/);
  const indexCssSource = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
  assert.match(indexCssSource, /family=Anton/);
  assert.match(indexCssSource, /--top10-rank-fill/);
  assert.match(indexCssSource, /paint-order:\s*stroke fill/);
  const heroLogoRule = indexCssSource.match(/\.home-hero-title-logo\s*\{([^}]+)\}/)?.[1] || '';
  assert.ok(heroLogoRule, 'hero title logo style must exist');
  assert.doesNotMatch(
    heroLogoRule,
    /grayscale\(|brightness\(|invert\(/,
    'official TMDB title art must keep its source colors',
  );
  assert.match(heroLogoRule, /filter:\s*none\s*!important/, 'hero title art must reject recoloring filters');
  assert.match(homeViewSource, /home-hero-title-logo-shell/, 'hero title logo must use a separate contrast wrapper');
  const heroLogoShellRule = indexCssSource.match(/\.home-hero-title-logo-shell\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(heroLogoShellRule, /drop-shadow\(/, 'hero title art wrapper keeps adaptive contrast');

  const tmdbSource = fs.readFileSync(path.join(root, 'src/utils/tmdb.ts'), 'utf8');
  const imageFallbackSource = fs.readFileSync(path.join(root, 'src/components/ImageWithFallback.tsx'), 'utf8');
  const tmdbCrawlerSource = fs.readFileSync(path.join(root, 'src/hooks/useTmdbCrawler.ts'), 'utf8');
  const tmdbWorkerSource = fs.readFileSync(path.join(root, 'src/utils/tmdbCrawler.worker.ts'), 'utf8');
  assert.match(tmdbSource, /export const getTmdbPosterCacheKey/);
  assert.match(
    tmdbSource,
    /window\.electronAPI\?\.fetchTmdbImage[\s\S]*Browser-only fallback/,
    'TMDB artwork must prefer the Electron image bridge before the direct CDN fallback',
  );
  assert.doesNotMatch(
    tmdbSource,
    /window\.location\.protocol\.startsWith\(['"]http['"]\)[\s\S]{0,300}return remoteUrl/,
    'Vite dev mode must not bypass the Electron TMDB image bridge',
  );
  assert.match(imageFallbackSource, /TMDB_TIMEOUT_MS = 3200/);
  assert.match(imageFallbackSource, /getTmdbPosterCacheKey\(itemType, playlistName, resolvedAspect\)/);
  assert.match(
    imageFallbackSource,
    /let lazyVisibilityObserver: IntersectionObserver \| null = null/,
    'poster cards must share one visibility observer',
  );
  assert.doesNotMatch(
    imageFallbackSource,
    /window\.setTimeout\(\(\) => setIsVisible\(true\), 500\)/,
    'offscreen cards must not bypass lazy visibility after 500ms',
  );
  assert.match(
    imageFallbackSource,
    /loading="lazy"/,
    'poster images must use native lazy loading',
  );
  assert.match(
    imageFallbackSource,
    /decoding="async"/,
    'poster image decoding must not block the current paint',
  );
  assert.match(
    imageFallbackSource,
    /Transparent live-channel PNGs must not reveal a duplicate title plate[\s\S]{0,100}\{usesTmdbCover && !imgLoaded && \(/,
    'live channel artwork must not render on top of a duplicate title plate',
  );
  assert.match(tmdbCrawlerSource, /getTmdbPosterCacheKey\(item\.itemType, item\.cleanTitle, 'portrait'\)/);
  assert.match(tmdbWorkerSource, /getTmdbPosterCacheKey\(item\.itemType, item\.cleanTitle, 'landscape'\)/);
  assert.match(
    tmdbSource,
    /cached && !String\(cached\)\.startsWith\('app-file:\/\/'\)/,
    'stale install-local logo paths must not be restored from IndexedDB',
  );

  console.log('regression tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
