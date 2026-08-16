import type React from 'react';
import type { AvatarSearchResult, ContentPreference, Profile } from '../../types';
import type { ProfileSetupStatus } from '../../hooks/useProfiles';

export interface LocalSeries {
  id: number;
  name: string;
  posterUrl: string;
}

export interface SeriesCast {
  name: string;
  avatarUrl: string;
}

export interface ProfileScreenProps {
  profiles: Profile[];
  profileSelectMode: 'select' | 'manage' | 'create' | 'edit';
  profileFormName: string;
  profileFormAvatar: string;
  profileContentPreferences: ContentPreference[];
  editingProfileId: string | null;
  profilePlaylistType: 'none' | 'm3u' | 'xtream';
  profileM3uUrl: string;
  profileXtreamUrl: string;
  profileXtreamUser: string;
  profileXtreamPass: string;
  profileAutoUpdateIntervalHours: 6 | 12 | 24 | 168;
  avatarSearchQuery: string;
  avatarSearchResults: AvatarSearchResult[];
  avatarSearchLoading: boolean;
  trendingAvatars: string[];
  localSeries: LocalSeries[];
  selectedSeriesForCast: { id: number; name: string } | null;
  seriesCast: SeriesCast[];
  castLoading: boolean;
  isParsing: boolean;
  profileSetupStatus: ProfileSetupStatus;
  profileEntryReady: boolean;
  toast: { show: boolean; message: string };
  activeTheme: string;
  accentStyles: React.CSSProperties;
  setProfileSelectMode: (mode: 'select' | 'manage' | 'create' | 'edit') => void;
  setProfileFormName: (name: string) => void;
  setProfileFormAvatar: (avatar: string) => void;
  setProfileContentPreferences: (preferences: ContentPreference[]) => void;
  setEditingProfileId: (id: string | null) => void;
  setProfilePlaylistType: (type: 'none' | 'm3u' | 'xtream') => void;
  setProfileM3uUrl: (url: string) => void;
  setProfileXtreamUrl: (url: string) => void;
  setProfileXtreamUser: (user: string) => void;
  setProfileXtreamPass: (pass: string) => void;
  setProfileAutoUpdateIntervalHours: (hours: 6 | 12 | 24 | 168) => void;
  setAvatarSearchQuery: (query: string) => void;
  setAvatarSearchResults: (results: AvatarSearchResult[]) => void;
  setSelectedSeriesForCast: (series: { id: number; name: string } | null) => void;
  setSeriesCast: (cast: SeriesCast[]) => void;
  onSelectProfile: (id: string) => void | Promise<void>;
  onSaveProfile: () => void;
  onDeleteProfile: (id: string) => void | Promise<void>;
  onAvatarSearch: (query: string) => void;
  onFetchSeriesCast: (id: number, name: string, mediaType: 'movie' | 'tv') => void;
}

export const contentPreferenceIds: ContentPreference[] = [
  'series', 'movies', 'sports', 'live', 'kids',
];

export function getPreferenceLabel(
  preference: ContentPreference,
  language: 'tr' | 'en',
) {
  const labels = {
    series: language === 'tr' ? 'Dizi' : 'Series',
    movies: language === 'tr' ? 'Film' : 'Movies',
    sports: language === 'tr' ? 'Spor' : 'Sports',
    live: language === 'tr' ? 'Canlı TV' : 'Live TV',
    kids: language === 'tr' ? 'Çocuk' : 'Kids',
  };
  return labels[preference];
}
