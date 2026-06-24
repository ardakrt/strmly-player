import { useState, useEffect, useRef, useCallback } from 'react';
import type { Language } from '../utils/translations';
import { getTranslation } from '../utils/translations';
import { GLOBAL_KEYS } from '../constants';
import { getTmdbApiKey } from '../utils/tmdb';

export function useAppSettings() {
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = useCallback((message: string) => {
    setToast({ show: true, message });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ show: false, message: '' });
  }, []);

  const [isParsing, setIsParsing] = useState(false);
  const [sortOption, setSortOption] = useState<string>('default');
  const [qualityFilter, setQualityFilter] = useState<string>('all');

  const pendingDiskWrites = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeProfileIdRef = useRef<string | null>(null);

  const setActiveProfileIdSettings = useCallback((id: string | null) => {
    activeProfileIdRef.current = id;
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const api = window.electronAPI;
      const saveBatchSync = api?.saveConfigBatchSync;
      const saveSync = api?.saveConfigSync;
      if (saveBatchSync) {
        const entries: Record<string, unknown> = {};
        Object.keys(pendingDiskWrites.current).forEach((key) => {
          clearTimeout(pendingDiskWrites.current[key]);
          const stored = localStorage.getItem(key);
          if (stored !== null) {
            try {
              entries[key] = JSON.parse(stored);
            } catch {
              entries[key] = stored;
            }
          }
        });
        if (Object.keys(entries).length > 0) saveBatchSync(entries);
      } else if (saveSync) {
        Object.keys(pendingDiskWrites.current).forEach((key) => {
          clearTimeout(pendingDiskWrites.current[key]);
          const stored = localStorage.getItem(key);
          if (stored !== null) {
            try {
              saveSync(key, JSON.parse(stored));
            } catch {
              saveSync(key, stored);
            }
          }
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const [defaultPlayer, setDefaultPlayer] = useState<string>('internal');
  const [tmdbApiKey, setTmdbApiKey] = useState<string>(() => getTmdbApiKey());
  const [activeAccent, setActiveAccent] = useState<string>('#FFFFFF');
  const [activeTheme, setActiveTheme] = useState<string>('space-black');
  const [glassIntensity, setGlassIntensity] = useState<string>('medium');
  const [neonGlowEnabled, setNeonGlowEnabled] = useState<boolean>(true);
  const [cardLayoutSize, setCardLayoutSize] = useState<string>('medium');
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('players');

  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('cinema_language');
      if (stored) {
        const parsed = stored.startsWith('"') ? JSON.parse(stored) : stored;
        if (parsed === 'en' || parsed === 'tr') return parsed;
      }
    } catch {
      // Ignore
    }
    return 'tr';
  });

  const t = useCallback((key: string) => {
    return getTranslation(key, language);
  }, [language]);

  const [scrolled, setScrolled] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('Ana Sayfa');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  const saveAppSetting = useCallback(async (key: string, value: unknown, profileIdOverride?: string | null) => {
    let finalKey = key;
    const profId = profileIdOverride !== undefined ? profileIdOverride : activeProfileIdRef.current;
    if (profId && !GLOBAL_KEYS.includes(key)) {
      finalKey = `profile_${profId}_${key}`;
    }
    localStorage.setItem(finalKey, typeof value === 'string' ? value : JSON.stringify(value));

    const api = window.electronAPI;
    if (api && api.saveConfig) {
      if (key === 'cinema_recently_watched') {
        if (pendingDiskWrites.current[finalKey]) {
          clearTimeout(pendingDiskWrites.current[finalKey]);
        }
        pendingDiskWrites.current[finalKey] = setTimeout(async () => {
          try {
            await api.saveConfig(finalKey, value);
          } catch (e) {
            console.error("Config save to disk error:", e);
          }
          delete pendingDiskWrites.current[finalKey];
        }, 1000);
      } else {
        if (pendingDiskWrites.current[finalKey]) {
          clearTimeout(pendingDiskWrites.current[finalKey]);
          delete pendingDiskWrites.current[finalKey];
        }
        try {
          await api.saveConfig(finalKey, value);
        } catch (e) {
          console.error("Config save to disk error:", e);
        }
      }
    }
  }, []);

  const loadAppSetting = useCallback(async (key: string, isJson = false, profileIdOverride?: string | null): Promise<any> => {
    let finalKey = key;
    const profId = profileIdOverride !== undefined ? profileIdOverride : activeProfileIdRef.current;
    if (profId && !GLOBAL_KEYS.includes(key)) {
      finalKey = `profile_${profId}_${key}`;
    }
    if (window.electronAPI && window.electronAPI.loadConfig) {
      const val = await window.electronAPI.loadConfig(finalKey);
      if (val !== null && val !== undefined) return val;
    }
    const stored = localStorage.getItem(finalKey);
    if (!stored) return null;
    return isJson ? JSON.parse(stored) : stored;
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    saveAppSetting('cinema_language', lang);
  }, [saveAppSetting]);

  return {
    toast,
    showToast,
    hideToast,
    isParsing,
    setIsParsing,
    sortOption,
    setSortOption,
    qualityFilter,
    setQualityFilter,
    defaultPlayer,
    setDefaultPlayer,
    tmdbApiKey,
    setTmdbApiKey,
    activeAccent,
    setActiveAccent,
    activeTheme,
    setActiveTheme,
    glassIntensity,
    setGlassIntensity,
    neonGlowEnabled,
    setNeonGlowEnabled,
    cardLayoutSize,
    setCardLayoutSize,
    activeSettingsTab,
    setActiveSettingsTab,
    language,
    setLanguageState,
    setLanguage,
    t,
    scrolled,
    setScrolled,
    selectedGroup,
    setSelectedGroup,
    categorySearchQuery,
    setCategorySearchQuery,
    saveAppSetting,
    loadAppSetting,
    setActiveProfileIdSettings
  };
}
