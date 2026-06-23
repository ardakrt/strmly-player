import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SavedPlaylist } from '../types';
import { useCategoryManager } from './useCategoryManager';

interface UseAppCategoriesProps {
  playlists: SavedPlaylist[];
  activeProfileId: string | null;
  saveAppSetting: (key: string, value: any) => Promise<void>;
  resetPreferences: () => void;
  uniqueLiveCategories: string[];
  uniqueSeriesCategories: string[];
  uniqueMovieCategories: string[];
  categorySearchQuery: string;
  showToast: (message: string) => void;
  selectedGroup: string;
  
  favoriteCategories: string[];
  setFavoriteCategories: Dispatch<SetStateAction<string[]>>;
  customCategoryOrder: string[];
  setCustomCategoryOrder: Dispatch<SetStateAction<string[]>>;
  hiddenCategories: string[];
  setHiddenCategories: Dispatch<SetStateAction<string[]>>;

  favoriteSeriesCategories: string[];
  setFavoriteSeriesCategories: Dispatch<SetStateAction<string[]>>;
  customSeriesCategoryOrder: string[];
  setCustomSeriesCategoryOrder: Dispatch<SetStateAction<string[]>>;
  hiddenSeriesCategories: string[];
  setHiddenSeriesCategories: Dispatch<SetStateAction<string[]>>;

  favoriteMovieCategories: string[];
  setFavoriteMovieCategories: Dispatch<SetStateAction<string[]>>;
  customMovieCategoryOrder: string[];
  setCustomMovieCategoryOrder: Dispatch<SetStateAction<string[]>>;
  hiddenMovieCategories: string[];
  setHiddenMovieCategories: Dispatch<SetStateAction<string[]>>;
}

