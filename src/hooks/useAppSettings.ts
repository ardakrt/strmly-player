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

  useEffect(() => {
    const handleShowToast = (e: Event) => {
      const customEvt = e as CustomEvent<{ message: string }>;
      if (customEvt.detail?.message) {
        showToast(customEvt.detail.message);
      }
    };
    window.addEventListener('show-toast', handleShowToast);
    return () => window.removeEventListener('show-toast', handleShowToast);
  }, [showToast]);

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

  const [transcodeMode, setTranscodeModeState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('cinema_transcode_mode');
      if (stored) {
        return stored.startsWith('"') ? JSON.parse(stored) : stored;
      }
    } catch {
      // Ignore
    }
    return 'full';
  });

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
  const [selectedGroup, setSelectedGroupState] = useState<string>('Ana Sayfa');
  const historyRef = useRef<string[]>(['Ana Sayfa']);
  const historyIndexRef = useRef<number>(0);

  const setSelectedGroup = useCallback((group: string | ((prev: string) => string)) => {
    setSelectedGroupState((prev) => {
      const nextGroup = typeof group === 'function' ? group(prev) : group;
      if (nextGroup === prev) return prev;

      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(nextGroup);
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      return nextGroup;
    });
  }, []);

  const navigateBack = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevGroup = historyRef.current[historyIndexRef.current];
      setSelectedGroupState(prevGroup);
    }
  }, []);

  const navigateForward = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextGroup = historyRef.current[historyIndexRef.current];
      setSelectedGroupState(nextGroup);
    }
  }, []);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        navigateBack();
      } else if (e.button === 4) {
        e.preventDefault();
        navigateForward();
      }
    };
    window.addEventListener('mouseup', handleMouseUp);

    const unsubBack = window.electronAPI?.onNavigateBack?.(() => {
      navigateBack();
    });
    const unsubForward = window.electronAPI?.onNavigateForward?.(() => {
      navigateForward();
    });

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      if (unsubBack) unsubBack();
      if (unsubForward) unsubForward();
    };
  }, [navigateBack, navigateForward]);

  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  const saveAppSetting = useCallback(async (key: string, value: unknown, profileIdOverride?: string | null) => {
    let finalKey = key;
    const profId = profileIdOverride !== undefined ? profileIdOverride : activeProfileIdRef.current;
    if (profId && !GLOBAL_KEYS.includes(key)) {
      finalKey = `profile_${profId}_${key}`;
    }
    const newValueStr = typeof value === 'string' ? value : JSON.stringify(value);
    if (localStorage.getItem(finalKey) === newValueStr) {
      return;
    }
    localStorage.setItem(finalKey, newValueStr);

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

  const setTranscodeMode = useCallback((mode: string) => {
    setTranscodeModeState(mode);
    saveAppSetting('cinema_transcode_mode', mode);
  }, [saveAppSetting]);

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
    transcodeMode,
    setTranscodeMode,
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
