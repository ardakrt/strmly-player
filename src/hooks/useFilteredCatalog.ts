import { useMemo } from 'react';
import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import {
  getItemGroupLower,
  getItemNameLower,
  getQualityRank,
  isHdChannel,
  itemMatchesQuery
} from '../utils/searchHelpers';

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

const turkishCollator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });

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
  
  // 1. filteredDisplayItems
  const filteredDisplayItems = useMemo(() => {
    let base = items;
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

    if (deferredSearchQuery.trim()) {
      base = (base as PlaylistItem[]).filter((ch: PlaylistItem) => itemMatchesQuery(ch, deferredSearchQuery));
    }

    // Filter national channels to only show HD versions
    base = (base as PlaylistItem[]).filter((ch: PlaylistItem) => {
      const gLower = getItemGroupLower(ch);
      if (gLower.includes('ulusal')) return isHdChannel(ch.name);
      return true;
    });

    // Filter by quality / resolution
    if (qualityFilter !== 'all') {
      base = (base as PlaylistItem[]).filter((ch: PlaylistItem) => {
        const rank = ch.qualityRank || getQualityRank(ch.name, ch.nameLower);
        if (qualityFilter === '4k') return rank === 4;
        if (qualityFilter === 'fhd') return rank === 3;
        if (qualityFilter === 'hd') return rank === 2;
        if (qualityFilter === 'sd') return rank === 1;
        return true;
      });
    }

    // Sort items (A-Z / Z-A)
    if (sortOption === 'az') {
      base = [...base].sort((a, b) => turkishCollator.compare(a.name, b.name));
    } else if (sortOption === 'za') {
      base = [...base].sort((a, b) => turkishCollator.compare(b.name, a.name));
    }

    return base;
  }, [items, itemBuckets.live, playlistIndex, selectedGroup, globalFavorites, activeLiveCategory, hiddenCategories, activeMovieCategory, hiddenMovieCategories, deferredSearchQuery, sortOption, qualityFilter]);

  // 2. groupedSeriesList
  const groupedSeriesList = useMemo(() => {
    if (selectedGroup !== 'Diziler') return [];

    let base = allGroupedSeries;

    // Filter by Category
    const hiddenSet = new Set(hiddenSeriesCategories || []);
    if (activeSeriesCategory !== 'Tümü') {
      base = base.filter(series => (series.group || 'Genel') === activeSeriesCategory);
    } else {
      base = base.filter(series => !hiddenSet.has(series.group || 'Genel'));
    }

    // Filter by Search Query
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.trim().toLocaleLowerCase('tr-TR');
      base = base.filter(series => {
        const sNameLower = getItemNameLower(series);
        const sGroupLower = getItemGroupLower(series);
        if (sNameLower.includes(query) || sGroupLower.includes(query)) return true;

        const seasons = Object.values(series.seasons);
        for (let s = 0; s < seasons.length; s++) {
          const episodes = seasons[s];
          for (let e = 0; e < episodes.length; e++) {
            const ep = episodes[e];
            const epNameLower = ep.item.nameLower || ep.item.name.toLocaleLowerCase('tr-TR');
            if (epNameLower.includes(query)) return true;
          }
        }
        return false;
      });
    }

    // Filter by quality / resolution
    if (qualityFilter !== 'all') {
      base = base.filter(series => {
        const nameLower = getItemNameLower(series);
        const is4k = nameLower.includes('4k') || nameLower.includes('uhd') || nameLower.includes('2160p');
        const isFhd = nameLower.includes('fhd') || nameLower.includes('1080p') || nameLower.includes('1080i');
        const isHd = (nameLower.includes('hd') && !nameLower.includes('fhd')) || nameLower.includes('720p') || nameLower.includes('720i');
        const isSd = nameLower.includes('sd') || nameLower.includes('576p') || nameLower.includes('480p') || (!is4k && !isFhd && !isHd);

        if (qualityFilter === '4k') return is4k;
        if (qualityFilter === 'fhd') return isFhd;
        if (qualityFilter === 'hd') return isHd;
        if (qualityFilter === 'sd') return isSd;
        return true;
      });
    }

    // Sort items (A-Z / Z-A)
    if (sortOption === 'az') {
      base = [...base].sort((a, b) => turkishCollator.compare(a.name, b.name));
    } else if (sortOption === 'za') {
      base = [...base].sort((a, b) => turkishCollator.compare(b.name, a.name));
    }

    return base;
  }, [allGroupedSeries, selectedGroup, activeSeriesCategory, hiddenSeriesCategories, deferredSearchQuery, sortOption, qualityFilter]);

  // 3. favoriteSeriesList
  const favoriteSeriesList = useMemo(() => {
    const favSet = new Set(globalFavorites || []);
    let base = allGroupedSeries.filter(series => favSet.has(series.id));
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.trim().toLocaleLowerCase('tr-TR');
      base = base.filter(series => {
        const sNameLower = getItemNameLower(series);
        const sGroupLower = getItemGroupLower(series);
        if (sNameLower.includes(query) || sGroupLower.includes(query)) return true;

        const seasons = Object.values(series.seasons);
        for (let s = 0; s < seasons.length; s++) {
          const episodes = seasons[s];
          for (let e = 0; e < episodes.length; e++) {
            const ep = episodes[e];
            const epNameLower = ep.item.nameLower || ep.item.name.toLocaleLowerCase('tr-TR');
            if (epNameLower.includes(query)) return true;
          }
        }
        return false;
      });
    }
    return base;
  }, [allGroupedSeries, globalFavorites, deferredSearchQuery]);




  return {
    filteredDisplayItems,
    groupedSeriesList,
    favoriteSeriesList
  };
}
