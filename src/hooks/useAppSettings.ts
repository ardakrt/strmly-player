import { useState, useEffect, useRef, useCallback } from 'react';
import type { Language } from '../utils/translations';
export type IptvUpdateMode = 'prompt' | 'silent' | 'manual';
import { getTranslation } from '../utils/translations';
import { GLOBAL_KEYS } from '../constants';
import { getTmdbApiKey } from '../utils/tmdb';

type TranscodeMode = "auto" | "copy" | "full";

const isTranscodeMode = (value: unknown): value is TranscodeMode => (
  value === "auto" || value === "copy" || value === "full"
);

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

  const [transcodeMode, setTranscodeModeState] = useState<TranscodeMode>(() => {
    try {
      const stored = localStorage.getItem('cinema_transcode_mode');
      if (stored) {
        const parsed = stored.startsWith('"') ? JSON.parse(stored) : stored;
        if (isTranscodeMode(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return 'full';
  });

  const [iptvUpdateMode, setIptvUpdateModeState] = useState<IptvUpdateMode>(() => {
    try {
      const stored = localStorage.getItem('cinema_iptv_update_mode');
      if (stored) {
        const parsed = stored.startsWith('"') ? JSON.parse(stored) : stored;
        if (parsed === 'prompt' || parsed === 'silent' || parsed === 'manual') return parsed;
      }
    } catch {
      // Ignore
    }
    return 'silent';
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
    } else {
      setSelectedGroupState((current) => {
        if (current !== 'Ana Sayfa') {
          historyRef.current = ['Ana Sayfa'];
          historyIndexRef.current = 0;
          return 'Ana Sayfa';
        }
        return current;
      });
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
    let lastNavTime = 0;

    const triggerBack = () => {
      const now = Date.now();
      if (now - lastNavTime < 200) return;
      lastNavTime = now;
      navigateBack();
    };

    const triggerForward = () => {
      const now = Date.now();
      if (now - lastNavTime < 200) return;
      lastNavTime = now;
      navigateForward();
    };

    const handleMouseSideButtons = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        triggerBack();
      } else if (e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
        triggerForward();
      }
    };

    window.addEventListener('mousedown', handleMouseSideButtons, true);
    window.addEventListener('mouseup', handleMouseSideButtons, true);
    window.addEventListener('auxclick', handleMouseSideButtons, true);

    const unsubBack = window.electronAPI?.onNavigateBack?.(() => {
      triggerBack();
    });
    const unsubForward = window.electronAPI?.onNavigateForward?.(() => {
      triggerForward();
    });

    return () => {
      window.removeEventListener('mousedown', handleMouseSideButtons, true);
      window.removeEventListener('mouseup', handleMouseSideButtons, true);
      window.removeEventListener('auxclick', handleMouseSideButtons, true);
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

  const setTranscodeMode = useCallback((mode: TranscodeMode) => {
    setTranscodeModeState(mode);
    saveAppSetting('cinema_transcode_mode', mode);
  }, [saveAppSetting]);

  const setIptvUpdateMode = useCallback((mode: IptvUpdateMode) => {
    setIptvUpdateModeState(mode);
    saveAppSetting('cinema_iptv_update_mode', mode);
  }, [saveAppSetting]);

  const loadAppSetting = useCallback(async (key: string, isJson = false, profileIdOverride?: string | null): Promise<any> => {
    let finalKey = key;
    const profId = profileIdOverride !== undefined ? profileIdOverride : activeProfileIdRef.current;
    if (profId && !GLOBAL_KEYS.includes(key)) {
      finalKey = `profile_${profId}_${key}`;
    }

    try {
      if (window.electronAPI && window.electronAPI.loadConfig) {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1200));
        const val = await Promise.race([
          window.electronAPI.loadConfig(finalKey),
          timeoutPromise
        ]);
        if (val !== null && val !== undefined) return val;
      }
    } catch (e) {
      console.warn(`IPC loadConfig error for ${finalKey}:`, e);
    }

    try {
      const stored = localStorage.getItem(finalKey);
      if (!stored) return null;
      if (!isJson) return stored;
      try {
        return JSON.parse(stored);
      } catch {
        return stored;
      }
    } catch (e) {
      console.warn(`localStorage read error for ${finalKey}:`, e);
      return null;
    }
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
    iptvUpdateMode,
    setIptvUpdateMode,
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
    navigateBack,
    navigateForward,
    categorySearchQuery,
    setCategorySearchQuery,
    saveAppSetting,
    loadAppSetting,
    setActiveProfileIdSettings
  };
}
