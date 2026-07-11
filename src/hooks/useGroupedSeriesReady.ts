import { useState, useEffect } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import { groupPlaylistItemsToSeries } from '../utils/seriesGroupers';
import type { GroupedSeries } from '../utils/seriesGroupers';

export function useGroupedSeriesReady(seriesItems: PlaylistItem[]) {
  const [isSeriesReady, setIsSeriesReady] = useState(() => seriesItems.length === 0);
  const [allGroupedSeries, setAllGroupedSeries] = useState<GroupedSeries[]>([]);

  useEffect(() => {
    let cancelled = false;

    // Empty playlist: ready immediately (no idle work). Avoids boot stall when no series.
    if (seriesItems.length === 0) {
      setAllGroupedSeries([]);
      setIsSeriesReady(true);
      return;
    }

    setIsSeriesReady(false);

    const run = () => {
      const grouped = groupPlaylistItemsToSeries(seriesItems);
      for (let i = 0; i < grouped.length; i++) {
        const s = grouped[i];
        // Precompute lowers once for O(1) search/filter later
        if (!s.nameLower) s.nameLower = s.name.toLocaleLowerCase('tr-TR');
        if (!s.groupLower) s.groupLower = (s.group || 'Genel').toLocaleLowerCase('tr-TR');
      }
      if (!cancelled) {
        setAllGroupedSeries(grouped);
        setIsSeriesReady(true);
      }
    };

    // Yield to paint first frame, then group (idle when available).
    const idle = window.requestIdleCallback;
    const cancelIdle = window.cancelIdleCallback;
    const handle =
      typeof idle === 'function' ? idle(run, { timeout: 800 }) : window.setTimeout(run, 0);

    return () => {
      cancelled = true;
      if (typeof idle === 'function' && typeof cancelIdle === 'function') cancelIdle(handle as number);
      else window.clearTimeout(handle as number);
    };
  }, [seriesItems]);

  return { isSeriesReady, allGroupedSeries };
}
