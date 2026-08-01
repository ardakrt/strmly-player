import { useState, useEffect, useRef } from 'react';
import type { Profile } from '../types';
import { DEFAULT_AVATARS } from '../constants';
import { getTmdbApiKey, tmdbCache } from '../utils/tmdb';
import { initSpatialNavigation } from '../utils/spatialNavigation';
import { getTranslation } from '../utils/translations';
import type { Language } from '../utils/translations';

interface UseAppBootProps {
  language: Language;
  setLanguageState: (lang: Language) => void;
  loadAppSetting: (key: string, isJson?: boolean) => Promise<any>;
  saveAppSetting: (key: string, value: unknown) => Promise<any>;
  loadProfileData: (id: string) => Promise<void>;
  setActiveProfileId: (id: string | null) => void;
  setProfiles: (profiles: Profile[]) => void;
  setDefaultPlayer: (player: string) => void;
  setTmdbApiKey: (key: string) => void;
  setActiveAccent: (accent: string) => void;
  setActiveTheme: (theme: string) => void;
  setGlassIntensity: (glass: string) => void;
  setNeonGlowEnabled: (enabled: boolean) => void;
  setCardLayoutSize: (size: string) => void;
  showToast: (msg: string) => void;
  setTranscodeMode?: (mode: 'auto' | 'copy' | 'full') => void;
}

