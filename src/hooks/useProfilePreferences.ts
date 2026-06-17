import { useState, useCallback } from 'react';

interface UseProfilePreferencesProps {
  loadAppSetting: (key: string, isJson?: boolean, profileIdOverride?: string | null) => Promise<any>;
}

export function useProfilePreferences({ loadAppSetting }: UseProfilePreferencesProps) {
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>([]);
  const [customCategoryOrder, setCustomCategoryOrder] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  const [favoriteSeriesCategories, setFavoriteSeriesCategories] = useState<string[]>([]);
  const [customSeriesCategoryOrder, setCustomSeriesCategoryOrder] = useState<string[]>([]);
  const [hiddenSeriesCategories, setHiddenSeriesCategories] = useState<string[]>([]);

  const [favoriteMovieCategories, setFavoriteMovieCategories] = useState<string[]>([]);
  const [customMovieCategoryOrder, setCustomMovieCategoryOrder] = useState<string[]>([]);
  const [hiddenMovieCategories, setHiddenMovieCategories] = useState<string[]>([]);

  const [homeHiddenQuickCategories, setHomeHiddenQuickCategories] = useState<string[]>([]);
  const [homeHiddenRows, setHomeHiddenRows] = useState<string[]>([]);
  const [homeQuickCategoryOrder, setHomeQuickCategoryOrder] = useState<string[]>([]);
  const [homeRowOrder, setHomeRowOrder] = useState<string[]>([]);
  const [homeQuickCategoryEditMode, setHomeQuickCategoryEditMode] = useState<boolean>(false);

  const load = async (profileId: string) => {
    const [
      savedFavCats,
      savedCustomOrder,
      savedHiddenCats,
      savedFavSeriesCats,
      savedCustomSeriesOrder,
      savedHiddenSeriesCats,
      savedFavMovieCats,
      savedCustomMovieOrder,
      savedHiddenMovieCats,
      savedHomeHiddenQuickCats,
      savedHomeHiddenRows,
      savedHomeQuickCategoryOrder,
      savedHomeRowOrder
    ] = await Promise.all([
      loadAppSetting('favorite_categories', true, profileId),
      loadAppSetting('custom_category_order', true, profileId),
      loadAppSetting('hidden_categories', true, profileId),
      loadAppSetting('favorite_series_categories', true, profileId),
      loadAppSetting('custom_series_category_order', true, profileId),
      loadAppSetting('hidden_series_categories', true, profileId),
      loadAppSetting('favorite_movie_categories', true, profileId),
      loadAppSetting('custom_movie_category_order', true, profileId),
      loadAppSetting('hidden_movie_categories', true, profileId),
      loadAppSetting('home_hidden_quick_categories', true, profileId),
      loadAppSetting('home_hidden_rows', true, profileId),
      loadAppSetting('home_quick_category_order', true, profileId),
      loadAppSetting('home_row_order', true, profileId)
    ]);

    setFavoriteCategories(Array.isArray(savedFavCats) ? savedFavCats : []);
    setCustomCategoryOrder(Array.isArray(savedCustomOrder) ? savedCustomOrder : []);
    setHiddenCategories(Array.isArray(savedHiddenCats) ? savedHiddenCats : []);
    setFavoriteSeriesCategories(Array.isArray(savedFavSeriesCats) ? savedFavSeriesCats : []);
    setCustomSeriesCategoryOrder(Array.isArray(savedCustomSeriesOrder) ? savedCustomSeriesOrder : []);
    setHiddenSeriesCategories(Array.isArray(savedHiddenSeriesCats) ? savedHiddenSeriesCats : []);
    setFavoriteMovieCategories(Array.isArray(savedFavMovieCats) ? savedFavMovieCats : []);
    setCustomMovieCategoryOrder(Array.isArray(savedCustomMovieOrder) ? savedCustomMovieOrder : []);
    setHiddenMovieCategories(Array.isArray(savedHiddenMovieCats) ? savedHiddenMovieCats : []);
    setHomeHiddenQuickCategories(Array.isArray(savedHomeHiddenQuickCats) ? savedHomeHiddenQuickCats : []);
    setHomeHiddenRows(Array.isArray(savedHomeHiddenRows) ? savedHomeHiddenRows : []);
    setHomeQuickCategoryOrder(Array.isArray(savedHomeQuickCategoryOrder) ? savedHomeQuickCategoryOrder : []);
    setHomeRowOrder(Array.isArray(savedHomeRowOrder) ? savedHomeRowOrder : []);
    setHomeQuickCategoryEditMode(false);
  };

  const reset = useCallback(() => {
    setFavoriteCategories([]);
    setCustomCategoryOrder([]);
    setHiddenCategories([]);
    setFavoriteSeriesCategories([]);
    setCustomSeriesCategoryOrder([]);
    setHiddenSeriesCategories([]);
    setFavoriteMovieCategories([]);
    setCustomMovieCategoryOrder([]);
    setHiddenMovieCategories([]);
    setHomeHiddenQuickCategories([]);
    setHomeHiddenRows([]);
    setHomeQuickCategoryOrder([]);
    setHomeRowOrder([]);
    setHomeQuickCategoryEditMode(false);
  }, []);

  return {
    favoriteCategories, setFavoriteCategories,
    customCategoryOrder, setCustomCategoryOrder,
    hiddenCategories, setHiddenCategories,
    favoriteSeriesCategories, setFavoriteSeriesCategories,
    customSeriesCategoryOrder, setCustomSeriesCategoryOrder,
    hiddenSeriesCategories, setHiddenSeriesCategories,
    favoriteMovieCategories, setFavoriteMovieCategories,
    customMovieCategoryOrder, setCustomMovieCategoryOrder,
    hiddenMovieCategories, setHiddenMovieCategories,
    homeHiddenQuickCategories, setHomeHiddenQuickCategories,
    homeHiddenRows, setHomeHiddenRows,
    homeQuickCategoryOrder, setHomeQuickCategoryOrder,
    homeRowOrder, setHomeRowOrder,
    homeQuickCategoryEditMode, setHomeQuickCategoryEditMode,
    load,
    reset
  };
}
