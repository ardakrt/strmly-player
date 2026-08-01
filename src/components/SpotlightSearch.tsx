import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LoaderCircle,
  Search,
  Tv,
  Film,
  Radio,
  Play,
  Trash2,
  ChevronRight,
  CornerDownLeft,
  ArrowUpDown,
  Clock,
  Sparkles,
  History,
  X,
} from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { useSettings } from '../context/SettingsContext';
import { cleanMovieName } from '../utils/tmdb';

type SpotlightScope = 'all' | 'live' | 'movie' | 'series';

interface SpotlightSearchProps {
  showSpotlight: boolean;
  setShowSpotlight: (show: boolean) => void;
  spotlightScope: SpotlightScope;
  setSpotlightScope: (scope: SpotlightScope) => void;
  spotlightSearchInput: string;
  setSpotlightSearchInput: (val: string) => void;
  spotlightSearchResults: any[];
  isSearchingWorker?: boolean;
  handlePlayStream: (item: PlaylistItem) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  handleOpenSeriesModalDirect: (series: GroupedSeries) => void;
}

function typeLabel(type: string, language: 'tr' | 'en'): string {
  if (type === 'series') return language === 'tr' ? 'Dizi' : 'Series';
  if (type === 'movie') return language === 'tr' ? 'Film' : 'Movie';
  return language === 'tr' ? 'Canlı' : 'Live';
}

function isGroupedSeries(item: any): item is GroupedSeries {
  return Boolean(
    item &&
      typeof item === 'object' &&
      item.seasons &&
      typeof item.seasons === 'object' &&
      !Array.isArray(item.seasons),
  );
}

function resultTitle(match: { type?: string; item?: any }): string {
  if (!match?.item) return '';
  try {
    if (match.type === 'series') {
      return cleanMovieName(String(match.item.name || '')) || String(match.item.name || '');
    }
    const pl = match.item as PlaylistItem;
    return pl.type === 'movie' ? cleanMovieName(pl.name) : String(pl.name || '');
  } catch {
    return String(match.item?.name || '');
  }
}

function resultLogo(match: { type?: string; item?: any }): string {
  return String(match?.item?.logo || '');
}

function getGridColumns(): number {
  if (typeof window === 'undefined') return 6;
  const w = window.innerWidth;
  if (w < 520) return 2;
  if (w < 760) return 3;
  if (w < 1024) return 4;
  if (w < 1280) return 5;
  if (w < 1600) return 6;
  return 7;
}

function sanitizeRecentList(raw: unknown): any[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      if (!entry.type || !entry.item || !entry.item.id || !entry.item.name) return false;
      if (entry.type === 'series') {
        return isGroupedSeries(entry.item) || Boolean(entry.item._flat?.id);
      }
      return entry.type === 'movie' || entry.type === 'live';
    })
    .slice(0, 18);
}

function toRecentEntry(match: any) {
  if (!match?.item || !match?.type) return null;
  const type = match.type as string;

  if (type === 'series' && isGroupedSeries(match.item)) {
    const series = match.item as GroupedSeries;
    const seasonKeys = Object.keys(series.seasons || {}).map(Number).sort((a, b) => a - b);
    const firstSeason = seasonKeys[0];
    const firstEp = firstSeason != null ? series.seasons[firstSeason]?.[0]?.item : null;
    return {
      type: 'series' as const,
      item: {
        id: series.id,
        name: series.name,
        logo: series.logo,
        group: series.group,
        type: 'series' as const,
        seasons: series.seasons,
        episodesCount: series.episodesCount,
        _flat: firstEp
          ? {
              id: firstEp.id,
              name: firstEp.name,
              logo: firstEp.logo,
              group: firstEp.group,
              type: firstEp.type,
              url: firstEp.url,
            }
          : null,
      },
    };
  }

  if (type === 'movie' || type === 'live') {
    const pl = match.item as PlaylistItem;
    return {
      type,
      item: {
        id: pl.id,
        name: pl.name,
        logo: pl.logo,
        group: pl.group,
        type: pl.type,
        url: pl.url,
        isGenericLogo: pl.isGenericLogo,
      },
    };
  }

  return null;
}

