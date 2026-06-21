import { useState, useMemo, useRef } from 'react';
import type { Profile, AvatarSearchResult, ContentPreference, SavedPlaylist, PlaylistItem } from '../types';
import { parseM3UAsync } from '../utils/m3uParser';
import { resolveTmdbImageSrc, getTmdbLanguage } from '../utils/tmdb';
import { DEFAULT_AUTO_UPDATE_INTERVAL_HOURS } from '../constants';

interface UseProfilesProps {
  tmdbApiKey: string;
  saveAppSetting: (key: string, value: any, profileIdOverride?: string | null) => Promise<void>;
  loadAppSetting: (key: string, isJson?: boolean, profileIdOverride?: string | null) => Promise<any>;
  showToast: (message: string) => void;
  loadProfileData: (profileId: string) => Promise<void>;
  resetAllProfileData: () => Promise<void>;
  setIsParsing: (val: boolean) => void;
}

const getCacheBustedUrl = (url: string): string => {
  const cb = Date.now();
  return url.includes('?') ? `${url}&_cb=${cb}` : `${url}?_cb=${cb}`;
};

export interface ProfileSetupStatus {
  active: boolean;
  step: number;
  title: string;
  detail: string;
  itemCount?: number;
}

const yieldToInterface = () => new Promise<void>(resolve => window.setTimeout(resolve, 0));

