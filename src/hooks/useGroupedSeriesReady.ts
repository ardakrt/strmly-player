import { useState, useEffect } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import { groupPlaylistItemsToSeries } from '../utils/seriesGroupers';
import type { GroupedSeries } from '../utils/seriesGroupers';

export function useGroupedSeriesReady(seriesItems: PlaylistItem[]) {
  const [isSeriesReady, setIsSeriesReady] = useState(false);
  const [allGroupedSeries, setAllGroupedSeries] = useState<GroupedSeries[]>([]);

  useEffect(() => {
    let cancelled = false;
    setIsSeriesReady(false);
    setAllGroupedSeries([]);
    const run = () => {
      const grouped = groupPlaylistItemsToSeries(seriesItems);
      for (let i = 0; i < grouped.length; i++) {
        const s = grouped[i];
        s.nameLower = s.name.toLocaleLowerCase('tr-TR');
        s.groupLower = (s.group || 'Genel').toLocaleLowerCase('tr-TR');
      }
      if (!cancelled) {
        setAllGroupedSeries(grouped);
        setIsSeriesReady(true);
      }
    };

    const idle = window.requestIdleCallback;
    const cancelIdle = window.cancelIdleCallback;
    const handle = typeof idle === 'function' ? idle(run, { timeout: 1200 }) : window.setTimeout(run, 60);

    return () => {
      cancelled = true;
      if (typeof idle === 'function' && typeof cancelIdle === 'function') cancelIdle(handle);
      else window.clearTimeout(handle);
    };
  }, [seriesItems]);

  return { isSeriesReady, allGroupedSeries };
}
