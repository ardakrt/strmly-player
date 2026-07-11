import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SavedPlaylist } from '../types';
import { useCategoryManager } from './useCategoryManager';

interface UseAppCategoriesProps {
  playlists: SavedPlaylist[];
  saveAppSetting: (key: string, value: any) => Promise<void>;
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
  saveAppSetting,
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

  const [visibleLiveCategoryLimit, setVisibleLiveCategoryLimit] = useState(24);
  const [visibleSeriesCategoryLimit, setVisibleSeriesCategoryLimit] = useState(40);
  const [visibleMovieCategoryLimit, setVisibleMovieCategoryLimit] = useState(40);

  const [prevSelectedGroup, setPrevSelectedGroup] = useState(selectedGroup);
  const [prevCategorySearchQuery, setPrevCategorySearchQuery] = useState(categorySearchQuery);
  const [prevPlaylistsLength, setPrevPlaylistsLength] = useState(playlists.length);

  if (selectedGroup !== prevSelectedGroup || categorySearchQuery !== prevCategorySearchQuery) {
    setPrevSelectedGroup(selectedGroup);
    setPrevCategorySearchQuery(categorySearchQuery);
    setVisibleLiveCategoryLimit(24);
    setVisibleSeriesCategoryLimit(40);
    setVisibleMovieCategoryLimit(40);
  }

  if (playlists.length !== prevPlaylistsLength) {
    setPrevPlaylistsLength(playlists.length);
    if (playlists.length === 0) {
      setActiveLiveCategory('Tümü');
      setActiveSeriesCategory('Tümü');
      setActiveMovieCategory('Tümü');
    }
  }

  // Sync custom category order with playlist items
  useEffect(() => {
    if (uniqueLiveCategories.length === 0) return;
    setCustomCategoryOrder(prevOrder => {
      const uniqueCatsSet = new Set(uniqueLiveCategories);
      const prevOrderSet = new Set(prevOrder);
      const updatedOrder = [
        ...prevOrder.filter(c => uniqueCatsSet.has(c)),
        ...uniqueLiveCategories.filter(c => !prevOrderSet.has(c))
      ];
      const hasChanged =
        updatedOrder.length !== prevOrder.length ||
        updatedOrder.some((val, index) => val !== prevOrder[index]);
      if (hasChanged) {
        void saveAppSetting('custom_category_order', updatedOrder);
        return updatedOrder;
      }
      return prevOrder;
    });
  }, [uniqueLiveCategories, saveAppSetting]);

  useEffect(() => {
    if (uniqueSeriesCategories.length === 0) return;
    setCustomSeriesCategoryOrder(prevOrder => {
      const uniqueCatsSet = new Set(uniqueSeriesCategories);
      const prevOrderSet = new Set(prevOrder);
      const updatedOrder = [
        ...prevOrder.filter(c => uniqueCatsSet.has(c)),
        ...uniqueSeriesCategories.filter(c => !prevOrderSet.has(c))
      ];
      const hasChanged =
        updatedOrder.length !== prevOrder.length ||
        updatedOrder.some((val, index) => val !== prevOrder[index]);
      if (hasChanged) {
        void saveAppSetting('custom_series_category_order', updatedOrder);
        return updatedOrder;
      }
      return prevOrder;
    });
  }, [uniqueSeriesCategories, saveAppSetting]);

  useEffect(() => {
    if (uniqueMovieCategories.length === 0) return;
    setCustomMovieCategoryOrder(prevOrder => {
      const uniqueCatsSet = new Set(uniqueMovieCategories);
      const prevOrderSet = new Set(prevOrder);
      const updatedOrder = [
        ...prevOrder.filter(c => uniqueCatsSet.has(c)),
        ...uniqueMovieCategories.filter(c => !prevOrderSet.has(c))
      ];
      const hasChanged =
        updatedOrder.length !== prevOrder.length ||
        updatedOrder.some((val, index) => val !== prevOrder[index]);
      if (hasChanged) {
        void saveAppSetting('custom_movie_category_order', updatedOrder);
        return updatedOrder;
      }
      return prevOrder;
    });
  }, [uniqueMovieCategories, saveAppSetting]);

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
