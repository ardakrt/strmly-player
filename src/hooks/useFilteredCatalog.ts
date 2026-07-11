import { useMemo } from 'react';
import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import {
  applyCatalogPostFilters,
  seriesMatchesQuality,
  seriesMatchesQuery,
  sortByNameAzZa,
} from '../utils/catalogFilters';

interface UseFilteredCatalogProps {
  items: PlaylistItem[];
  itemBuckets: {
    live: PlaylistItem[];
    movie: PlaylistItem[];
    series: PlaylistItem[];
  };
  playlistIndex: any;
  allGroupedSeries: GroupedSeries[];
  selectedGroup: string;
  globalFavorites: string[];
  activeLiveCategory: string;
  activeMovieCategory: string;
  activeSeriesCategory: string;
  hiddenCategories: string[];
  hiddenMovieCategories: string[];
  hiddenSeriesCategories: string[];
  deferredSearchQuery: string;
  sortOption: string;
  qualityFilter: string;
}

export function useFilteredCatalog({
  items,
  itemBuckets,
  playlistIndex,
  allGroupedSeries,
  selectedGroup,
  globalFavorites,
  activeLiveCategory,
  activeMovieCategory,
  activeSeriesCategory,
  hiddenCategories,
  hiddenMovieCategories,
  hiddenSeriesCategories,
  deferredSearchQuery,
  sortOption,
  qualityFilter
}: UseFilteredCatalogProps) {

  // 1. filteredDisplayItems — select base once, then single-pass post-filters
  const filteredDisplayItems = useMemo(() => {
    let base: PlaylistItem[] = items;
    if (selectedGroup === 'Favorilerim') {
      const favSet = new Set(globalFavorites || []);
      base = items.filter((ch: PlaylistItem) => favSet.has(ch.id));
    } else if (selectedGroup === 'Canlı TV') {
      const hiddenSet = new Set(hiddenCategories || []);
      const liveItems = itemBuckets.live;
      if (activeLiveCategory !== 'Tümü') {
        base = playlistIndex.liveGroupMap.get(activeLiveCategory) || [];
      } else {
        base = liveItems.filter((ch: PlaylistItem) => !hiddenSet.has(ch.group || 'Genel'));
      }
    } else if (selectedGroup === 'Sinema') {
      const hiddenSet = new Set(hiddenMovieCategories || []);
      const movieItems = playlistIndex.displayMovie;
      if (activeMovieCategory !== 'Tümü') {
        base = playlistIndex.movieGroupMap.get(activeMovieCategory) || [];
      } else {
        base = (movieItems as PlaylistItem[]).filter((ch: PlaylistItem) => !hiddenSet.has(ch.group || 'Genel'));
      }
    } else if (selectedGroup === 'Diziler') {
      return [];
    } else if (selectedGroup !== 'Ana Sayfa' && selectedGroup !== 'İstatistikler' && selectedGroup !== 'Ayarlar') {
      base = playlistIndex.displayGroupMap.get(selectedGroup) || [];
    }

    base = applyCatalogPostFilters(base as PlaylistItem[], deferredSearchQuery, qualityFilter);
    return sortByNameAzZa(base, sortOption);
  }, [items, itemBuckets.live, playlistIndex, selectedGroup, globalFavorites, activeLiveCategory, hiddenCategories, activeMovieCategory, hiddenMovieCategories, deferredSearchQuery, sortOption, qualityFilter]);

  // 2. groupedSeriesList — single-pass category + search + quality
  const groupedSeriesList = useMemo(() => {
    if (selectedGroup !== 'Diziler') return [];

    const hiddenSet = new Set(hiddenSeriesCategories || []);
    const query = deferredSearchQuery.trim();
    const hasSearch = query.length > 0;
    const hasQuality = qualityFilter !== 'all';
    const out: GroupedSeries[] = [];

    for (let i = 0; i < allGroupedSeries.length; i++) {
      const series = allGroupedSeries[i];
      const group = series.group || 'Genel';
      if (activeSeriesCategory !== 'Tümü') {
        if (group !== activeSeriesCategory) continue;
      } else if (hiddenSet.has(group)) {
        continue;
      }
      if (hasSearch && !seriesMatchesQuery(series, deferredSearchQuery)) continue;
      if (hasQuality && !seriesMatchesQuality(series, qualityFilter)) continue;
      out.push(series);
    }

    return sortByNameAzZa(out, sortOption);
  }, [allGroupedSeries, selectedGroup, activeSeriesCategory, hiddenSeriesCategories, deferredSearchQuery, sortOption, qualityFilter]);

  // 3. favoriteSeriesList
  const favoriteSeriesList = useMemo(() => {
    const favSet = new Set(globalFavorites || []);
    const query = deferredSearchQuery.trim();
    const hasSearch = query.length > 0;
    const out: GroupedSeries[] = [];
    for (let i = 0; i < allGroupedSeries.length; i++) {
      const series = allGroupedSeries[i];
      if (!favSet.has(series.id)) continue;
      if (hasSearch && !seriesMatchesQuery(series, deferredSearchQuery)) continue;
      out.push(series);
    }
    return out;
  }, [allGroupedSeries, globalFavorites, deferredSearchQuery]);

  return {
    filteredDisplayItems,
    groupedSeriesList,
    favoriteSeriesList
  };
}
