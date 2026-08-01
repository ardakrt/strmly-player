import { AppModals } from './AppModals';
import { DynamicIslandToast } from './DynamicIslandToast';
import type { AppProviderValue } from '../hooks/useAppProvider';

interface AppOverlaysProps {
  app: AppProviderValue;
}

export function AppOverlays({ app }: AppOverlaysProps) {
  const { ui, modals, catalog, playback, navigation } = app;

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
