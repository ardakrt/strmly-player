import { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  X,
} from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { useSettings } from '../context/SettingsContext';
import {
  countMatches,
  getAutocompleteSuggestions,
  isGroupedSeries,
  type SpotlightMatch,
  type SpotlightScope,
} from './spotlight/spotlightHelpers';
import { useSpotlightHistory } from '../hooks/useSpotlightHistory';
import { useSpotlightFocus } from '../hooks/useSpotlightFocus';
import { SpotlightResults } from './spotlight/SpotlightResults';
import { SpotlightHistoryView } from './spotlight/SpotlightHistoryView';


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

/**
 * Prime-Video style Floating Glass Spotlight Modal Overlay
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
  const { t, language } = useSettings();
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const {
    recentSearches,
    queryHistory,
    saveQuery: saveQueryToHistory,
    removeQuery: removeQueryFromHistory,
    clearQueries: clearAllQueryHistory,
    saveRecent: saveRecentSearch,
    removeRecent: removeRecentItem,
    clearRecent: clearAllRecent,
  } = useSpotlightHistory();
  useSpotlightFocus(showSpotlight, modalContainerRef, modalInputRef);

  const query = spotlightSearchInput.trim();
  const isQueryEmpty = !query;

  const visibleResults = useMemo(
    () => (Array.isArray(spotlightSearchResults) ? spotlightSearchResults.slice(0, 48) : []),
    [spotlightSearchResults],
  );

  // Text Autocomplete Suggestions (Prime Video style)
  const autocompleteSuggestions = useMemo(
    () => getAutocompleteSuggestions(query, visibleResults),
    [visibleResults, query],
  );

  // Result counts by scope type
  const countsByType = useMemo(
    () => countMatches(spotlightSearchResults, query),
    [spotlightSearchResults, query],
  );

  const scopesList = useMemo(
    () =>
      [
        { id: 'all' as const, label: language === 'tr' ? 'Tümü' : 'All', count: countsByType.all },
        { id: 'movie' as const, label: language === 'tr' ? 'Filmler' : 'Movies', count: countsByType.movie },
        { id: 'series' as const, label: language === 'tr' ? 'Diziler' : 'Series', count: countsByType.series },
        { id: 'live' as const, label: language === 'tr' ? 'Canlı TV' : 'Live TV', count: countsByType.live },
      ] as const,
    [language, countsByType],
  );
  const handleSelectResult = useCallback(
    (match: SpotlightMatch) => {
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

  // Keyboard navigation inside modal
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSpotlight, query, saveQueryToHistory, setShowSpotlight, setSpotlightSearchInput]);

  if (!showSpotlight) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowSpotlight(false);
          setSpotlightSearchInput('');
        }
      }}
    >
      {/* Floating Liquid Glass Spotlight Modal Card */}
      <div
        ref={modalContainerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-search-title"
        tabIndex={-1}
        className="spotlight-liquid-glass relative w-full max-w-4xl rounded-[28px] overflow-hidden flex flex-col max-h-[85vh] animate-scale-in my-auto transition-[height,max-height,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <h2 id="spotlight-search-title" className="sr-only">
          {language === 'tr' ? 'İçerik ara' : 'Search content'}
        </h2>
        {/* Modal Top Search Header Bar */}
        <div className="relative z-10 p-4 sm:p-5 border-b border-white/12 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 flex items-center h-11.5 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-xl px-4 focus-within:border-white/35 focus-within:bg-black/40 focus-within:ring-2 focus-within:ring-white/20 transition-all">
              <Search size={17} className="shrink-0 text-white/60" />
              <input
                ref={modalInputRef}
                type="text"
                value={spotlightSearchInput}
                placeholder={language === 'tr' ? 'Dizi, film veya kanal ara…' : 'Search movies, series, channels…'}
                aria-label={language === 'tr' ? 'Arama' : 'Search'}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setSpotlightSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowSpotlight(false);
                  }
                }}
                className="h-full w-full min-w-0 bg-transparent px-3 text-base sm:text-sm font-semibold text-white outline-none placeholder:text-white/40"
              />

              {spotlightSearchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setSpotlightSearchInput('');
                    modalInputRef.current?.focus();
                  }}
                  className="flex items-center gap-1 rounded-full border border-white/15 bg-white/12 px-2.5 py-1 text-xs font-bold text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
                >
                  <X size={12} />
                  <span>{language === 'tr' ? 'Temizle' : 'Clear'}</span>
                </button>
              ) : null}
            </div>

            {/* ESC Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowSpotlight(false);
                setSpotlightSearchInput('');
              }}
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] backdrop-blur-xl px-3.5 py-2 text-xs font-bold text-white/70 hover:bg-white/18 hover:text-white transition cursor-pointer shrink-0"
            >
              <kbd className="rounded-md border border-white/20 bg-white/15 px-1.5 py-0.5 text-xs font-mono font-black text-white">ESC</kbd>
              <span>{language === 'tr' ? 'Kapat' : 'Close'}</span>
            </button>
          </div>

          {/* Scope Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3">
            {scopesList.map((scope) => {
              const isActive = spotlightScope === scope.id;
              return (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setSpotlightScope(scope.id)}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-all duration-300 cursor-pointer  ${
                    isActive
                      ? 'text-white bg-white/[0.12] border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md'
                      : 'text-neutral-400 border border-transparent hover:text-white hover:bg-white/[0.05] backdrop-blur-md'
                  }`}
                >
                  <span>{scope.label}</span>
                  {!isQueryEmpty && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${
                        isActive ? 'bg-white/15 text-white' : 'bg-white/10 text-neutral-400'
                      }`}
                    >
                      {scope.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-modal-scrollbar transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
          {/* Autocomplete Text Suggestions List (Prime Video style) */}
          {!isQueryEmpty && autocompleteSuggestions.length > 0 && (
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-2 space-y-0.5 shadow-lg">
              {autocompleteSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  aria-label={suggestion}
                  onClick={() => {
                    saveQueryToHistory(suggestion);
                    setSpotlightSearchInput(suggestion);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-white/[0.09] transition text-left cursor-pointer group"
                >
                  <Search aria-hidden="true" size={13} className="text-white/40 group-hover:text-white/80 shrink-0" />
                  <span className="text-xs font-bold text-white/85 group-hover:text-white truncate">
                    {suggestion}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!isQueryEmpty ? (
            <SpotlightResults
              query={query}
              results={visibleResults}
              isSearching={isSearchingWorker}
              language={language}
              onSelect={handleSelectResult}
            />
          ) : (
            <SpotlightHistoryView
              language={language}
              emptyPrompt={t('search.emptyPrompt')}
              queryHistory={queryHistory}
              recentSearches={recentSearches}
              onSelectQuery={(term) => {
                saveQueryToHistory(term);
                setSpotlightSearchInput(term);
              }}
              onRemoveQuery={removeQueryFromHistory}
              onClearQueries={clearAllQueryHistory}
              onSelectRecent={handleSelectResult}
              onRemoveRecent={removeRecentItem}
              onClearRecent={clearAllRecent}
            />
          )}
        </div>
      </div>
    </div>
  );
}
