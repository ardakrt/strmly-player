import { useMemo } from 'react';
import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';
import {
  getItemCleanNameLower,
  getItemGroupLower,
  getItemNameLower,
  getItemSearchScore,
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
  deferredSpotlightSearchInput: string;
  spotlightScope: string;
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
  qualityFilter,
  deferredSpotlightSearchInput,
  spotlightScope
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

  // 4. genericLogosSet
  const genericLogosSet = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type !== 'live') {
        const logo = item.logo;
        if (logo && logo.startsWith('http')) {
          counts[logo] = (counts[logo] || 0) + 1;
        }
      }
    }

    const genericSet = new Set<string>();
    for (const logo in counts) {
      if (counts[logo] > 5) {
        genericSet.add(logo);
      }
    }
    return genericSet;
  }, [items]);

  // 5. spotlightSearchResults
  const spotlightSearchResults = useMemo(() => {
    if (!deferredSpotlightSearchInput.trim()) return [];
    const query = deferredSpotlightSearchInput.trim().toLocaleLowerCase('tr-TR');
    const hiddenLiveSet = new Set(hiddenCategories || []);
    const hiddenMovieSet = new Set(hiddenMovieCategories || []);
    const hiddenSeriesSet = new Set(hiddenSeriesCategories || []);

    const matches: Array<{
      type: 'live' | 'movie' | 'series';
      item: PlaylistItem | GroupedSeries;
      score: number;
    }> = [];

    // Live TV Search
    if (spotlightScope === 'all' || spotlightScope === 'live') {
      const liveItems = itemBuckets.live;
      for (let i = 0; i < liveItems.length; i++) {
        const ch = liveItems[i];
        if (hiddenLiveSet.has(ch.group || 'Genel')) continue;
        const groupLower = getItemGroupLower(ch);
        if (groupLower.includes('ulusal') && !isHdChannel(ch.name)) continue;
        const score = getItemSearchScore(ch, query);
        if (score > 0) {
          matches.push({ type: 'live', item: ch, score });
        }
      }
    }

    // Movies Search
    if (spotlightScope === 'all' || spotlightScope === 'movie') {
      const movieItems = itemBuckets.movie;
      const dedupedMovies: Record<string, { item: PlaylistItem; score: number; qualityRank: number }> = {};
      for (let i = 0; i < movieItems.length; i++) {
        const ch = movieItems[i];
        if (hiddenMovieSet.has(ch.group || 'Genel')) continue;
        const clNameLower = getItemCleanNameLower(ch);
        const nameLower = getItemNameLower(ch);
        const score = getItemSearchScore(ch, query);
        if (score > 0) {
          const qRank = getQualityRank(ch.name, nameLower);
          const existing = dedupedMovies[clNameLower];
          if (!existing || score > existing.score || (score === existing.score && qRank > existing.qualityRank)) {
            dedupedMovies[clNameLower] = { item: ch, score, qualityRank: qRank };
          }
        }
      }
      Object.values(dedupedMovies).forEach(m => {
        matches.push({ type: 'movie', item: m.item, score: m.score });
      });
    }

    // Series Search
    if (spotlightScope === 'all' || spotlightScope === 'series') {
      const dedupedSeries: Record<string, { item: GroupedSeries; score: number }> = {};
      for (let i = 0; i < allGroupedSeries.length; i++) {
        const series = allGroupedSeries[i];
        if (hiddenSeriesSet.has(series.group || 'Genel')) continue;
        const sNameLower = getItemNameLower(series);
        const score = getItemSearchScore(series, query);

        let episodeMatch = false;
        const seasons = Object.values(series.seasons);
        for (let s = 0; s < seasons.length; s++) {
          const episodes = seasons[s];
          for (let e = 0; e < episodes.length; e++) {
            const ep = episodes[e];
            const epNameLower = ep.item.nameLower || ep.item.name.toLocaleLowerCase('tr-TR');
            if (epNameLower.includes(query)) {
              episodeMatch = true;
              break;
            }
          }
          if (episodeMatch) break;
        }
        const finalScore = score > 0 ? score : (episodeMatch ? 50 : 0);
        if (finalScore > 0) {
          const existing = dedupedSeries[sNameLower];
          if (!existing || finalScore > existing.score) {
            dedupedSeries[sNameLower] = { item: series, score: finalScore };
          }
        }
      }
      Object.values(dedupedSeries).forEach(s => {
        matches.push({ type: 'series', item: s.item, score: s.score });
      });
    }

    // Sort matches by score descending
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }, [allGroupedSeries, deferredSpotlightSearchInput, spotlightScope, hiddenCategories, hiddenMovieCategories, hiddenSeriesCategories, itemBuckets.live, itemBuckets.movie]);

  return {
    filteredDisplayItems,
    groupedSeriesList,
    favoriteSeriesList,
    genericLogosSet,
    spotlightSearchResults
  };
}
