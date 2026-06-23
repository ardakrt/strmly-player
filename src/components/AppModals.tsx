import React, { Suspense, lazy } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';

const ChannelModal = lazy(() => import('./ChannelModal').then(m => ({ default: m.ChannelModal })));
const SeriesModal = lazy(() => import('./SeriesModal').then(m => ({ default: m.SeriesModal })));

interface AppModalsProps {
  selectedChannelForModal: PlaylistItem | null;
  setSelectedChannelForModal: (channel: PlaylistItem | null) => void;
  selectedSeriesForModal: GroupedSeries | null;
  setSelectedSeriesForModal: (series: GroupedSeries | null) => void;
  tmdbData: any;
  tmdbShowId: number | null;
  activeSeason: number;
  expandedEpisodeId: string | null;
  recentlyWatched: any[];
  handlePlayStream: (item: PlaylistItem) => void;
  globalFavorites: string[];
  toggleFavorite: (id: string, e?: React.MouseEvent) => void;
  setActiveSeason: (season: number) => void;
  setExpandedEpisodeId: (id: string | null) => void;
}

export function AppModals({
  selectedChannelForModal,
  setSelectedChannelForModal,
  selectedSeriesForModal,
  setSelectedSeriesForModal,
  tmdbData,
  tmdbShowId,
  activeSeason,
  expandedEpisodeId,
  recentlyWatched,
  handlePlayStream,
  globalFavorites,
  toggleFavorite,
  setActiveSeason,
  setExpandedEpisodeId,
}: AppModalsProps) {
  return (
    <>
      {selectedChannelForModal && (
        <Suspense fallback={null}>
          <ChannelModal
            channel={selectedChannelForModal}
            tmdbData={tmdbData}
            onClose={() => setSelectedChannelForModal(null)}
            onPlay={handlePlayStream}
            isFavorite={globalFavorites.includes(selectedChannelForModal.id)}
            onToggleFavorite={(e) => toggleFavorite(selectedChannelForModal.id, e)}
          />
        </Suspense>
      )}

      {selectedSeriesForModal && (
        <Suspense fallback={null}>
          <SeriesModal
            series={selectedSeriesForModal}
            tmdbData={tmdbData}
            tmdbShowId={tmdbShowId}
            activeSeason={activeSeason}
            expandedEpisodeId={expandedEpisodeId}
            recentlyWatched={recentlyWatched}
            onClose={() => setSelectedSeriesForModal(null)}
            onPlay={handlePlayStream}
            onSetActiveSeason={setActiveSeason}
            onSetExpandedEpisodeId={setExpandedEpisodeId}
            isFavorite={globalFavorites.includes(selectedSeriesForModal.id)}
            onToggleFavorite={(e) => toggleFavorite(selectedSeriesForModal.id, e)}
          />
        </Suspense>
      )}
    </>
  );
}
