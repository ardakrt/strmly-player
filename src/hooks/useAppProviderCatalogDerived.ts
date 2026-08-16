import { useMemo } from "react";
import type { PlaylistItem } from "../types";
import type { PlaylistIndex } from "./usePlaylistIndex";

interface UseAppProviderCatalogDerivedOptions {
  items: PlaylistItem[];
  itemBuckets: PlaylistIndex["itemBuckets"];
  filteredDisplayItems: PlaylistItem[];
  uniqueLiveCategories: string[];
  uniqueSeriesCategories: string[];
  uniqueMovieCategories: string[];
  favoriteCategories: string[];
  favoriteSeriesCategories: string[];
  favoriteMovieCategories: string[];
  hiddenCategories: string[];
  hiddenSeriesCategories: string[];
  hiddenMovieCategories: string[];
}

function visibleFavorites(
  favorites: string[],
  available: string[],
  hidden: string[],
) {
  const availableSet = new Set(available);
  const hiddenSet = new Set(hidden);
  return favorites.filter(
    (group) => availableSet.has(group) && !hiddenSet.has(group),
  );
}

export function useAppProviderCatalogDerived({
  items,
  itemBuckets,
  filteredDisplayItems,
  uniqueLiveCategories,
  uniqueSeriesCategories,
  uniqueMovieCategories,
  favoriteCategories,
  favoriteSeriesCategories,
  favoriteMovieCategories,
  hiddenCategories,
  hiddenSeriesCategories,
  hiddenMovieCategories,
}: UseAppProviderCatalogDerivedOptions) {
  const itemStats = useMemo(
    () => ({
      live: itemBuckets.live.length,
      movie: itemBuckets.movie.length,
      series: itemBuckets.series.length,
      total: items.length,
    }),
    [itemBuckets, items.length],
  );
  const favChannels = useMemo(
    () =>
      filteredDisplayItems.filter(
        (item) => item.type === "live" || item.type === undefined,
      ),
    [filteredDisplayItems],
  );
  const favMovies = useMemo(
    () => filteredDisplayItems.filter((item) => item.type === "movie"),
    [filteredDisplayItems],
  );
  const allLiveItems = useMemo(
    () => items.filter((item) => item.type === "live" || item.type === undefined),
    [items],
  );
  const liveFavCatsToShow = useMemo(
    () =>
      visibleFavorites(
        favoriteCategories,
        uniqueLiveCategories,
        hiddenCategories,
      ),
    [favoriteCategories, uniqueLiveCategories, hiddenCategories],
  );
  const seriesFavCatsToShow = useMemo(
    () =>
      visibleFavorites(
        favoriteSeriesCategories,
        uniqueSeriesCategories,
        hiddenSeriesCategories,
      ),
    [
      favoriteSeriesCategories,
      uniqueSeriesCategories,
      hiddenSeriesCategories,
    ],
  );
  const movieFavCatsToShow = useMemo(
    () =>
      visibleFavorites(
        favoriteMovieCategories,
        uniqueMovieCategories,
        hiddenMovieCategories,
      ),
    [favoriteMovieCategories, uniqueMovieCategories, hiddenMovieCategories],
  );

  return {
    itemStats,
    favChannels,
    favMovies,
    allLiveItems,
    liveFavCatsToShow,
    seriesFavCatsToShow,
    movieFavCatsToShow,
  };
}
