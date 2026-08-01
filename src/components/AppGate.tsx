import { lazy, Suspense, useLayoutEffect } from 'react';
import { SettingsProvider } from '../context/SettingsContext';
import { SplashScreen } from './SplashScreen';
import { AppShell } from './AppShell';
import { ProfileScreenWrapper } from './ProfileScreenWrapper';
import type { AppProviderValue } from '../hooks/useAppProvider';

const PlayerScreen = lazy(() => import('./PlayerScreen').then(m => ({ default: m.PlayerScreen })));

interface AppGateProps {
  app: AppProviderValue;
}

export function AppGate({ app }: AppGateProps) {
  useLayoutEffect(() => {
    document.getElementById('boot-splash')?.remove();
  }, []);

  const {
    profilesHook,
    playerState,
    playback,
    boot,
    ui,
    settingsContextValue,
    showToast,
    saveWatchProgress,
    isParsing,
    activeProfileId,
  } = app;

  const { selectedChannel } = playerState;

  if (selectedChannel) {
    return (
      <SettingsProvider value={settingsContextValue}>
        <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
          <PlayerScreen
            channel={selectedChannel}
            channels={app.catalog.items}
            onChannelChange={playback.handlePlayStream}
            accentStyles={ui.getAccentStyles()}
            saveWatchProgress={saveWatchProgress}
            showToast={showToast}
            onClose={playback.handlePlayerClose}
          />
        </Suspense>
      </SettingsProvider>
    );
  }

  const isPerfBench =
    typeof window !== 'undefined' &&
    (window as Window & { strmlyPerfBench?: boolean }).strmlyPerfBench === true;

  if (!boot.loaded && !isPerfBench) {
    return (
      <SplashScreen
        splashStatus={boot.splashStatus}
      />
    );
  }

  // Keep automatic startup on the single branded splash until the active
  // profile's catalog and home data have completed their first preparation.
  // The profile screen's loading overlay is reserved for an explicit profile
  // selection, otherwise startup visibly presents two consecutive loaders.
  if (!isPerfBench && activeProfileId !== null && !boot.hasInitialBooted) {
    return (
      <SplashScreen
        splashStatus={boot.splashStatus}
      />
    );
  }

  // Performance bench mode must reach the main shell (navbar) without a live
  // profile/playlist so scripts/test-performance.ps1 can measure real nav cost.
  if (!isPerfBench && activeProfileId === null) {
    return (
      <SettingsProvider value={settingsContextValue}>
        <ProfileScreenWrapper
          profilesHook={profilesHook}
          isParsing={isParsing}
          toast={ui.toast}
          activeTheme={ui.activeTheme}
          accentStyles={ui.getAccentStyles()}
        />
      </SettingsProvider>
    );
  }

  return (
    <SettingsProvider value={settingsContextValue}>
      <AppShell app={app} />
    </SettingsProvider>
  );
}
