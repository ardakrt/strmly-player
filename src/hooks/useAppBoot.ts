import { useState, useEffect, useRef } from 'react';
import type { Profile } from '../types';
import { DEFAULT_AVATARS } from '../constants';
import { getTmdbApiKey, tmdbCache } from '../utils/tmdb';
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
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateReleaseNotes, setUpdateReleaseNotes] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateSpeed, setUpdateSpeed] = useState<string>('');
  const [updateError, setUpdateError] = useState<string>('');
  const [updateToastVisible, setUpdateToastVisible] = useState<boolean>(false);
  const bootStartedRef = useRef(false);

  // Listen to update status from main process
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateStatus) return;

    const applyUpdateState = (data: { status: string; version?: string; releaseNotes?: string; message?: string; error?: string }) => {
      if (data.status === 'available' || data.status === 'downloaded') {
        setUpdateAvailable(true);
        setUpdateStatus(data.status as any);
        if (data.version) setUpdateVersion(data.version);
        if (data.releaseNotes) setUpdateReleaseNotes(data.releaseNotes);
        setUpdateProgress(data.status === 'downloaded' ? 100 : 0);
        setUpdateError('');
        setUpdateToastVisible(true);
      } else if (data.status === 'downloading') {
        setUpdateAvailable(true);
        setUpdateStatus('downloading');
        setUpdateToastVisible(true);
      } else if (data.status === 'error') {
        setUpdateStatus('error');
        setUpdateError(getTranslation('updateToast.errorDescription', language));
      } else if (data.status === 'not-available') {
        setUpdateAvailable(false);
      }
    };

    const unsubStatus = api.onUpdateStatus(applyUpdateState);
    const unsubProgress = api.onUpdateProgress?.((data: { percent: number; speed: string }) => {
      setUpdateStatus('downloading');
      setUpdateProgress(data.percent);
      setUpdateSpeed(data.speed);
      setUpdateToastVisible(true);
    });

    api.getUpdateState?.().then(applyUpdateState).catch(() => {});

    return () => {
      if (unsubStatus) unsubStatus();
      if (unsubProgress) unsubProgress();
    };
  }, [language]);

  const triggerInstallUpdate = async () => {
    const api = window.electronAPI;
    if (api?.installUpdate) {
      try {
        const result = await api.installUpdate();
        if (result.success) return;
        setUpdateStatus('error');
        setUpdateError(getTranslation('updateToast.errorDescription', language));
        setUpdateToastVisible(true);
      } catch {
        setUpdateStatus('error');
        setUpdateError(getTranslation('updateToast.errorDescription', language));
        setUpdateToastVisible(true);
      }
    }
  };

  const dismissUpdateToast = () => {
    setUpdateToastVisible(false);
  };

  // Main application bootstrapper sequence
  useEffect(() => {
    if (bootStartedRef.current) return;
    bootStartedRef.current = true;
    const loadAppConfig = async () => {
      try {
        sessionStorage.setItem('strmly_session_active', 'true');
        const posterManifestStartedAt = performance.now();
        const posterManifestPromise = tmdbCache.loadAllToMemory();

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
        const posterCount = await posterManifestPromise;
        console.info(
          `[TMDB Cache] ${posterCount} poster records ready in ${Math.round(performance.now() - posterManifestStartedAt)}ms`,
        );
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
    updateAvailable,
    updateStatus,
    updateVersion,
    updateReleaseNotes,
    updateProgress,
    updateSpeed,
    updateError,
    updateToastVisible,
    triggerInstallUpdate,
    dismissUpdateToast,
  };
}
