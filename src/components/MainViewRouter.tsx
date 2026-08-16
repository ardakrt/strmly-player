import { lazy, Suspense } from 'react';
import type { AppProviderValue } from '../hooks/useAppProvider';
import { APP_VIEWS, isLiveTvView } from '../navigation/views';
import { FavoritesEmptyState } from './FavoritesEmptyState';
import { CatalogPageSkeleton } from './CatalogPageSkeleton';

const loadHomeView = () => import('./HomeView');
const loadLiveTvView = () => import('./LiveTvView');
const loadSeriesView = () => import('./series/SeriesView');
const loadMoviesView = () => import('./movies/MoviesView');
const loadFavoritesView = () => import('./FavoritesView');

// Prefetch core view chunks so tab switching is instantaneous
loadMoviesView();
loadSeriesView();
loadLiveTvView();
loadHomeView();
loadFavoritesView();

const HomeView = lazy(() => loadHomeView().then(m => ({ default: m.HomeView })));
const LiveTvView = lazy(() => loadLiveTvView().then(m => ({ default: m.LiveTvView })));
const SeriesView = lazy(() => loadSeriesView().then(m => ({ default: m.SeriesView })));
const MoviesView = lazy(() => loadMoviesView().then(m => ({ default: m.MoviesView })));
const FavoritesView = lazy(() => loadFavoritesView().then(m => ({ default: m.FavoritesView })));
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
        <Suspense fallback={<CatalogPageSkeleton />}>
          <HomeView
            selectedGroup={selectedGroup}
            searchQuery={deferredSearchQuery}
            isPlaylistHero={home.isPlaylistHero}
            featuredTmdbData={home.featuredTmdbData}
            fallbackHeroItem={home.fallbackHeroItem}
            currentHeroItem={home.currentHeroItem}
            activeFeaturedIndex={home.activeFeaturedIndex}
            displayFeaturedIndex={home.displayFeaturedIndex}
            setActiveFeaturedIndex={home.setActiveFeaturedIndex}
            activeShowcaseList={home.activeShowcaseList}
            top10Movies={(home as any).top10Movies}
            top10Series={(home as any).top10Series}
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
        <Suspense fallback={<CatalogPageSkeleton />}>
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
        <Suspense fallback={<CatalogPageSkeleton />}>
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
            allLiveItems={(catalog as any).allLiveItems || catalog.favItems}
            recentlyWatched={home.uniqueRecentlyWatched}
            handleMainScroll={catalog.handleMainScroll}
            handlePlayStream={playback.handlePlayStream}
            checkedStatusMap={catalog.checkedStatusMap}
            toggleFavorite={catalog.toggleFavorite}
            globalFavorites={catalog.globalFavorites}
            setVisibleCount={catalog.setVisibleCount}
          />
        </Suspense>
      )}

      {/* Keep a small first-screen slice mounted while inactive so its local
          posters are decoded before the first Series navigation. */}
      {(
        <Suspense fallback={<CatalogPageSkeleton />}>
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
            seriesCategoryCounts={catalog.seriesCategoryCounts}
            handleMainScroll={catalog.handleMainScroll}
            handleOpenSeriesModalDirect={catalog.handleOpenSeriesModalDirect}
            toggleFavorite={catalog.toggleFavorite}
            globalFavorites={catalog.globalFavorites}
            setVisibleCount={catalog.setVisibleCount}
          />
        </Suspense>
      )}

      {/* Movies follows the same bounded first-screen prewarm strategy. */}
      {(
        <Suspense fallback={<CatalogPageSkeleton />}>
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
            movieCatalogItems={catalog.movieCatalogItems}
            movieCategoryCounts={catalog.movieCategoryCounts}
            handleMainScroll={catalog.handleMainScroll}
            handleOpenDetails={catalog.handleOpenDetails}
            handlePlayStream={playback.handlePlayStream}
            toggleFavorite={catalog.toggleFavorite}
            globalFavorites={catalog.globalFavorites}
            setVisibleCount={catalog.setVisibleCount}
          />
        </Suspense>
      )}

      {selectedGroup === APP_VIEWS.settings && !deferredSearchQuery.trim() && (
        <Suspense fallback={<CatalogPageSkeleton />}>
          <SettingsPanel onNavigate={setSelectedGroup} />
        </Suspense>
      )}

      {selectedGroup === APP_VIEWS.downloads && (
        <Suspense fallback={<CatalogPageSkeleton />}>
          <DownloadsView app={app} />
        </Suspense>
      )}
    </>
  );
}
