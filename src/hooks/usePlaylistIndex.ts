import { useMemo } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import { isExcludedCatalogItem } from '../utils/searchHelpers';

export function usePlaylistIndex(items: PlaylistItem[]) {
  return useMemo(() => {
    const liveSet = new Set<string>();
    const seriesSet = new Set<string>();
    const movieSet = new Set<string>();
    const live: PlaylistItem[] = [];
    const movie: PlaylistItem[] = [];
    const series: PlaylistItem[] = [];
    const displayMovie: PlaylistItem[] = [];
    const liveGroupCounts: Record<string, number> = {};
    const liveGroupMap = new Map<string, PlaylistItem[]>();
    const movieGroupMap = new Map<string, PlaylistItem[]>();
    const displayGroupMap = new Map<string, PlaylistItem[]>();

    for (const item of items) {
      const group = item.group || 'Genel';

      const displayGroupItems = displayGroupMap.get(group);
      if (displayGroupItems) displayGroupItems.push(item);
      else displayGroupMap.set(group, [item]);

      if (item.type === 'live') {
        liveSet.add(group);
        live.push(item);
        liveGroupCounts[group] = (liveGroupCounts[group] || 0) + 1;
        const groupItems = liveGroupMap.get(group);
        if (groupItems) groupItems.push(item);
        else liveGroupMap.set(group, [item]);
      } else if (item.type === 'series') {
        if (isExcludedCatalogItem(item)) continue;
        seriesSet.add(group);
        series.push(item);
      } else if (item.type === 'movie') {
        if (isExcludedCatalogItem(item)) continue;
        movieSet.add(group);
        movie.push(item);
        displayMovie.push(item);
        const groupItems = movieGroupMap.get(group);
        if (groupItems) groupItems.push(item);
        else movieGroupMap.set(group, [item]);
      }
    }

    return {
      uniqueLiveCategories: Array.from(liveSet),
      uniqueSeriesCategories: Array.from(seriesSet),
      uniqueMovieCategories: Array.from(movieSet),
      itemBuckets: { live, movie, series, livePreview: live.slice(0, 15) },
      liveGroupCounts,
      liveGroupMap,
      movieGroupMap,
      displayGroupMap,
      displayMovie
    };
  }, [items]);
}