export function useProfiles({
  tmdbApiKey,
  saveAppSetting,
  loadAppSetting,
  showToast,
  loadProfileData,
  resetAllProfileData,
  setIsParsing
}: UseProfilesProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  
  const currentProfile = useMemo(() => profiles.find(p => p.id === activeProfileId), [profiles, activeProfileId]);
  const isCurrentProfileGradient = currentProfile?.avatarUrl.startsWith('linear-gradient');
  
  const [profileSelectMode, setProfileSelectMode] = useState<'select' | 'manage' | 'create' | 'edit'>('select');
  const [profileFormName, setProfileFormName] = useState('');
  const [profileFormAvatar, setProfileFormAvatar] = useState('');
  const [profileContentPreferences, setProfileContentPreferences] = useState<ContentPreference[]>([]);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  // IPTV Setup within profile wizard
  const [profilePlaylistType, setProfilePlaylistType] = useState<'none' | 'm3u' | 'xtream'>('none');
  const [profileM3uUrl, setProfileM3uUrl] = useState('');
  const [profileXtreamUrl, setProfileXtreamUrl] = useState('');
  const [profileXtreamUser, setProfileXtreamUser] = useState('');
  const [profileXtreamPass, setProfileXtreamPass] = useState('');
  const [profileAutoUpdateIntervalHours, setProfileAutoUpdateIntervalHours] = useState<6 | 12 | 24 | 168>(DEFAULT_AUTO_UPDATE_INTERVAL_HOURS);

  // TMDB Avatar Search states
  const [avatarSearchQuery, setAvatarSearchQuery] = useState('');
  const [avatarSearchResults, setAvatarSearchResults] = useState<AvatarSearchResult[]>([]);
  const [avatarSearchLoading, setAvatarSearchLoading] = useState(false);
  const [trendingAvatars, setTrendingAvatars] = useState<string[]>([]);
  const [localSeries, setLocalSeries] = useState<{ id: number; name: string; posterUrl: string }[]>([]);
  const [selectedSeriesForCast, setSelectedSeriesForCast] = useState<{ id: number; name: string } | null>(null);
  const [seriesCast, setSeriesCast] = useState<{ name: string; avatarUrl: string }[]>([]);
  const [castLoading, setCastLoading] = useState(false);

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [profileEntryReady, setProfileEntryReady] = useState(false);
  const profileSaveInProgressRef = useRef(false);
  const [profileSetupStatus, setProfileSetupStatus] = useState<ProfileSetupStatus>({
    active: false,
    step: 0,
    title: '',
    detail: ''
  });

  // Profile selection
  const handleSelectProfile = async (profileId: string) => {
    const transitionStartedAt = Date.now();
    setProfileSelectMode('select');
    setProfileEntryReady(false);
    setIsParsing(true);
    try {
      await saveAppSetting('cinema_active_profile_id', profileId);
      await loadProfileData(profileId);
      const remainingAnimationTime = Math.max(0, 1400 - (Date.now() - transitionStartedAt));
      if (remainingAnimationTime > 0) {
        await new Promise<void>(resolve => window.setTimeout(resolve, remainingAnimationTime));
      }
      setProfileEntryReady(true);
      await new Promise<void>(resolve => window.setTimeout(resolve, 420));
      setActiveProfileId(profileId);
    } catch (error) {
      console.error("Error loading selected profile:", error);
      showToast("Profil verileri yüklenirken bir hata oluştu.");
    } finally {
      setIsParsing(false);
      setProfileEntryReady(false);
    }
  };

  const handleLogoutProfile = async () => {
    setActiveProfileId(null);
    await saveAppSetting('cinema_active_profile_id', '');
    await resetAllProfileData();
  };

  const handleDeleteProfile = async (profileId: string) => {
    const rawPlaylists = localStorage.getItem(`profile_${profileId}_cinema_playlists`);
    if (rawPlaylists) {
      try {
        const parsed: SavedPlaylist[] = JSON.parse(rawPlaylists);
        for (const p of parsed) {
          if (window.electronAPI && window.electronAPI.deletePlaylistItems) {
            await window.electronAPI.deletePlaylistItems(p.id);
          } else {
            localStorage.removeItem(`cinema_playlist_items_${p.id}`);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    const prefix = `profile_${profileId}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    setProfiles(updatedProfiles);
    await saveAppSetting('cinema_profiles', updatedProfiles);

    if (activeProfileId === profileId) {
      await handleLogoutProfile();
    }
    showToast("Profil ve tüm verileri silindi.");
  };

  const handleAvatarSearch = async (query: string) => {
    if (!query.trim()) return;
    setAvatarSearchLoading(true);
    try {
      const encodedQuery = encodeURIComponent(query);
      const tmdbLang = getTmdbLanguage();
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbApiKey}&query=${encodedQuery}&language=${tmdbLang}`;

      let results: any[] = [];
      if (window.electronAPI && window.electronAPI.fetchTmdb) {
        const res = await window.electronAPI.fetchTmdb(`/3/search/multi?api_key=${tmdbApiKey}&query=${encodedQuery}&language=${tmdbLang}`);
        if (res && Array.isArray(res.results)) {
          results = res.results;
        }
      } else {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results)) {
            results = data.results;
          }
        }
      }

      const mediaResults = results.filter((item: any) => item.media_type === 'tv');

      const mappedResultsPromises = mediaResults.map(async (item: any) => {
        const imgPath = item.poster_path || item.backdrop_path;
        if (!imgPath) return null;

        const posterUrl = await resolveTmdbImageSrc(imgPath, 'w185');
        if (!posterUrl) return null;

        return {
          id: item.id,
          name: item.name || item.title || item.original_name || item.original_title || '',
          posterUrl: posterUrl,
          mediaType: item.media_type as 'movie' | 'tv'
        };
      });

      const resolved = await Promise.all(mappedResultsPromises);
      const finalResults = resolved.filter((r): r is AvatarSearchResult => r !== null);

      setAvatarSearchResults(finalResults.slice(0, 18));
    } catch (e) {
      console.error("Error searching avatars from TMDB:", e);
      showToast("TMDB görsel araması sırasında bir hata oluştu.");
    } finally {
      setAvatarSearchLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (profileSaveInProgressRef.current) return;
    if (!profileFormName.trim()) {
      showToast("Lütfen bir profil ismi girin.");
      return;
    }
    if (!profileFormAvatar) {
      showToast("Lütfen bir profil resmi seçin.");
      return;
    }

    profileSaveInProgressRef.current = true;
    setProfileSetupStatus({
      active: true,
      step: 1,
      title: 'Profil hazırlanıyor',
      detail: 'Bilgiler kontrol ediliyor...'
    });
    setIsParsing(true);
    await yieldToInterface();
    try {
      const isEditing = profileSelectMode === 'edit';
      const profId = isEditing && editingProfileId ? editingProfileId : Date.now().toString();

      const newProfile: Profile = {
        id: profId,
        name: profileFormName.trim(),
        avatarUrl: profileFormAvatar,
        autoUpdateIntervalHours: profileAutoUpdateIntervalHours,
        contentPreferences: profileContentPreferences
      };

      let loadedItems: PlaylistItem[] = [];
      let newPlaylist: SavedPlaylist | null = null;

      if (profilePlaylistType === 'm3u' && profileM3uUrl.trim()) {
        setProfileSetupStatus({
          active: true,
          step: 1,
          title: 'Kanal listesine bağlanılıyor',
          detail: 'M3U sunucusundan yanıt bekleniyor...'
        });
        showToast("M3U Listesi indiriliyor...");
        try {
          const res = await fetch(getCacheBustedUrl(profileM3uUrl), {
            cache: 'no-store',
            headers: {
              'User-Agent': '9XtreamPlayer LibVLC/3.0.22-rc1'
            }
          });
          if (!res.ok) throw new Error("HTTP Hatası: " + res.status);
          setProfileSetupStatus({
            active: true,
            step: 2,
            title: 'Kanal listesi indiriliyor',
            detail: 'İçerikler güvenli şekilde alınıyor...'
          });
          const text = await res.text();
          setProfileSetupStatus({
            active: true,
            step: 2,
            title: 'Kanallar düzenleniyor',
            detail: 'Diziler, filmler ve canlı kanallar ayrıştırılıyor...'
          });
          await yieldToInterface();
          const parsedPlaylist = await parseM3UAsync(text);
          loadedItems = parsedPlaylist.items;
          if (loadedItems.length === 0) throw new Error("Çözümlenebilir kanal bulunamadı!");

          newPlaylist = {
            id: Date.now().toString(),
            name: profileFormName.trim() + " Listesi",
            channelCount: loadedItems.length,
            groupCount: parsedPlaylist.groups.length,
            groups: parsedPlaylist.groups,
            playlistMode: 'm3u',
            url: profileM3uUrl.trim(),
            autoUpdateIntervalHours: profileAutoUpdateIntervalHours,
            lastAutoUpdatedAt: Date.now()
          };
        } catch (e: any) {
          console.error(e);
          showToast(`Kanal listesi yüklenemedi: ${e.message || e}. Profil playlist olmadan oluşturulacak.`);
        }
      } else if (profilePlaylistType === 'xtream' && profileXtreamUrl.trim() && profileXtreamUser.trim() && profileXtreamPass.trim()) {
        setProfileSetupStatus({
          active: true,
          step: 1,
          title: 'Xtream sunucusuna bağlanılıyor',
          detail: 'Hesap ve sunucu bilgileri doğrulanıyor...'
        });
        showToast("Xtream Codes API'ye bağlanılıyor...");
        try {
          const cleanUrl = profileXtreamUrl.trim().replace(/\/$/, "");
          const finalUrl = `${cleanUrl}/get.php?username=${profileXtreamUser.trim()}&password=${profileXtreamPass.trim()}&type=m3u_plus&output=m3u8`;
          const res = await fetch(getCacheBustedUrl(finalUrl), {
            cache: 'no-store',
            headers: {
              'User-Agent': '9XtreamPlayer LibVLC/3.0.22-rc1'
            }
          });
          if (!res.ok) throw new Error("Bağlantı Hatası: " + res.status);
          setProfileSetupStatus({
            active: true,
            step: 2,
            title: 'Kanal listesi indiriliyor',
            detail: 'Xtream içerikleri alınıyor...'
          });
          const text = await res.text();
          setProfileSetupStatus({
            active: true,
            step: 2,
            title: 'Kanallar düzenleniyor',
            detail: 'Diziler, filmler ve canlı kanallar ayrıştırılıyor...'
          });
          await yieldToInterface();
          const parsedPlaylist = await parseM3UAsync(text);
          loadedItems = parsedPlaylist.items;
          if (loadedItems.length === 0) throw new Error("Çözümlenebilir kanal bulunamadı!");

          newPlaylist = {
            id: Date.now().toString(),
            name: profileFormName.trim() + " Xtream",
            channelCount: loadedItems.length,
            groupCount: parsedPlaylist.groups.length,
            groups: parsedPlaylist.groups,
            playlistMode: 'xtream',
            xtreamUrl: cleanUrl,
            xtreamUser: profileXtreamUser.trim(),
            xtreamPass: profileXtreamPass.trim(),
            autoUpdateIntervalHours: profileAutoUpdateIntervalHours,
            lastAutoUpdatedAt: Date.now()
          };
        } catch (e: any) {
          console.error(e);
          showToast(`Xtream bağlantısı başarısız: ${e.message || e}. Profil playlist olmadan oluşturulacak.`);
        }
      }

      let updatedProfiles: Profile[] = [];
      if (isEditing) {
        updatedProfiles = profiles.map(p => p.id === profId ? newProfile : p);
      } else {
        updatedProfiles = [...profiles, newProfile];
      }

      setProfileSetupStatus({
        active: true,
        step: 3,
        title: 'Profil kaydediliyor',
        detail: loadedItems.length > 0
          ? `${loadedItems.length.toLocaleString('tr-TR')} içerik profilinize ekleniyor...`
          : 'Profil tercihleri güvenli şekilde kaydediliyor...',
        itemCount: loadedItems.length || undefined
      });
      await yieldToInterface();
      setProfiles(updatedProfiles);
      await saveAppSetting('cinema_profiles', updatedProfiles);

      if (isEditing) {
        const existingPlaylists = await loadAppSetting('cinema_playlists', true, profId);
        if (Array.isArray(existingPlaylists)) {
          const updatedPlaylists = existingPlaylists.map((playlist: SavedPlaylist) => ({
            ...playlist,
            autoUpdateIntervalHours: profileAutoUpdateIntervalHours
          }));
          await saveAppSetting('cinema_playlists', updatedPlaylists, profId);
        }
      }

      if (newPlaylist && loadedItems.length > 0) {
        if (window.electronAPI && window.electronAPI.savePlaylistItems) {
          await window.electronAPI.savePlaylistItems(newPlaylist.id, loadedItems);
        } else {
          localStorage.setItem(`cinema_playlist_items_${newPlaylist.id}`, JSON.stringify(loadedItems));
        }

        const playlistKey = `profile_${profId}_cinema_playlists`;
        const activePlaylistKey = `profile_${profId}_cinema_active_playlist`;

        if (window.electronAPI && window.electronAPI.saveConfig) {
          await window.electronAPI.saveConfig(playlistKey, [newPlaylist]);
          await window.electronAPI.saveConfig(activePlaylistKey, newPlaylist.id);
        }
        localStorage.setItem(playlistKey, JSON.stringify([newPlaylist]));
        localStorage.setItem(activePlaylistKey, newPlaylist.id);
      }

      setProfileSetupStatus({
        active: true,
        step: 4,
        title: 'Ana sayfa hazırlanıyor',
        detail: 'Kategoriler ve kişisel öneriler oluşturuluyor...',
        itemCount: loadedItems.length || undefined
      });
      await yieldToInterface();
      await handleSelectProfile(profId);
      setProfileFormName('');
      setProfileFormAvatar('');
      setProfileContentPreferences([]);
      setEditingProfileId(null);
      setProfilePlaylistType('none');
      setProfileM3uUrl('');
      setProfileXtreamUrl('');
      setProfileXtreamUser('');
      setProfileXtreamPass('');
      setProfileAutoUpdateIntervalHours(DEFAULT_AUTO_UPDATE_INTERVAL_HOURS);
      setAvatarSearchQuery('');
      setAvatarSearchResults([]);
      showToast(isEditing ? "Profil güncellendi." : `Hoş geldiniz, ${newProfile.name}!`);
    } catch (e) {
      console.error(e);
      showToast("Profil kaydedilirken bir hata oluştu.");
    } finally {
      profileSaveInProgressRef.current = false;
      setProfileSetupStatus(previous => ({ ...previous, active: false }));
      setIsParsing(false);
    }
  };

  return {
    profiles, setProfiles,
    activeProfileId, setActiveProfileId,
    currentProfile,
    isCurrentProfileGradient,
    profileSelectMode, setProfileSelectMode,
    profileFormName, setProfileFormName,
    profileFormAvatar, setProfileFormAvatar,
    profileContentPreferences, setProfileContentPreferences,
    editingProfileId, setEditingProfileId,
    profilePlaylistType, setProfilePlaylistType,
    profileM3uUrl, setProfileM3uUrl,
    profileXtreamUrl, setProfileXtreamUrl,
    profileXtreamUser, setProfileXtreamUser,
    profileXtreamPass, setProfileXtreamPass,
    profileAutoUpdateIntervalHours, setProfileAutoUpdateIntervalHours,
    avatarSearchQuery, setAvatarSearchQuery,
    avatarSearchResults, setAvatarSearchResults,
    avatarSearchLoading, setAvatarSearchLoading,
    trendingAvatars, setTrendingAvatars,
    localSeries, setLocalSeries,
    selectedSeriesForCast, setSelectedSeriesForCast,
    seriesCast, setSeriesCast,
    castLoading, setCastLoading,
    profileDropdownOpen, setProfileDropdownOpen,
    profileEntryReady,
    profileSetupStatus,
    handleSelectProfile,
    handleLogoutProfile,
    handleDeleteProfile,
    handleAvatarSearch,
    handleSaveProfile
  };
}
