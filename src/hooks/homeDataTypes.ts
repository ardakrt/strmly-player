import type { PlaylistItem } from '../types';
import type { GroupedSeries } from '../utils/seriesGroupers';

export interface UseHomeDataProps {
  items: PlaylistItem[];
  itemBuckets: { live: PlaylistItem[]; movie: PlaylistItem[]; series: PlaylistItem[] };
  allGroupedSeries: GroupedSeries[];
  recentlyWatched: PlaylistItem[];
  tmdbApiKey: string;
  activeContentPreferences: string[];
  globalFavorites?: string[];
}

export interface FeaturedTmdbData {
  match: string;
  rating: string;
  year: string;
  desc: string;
  backdrop?: string;
  poster?: string;
  logo?: string;
  duration?: string;
  genres?: string[];
}