export function useAppCategories({
  playlists,
  activeProfileId,
  saveAppSetting,
  resetPreferences,
  uniqueLiveCategories,
  uniqueSeriesCategories,
  uniqueMovieCategories,
  categorySearchQuery,
  showToast,
  selectedGroup,

  favoriteCategories,
  setFavoriteCategories,
  customCategoryOrder,
  setCustomCategoryOrder,
  hiddenCategories,
  setHiddenCategories,

  favoriteSeriesCategories,
  setFavoriteSeriesCategories,
  customSeriesCategoryOrder,
  setCustomSeriesCategoryOrder,
  hiddenSeriesCategories,
  setHiddenSeriesCategories,

  favoriteMovieCategories,
  setFavoriteMovieCategories,
  customMovieCategoryOrder,
  setCustomMovieCategoryOrder,
  hiddenMovieCategories,
  setHiddenMovieCategories
}: UseAppCategoriesProps) {
  const [activeLiveCategory, setActiveLiveCategory] = useState<string>('Tümü');
  const [activeMovieCategory, setActiveMovieCategory] = useState<string>('Tümü');
  const [activeSeriesCategory, setActiveSeriesCategory] = useState<string>('Tümü');

  const [categoryEditMode, setCategoryEditMode] = useState<boolean>(false);
  const [seriesCategoryEditMode, setSeriesCategoryEditMode] = useState<boolean>(false);
  const [movieCategoryEditMode, setMovieCategoryEditMode] = useState<boolean>(false);

  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedSeriesCategory, setDraggedSeriesCategory] = useState<string | null>(null);
  const [draggedMovieCategory, setDraggedMovieCategory] = useState<string | null>(null);

  const [visibleLiveCategoryLimit, setVisibleLiveCategoryLimit] = useState(40);
  const [visibleSeriesCategoryLimit, setVisibleSeriesCategoryLimit] = useState(40);
  const [visibleMovieCategoryLimit, setVisibleMovieCategoryLimit] = useState(40);

  useEffect(() => {
    setVisibleLiveCategoryLimit(40);
    setVisibleSeriesCategoryLimit(40);
    setVisibleMovieCategoryLimit(40);
  }, [selectedGroup, categorySearchQuery]);

  // Reset category configurations if there are no playlists loaded
  useEffect(() => {
    if (playlists.length === 0) {
      resetPreferences();
      if (activeProfileId) {
        saveAppSetting('favorite_categories', []);
        saveAppSetting('custom_category_order', []);
        saveAppSetting('hidden_categories', []);
        saveAppSetting('favorite_series_categories', []);
        saveAppSetting('custom_series_category_order', []);
        saveAppSetting('hidden_series_categories', []);
        saveAppSetting('favorite_movie_categories', []);
        saveAppSetting('custom_movie_category_order', []);
        saveAppSetting('hidden_movie_categories', []);
      }
    }
  }, [playlists.length, saveAppSetting, resetPreferences, activeProfileId]);

  const liveCat = useCategoryManager({
    domain: 'live',
    uniqueCategories: uniqueLiveCategories,
    categorySearchQuery,
    saveAppSetting,
    showToast,
    activeCategory: activeLiveCategory,
    setActiveCategory: setActiveLiveCategory,
    favorites: favoriteCategories,
    setFavorites: setFavoriteCategories,
    customOrder: customCategoryOrder,
    setCustomOrder: setCustomCategoryOrder,
    hidden: hiddenCategories,
    setHidden: setHiddenCategories,
    editMode: categoryEditMode,
    setEditMode: setCategoryEditMode,
    draggedCategory,
    setDraggedCategory,
  });

  const seriesCat = useCategoryManager({
    domain: 'series',
    uniqueCategories: uniqueSeriesCategories,
    categorySearchQuery,
    saveAppSetting,
    showToast,
    activeCategory: activeSeriesCategory,
    setActiveCategory: setActiveSeriesCategory,
    favorites: favoriteSeriesCategories,
    setFavorites: setFavoriteSeriesCategories,
    customOrder: customSeriesCategoryOrder,
    setCustomOrder: setCustomSeriesCategoryOrder,
    hidden: hiddenSeriesCategories,
    setHidden: setHiddenSeriesCategories,
    editMode: seriesCategoryEditMode,
    setEditMode: setSeriesCategoryEditMode,
    draggedCategory: draggedSeriesCategory,
    setDraggedCategory: setDraggedSeriesCategory,
  });

  const movieCat = useCategoryManager({
    domain: 'movie',
    uniqueCategories: uniqueMovieCategories,
    categorySearchQuery,
    saveAppSetting,
    showToast,
    activeCategory: activeMovieCategory,
    setActiveCategory: setActiveMovieCategory,
    favorites: favoriteMovieCategories,
    setFavorites: setFavoriteMovieCategories,
    customOrder: customMovieCategoryOrder,
    setCustomOrder: setCustomMovieCategoryOrder,
    hidden: hiddenMovieCategories,
    setHidden: setHiddenMovieCategories,
    editMode: movieCategoryEditMode,
    setEditMode: setMovieCategoryEditMode,
    draggedCategory: draggedMovieCategory,
    setDraggedCategory: setDraggedMovieCategory,
  });

  return {
    activeLiveCategory,
    setActiveLiveCategory,
    activeMovieCategory,
    setActiveMovieCategory,
    activeSeriesCategory,
    setActiveSeriesCategory,
    categoryEditMode,
    setCategoryEditMode,
    seriesCategoryEditMode,
    setSeriesCategoryEditMode,
    movieCategoryEditMode,
    setMovieCategoryEditMode,
    draggedCategory,
    setDraggedCategory,
    draggedSeriesCategory,
    setDraggedSeriesCategory,
    draggedMovieCategory,
    setDraggedMovieCategory,
    liveCat,
    seriesCat,
    movieCat,
    visibleLiveCategoryLimit,
    setVisibleLiveCategoryLimit,
    visibleSeriesCategoryLimit,
    setVisibleSeriesCategoryLimit,
    visibleMovieCategoryLimit,
    setVisibleMovieCategoryLimit
  };
}
