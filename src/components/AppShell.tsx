import { Navbar } from './Navbar';
import { MainViewRouter } from './MainViewRouter';
import { AppOverlays } from './AppOverlays';
import type { AppProviderValue } from '../hooks/useAppProvider';
import { APP_VIEWS, isLiveTvView } from '../navigation/views';

interface AppShellProps {
  app: AppProviderValue;
}

export function AppShell({ app }: AppShellProps) {
  const { profilesHook, playback, boot, ui, navigation, spotlight, catalog } = app;

  const {
    profileDropdownOpen, setProfileDropdownOpen,
    isCurrentProfileGradient,
    profiles,
    handleSelectProfile,
    handleLogoutProfile,
    currentProfile,
  } = profilesHook;

  const isHomeActive = navigation.selectedGroup === APP_VIEWS.home && !navigation.deferredSearchQuery.trim();
  // Series / Movies / Live: fill the shell under the floating navbar (no dead gap, no outer scroll).
  const isCatalogView =
    navigation.selectedGroup === APP_VIEWS.series ||
    navigation.selectedGroup === APP_VIEWS.movies ||
    navigation.selectedGroup === APP_VIEWS.downloads ||
    isLiveTvView(navigation.selectedGroup);

  return (
    <div
      className={`app-wrapper flex flex-col h-screen bg-[var(--bg-main)] text-white relative overflow-hidden select-none ${ui.activeTheme}`}
      style={{
        ...ui.getAccentStyles(),
        // Soft monochrome depth only — never poster-tinted chrome
        '--hero-ambient-color-1': 'rgba(255, 255, 255, 0.04)',
        '--hero-ambient-color-2': 'rgba(255, 255, 255, 0.022)',
        '--hero-ambient-bg': '#141416',
        '--hero-ambient-bg-solid': '#0a0a0c',
      } as React.CSSProperties}
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* Quiet depth blooms — fill the void without color noise */}
      <div className="pointer-events-none absolute top-[-18%] left-[8%] z-0 h-[520px] w-[520px] rounded-full bg-glow-one opacity-50" />
      <div className="pointer-events-none absolute bottom-[-22%] right-[-4%] z-0 h-[480px] w-[480px] rounded-full bg-glow-two opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[42%] bg-gradient-to-b from-white/[0.025] to-transparent" />

      <AppOverlays app={app} />

      <Navbar
        loaded={
          boot.isAppReady ||
          (typeof window !== 'undefined' &&
            (window as Window & { strmlyPerfBench?: boolean }).strmlyPerfBench === true)
        }
        scrolled={ui.scrolled}
        selectedGroup={navigation.selectedGroup}
        setSelectedGroup={navigation.setSelectedGroup}
        setSearchInput={navigation.setSearchInput}
        setSearchQuery={navigation.setSearchQuery}
        setShowSpotlight={spotlight.setShowSpotlight}
        setSpotlightScope={spotlight.setSpotlightScope}
        profileDropdownOpen={profileDropdownOpen}
        setProfileDropdownOpen={setProfileDropdownOpen}
        currentProfile={currentProfile}
        isCurrentProfileGradient={!!isCurrentProfileGradient}
        items={catalog.items}
        playlists={catalog.playlists}
        activePlaylistId={catalog.activePlaylistId}
        profiles={profiles}
        handleSelectProfile={handleSelectProfile}
        handleLogoutProfile={handleLogoutProfile}
        updateAvailable={boot.updateAvailable}
      />

      <div
        ref={playback.mainContentRef}
        className={
          isHomeActive
            ? 'flex-1 min-h-0 overflow-y-auto px-6 md:px-10 pb-10 pt-0 relative z-30 select-none hide-scrollbar'
            : isCatalogView
              ? // Follow the floating navbar height so a stale scrolled state cannot leave a dead strip above catalogs.
                `flex-1 min-h-0 overflow-hidden px-5 md:px-8 ${ui.scrolled ? 'pt-14' : 'pt-[4.125rem]'} pb-3 relative z-30 select-none flex flex-col`
              : 'flex-1 min-h-0 overflow-y-auto px-6 md:px-10 pb-10 pt-24 relative z-30 select-none hide-scrollbar'
        }
        onScroll={isCatalogView ? undefined : catalog.handleMainScroll}
      >
        <MainViewRouter app={app} />
      </div>
    </div>
  );
}