export function useAppBoot({
  language,
  setLanguageState,
  loadAppSetting,
  saveAppSetting,
  loadProfileData,
  setActiveProfileId,
  setProfiles,
  setDefaultPlayer,
  setTmdbApiKey,
  setActiveAccent,
  setActiveTheme,
  setGlassIntensity,
  setNeonGlowEnabled,
  setCardLayoutSize,
  showToast,
  setTranscodeMode
}: UseAppBootProps) {
  const [loaded, setLoaded] = useState(false);
  const [splashStatus, setSplashStatus] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('cinema_language');
      return stored === 'en' ? 'Starting Strmly…' : 'Strmly başlatılıyor…';
    } catch {
      return 'Strmly başlatılıyor…';
    }
  });
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const bootStartedRef = useRef(false);

  // Listen to update status from main process
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateStatus) return;

    const applyUpdateState = (data: { status: string }) => {
      if (data.status === 'available' || data.status === 'downloaded') {
        setUpdateAvailable(true);
      } else if (data.status === 'not-available' || data.status === 'error') {
        setUpdateAvailable(false);
      }
    };

    const unsubStatus = api.onUpdateStatus(applyUpdateState);
    api.getUpdateState?.().then(applyUpdateState).catch(() => {
      // The main process will publish the next lifecycle event.
    });

    return () => {
      if (unsubStatus) unsubStatus();
    };
  }, []);

  // Preheat TMDB IndexedDB cache when fully loaded
  useEffect(() => {
    if (!loaded) return;

    const timer = window.setTimeout(() => {
      tmdbCache.loadAllToMemory().catch((err) => {
        console.error("Failed to preload TMDB cache during idle:", err);
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [loaded]);

  // Initialize Spatial Navigation for keyboard controls
  useEffect(() => {
    if (!loaded) return;

    const cleanupRef = { current: undefined as undefined | (() => void) };
    const timer = window.setTimeout(() => {
      const cleanup = initSpatialNavigation();
      cleanupRef.current = cleanup;
    }, 0);

    return () => {
      window.clearTimeout(timer);
      cleanupRef.current?.();
    };
  }, [loaded]);

  // Main application bootstrapper sequence
  useEffect(() => {
    if (bootStartedRef.current) return;
    bootStartedRef.current = true;
    const loadAppConfig = async () => {
      try {
        sessionStorage.setItem('strmly_session_active', 'true');

        const holdBootMessage = (delayMs: number) => new Promise<void>((resolve) => {
          window.setTimeout(resolve, delayMs);
        });

        setSplashStatus(getTranslation('splash.loadingSettings', language));
        const [
          savedProfiles,
          configPlayer,
          configAccent,
          configTheme,
          configGlass,
          configGlow,
          configCardSize,
          configLanguage,
          configTranscodeMode
        ] = await Promise.all([
          loadAppSetting('cinema_profiles', true).catch(() => null),
          loadAppSetting('cinema_default_player').catch(() => null),
          loadAppSetting('cinema_accent').catch(() => null),
          loadAppSetting('cinema_theme').catch(() => null),
          loadAppSetting('cinema_glass_intensity').catch(() => null),
          loadAppSetting('cinema_neon_glow').catch(() => null),
          loadAppSetting('cinema_card_layout_size').catch(() => null),
          loadAppSetting('cinema_language').catch(() => null),
          loadAppSetting('cinema_transcode_mode').catch(() => null)
        ]);

        let loadedProfiles = Array.isArray(savedProfiles) ? savedProfiles : [];
        setDefaultPlayer(configPlayer || 'internal');

        setTmdbApiKey(getTmdbApiKey());

        setActiveAccent(configAccent || '#FFFFFF');
        setActiveTheme(configTheme || 'space-black');
        setGlassIntensity(configGlass || 'medium');
        setNeonGlowEnabled(configGlow !== null ? configGlow === 'true' || configGlow === true : true);
        setCardLayoutSize(configCardSize || 'medium');
        if (configLanguage === 'en' || configLanguage === 'tr') {
          setLanguageState(configLanguage);
        }
        if (setTranscodeMode && (configTranscodeMode === 'auto' || configTranscodeMode === 'copy' || configTranscodeMode === 'full')) {
          setTranscodeMode(configTranscodeMode);
        }

        // Legacy profile migration
        const hasOldPlaylists = localStorage.getItem('cinema_playlists');
        if (loadedProfiles.length === 0 && hasOldPlaylists) {
          const defaultProfile: Profile = {
            id: 'main_profile',
            name: 'Arda',
            avatarUrl: DEFAULT_AVATARS[0]
          };
          loadedProfiles = [defaultProfile];

          await saveAppSetting('cinema_profiles', loadedProfiles).catch(() => {});

          const keysToMigrate = [
            'favorite_categories', 'custom_category_order', 'hidden_categories',
            'favorite_series_categories', 'custom_series_category_order', 'hidden_series_categories',
            'favorite_movie_categories', 'custom_movie_category_order', 'hidden_movie_categories',
            'cinema_global_favorites', 'cinema_recently_watched', 'cinema_playlists', 'cinema_active_playlist'
          ];

          for (const k of keysToMigrate) {
            const val = localStorage.getItem(k);
            if (val !== null) {
              const finalKey = `profile_main_profile_${k}`;
              if (window.electronAPI && window.electronAPI.saveConfig) {
                try {
                  const parsedVal = JSON.parse(val);
                  await window.electronAPI.saveConfig(finalKey, parsedVal);
                } catch {
                  await window.electronAPI.saveConfig(finalKey, val);
                }
              }
              localStorage.setItem(finalKey, val);
              localStorage.removeItem(k);
            }
          }

          await saveAppSetting('cinema_active_profile_id', 'main_profile').catch(() => {});
        }

        setProfiles(loadedProfiles);

        // Stage 4: Load active profile data
        setSplashStatus(getTranslation('splash.loadingProfiles', language));
        const activeProfId = await loadAppSetting('cinema_active_profile_id').catch(() => null);
        if (activeProfId && loadedProfiles.some(p => p.id === activeProfId)) {
          try {
            await loadProfileData(activeProfId);
          } catch (error) {
            console.error("Error loading active profile during boot:", error);
            showToast(getTranslation('profiles.loadingProfilesError', language));
          }
        } else {
          setActiveProfileId(null);
        }

        setSplashStatus(getTranslation('splash.preparingExperience', language));
        await holdBootMessage(80);
        setSplashStatus(getTranslation('splash.openingApp', language));
        await holdBootMessage(200);
      } catch (err) {
        console.error("Boot configuration error:", err);
      } finally {
        setLoaded(true);
      }
    };

    loadAppConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loaded,
    splashStatus,
    updateAvailable
  };
}
