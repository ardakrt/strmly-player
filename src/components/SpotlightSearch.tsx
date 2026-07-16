import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Film, Tv, Search, X, Layers, Trash2, Clock, LoaderCircle } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { useSettings } from '../context/SettingsContext';
import { cleanMovieName } from '../utils/tmdb';

type SpotlightScope = 'all' | 'live' | 'movie' | 'series';

interface SpotlightSearchProps {
  showSpotlight: boolean;
  setShowSpotlight: (show: boolean) => void;
  spotlightActiveStep: 'select_scope' | 'searching';
  setSpotlightActiveStep: (step: 'select_scope' | 'searching') => void;
  focusedButtonIndex: number;
  setFocusedButtonIndex: (idx: number) => void;
  spotlightScope: SpotlightScope;
  setSpotlightScope: (scope: SpotlightScope) => void;
  spotlightSearchInput: string;
  setSpotlightSearchInput: (val: string) => void;
  spotlightInputRef: React.RefObject<HTMLInputElement | null>;
  spotlightSearchResults: any[];
  isSearchingWorker?: boolean;
  handlePlayStream: (item: PlaylistItem) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  handleOpenSeriesModalDirect: (series: GroupedSeries) => void;
}

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q || !text) return text;

  try {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    if (parts.length === 1) return text;

    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="spotlight-match">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  } catch {
    return text;
  }
}

function typeLabel(type: string, language: 'tr' | 'en'): string {
  if (type === 'series') return language === 'tr' ? 'Dizi' : 'Series';
  if (type === 'movie') return language === 'tr' ? 'Film' : 'Movie';
  return language === 'tr' ? 'Canlı' : 'Live';
}

