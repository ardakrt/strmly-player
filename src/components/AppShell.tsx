import { Navbar } from './Navbar';
import { MainViewRouter } from './MainViewRouter';
import { AppOverlays } from './AppOverlays';
import type { AppProviderValue } from '../hooks/useAppProvider';

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

  return (
    <div
      className={`app-wrapper flex flex-col h-screen bg-[var(--bg-main)] text-white relative overflow-hidden select-none ${ui.activeTheme}`}
      style={ui.getAccentStyles()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="absolute top-[-15%] left-[10%] w-[800px] h-[800px] rounded-full bg-glow-one pointer-events-none z-0" />
      <div className="absolute bottom-[-15%] right-[5%] w-[700px] h-[700px] rounded-full bg-glow-two pointer-events-none z-0" />

      <AppOverlays app={app} />

      <Navbar
        loaded={boot.isAppReady}
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
        className="flex-1 overflow-y-auto px-6 md:px-10 pt-28 pb-10 relative z-30 select-none hide-scrollbar"
        onScroll={catalog.handleMainScroll}
      >
        <MainViewRouter app={app} />
      </div>
    </div>
  );
}
