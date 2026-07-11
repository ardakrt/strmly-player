import { lazy, Suspense } from 'react';
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

  if (!boot.hasInitialBooted && !isPerfBench) {
    return (
      <SplashScreen
        activeAccent={ui.activeAccent}
        splashStatus={boot.splashStatus}
      />
    );
  }

  // Performance bench mode must reach the main shell (navbar) without a live
  // profile/playlist so scripts/test-performance.ps1 can measure real nav cost.
  if (!isPerfBench && boot.loaded && (activeProfileId === null || !boot.isAppReady)) {
    return (
      <SettingsProvider value={settingsContextValue}>
        <ProfileScreenWrapper
          profilesHook={{
            ...profilesHook,
            profileEntryReady: profilesHook.profileEntryReady || (activeProfileId !== null && boot.isAppReady),
          }}
          isParsing={isParsing || (activeProfileId !== null && !boot.isAppReady)}
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