export function SpotlightSearch({
  showSpotlight,
  setShowSpotlight,
  spotlightScope,
  setSpotlightScope,
  spotlightSearchInput,
  setSpotlightSearchInput,
  spotlightInputRef,
  spotlightSearchResults,
  isSearchingWorker = false,
  handlePlayStream,
  handleOpenDetails,
  handleOpenSeriesModalDirect,
}: SpotlightSearchProps) {
  const { language } = useSettings();
  const [focusedResultIndex, setFocusedResultIndex] = useState(0);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [recentSearches, setRecentSearches] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('strmly_recent_searches:v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const query = spotlightSearchInput.trim();
  const isQueryEmpty = !query;
  const isActiveRecent = isQueryEmpty && recentSearches.length > 0;
  const visibleResults = useMemo(
    () => spotlightSearchResults.slice(0, 50),
    [spotlightSearchResults],
  );
  const activeList = isActiveRecent ? recentSearches : visibleResults;

  const scopesList = useMemo(
    () =>
      [
        { id: 'all' as const, label: language === 'tr' ? 'Tümü' : 'All', icon: Layers },
        { id: 'series' as const, label: language === 'tr' ? 'Diziler' : 'Series', icon: Play },
        { id: 'movie' as const, label: language === 'tr' ? 'Filmler' : 'Movies', icon: Film },
        { id: 'live' as const, label: language === 'tr' ? 'Canlı' : 'Live', icon: Tv },
      ] as const,
    [language],
  );

  useEffect(() => {
    setFocusedResultIndex(0);
  }, [spotlightSearchInput, spotlightScope, isActiveRecent]);

  const scrollIntoView = useCallback((index: number) => {
    const container = resultsContainerRef.current;
    if (!container) return;
    const items = container.querySelectorAll('[data-spotlight-item]');
    const targetItem = items[index] as HTMLElement | undefined;
    targetItem?.scrollIntoView({ block: 'nearest' });
  }, []);

  const saveRecentSearch = useCallback((match: any) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((x) => x.item.id !== match.item.id);
      const updated = [match, ...filtered].slice(0, 8);
      localStorage.setItem('strmly_recent_searches:v1', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((x) => x.item.id !== id);
      localStorage.setItem('strmly_recent_searches:v1', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem('strmly_recent_searches:v1');
  }, []);

  const handleSelectResult = useCallback(
    (match: any) => {
      if (!match) return;
      const { type, item } = match;
      setShowSpotlight(false);
      saveRecentSearch(match);

      if (type === 'live') {
        handlePlayStream(item as PlaylistItem);
      } else if (type === 'movie') {
        handleOpenDetails(item as PlaylistItem);
      } else if (type === 'series') {
        handleOpenSeriesModalDirect(item as GroupedSeries);
      }
    },
    [setShowSpotlight, saveRecentSearch, handlePlayStream, handleOpenDetails, handleOpenSeriesModalDirect],
  );

  const cycleScope = useCallback(
    (direction: 1 | -1) => {
      const ids = scopesList.map((s) => s.id);
      const current = ids.indexOf(spotlightScope);
      const next = (current + direction + ids.length) % ids.length;
      setSpotlightScope(ids[next]);
    },
    [scopesList, spotlightScope, setSpotlightScope],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      cycleScope(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      const idx = Number(e.key) - 1;
      if (scopesList[idx]) setSpotlightScope(scopesList[idx].id);
      return;
    }

    if (activeList.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedResultIndex((prev) => {
        const next = Math.min(prev + 1, activeList.length - 1);
        requestAnimationFrame(() => scrollIntoView(next));
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedResultIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        requestAnimationFrame(() => scrollIntoView(next));
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentMatch = activeList[focusedResultIndex];
      if (currentMatch) handleSelectResult(currentMatch);
    }
  };

  useEffect(() => {
    if (!showSpotlight) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSpotlight]);

  if (!showSpotlight) return null;

  const placeholder =
    spotlightScope === 'all'
      ? language === 'tr'
        ? 'Film, dizi veya kanal ara…'
        : 'Search movies, series or channels…'
      : spotlightScope === 'live'
        ? language === 'tr'
          ? 'Kanal ara…'
          : 'Search channels…'
        : spotlightScope === 'movie'
          ? language === 'tr'
            ? 'Film ara…'
            : 'Search movies…'
          : language === 'tr'
            ? 'Dizi ara…'
            : 'Search series…';

  const resultCountLabel = !isQueryEmpty
    ? isSearchingWorker
      ? language === 'tr'
        ? 'Aranıyor…'
        : 'Searching…'
      : visibleResults.length === 0
        ? language === 'tr'
          ? 'Sonuç yok'
          : 'No results'
        : language === 'tr'
          ? `${visibleResults.length}${spotlightSearchResults.length > 50 ? '+' : ''} sonuç`
          : `${visibleResults.length}${spotlightSearchResults.length > 50 ? '+' : ''} results`
    : isActiveRecent
      ? language === 'tr'
        ? `${recentSearches.length} kayıt`
        : `${recentSearches.length} saved`
      : null;

  const renderResultRow = (match: any, idx: number, mode: 'result' | 'recent') => {
    const type = match.type as string;
    const item = match.item;
    const isLive = type === 'live';
    const isSeries = type === 'series';
    const isFocused = focusedResultIndex === idx;

    let logoSrc: string;
    let titleName: string;
    let subtext: string;

    if (isSeries) {
      const series = item as GroupedSeries;
      logoSrc = series.logo || '';
      titleName = cleanMovieName(series.name);
      const seasonsCount = Object.keys(series.seasons || {}).length;
      subtext =
        mode === 'recent'
          ? typeLabel('series', language)
          : language === 'tr'
            ? `${seasonsCount} sezon · ${series.episodesCount} bölüm`
            : `${seasonsCount} season${seasonsCount > 1 ? 's' : ''} · ${series.episodesCount} ep.`;
    } else {
      const plItem = item as PlaylistItem;
      logoSrc = plItem.logo || '';
      titleName = plItem.type === 'movie' ? cleanMovieName(plItem.name) : plItem.name;
      subtext =
        mode === 'recent'
          ? typeLabel(type, language)
          : plItem.group || typeLabel(type, language);
    }

    const actionHint =
      type === 'live'
        ? language === 'tr'
          ? 'İzle'
          : 'Watch'
        : language === 'tr'
          ? 'Aç'
          : 'Open';

    return (
      <div
        key={`${mode}-${type}-${item.id}-${idx}`}
        data-spotlight-item
        role="option"
        aria-selected={isFocused}
        tabIndex={-1}
        onClick={() => handleSelectResult(match)}
        onMouseEnter={() => setFocusedResultIndex(idx)}
        className={`spotlight-row group ${isFocused ? 'is-active' : ''}`}
      >
        <div className={`spotlight-thumb ${isLive ? 'spotlight-thumb--live' : 'spotlight-thumb--vod'}`}>
          <ImageWithFallback
            src={logoSrc}
            name={titleName}
            group={subtext}
            size="sm"
            itemType={type as 'live' | 'movie' | 'series'}
          />
          {isLive && (
            <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`truncate text-[13px] tracking-tight ${
                isFocused ? 'font-bold text-white' : 'font-semibold text-white/78'
              }`}
            >
              {mode === 'result' ? highlightMatch(titleName, query) : titleName}
            </span>
            <span className={`spotlight-type-chip ${isLive ? 'spotlight-type-chip--live' : ''}`}>
              {isLive && (
                <span className="relative flex h-1 w-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-emerald-400" />
                </span>
              )}
              {typeLabel(type, language)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium text-white/32">{subtext}</p>
        </div>

        {mode === 'recent' ? (
          <button
            type="button"
            onClick={(e) => removeRecentSearch(e, item.id)}
            className={`shrink-0 grid h-7 w-7 place-items-center rounded-full text-white/25 hover:text-white/75 hover:bg-white/[0.07] transition-colors cursor-pointer ${
              isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            title={language === 'tr' ? 'Kaldır' : 'Remove'}
            aria-label={language === 'tr' ? 'Kaldır' : 'Remove'}
          >
            <Trash2 size={12} />
          </button>
        ) : (
          <span className="spotlight-action">
            {actionHint}
            <span className="opacity-50 text-[9px]">↵</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className="spotlight-backdrop fixed inset-0 z-[100] flex items-start justify-center pt-[min(12vh,100px)] px-4 pb-8 animate-fade-in"
      onClick={() => setShowSpotlight(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowSpotlight(false);
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={language === 'tr' ? 'İçerik ara' : 'Search content'}
        className="spotlight-panel relative w-full max-w-[580px] flex flex-col overflow-hidden rounded-[22px] glass-slide-up max-h-[min(74vh,660px)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="relative z-[1] shrink-0 px-4 pt-4 pb-3">
          <div className="mb-3 flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Strmly
              </span>
              <span className="h-0.5 w-0.5 rounded-full bg-white/20" />
              <span className="truncate text-[11px] font-medium text-white/45">
                {language === 'tr' ? 'Hızlı arama' : 'Quick search'}
              </span>
            </div>
            {resultCountLabel && (
              <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/28">
                {resultCountLabel}
              </span>
            )}
          </div>

          <div className="spotlight-field">
            {isSearchingWorker && query ? (
              <LoaderCircle size={16} className="shrink-0 text-white/40 animate-spin" />
            ) : (
              <Search size={16} className="shrink-0 text-white/38" />
            )}
            <input
              ref={spotlightInputRef}
              type="text"
              placeholder={placeholder}
              value={spotlightSearchInput}
              onChange={(e) => setSpotlightSearchInput(e.target.value)}
              className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/28 font-medium tracking-tight"
              autoComplete="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls="spotlight-results"
            />
            {spotlightSearchInput ? (
              <button
                type="button"
                onClick={() => {
                  setSpotlightSearchInput('');
                  spotlightInputRef.current?.focus();
                }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/35 hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
                aria-label={language === 'tr' ? 'Temizle' : 'Clear'}
              >
                <X size={13} />
              </button>
            ) : (
              <kbd className="spotlight-kbd hidden sm:inline-flex">ESC</kbd>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1 overflow-x-auto hide-scrollbar">
            {scopesList.map((scope) => {
              const Icon = scope.icon;
              const isActive = spotlightScope === scope.id;
              return (
                <button
                  type="button"
                  key={scope.id}
                  onClick={() => setSpotlightScope(scope.id)}
                  className={`spotlight-scope ${isActive ? 'is-active' : ''}`}
                >
                  <Icon size={12} strokeWidth={isActive ? 2.25 : 1.75} />
                  <span>{scope.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-4 h-px shrink-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        {/* Results */}
        <div
          id="spotlight-results"
          ref={resultsContainerRef}
          role="listbox"
          className="relative z-[1] flex-1 overflow-y-auto custom-modal-scrollbar px-2.5 py-2.5 min-h-[190px]"
        >
          {isQueryEmpty ? (
            isActiveRecent ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between px-2.5 pb-1.5 pt-0.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                    <Clock size={11} />
                    {language === 'tr' ? 'Son aramalar' : 'Recent'}
                  </span>
                  <button
                    type="button"
                    onClick={clearAllRecent}
                    className="text-[10px] font-medium text-white/28 hover:text-white/55 transition-colors cursor-pointer"
                  >
                    {language === 'tr' ? 'Temizle' : 'Clear'}
                  </button>
                </div>
                {recentSearches.map((match, idx) => renderResultRow(match, idx, 'recent'))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center select-none">
                <div className="spotlight-empty-orb mb-4">
                  <Search size={18} />
                </div>
                <p className="text-[13px] font-semibold tracking-tight text-white/72">
                  {language === 'tr' ? 'Ne arıyorsun?' : 'What are you looking for?'}
                </p>
                <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-white/32">
                  {language === 'tr'
                    ? 'Film, dizi veya kanal adını yaz. Filtrelerle daraltabilirsin.'
                    : 'Type a title or channel. Use filters to narrow results.'}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                  {scopesList.slice(1).map((scope) => {
                    const Icon = scope.icon;
                    return (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => setSpotlightScope(scope.id)}
                        className="spotlight-scope border border-white/[0.08] bg-white/[0.03]"
                      >
                        <Icon size={11} />
                        {scope.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ) : isSearchingWorker && visibleResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 select-none">
              <LoaderCircle size={20} className="mb-3 animate-spin text-white/30" />
              <p className="text-[12px] font-medium text-white/35">
                {language === 'tr' ? 'Aranıyor…' : 'Searching…'}
              </p>
            </div>
          ) : visibleResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center select-none">
              <div className="spotlight-empty-orb mb-4 text-white/35">
                <X size={16} />
              </div>
              <p className="text-[13px] font-semibold tracking-tight text-white/72">
                {language === 'tr' ? 'Sonuç bulunamadı' : 'No results'}
              </p>
              <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-white/32">
                {language === 'tr'
                  ? `“${query}” için eşleşme yok. Filtreyi veya yazımı dene.`
                  : `Nothing matches “${query}”. Try another filter or spelling.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {visibleResults.map((match, idx) => renderResultRow(match, idx, 'result'))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="spotlight-footer relative z-[1] flex items-center justify-between gap-3 px-4 py-2.5 shrink-0 select-none">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-white/28">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="spotlight-kbd">↑↓</kbd>
              {language === 'tr' ? 'Gezin' : 'Move'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="spotlight-kbd">↵</kbd>
              {language === 'tr' ? 'Seç' : 'Select'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <kbd className="spotlight-kbd">Ctrl 1-4</kbd>
              {language === 'tr' ? 'Filtre' : 'Filter'}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-white/28">
            <kbd className="spotlight-kbd">ESC</kbd>
            {language === 'tr' ? 'Kapat' : 'Close'}
          </span>
        </div>
      </div>
    </div>
  );
}
