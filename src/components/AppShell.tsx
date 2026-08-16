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

  const isSearchActive = spotlight.showSpotlight;
  const isHomeActive =
    !isSearchActive &&
    navigation.selectedGroup === APP_VIEWS.home &&
    !navigation.deferredSearchQuery.trim();
  // Series / Movies / Live: fill the shell under the floating navbar (no dead gap, no outer scroll).
  const isCatalogView =
    !isSearchActive && (
      navigation.selectedGroup === APP_VIEWS.series ||
      navigation.selectedGroup === APP_VIEWS.movies ||
      navigation.selectedGroup === APP_VIEWS.downloads ||
      isLiveTvView(navigation.selectedGroup)
    );
  const isFullBleedCatalogView =
    navigation.selectedGroup === APP_VIEWS.series ||
    navigation.selectedGroup === APP_VIEWS.movies ||
    isLiveTvView(navigation.selectedGroup);

  return (
    <div
      className={`app-wrapper flex flex-col h-screen bg-[var(--bg-main)] text-white relative overflow-hidden select-none ${ui.activeTheme}`}
      style={{
        ...ui.getAccentStyles(),
        '--hero-ambient-color-1': 'transparent',
        '--hero-ambient-color-2': 'transparent',
        '--hero-ambient-bg': 'var(--bg-surface)',
        '--hero-ambient-bg-solid': 'var(--bg-surface)',
      } as React.CSSProperties}
      onContextMenu={(event) => event.preventDefault()}
    >
      <AppOverlays app={app} />

      <Navbar
        loaded={
          boot.hasInitialBooted ||
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
        spotlightSearchInput={spotlight.spotlightSearchInput}
        setSpotlightSearchInput={spotlight.setSpotlightSearchInput}
        spotlightInputRef={spotlight.spotlightInputRef}
        showSpotlight={spotlight.showSpotlight}
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
          isSearchActive
            ? `flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 md:px-10 pb-10 pt-20 relative z-30 select-none hide-scrollbar`
            : isHomeActive
            ? 'flex-1 min-h-0 overflow-y-auto px-6 md:px-10 pb-10 pt-0 relative z-30 select-none hide-scrollbar transition-none'
            : isCatalogView
              ? // Follow the floating navbar height so a stale scrolled state cannot leave a dead strip above catalogs.
                // No padding transition: animating padding-top here makes the whole page slide up when switching
                // from a non-catalog page (pt-24) to the catalog shell (pt-[4.125rem]). The navbar animates itself.
                // Series, Movies and Live TV run full-bleed (pt-0) so content sits directly
                // behind the floating navbar — the navbar then frosts the panel + ambient
                // glow instead of flat black, and rails scroll edge-to-edge under it.
                `flex-1 min-h-0 overflow-hidden ${isFullBleedCatalogView ? 'px-0 pb-0 pt-0' : `${ui.scrolled ? 'pt-20' : 'pt-[5.125rem]'} px-5 md:px-8 pb-2`} relative z-30 select-none flex flex-col`
              : 'flex-1 min-h-0 overflow-y-auto px-6 md:px-10 pb-10 pt-24 relative z-30 select-none hide-scrollbar'
        }
        onScroll={isCatalogView || isSearchActive ? undefined : catalog.handleMainScroll}
      >
        {isCatalogView && (
          // Ambient surface layer: the navbar + catalog toolbar strip would
          // otherwise sit on flat black; a faint accent glow and top gradient
          // lift the whole area to match the app's glass aesthetic.
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 50% -20%, color-mix(in srgb, var(--accent-color, #ffffff) 11%, transparent), transparent 62%), linear-gradient(180deg, rgba(255,255,255,0.04), transparent 32%)',
            }}
            aria-hidden="true"
          />
        )}
        <MainViewRouter app={app} />
      </div>
    </div>
  );
}
