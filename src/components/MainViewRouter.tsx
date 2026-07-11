import { lazy, Suspense } from 'react';
import type { AppProviderValue } from '../hooks/useAppProvider';
import { APP_VIEWS, isLiveTvView } from '../navigation/views';
import { FavoritesEmptyState } from './FavoritesEmptyState';

const HomeView = lazy(() => import('./HomeView').then(m => ({ default: m.HomeView })));
const LiveTvView = lazy(() => import('./LiveTvView').then(m => ({ default: m.LiveTvView })));
const SeriesView = lazy(() => import('./SeriesView').then(m => ({ default: m.SeriesView })));
const MoviesView = lazy(() => import('./MoviesView').then(m => ({ default: m.MoviesView })));
const FavoritesView = lazy(() => import('./FavoritesView').then(m => ({ default: m.FavoritesView })));
const SettingsPanel = lazy(() => import('./SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const DownloadsView = lazy(() => import('./DownloadsView').then(m => ({ default: m.DownloadsView })));

interface MainViewRouterProps {
  app: AppProviderValue;
}

export function MainViewRouter({ app }: MainViewRouterProps) {
  const { navigation, catalog, home, playback, showToast } = app;
  const { selectedGroup, deferredSearchQuery, setSelectedGroup, setActiveSettingsTab, setShowAddPlaylistForm } = navigation;

  return (
    <>
      {selectedGroup === APP_VIEWS.home && !deferredSearchQuery.trim() && (
        <Suspense fallback={null}>
          <HomeView
            selectedGroup={selectedGroup}
            searchQuery={deferredSearchQuery}
            isPlaylistHero={home.isPlaylistHero}
            featuredTmdbData={home.featuredTmdbData}
            fallbackHeroItem={home.fallbackHeroItem}
            currentHeroItem={home.currentHeroItem}
            activeFeaturedIndex={home.activeFeaturedIndex}
            setActiveFeaturedIndex={home.setActiveFeaturedIndex}
            activeShowcaseList={home.activeShowcaseList}
            playlists={catalog.playlists}
            uniqueRecentlyWatched={home.uniqueRecentlyWatched}
            clearRecentlyWatched={home.clearRecentlyWatched}
            removeFromRecentlyWatched={home.removeFromRecentlyWatched}
            handleScrollSlider={catalog.handleScrollSlider}
            handlePlayStream={playback.handlePlayStream}
            handleOpenDetails={catalog.handleOpenDetails}
            toggleFavorite={catalog.toggleFavorite}
            globalFavorites={catalog.globalFavorites}
            getFavoriteIdForItem={catalog.getFavoriteIdForItem}
            homeDiscoveryItems={home.homeDiscoveryItems}
            homeLiveTvQuickChannels={home.homeLiveTvQuickChannels}
            populerFilmler={home.populerFilmler}
            populerDiziler={home.populerDiziler}
            contentPreferences={home.activeContentPreferences}
            setSelectedGroup={setSelectedGroup}
            setActiveLiveCategory={catalog.setActiveLiveCategory}
            setActiveSeriesCategory={catalog.setActiveSeriesCategory}
            setActiveMovieCategory={catalog.setActiveMovieCategory}
            onOpenPlaylistSetup={() => {
              setActiveSettingsTab('playlists');
              setShowAddPlaylistForm(true);
              setSelectedGroup(APP_VIEWS.settings);
            }}
            showToast={showToast}
          />
        </Suspense>
      )}

      {selectedGroup === APP_VIEWS.favorites && catalog.favItems.length === 0 && catalog.favSeries.length === 0 && !deferredSearchQuery.trim() && (
        <FavoritesEmptyState
          onGoToLiveTv={() => setSelectedGroup(APP_VIEWS.live)}
          onGoToHome={() => setSelectedGroup(APP_VIEWS.home)}
        />
      )}

      {selectedGroup === APP_VIEWS.favorites && (catalog.favItems.length > 0 || catalog.favSeries.length > 0 || deferredSearchQuery.trim()) && (
        <Suspense fallback={null}>
          <FavoritesView
            selectedGroup={selectedGroup}
            favChannels={catalog.favChannels}
            favMovies={catalog.favMovies}
            favSeries={catalog.favSeries}
            handlePlayStream={playback.handlePlayStream}
            handleOpenDetails={catalog.handleOpenDetails}
            handleOpenSeriesModalDirect={catalog.handleOpenSeriesModalDirect}
            toggleFavorite={catalog.toggleFavorite}
            globalFavorites={catalog.globalFavorites}
            checkedStatusMap={catalog.checkedStatusMap}
          />
        </Suspense>
      )}

      {isLiveTvView(selectedGroup) && (
        <Suspense fallback={null}>
          <LiveTvView
            selectedGroup={selectedGroup}
            activeLiveCategory={catalog.activeLiveCategory}
            setActiveLiveCategory={catalog.setActiveLiveCategory}
            categorySearchQuery={navigation.categorySearchQuery}
            setCategorySearchQuery={navigation.setCategorySearchQuery}
            liveFavCatsToShow={catalog.liveFavCatsToShow}
            liveCat={catalog.liveCat}
            visibleLiveCategoryLimit={catalog.visibleLiveCategoryLimit}
            setVisibleLiveCategoryLimit={catalog.setVisibleLiveCategoryLimit}
            filteredDisplayItems={catalog.favItems}
            handleMainScroll={catalog.handleMainScroll}
            handlePlayStream={playback.handlePlayStream}
            checkedStatusMap={catalog.checkedStatusMap}
            toggleFavorite={catalog.toggleFavorite}
            globalFavorites={catalog.globalFavorites}
            setVisibleCount={catalog.setVisibleCount}
          />
        </Suspense>
      )}

      {selectedGroup === APP_VIEWS.series && (
        <Suspense fallback={null}>
          <SeriesView
            selectedGroup={selectedGroup}
            activeSeriesCategory={catalog.activeSeriesCategory}
            setActiveSeriesCategory={catalog.setActiveSeriesCategory}
            categorySearchQuery={navigation.categorySearchQuery}
            setCategorySearchQuery={navigation.setCategorySearchQuery}
            seriesFavCatsToShow={catalog.seriesFavCatsToShow}
            seriesCat={catalog.seriesCat}
            visibleSeriesCategoryLimit={catalog.visibleSeriesCategoryLimit}
            setVisibleSeriesCategoryLimit={catalog.setVisibleSeriesCategoryLimit}
            groupedSeriesList={catalog.groupedSeriesList}
            handleMainScroll={catalog.handleMainScroll}
            handleOpenSeriesModalDirect={catalog.handleOpenSeriesModalDirect}
            toggleFavorite={catalog.toggleFavorite}
            globalFavorites={catalog.globalFavorites}
            setVisibleCount={catalog.setVisibleCount}
          />
        </Suspense>
      )}

      {selectedGroup === APP_VIEWS.movies && (
        <Suspense fallback={null}>
          <MoviesView
            selectedGroup={selectedGroup}
            activeMovieCategory={catalog.activeMovieCategory}
            setActiveMovieCategory={catalog.setActiveMovieCategory}
            categorySearchQuery={navigation.categorySearchQuery}
            setCategorySearchQuery={navigation.setCategorySearchQuery}
            movieFavCatsToShow={catalog.movieFavCatsToShow}
            movieCat={catalog.movieCat}
            visibleMovieCategoryLimit={catalog.visibleMovieCategoryLimit}
            setVisibleMovieCategoryLimit={catalog.setVisibleMovieCategoryLimit}
            filteredDisplayItems={catalog.favItems}
            handleMainScroll={catalog.handleMainScroll}
            handleOpenDetails={catalog.handleOpenDetails}
            handlePlayStream={playback.handlePlayStream}
            checkedStatusMap={catalog.checkedStatusMap}
            toggleFavorite={catalog.toggleFavorite}
            globalFavorites={catalog.globalFavorites}
            setVisibleCount={catalog.setVisibleCount}
          />
        </Suspense>
      )}



      {selectedGroup === APP_VIEWS.settings && !deferredSearchQuery.trim() && (
        <Suspense fallback={null}>
          <SettingsPanel onNavigate={setSelectedGroup} />
        </Suspense>
      )}

      {selectedGroup === APP_VIEWS.downloads && (
        <Suspense fallback={null}>
          <DownloadsView app={app} />
        </Suspense>
      )}
    </>
  );
}
