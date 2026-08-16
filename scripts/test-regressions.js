const assert = require('assert');
const { EventEmitter } = require('events');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
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
  const sourceFiles = [];
  const collectSourceFiles = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectSourceFiles(fullPath);
      else if (/\.tsx?$/.test(entry.name)) sourceFiles.push(fullPath);
    }
  };
  collectSourceFiles(path.join(root, 'src'));

  const longInlineLocalization = [];
  for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const textValue = (node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
      if (!ts.isTemplateExpression(node)) return null;
      return node.head.text + node.templateSpans.map((span) => `{{value}}${span.literal.text}`).join('');
    };
    const visit = (node) => {
      if (
        ts.isConditionalExpression(node)
        && /language\s*===\s*['"]tr['"]/.test(node.condition.getText(sourceFile))
      ) {
        const trText = textValue(node.whenTrue);
        const enText = textValue(node.whenFalse);
        if (trText && enText && Math.max(trText.length, enText.length) >= 55) {
          const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          longInlineLocalization.push(`${path.relative(root, filePath)}:${location.line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  assert.deepStrictEqual(
    longInlineLocalization,
    [],
    `long bilingual copy must live in translations.ts: ${longInlineLocalization.join(', ')}`,
  );

  const { getTranslation } = bundle(path.join(root, 'src/utils/translations.ts'));
  assert.strictEqual(
    getTranslation('feedback.playlist.loaded', 'tr', { count: 42 }),
    '42 kanal yüklendi.',
  );
  assert.strictEqual(
    getTranslation('feedback.playlist.loaded', 'en', { count: 42 }),
    '42 channels loaded.',
  );
  const { getFriendlyToastMessage } = bundle(path.join(root, 'src/utils/toastHelpers.tsx'));
  assert.strictEqual(
    getFriendlyToastMessage('Hata: request failed with status 500', 'tr'),
    'İşlem tamamlanamadı. Tekrar deneyin.',
  );
  assert.strictEqual(
    getFriendlyToastMessage('Xtream connection failed: unauthorized', 'en'),
    "Xtream couldn't connect. Check the server address and sign-in details.",
  );
  assert.strictEqual(
    getFriendlyToastMessage('17 kanal yüklendi.', 'tr'),
    '17 kanal yüklendi.',
  );
  assert.strictEqual(
    getFriendlyToastMessage('Profil açılamadı. Tekrar deneyin.', 'tr'),
    'Profil açılamadı. Tekrar deneyin.',
  );

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

  const cinematicPlayerHelpers = bundle(
    path.join(root, 'src/hooks/cinematicPlayerHelpers.ts'),
  );
  assert.strictEqual(cinematicPlayerHelpers.formatPlayerTime(65), '01:05');
  assert.strictEqual(cinematicPlayerHelpers.formatPlayerTime(3661), '1:01:01');
  assert.strictEqual(cinematicPlayerHelpers.formatPlayerTime(Number.NaN), '00:00');
  assert.strictEqual(cinematicPlayerHelpers.isUnsupportedAudioCodec('E-AC-3'), true);
  assert.strictEqual(cinematicPlayerHelpers.isUnsupportedAudioCodec('aac'), false);
  assert.strictEqual(cinematicPlayerHelpers.isBrowserSafeAudioCodec('AAC'), true);
  assert.strictEqual(cinematicPlayerHelpers.isBrowserSafeAudioCodec('dts'), false);
  const cinematicPlayerHookSource = fs.readFileSync(
    path.join(root, 'src/hooks/useCinematicPlayer.ts'),
    'utf8',
  );
  const cinematicPlayerLineCount = cinematicPlayerHookSource.split(/\r?\n/).length;
  assert.ok(
    cinematicPlayerLineCount <= 500,
    `useCinematicPlayer.ts must remain at or below 500 lines; received ${cinematicPlayerLineCount}`,
  );
  assert.match(cinematicPlayerHookSource, /useCinematicPlayerControls/);
  assert.match(cinematicPlayerHookSource, /useCinematicPlayerSubtitles/);
  assert.match(cinematicPlayerHookSource, /useCinematicPlayerAudio/);
  assert.match(cinematicPlayerHookSource, /useCinematicPlayerSession/);

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

  const playlistSource = [
    'src/hooks/usePlaylists.ts',
    'src/hooks/playlists/playlistProfileLoader.ts',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  assert.match(playlistSource, /activePlaylistIdRef\.current === playlist\.id/);
  assert.match(playlistSource, /scheduleAutoUpdate\(playlist, currentActiveId, 5 \* 60 \* 1000\)/);
  assert.match(playlistSource, /playlist\.contentRevision === parsedPlaylist\.revision/);
  assert.match(playlistSource, /startTransition\(\(\) => setItems\(parsedItems\)\)/);
  assert.match(playlistSource, /updateInFlightRef\.current\.has\(playlist\.id\)/);
  assert.match(playlistSource, /feedback\.playlist\.credentialsMissing/);
  assert.match(playlistSource, /recoverPlaylistCredentials/);
  assert.match(playlistSource, /encodeURIComponent\(playlist\.xtreamUser!\)/);
  assert.strictEqual(
    (playlistSource.match(/activateImportedPlaylist\(newList, parsed\.items, true\)/g) || []).length,
    2,
  );
  assert.match(
    playlistSource,
    /activateImportedPlaylist\(newList, parsed\.items, false\)/,
  );
  assert.doesNotMatch(playlistSource, /showToast\([^)]*(?:Hata:|Error:)/s);
  assert.doesNotMatch(playlistSource, /An error occurred while loading the playlist/);
  const settingsContextSource = fs.readFileSync(path.join(root, 'src/hooks/useAppSettingsContextValue.ts'), 'utf8');
  assert.match(settingsContextSource, /return autoUpdatePlaylist\(playlist, activePlaylistId, true\)/);
  const playlistSettingsTabSource = fs.readFileSync(path.join(root, 'src/components/settings/SettingsPlaylistsTab.tsx'), 'utf8');
  assert.match(playlistSettingsTabSource, /Güncellemeyi kontrol et/);
  assert.match(playlistSettingsTabSource, /refreshingPlaylistId === playlist\.id/);
  const appProviderSource = [
    'src/hooks/useAppProvider.ts',
    'src/hooks/useAppProviderUiLifecycle.ts',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  assert.match(appProviderSource, /if \(loaded && isSeriesReady && isHomeReady\)/);
  const appBootSource = fs.readFileSync(path.join(root, 'src/hooks/useAppBoot.ts'), 'utf8');
  assert.doesNotMatch(appBootSource, /api\.checkForUpdates\(/);
  assert.match(appBootSource, /splash\.preparingExperience[\s\S]*splash\.openingApp/);
  const tmdbPreloadSource = fs.readFileSync(path.join(root, 'src/utils/tmdb.ts'), 'utf8');
  assert.match(tmdbPreloadSource, /poster manifest preload timed out; continuing boot/);
  assert.match(tmdbPreloadSource, /worker\.onmessageerror = \(\) => finish\(0\)/);
  assert.match(tmdbPreloadSource, /setTimeout\([\s\S]{0,250}finish\(0\)[\s\S]{0,80}3000\)/);
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
  const autoUpdateServiceSource = fs.readFileSync(path.join(root, 'electron/auto-update-service.js'), 'utf8');
  assert.match(autoUpdateServiceSource, /autoUpdater\.autoDownload = false/);
  assert.match(autoUpdateServiceSource, /autoUpdater\.autoInstallOnAppQuit = false/);
  assert.match(autoUpdateServiceSource, /autoUpdater\.disableWebInstaller = true/);
  assert.strictEqual(
    (electronMainSource.match(/scheduleStartupUpdateCheck\(\)/g) || []).length
      + (autoUpdateServiceSource.match(/scheduleStartupUpdateCheck\(\)/g) || []).length,
    2,
  );
  assert.match(autoUpdateServiceSource, /downloadAppUpdate\(\{ installWhenReady: true \}\)/);
  assert.match(autoUpdateServiceSource, /quitAndInstall\(true, true\)/);
  assert.match(autoUpdateServiceSource, /normalizeUpdateReleaseNotes\(info\?\.releaseNotes\)/);
  assert.match(autoUpdateServiceSource, /\.replace\(\/<\[\^>\]\+>\/g, ""\)/);
  assert.match(autoUpdateServiceSource, /ipcMain\.handle\("get-update-state"/);
  const preloadSource = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
  assert.match(preloadSource, /downloadUpdate: \(\) => ipcRenderer\.invoke\('download-update'\)/);
  const downloadsSource = [
    'src/hooks/useDownloads.ts',
    'src/hooks/downloads/downloadAddAction.ts',
    'src/hooks/downloads/downloadIpcListeners.ts',
    'src/hooks/downloads/downloadQueueActions.ts',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const downloadPersistenceSource = fs.readFileSync(
    path.join(root, 'src/hooks/downloads/downloadPersistence.ts'),
    'utf8',
  );
  const downloadDiskSyncSource = fs.readFileSync(
    path.join(root, 'src/hooks/downloads/downloadDiskSync.ts'),
    'utf8',
  );
  assert.match(downloadPersistenceSource, /localStorage\.removeItem\(LEGACY_LOCAL_STORAGE_KEY\)/);
  // Only brand-new downloads and completed files missing from disk may reset
  // to zero. Pause, retry and queue transitions must retain their checkpoint.
  assert.strictEqual(
    (downloadsSource.match(/progress:\s*0/g) || []).length
      + (downloadDiskSyncSource.match(/progress:\s*0/g) || []).length,
    2,
  );
  assert.match(
    downloadsSource,
    /if \(download\.status === "paused"\)\s*{\s*return download;/,
  );
  const hlsDownloadEngineSource = fs.readFileSync(
    path.join(root, 'electron/hls-download-engine.js'),
    'utf8',
  );
  assert.match(hlsDownloadEngineSource, /if \(completedCount > 0\) emitProgress\(\)/);
  assert.match(
    hlsDownloadEngineSource,
    /!\["FALLBACK_ENCRYPTED", "FALLBACK_NOT_HLS", "DISK_FULL"\]\.includes\(msg\)/,
  );
  const profilesSource = fs.readFileSync(path.join(root, 'src/hooks/useProfiles.ts'), 'utf8');
  assert.match(profilesSource, /electronAPI\.deleteProfileData\(profileId\)/);
  assert.doesNotMatch(profilesSource, /An error occurred while/);
  assert.doesNotMatch(profilesSource, /Profil verileri yüklenirken bir hata oluştu/);
  const settingsPanelSource = fs.readFileSync(path.join(root, 'src/components/SettingsPanel.tsx'), 'utf8');
  const settingsAboutTabSource = fs.readFileSync(path.join(root, 'src/components/settings/SettingsAboutTab.tsx'), 'utf8');
  const settingsPlaybackTabSource = fs.readFileSync(path.join(root, 'src/components/settings/SettingsPlaybackTab.tsx'), 'utf8');
  assert.match(settingsPlaybackTabSource, /role="radiogroup"/);
  assert.match(settingsPlaybackTabSource, /role="radio"/);
  assert.match(settingsPlaybackTabSource, /aria-checked=\{selected\}/);
  assert.match(settingsPlaybackTabSource, /Yeni içerikler nasıl eklensin\?/);
  assert.doesNotMatch(settingsPanelSource, /(?:Hata|Error): \$\{(?:res\?\.error|err\.message|error)\}/);
  assert.match(
    settingsAboutTabSource,
    /settings-brand-logo-shell[^\n]*bg-neutral-950/,
    'transparent Strmly logo must sit on a dark contrast surface',
  );
  assert.doesNotMatch(
    settingsAboutTabSource,
    /settings-brand-logo-shell[^\n]*bg-white(?:\s|\")/,
    'transparent white logo must not be placed on a white surface',
  );
  assert.doesNotMatch(
    settingsAboutTabSource,
    /settings-brand-logo-shell[^\n]*shadow-\[0_0_[^\]]*rgba\(255,255,255/,
    'Strmly logo shell must not render a white glow',
  );
  assert.match(settingsPanelSource, /getUpdateState\?\.\(\)\.then\(applyUpdateState\)/);
  assert.match(settingsAboutTabSource, /updateState\.status === ["']available["'][\s\S]{0,500}onClick=\{onInstallUpdate\}/);

  const updateToastSource = fs.readFileSync(path.join(root, 'src/components/UpdateToast.tsx'), 'utf8');
  assert.match(updateToastSource, /update-toast-glass/);
  assert.match(updateToastSource, /updateToast\.later/);
  assert.match(updateToastSource, /updateToast\.updateBtn/);

  const appShellSource = fs.readFileSync(path.join(root, 'src/components/AppShell.tsx'), 'utf8');
  assert.match(
    appShellSource,
    /loaded=\{[\s\S]{0,120}boot\.hasInitialBooted/,
    'navbar visibility must use the latched initial-boot state',
  );
  assert.doesNotMatch(
    appShellSource,
    /loaded=\{[\s\S]{0,120}boot\.isAppReady/,
    'transient catalog readiness must not unmount the navbar',
  );

  const translationsSource = fs.readFileSync(path.join(root, 'src/utils/translations.ts'), 'utf8');
  for (const staleCopy of [
    'Preparing your experience',
    'personalized experience',
    'explore the IPTV world',
    'Determine the video playback engine',
    'An error occurred while loading profile data',
  ]) {
    assert.ok(!translationsSource.includes(staleCopy), `stale abstract copy remains: ${staleCopy}`);
  }

  const cinematicPlayerSource = fs.readFileSync(path.join(root, 'src/components/CinematicPlayer.tsx'), 'utf8');
  const playerOverlayControlsSource = fs.readFileSync(path.join(root, 'src/components/player/PlayerOverlayControls.tsx'), 'utf8');
  assert.match(
    playerOverlayControlsSource,
    /nextEpisode[\s\S]*language === 'tr' \? 'Sonraki Bölüm' : 'Next Episode'/,
  );

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
  assert.doesNotMatch(homeDataSource, /isInitialArtworkReady/);
  assert.match(electronMainSource, /scheme: "tmdb-image"/);
  assert.match(electronMainSource, /protocol\.handle\("tmdb-image"/);
  assert.doesNotMatch(homeDataSource, /rating:\s*0\.1|source\.slice\(0,\s*SHOWCASE_COUNT\)/);
  const homeViewSource = fs.readFileSync(path.join(root, 'src/components/HomeView.tsx'), 'utf8');
  const homeVodCardsSource = fs.readFileSync(path.join(root, 'src/components/home/HomeVodCards.tsx'), 'utf8');
  const homeHeroSource = fs.readFileSync(path.join(root, 'src/components/home/HomeHero.tsx'), 'utf8');
  const homeContentRailsSource = fs.readFileSync(path.join(root, 'src/components/home/HomeContentRails.tsx'), 'utf8');
  assert.match(homeContentRailsSource, /Top 10 Filmler/);
  assert.match(homeContentRailsSource, /Top 10 Diziler/);
  assert.match(homeVodCardsSource, /top10-rank-overlay/);
  assert.match(homeVodCardsSource, /top10-card--rank-one/);
  assert.match(homeVodCardsSource, /top10-card--double/);
  assert.doesNotMatch(homeVodCardsSource, /top10-rank-badge|padStart\(2/);
  assert.doesNotMatch(homeVodCardsSource, /glass-top10-number/);
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
  assert.match(homeHeroSource, /home-hero-title-logo-shell/, 'hero title logo must use a separate contrast wrapper');
  const heroLogoShellRule = indexCssSource.match(/\.home-hero-title-logo-shell\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(heroLogoShellRule, /drop-shadow\(/, 'hero title art wrapper keeps adaptive contrast');

  const tmdbSource = fs.readFileSync(path.join(root, 'src/utils/tmdb.ts'), 'utf8');
  assert.match(
    tmdbSource,
    /if \(isValidTmdbKey\(bundledKey\)\) return bundledKey;\s*if \(isValidTmdbKey\(storedKey\)\) return storedKey;/,
    'validated release TMDB key must outrank stale install-local keys',
  );
  const ffmpegResolverSource = fs.readFileSync(path.join(root, 'electron/ffmpeg-resolver.js'), 'utf8');
  assert.match(ffmpegResolverSource, /if \(process\.platform !== "win32"\) candidates\.push\("ffmpeg"\)/);
  assert.ok(
    ffmpegResolverSource.indexOf('candidates.push("ffmpeg")')
      < ffmpegResolverSource.indexOf('require("ffmpeg-static")'),
    'Linux must try the system FFmpeg before the crash-prone static fallback',
  );
  const imageFallbackSource = fs.readFileSync(path.join(root, 'src/components/ImageWithFallback.tsx'), 'utf8');
  const tmdbCrawlerSource = fs.readFileSync(path.join(root, 'src/hooks/useTmdbCrawler.ts'), 'utf8');
  const tmdbWorkerSource = fs.readFileSync(path.join(root, 'src/utils/tmdbCrawler.worker.ts'), 'utf8');
  assert.match(tmdbSource, /export const getTmdbPosterCacheKey/);
  assert.match(tmdbSource, /tmdb-image:\/\//, 'Electron TMDB artwork must use the non-persistent streaming protocol');
  assert.doesNotMatch(
    tmdbSource,
    /window\.location\.protocol\.startsWith\(['"]http['"]\)[\s\S]{0,300}return remoteUrl/,
    'Vite dev mode must not bypass the Electron TMDB image bridge',
  );
  assert.match(imageFallbackSource, /TMDB_TIMEOUT_MS = 3200/);
  assert.match(imageFallbackSource, /getTmdbPosterCacheKey\(itemType, playlistName, resolvedAspect\)/);
  assert.match(
    imageFallbackSource,
    /itemType === 'series' \? null : getPlaylistTmdbImagePath\(src\)/,
    'series cards must not promote episode stills from playlist logos to series posters',
  );
  assert.match(
    imageFallbackSource,
    /setFailedImageSrc\(\(failed\) => failed === posterPath \? null : failed\)/,
    'a freshly resolved poster must be allowed to retry the same streamed URL',
  );
  assert.match(
    tmdbSource,
    /itemType === 'series' && aspect === 'portrait'[\s\S]{0,100}series-poster-v2/,
    'series poster cache must invalidate entries created from episode stills',
  );
  assert.match(
    homeVodCardsSource,
    /onError=\{\(\) => setFailedPosterSrc\(usablePosterSrc\)\}/,
    'home metadata posters must fall back to the retrying TMDB artwork component after a transient image failure',
  );
  assert.match(
    homeVodCardsSource,
    /Poster-first paint:[\s\S]{0,500}setMetadata\(quickMeta\)[\s\S]{0,500}fetchTmdbDetails/,
    'home posters must paint before slower detail metadata is requested',
  );
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
    /loading=\{usesTmdbCover \? 'eager' : 'lazy'\}/,
    'TMDB posters already gated by shared visibility must not enter a second lazy queue',
  );
  assert.match(
    imageFallbackSource,
    /decoding="async"/,
    'poster image decoding must not block the current paint',
  );
  assert.match(
    imageFallbackSource,
    /Placeholder crossfades out as the artwork fades in\.[\s\S]{0,80}\{usesTmdbCover && \(/,
    'live channel artwork must not render on top of a duplicate title plate',
  );
  assert.match(tmdbCrawlerSource, /getTmdbPosterCacheKey\(item\.itemType, item\.cleanTitle, 'portrait'\)/);
  assert.doesNotMatch(
    tmdbCrawlerSource,
    /getResolvedTmdbResult\([\s\S]{0,180}?\.catch\(\(\) => null\)/,
    'TMDB request failures must not be persisted as definitive no-match results',
  );
  assert.match(
    tmdbCrawlerSource,
    /Electron background catalogue warmer[\s\S]{0,5000}breadthFirstByGroup[\s\S]{0,2500}interleave\(movies, series\)[\s\S]{0,5000}image\.decode\(\)/,
    'Electron must warm movie and series artwork before those tabs are opened',
  );
  assert.match(tmdbWorkerSource, /getTmdbPosterCacheKey\(item\.itemType, item\.cleanTitle, 'landscape'\)/);
  assert.match(
    tmdbSource,
    /cached && !String\(cached\)\.startsWith\('app-file:\/\/'\)/,
    'stale install-local logo paths must not be restored from IndexedDB',
  );

  for (const [railPath, viewPath] of [
    ['src/components/movies/MovieRail.tsx', 'src/components/movies/MoviesView.tsx'],
    ['src/components/series/SeriesRail.tsx', 'src/components/series/SeriesView.tsx'],
  ]) {
    const railSource = fs.readFileSync(path.join(root, railPath), 'utf8');
    const viewSource = fs.readFileSync(path.join(root, viewPath), 'utf8');
    assert.match(railSource, /\{ root, rootMargin: '2400px 0px' \}/);
    assert.match(railSource, /root\?\.addEventListener\('scroll', reveal, \{ passive: true \}\)/);
    assert.doesNotMatch(railSource, /catalog-rail-content--entered/);
    assert.doesNotMatch(railSource, /railEntered/);
    assert.doesNotMatch(railSource, /series-card-enter/);
    assert.doesNotMatch(railSource, /animationDelay/);
    assert.doesNotMatch(railSource, /className="lazy-row-shell mb-6"/);
    assert.doesNotMatch(railSource, /if \(!initialVisible\) return;/);
    assert.match(viewSource, /scrollRootRef=\{scrollRef\}/);
    assert.match(
      viewSource,
      /rowEntries\.slice\(0, 2\)/,
      'inactive catalog views must keep hidden DOM prewarm bounded to two rows',
    );
    assert.match(
      viewSource,
      /\? 'flex' : 'hidden'/,
      'inactive catalog prewarm must stay visually and semantically hidden',
    );
  }

  assert.doesNotMatch(indexCssSource, /\.catalog-rail-content/);
  assert.doesNotMatch(indexCssSource, /seriesCardSlideUp/);

  assert.match(
    imageFallbackSource,
    /rootMargin: '600px 0px'/,
    'poster preloading must stay near the viewport so visible artwork is not starved',
  );
  assert.doesNotMatch(tmdbSource, /downloadTmdbImageToLocalCache/, 'TMDB artwork must not use a local download manager');
  assert.match(imageFallbackSource, /loading=\{usesTmdbCover \? 'eager' : 'lazy'\}/);
  assert.match(imageFallbackSource, /await image\.decode\(\)/);
  assert.doesNotMatch(imageFallbackSource, /duration-\[400ms\]/);
  assert.match(tmdbWorkerSource, /const BATCH_SIZE = 3/);
  assert.match(tmdbWorkerSource, /Promise\.all\(items\.slice\(i, i \+ BATCH_SIZE\)\.map\(crawlItem\)\)/);

  console.log('regression tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
