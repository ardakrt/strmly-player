import { AppModals } from './AppModals';
import { DynamicIslandToast } from './DynamicIslandToast';
import { UpdateToast } from './UpdateToast';
import { SpotlightSearch } from './SpotlightSearch';
import type { AppProviderValue } from '../hooks/useAppProvider';

interface AppOverlaysProps {
  app: AppProviderValue;
}

export function AppOverlays({ app }: AppOverlaysProps) {
  const { ui, modals, catalog, playback, navigation, boot, appSettings, spotlight } = app;

  return (
    <>
      <DynamicIslandToast
        message={ui.dynamicIslandToast.toastMessage}
        visible={ui.dynamicIslandToast.toastVisible}
        exit={ui.dynamicIslandToast.toastExit}
        scrolled={ui.scrolled}
        onMouseEnter={ui.dynamicIslandToast.handleToastMouseEnter}
        onMouseLeave={ui.dynamicIslandToast.handleToastMouseLeave}
      />

      <UpdateToast
        visible={boot.updateToastVisible ?? false}
        version={boot.updateVersion ?? ''}
        releaseNotes={boot.updateReleaseNotes ?? ''}
        status={boot.updateStatus ?? 'idle'}
        progressPercent={boot.updateProgress ?? 0}
        downloadSpeed={boot.updateSpeed ?? ''}
        errorMessage={boot.updateError ?? ''}
        onInstall={boot.triggerInstallUpdate}
        onDismiss={boot.dismissUpdateToast}
        language={appSettings.language ?? 'tr'}
      />

      <SpotlightSearch
        showSpotlight={spotlight.showSpotlight}
        setShowSpotlight={spotlight.setShowSpotlight}
        spotlightScope={spotlight.spotlightScope}
        setSpotlightScope={spotlight.setSpotlightScope}
        spotlightSearchInput={spotlight.spotlightSearchInput}
        setSpotlightSearchInput={spotlight.setSpotlightSearchInput}
        spotlightSearchResults={spotlight.spotlightSearchResults}
        isSearchingWorker={spotlight.isSearchingWorker}
        handlePlayStream={playback.handlePlayStream}
        handleOpenDetails={catalog.handleOpenDetails}
        handleOpenSeriesModalDirect={catalog.handleOpenSeriesModalDirect}
      />

      <AppModals
        selectedChannelForModal={modals.selectedChannelForModal}
        setSelectedChannelForModal={modals.setSelectedChannelForModal}
        selectedSeriesForModal={modals.selectedSeriesForModal}
        setSelectedSeriesForModal={modals.setSelectedSeriesForModal}
        tmdbData={modals.tmdbData}
        tmdbShowId={modals.tmdbShowId}
        activeSeason={modals.activeSeason}
        expandedEpisodeId={modals.expandedEpisodeId}
        recentlyWatched={modals.recentlyWatched}
        handlePlayStream={playback.handlePlayStream}
        globalFavorites={catalog.globalFavorites}
        toggleFavorite={catalog.toggleFavorite}
        setActiveSeason={modals.setActiveSeason}
        setExpandedEpisodeId={modals.setExpandedEpisodeId}
        onNavigateToDownloads={() => {
          navigation.setSelectedGroup('İndirilenler');
          modals.setSelectedSeriesForModal(null);
        }}
      />
    </>
  );
}