/**
 * Ultra-minimalist full-screen search view (with search text history & clicked items history).
 */
export function SpotlightSearch({
  showSpotlight,
  setShowSpotlight,
  spotlightScope,
  setSpotlightScope,
  spotlightSearchInput,
  setSpotlightSearchInput,
  spotlightSearchResults,
  isSearchingWorker = false,
  handlePlayStream,
  handleOpenDetails,
  handleOpenSeriesModalDirect,
}: SpotlightSearchProps) {
  const { language } = useSettings();
  const [focusedResultIndex, setFocusedResultIndex] = useState(-1);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [gridCols, setGridCols] = useState(getGridColumns);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Clicked media item history
  const [recentSearches, setRecentSearches] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('strmly_recent_searches:v1');
      return sanitizeRecentList(saved ? JSON.parse(saved) : []);
    } catch {
      return [];
    }
  });

  // Text search query history
  const [queryHistory, setQueryHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('strmly_search_query_history:v1');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.filter((x) => typeof x === 'string' && x.trim()).slice(0, 15)
        : [];
    } catch {
      return [];
    }
  });

  const query = spotlightSearchInput.trim();
  const isQueryEmpty = !query;

  const visibleResults = useMemo(
    () => (Array.isArray(spotlightSearchResults) ? spotlightSearchResults.slice(0, 84) : []),
    [spotlightSearchResults],
  );

  const displayList = useMemo(() => {
    if (!isQueryEmpty) return visibleResults;
    return recentSearches;
  }, [isQueryEmpty, visibleResults, recentSearches]);

  const scopesList = useMemo(
    () =>
      [
        { id: 'all' as const, label: language === 'tr' ? 'Tümü' : 'All' },
        { id: 'series' as const, label: language === 'tr' ? 'Diziler' : 'Series' },
        { id: 'movie' as const, label: language === 'tr' ? 'Filmler' : 'Movies' },
        { id: 'live' as const, label: language === 'tr' ? 'Canlı' : 'Live' },
      ] as const,
    [language],
  );

  const quickCategories = useMemo(
    () => [
      {
        id: 'action',
        title: language === 'tr' ? 'Aksiyon & Macera' : 'Action & Adventure',
        query: 'Aksiyon',
        icon: Film,
      },
      {
        id: 'comedy',
        title: language === 'tr' ? 'Komedi' : 'Comedy',
        query: 'Komedi',
        icon: Sparkles,
      },
      {
        id: 'series-hub',
        title: language === 'tr' ? 'Diziler' : 'Series',
        scope: 'series' as const,
        query: '',
        icon: Tv,
      },
      {
        id: 'movies-hub',
        title: language === 'tr' ? 'Filmler' : 'Movies',
        scope: 'movie' as const,
        query: '',
        icon: Film,
      },
      {
        id: 'live-sports',
        title: language === 'tr' ? 'Canlı TV' : 'Live TV',
        scope: 'live' as const,
        query: '',
        icon: Radio,
      },
      {
        id: 'hd-content',
        title: language === 'tr' ? '4K / Ultra HD' : '4K / Ultra HD',
        query: '4K',
        icon: Search,
      },
    ],
    [language],
  );

  const quickTags = useMemo(
    () => [
      '4K',
      'Aksiyon',
      'Komedi',
      'Marvel',
      'HBO',
      'Netflix',
      'Süper Lig',
      'Formula 1',
      'Belgesel',
      'Animasyon',
    ],
    [],
  );

  const suggestionChips = useMemo(() => {
    if (isQueryEmpty || visibleResults.length === 0) return [];
    const seen = new Set<string>();
    const chips: string[] = [];
    for (const match of visibleResults) {
      const title = resultTitle(match).trim();
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key) || key === query.toLowerCase()) continue;
      seen.add(key);
      chips.push(title);
      if (chips.length >= 8) break;
    }
    return chips;
  }, [isQueryEmpty, visibleResults, query]);

  useEffect(() => {
    setFocusedResultIndex(-1);
    setKeyboardNav(false);
  }, [spotlightSearchInput, spotlightScope, query]);

  useEffect(() => {
    if (!showSpotlight) {
      setFocusedResultIndex(-1);
      setKeyboardNav(false);
    }
  }, [showSpotlight]);

  useEffect(() => {
    const onResize = () => setGridCols(getGridColumns());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scrollIntoView = useCallback((index: number) => {
    const container = resultsContainerRef.current;
    if (!container) return;
    const items = container.querySelectorAll('[data-spotlight-item]');
    (items[index] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, []);

  // Text search history handlers
  const saveQueryToHistory = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setQueryHistory((prev) => {
      const filtered = prev.filter((q) => q.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 15);
      try {
        localStorage.setItem('strmly_search_query_history:v1', JSON.stringify(updated));
      } catch {
        /* quota */
      }
      return updated;
    });
  }, []);

  const removeQueryFromHistory = useCallback((term: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setQueryHistory((prev) => {
      const updated = prev.filter((q) => q.toLowerCase() !== term.toLowerCase());
      try {
        localStorage.setItem('strmly_search_query_history:v1', JSON.stringify(updated));
      } catch {
        /* quota */
      }
      return updated;
    });
  }, []);

  const clearAllQueryHistory = useCallback(() => {
    setQueryHistory([]);
    localStorage.removeItem('strmly_search_query_history:v1');
  }, []);

  // Media item history handlers
  const saveRecentSearch = useCallback((match: any) => {
    const entry = toRecentEntry(match);
    if (!entry) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((x) => x.item?.id !== entry.item.id);
      const updated = [entry, ...filtered].slice(0, 18);
      try {
        localStorage.setItem('strmly_recent_searches:v1', JSON.stringify(updated));
      } catch {
        /* quota */
      }
      return updated;
    });
  }, []);

  const removeRecentItem = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((x) => String(x.item?.id) !== String(id));
      try {
        localStorage.setItem('strmly_recent_searches:v1', JSON.stringify(updated));
      } catch {
        /* quota */
      }
      return updated;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem('strmly_recent_searches:v1');
  }, []);

  const handleSelectResult = useCallback(
    (match: any) => {
      if (!match?.item || !match?.type) return;
      const { type, item } = match;

      if (query) {
        saveQueryToHistory(query);
      }
      saveRecentSearch(match);
      setShowSpotlight(false);
      setSpotlightSearchInput('');

      try {
        if (type === 'live') {
          handlePlayStream(item as PlaylistItem);
          return;
        }
        if (type === 'movie') {
          handleOpenDetails(item as PlaylistItem);
          return;
        }
        if (type === 'series') {
          if (isGroupedSeries(item) && Object.keys(item.seasons).length > 0) {
            handleOpenSeriesModalDirect(item);
            return;
          }
          const flat = item._flat as PlaylistItem | undefined;
          if (flat?.id) {
            handleOpenDetails(flat);
            return;
          }
          handleOpenDetails({
            id: String(item.id),
            name: String(item.name || ''),
            logo: item.logo || '',
            group: item.group || '',
            type: 'series',
            url: '',
          });
        }
      } catch (err) {
        console.error('[search] open failed', err);
      }
    },
    [
      query,
      saveQueryToHistory,
      saveRecentSearch,
      setShowSpotlight,
      setSpotlightSearchInput,
      handlePlayStream,
      handleOpenDetails,
      handleOpenSeriesModalDirect,
    ],
  );

  const moveFocus = useCallback(
    (next: number) => {
      if (displayList.length === 0) return;
      const clamped = Math.max(0, Math.min(next, displayList.length - 1));
      setKeyboardNav(true);
      setFocusedResultIndex(clamped);
      requestAnimationFrame(() => scrollIntoView(clamped));
    },
    [displayList.length, scrollIntoView],
  );

  useEffect(() => {
    if (!showSpotlight) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSpotlight(false);
        setSpotlightSearchInput('');
        return;
      }
      if (e.key === 'Enter' && query) {
        saveQueryToHistory(query);
      }
      if (displayList.length === 0) return;
      const cols = gridCols;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'ArrowDown' && inField) {
        e.preventDefault();
        moveFocus(0);
        return;
      }
      if (inField) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveFocus(focusedResultIndex < 0 ? 0 : focusedResultIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveFocus(focusedResultIndex < 0 ? 0 : focusedResultIndex - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveFocus(focusedResultIndex < 0 ? 0 : focusedResultIndex + cols);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveFocus(focusedResultIndex < 0 ? 0 : focusedResultIndex - cols);
      } else if (e.key === 'Enter' && keyboardNav && focusedResultIndex >= 0) {
        e.preventDefault();
        const m = displayList[focusedResultIndex];
        if (m) handleSelectResult(m);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    showSpotlight,
    displayList,
    gridCols,
    focusedResultIndex,
    keyboardNav,
    moveFocus,
    handleSelectResult,
    setShowSpotlight,
    setSpotlightSearchInput,
    query,
    saveQueryToHistory,
  ]);

  if (!showSpotlight) return null;

  const renderCard = (match: any, idx: number, mode: 'result' | 'recent') => {
    if (!match?.item) return null;
    const type = String(match.type || '');
    const item = match.item;
    const isLive = type === 'live';
    const isFocused = keyboardNav && focusedResultIndex === idx;
    const titleName = resultTitle(match);
    const logoSrc = resultLogo(match);
    const artType: 'live' | 'movie' | 'series' =
      type === 'live' || type === 'series' ? type : 'movie';
    const group =
      type === 'series'
        ? typeLabel('series', language)
        : (item as PlaylistItem).group || typeLabel(type, language);

    const isPortrait = type === 'movie' || type === 'series';

    return (
      <div
        key={`${mode}-${type}-${item.id}-${idx}`}
        data-spotlight-item
        role="option"
        aria-selected={isFocused}
        tabIndex={-1}
        onClick={() => handleSelectResult(match)}
        onMouseEnter={() => {
          setKeyboardNav(false);
          setFocusedResultIndex(idx);
        }}
        className={`group relative block w-full cursor-pointer rounded-lg border-0 bg-transparent p-0 text-left outline-none transition-transform duration-150 ${
          isFocused ? 'z-[2] scale-[1.03]' : 'hover:z-[2] hover:scale-[1.03]'
        }`}
      >
        <div
          className={`relative overflow-hidden rounded-lg bg-[#141416] border transition-all duration-150 ${
            isPortrait ? 'aspect-[2/3]' : 'aspect-video'
          } ${
            isFocused
              ? 'border-white/60 shadow-[0_8px_24px_rgba(0,0,0,0.6)] ring-1 ring-white/30'
              : 'border-white/10 group-hover:border-white/30 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]'
          }`}
        >
          <ImageWithFallback
            src={logoSrc}
            name={titleName || '—'}
            group={group}
            itemType={artType}
            aspect={isPortrait ? 'portrait' : 'landscape'}
            cover
            fallbackToPlaylist
            lazy={false}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

          {/* Type Badge */}
          {isLive ? (
            <span className="absolute left-2 top-2 z-[2] inline-flex h-4.5 items-center rounded bg-[#e50914] px-1.5 text-[9px] font-bold uppercase tracking-wide text-white">
              {language === 'tr' ? 'Canlı' : 'Live'}
            </span>
          ) : (
            <span className="absolute right-2 top-2 z-[2] inline-flex h-4.5 items-center rounded border border-white/15 bg-black/60 px-1.5 text-[9px] font-medium text-white/80">
              {typeLabel(type, language)}
            </span>
          )}

          {/* Remove Recent Item Action */}
          {mode === 'recent' && (
            <button
              type="button"
              onClick={(e) => removeRecentItem(String(item.id), e)}
              title={language === 'tr' ? 'Geçmişten Kaldır' : 'Remove from history'}
              aria-label={language === 'tr' ? 'Geçmişten Kaldır' : 'Remove from history'}
              className="absolute left-2 top-2 z-[3] grid h-5.5 w-5.5 place-items-center rounded-full border border-white/15 bg-black/70 text-white/60 opacity-0 transition-all hover:bg-white hover:text-black group-hover:opacity-100 cursor-pointer"
            >
              <Trash2 size={10} />
            </button>
          )}

          {/* Play Icon on hover */}
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white">
              <Play size={14} className="ml-0.5 fill-white text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-2.5">
            <span className="line-clamp-2 text-xs font-semibold leading-snug text-white drop-shadow">
              {titleName}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const noResultsTips =
    language === 'tr'
      ? [
          'Farklı kelimeler deneyin',
          'Bir film, dizi veya kanal adı yazın',
          'Örnek: "Marvel", "HBO", "Formula 1" veya "4K"',
        ]
      : [
          'Try different keywords',
          'Type a movie, series, or channel name',
          'Examples: "Marvel", "HBO", "Formula 1", or "4K"',
        ];

  return (
    <div className="animate-fade-in w-full select-none pb-12 pt-1">
      {/* Top Header: Scopes + Hotkeys */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        {/* Scope Filter Pills */}
        <div
          className="flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label={language === 'tr' ? 'Filtre' : 'Filter'}
        >
          {scopesList.map((scope) => {
            const isActive = spotlightScope === scope.id;
            return (
              <button
                key={scope.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSpotlightScope(scope.id)}
                className={`h-7.5 rounded-full px-3.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white text-black font-semibold'
                    : 'border border-white/10 bg-transparent text-white/60 hover:border-white/25 hover:text-white'
                }`}
              >
                {scope.label}
              </button>
            );
          })}
        </div>

        {/* Keyboard Hints */}
        <div className="hidden sm:flex items-center gap-2.5 text-[11px] text-white/40">
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/70">
              ESC
            </kbd>
            <span>{language === 'tr' ? 'Kapat' : 'Close'}</span>
          </div>
          <span className="text-white/15">•</span>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/70">
              <ArrowUpDown size={10} className="inline" />
            </kbd>
            <span>{language === 'tr' ? 'Gezin' : 'Navigate'}</span>
          </div>
          <span className="text-white/15">•</span>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/70">
              <CornerDownLeft size={10} className="inline" />
            </kbd>
            <span aria-label={language === 'tr' ? 'Aç' : 'Open'}>{language === 'tr' ? 'Aç' : 'Open'}</span>
          </div>
        </div>
      </div>

      {/* Suggestion Chips when typing */}
      {suggestionChips.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-white/45">
            {language === 'tr' ? 'İlgili aramalar:' : 'Related searches:'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {suggestionChips.map((chip) => (
              <button
                key={chip}
                type="button"
                aria-label={chip}
                onClick={() => {
                  saveQueryToHistory(chip);
                  setSpotlightSearchInput(chip);
                }}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/80 transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-white cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content Container */}
      <div ref={resultsContainerRef}>
        {!isQueryEmpty && isSearchingWorker && visibleResults.length === 0 ? (
          <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-2.5 text-center text-white/40">
            <LoaderCircle size={22} className="animate-spin text-white/60" />
            <p className="m-0 text-xs font-medium">{language === 'tr' ? 'Aranıyor…' : 'Searching…'}</p>
          </div>
        ) : !isQueryEmpty && visibleResults.length === 0 ? (
          /* Empty search result block */
          <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-start justify-center gap-4 px-4 py-8">
            <p className="m-0 text-sm font-medium text-white/80">
              {language === 'tr'
                ? `“${query}” aramanızla eşleşen içerik bulunamadı.`
                : `No matches found for “${query}”.`}
            </p>
            <div className="text-xs text-white/50">
              <p className="m-0 mb-1.5 font-semibold text-white/70">
                {language === 'tr' ? 'Öneriler:' : 'Suggestions:'}
              </p>
              <ul className="m-0 list-disc space-y-1 pl-4">
                {noResultsTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : isQueryEmpty ? (
          /* Initial Clean State (No search input typed) */
          <div className="space-y-8">
            {/* Search Query Text History */}
            {queryHistory.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
                    <History size={13} />
                    <span>{language === 'tr' ? 'Arama Geçmişi' : 'Search History'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearAllQueryHistory}
                    className="text-xs font-medium text-white/40 transition hover:text-rose-400 cursor-pointer"
                  >
                    {language === 'tr' ? 'Tümünü Temizle' : 'Clear All'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {queryHistory.map((term) => (
                    <div
                      key={term}
                      onClick={() => {
                        saveQueryToHistory(term);
                        setSpotlightSearchInput(term);
                      }}
                      className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] pl-3 pr-2 py-1 text-xs font-medium text-white/80 transition-all hover:border-white/25 hover:bg-white/[0.07] hover:text-white cursor-pointer"
                    >
                      <Clock size={12} className="text-white/40 group-hover:text-white/70" />
                      <span>{term}</span>
                      <button
                        type="button"
                        onClick={(e) => removeQueryFromHistory(term, e)}
                        title={language === 'tr' ? 'Geçmişten sil' : 'Remove from history'}
                        aria-label={language === 'tr' ? `${term} aramasını geçmişten sil` : `Remove ${term} from search history`}
                        className="grid h-4 w-4 place-items-center rounded-full text-white/30 hover:bg-white/20 hover:text-white transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clicked Media Items History Section */}
            {recentSearches.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
                    <Clock size={13} />
                    <span>{language === 'tr' ? 'Son İzlenen / Açılan İçerikler' : 'Recently Opened'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearAllRecent}
                    className="text-xs font-medium text-white/40 transition hover:text-white cursor-pointer"
                  >
                    {language === 'tr' ? 'Temizle' : 'Clear'}
                  </button>
                </div>
                <div
                  className="grid gap-2.5"
                  style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                  role="listbox"
                  aria-label={language === 'tr' ? 'Son aramalar' : 'Recent searches'}
                >
                  {recentSearches.map((match, idx) => renderCard(match, idx, 'recent'))}
                </div>
              </div>
            )}

            {/* Clean Quick Discovery Categories */}
            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-white/60">
                {language === 'tr' ? 'Hızlı Keşfet' : 'Quick Discovery'}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {quickCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        if (cat.scope) setSpotlightScope(cat.scope);
                        if (cat.query) {
                          saveQueryToHistory(cat.query);
                          setSpotlightSearchInput(cat.query);
                        }
                      }}
                      className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-all hover:border-white/25 hover:bg-white/[0.06] cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className="text-white/60 group-hover:text-white transition-colors" />
                        <span className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors">
                          {cat.title}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-white/30 group-hover:text-white transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trending Tags */}
            <div>
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-white/60">
                {language === 'tr' ? 'Popüler Etiketler' : 'Trending Tags'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-label={`#${tag}`}
                    onClick={() => {
                      saveQueryToHistory(tag);
                      setSpotlightSearchInput(tag);
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs font-medium text-white/70 transition-all hover:border-white/30 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Results Grid */
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="m-0 text-sm font-bold text-white/90">
                {language === 'tr' ? `“${query}” sonuçları` : `Results for “${query}”`}
              </h2>
              <span className="text-xs text-white/40">
                {visibleResults.length}
                {spotlightSearchResults.length > 84 ? '+' : ''}{' '}
                {language === 'tr' ? 'sonuç' : 'results'}
              </span>
            </div>
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
              role="listbox"
              aria-label={language === 'tr' ? 'Arama sonuçları' : 'Search results'}
            >
              {displayList.map((match, idx) => renderCard(match, idx, 'result'))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
