import React, { useState, useEffect, useRef } from 'react';
import { Play, Film, Tv, Search, X, ChevronRight, Layers, Mic, Trash2, Clock, Volume2 } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { useSettings } from '../context/SettingsContext';
import { cleanMovieName } from '../utils/tmdb';

interface SpotlightSearchProps {
  showSpotlight: boolean;
  setShowSpotlight: (show: boolean) => void;
  spotlightActiveStep: 'select_scope' | 'searching';
  setSpotlightActiveStep: (step: 'select_scope' | 'searching') => void;
  focusedButtonIndex: number;
  setFocusedButtonIndex: (idx: number) => void;
  spotlightScope: 'all' | 'live' | 'movie' | 'series';
  setSpotlightScope: (scope: 'all' | 'live' | 'movie' | 'series') => void;
  spotlightSearchInput: string;
  setSpotlightSearchInput: (val: string) => void;
  spotlightInputRef: React.RefObject<HTMLInputElement | null>;
  spotlightSearchResults: any[];
  handlePlayStream: (item: PlaylistItem) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  handleOpenSeriesModalDirect: (series: GroupedSeries) => void;
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
  handlePlayStream,
  handleOpenDetails,
  handleOpenSeriesModalDirect
}: SpotlightSearchProps) {
  const { language, onShowToast } = useSettings();
  const [focusedResultIndex, setFocusedResultIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Recent Searches state
  const [recentSearches, setRecentSearches] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('strmly_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isActiveRecent = !spotlightSearchInput.trim() && recentSearches.length > 0;
  const activeList = isActiveRecent ? recentSearches : spotlightSearchResults;

  // Reset focused result when search query or category scope changes
  useEffect(() => {
    setFocusedResultIndex(0);
  }, [spotlightSearchInput, spotlightScope]);

  if (!showSpotlight) return null;

  const scopesList: { id: 'all' | 'series' | 'movie' | 'live'; label: string; icon: any }[] = [
    { id: 'all', label: language === 'tr' ? 'Tümü' : 'All', icon: Layers },
    { id: 'series', label: language === 'tr' ? 'Diziler' : 'Series', icon: Play },
    { id: 'movie', label: language === 'tr' ? 'Filmler' : 'Movies', icon: Film },
    { id: 'live', label: language === 'tr' ? 'Canlı TV' : 'Live TV', icon: Tv }
  ];

  const saveRecentSearch = (match: any) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(x => x.item.id !== match.item.id);
      const updated = [match, ...filtered].slice(0, 6);
      localStorage.setItem('strmly_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecentSearch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(x => x.item.id !== id);
      localStorage.setItem('strmly_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('strmly_recent_searches');
  };

  const handleSelectResult = (match: any) => {
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
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onShowToast(language === 'tr' ? 'Tarayıcınız sesli aramayı desteklemiyor.' : 'Voice search is not supported in this browser.');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'tr' ? 'tr-TR' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setSpotlightSearchInput(speechToText);
    };

    recognition.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (activeList.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedResultIndex(prev => {
        const next = Math.min(prev + 1, activeList.length - 1);
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedResultIndex(prev => {
        const next = Math.max(prev - 1, 0);
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentMatch = activeList[focusedResultIndex];
      if (currentMatch) {
        handleSelectResult(currentMatch);
      }
    }
  };

  const scrollIntoView = (index: number) => {
    const container = resultsContainerRef.current;
    if (!container) return;
    const items = container.querySelectorAll(isActiveRecent ? '.recent-item' : '.result-item');
    const targetItem = items[index] as HTMLElement;
    if (!targetItem) return;

    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const elemTop = targetItem.offsetTop;
    const elemBottom = elemTop + targetItem.clientHeight;

    if (elemTop < containerTop) {
      container.scrollTop = elemTop;
    } else if (elemBottom > containerBottom) {
      container.scrollTop = elemBottom - container.clientHeight;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={() => setShowSpotlight(false)}
    >
      <div
        className="relative w-full max-w-3xl bg-neutral-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden glass-slide-up max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input container */}
        <div className="relative flex items-center p-4 border-b border-white/5 shrink-0 gap-3">
          <Search size={18} className="text-[var(--accent-color)] shrink-0 ml-1" />
          <input
            ref={spotlightInputRef}
            type="text"
            placeholder={
              spotlightScope === 'all'
                ? (language === 'tr' ? 'Film, dizi veya canlı TV kanalı ara...' : 'Search movies, series or live channels...')
                : spotlightScope === 'live'
                  ? (language === 'tr' ? 'Canlı TV kanalı ara...' : 'Search live TV channels...')
                  : spotlightScope === 'movie'
                    ? (language === 'tr' ? 'Sinema filmi ara...' : 'Search movies...')
                    : (language === 'tr' ? 'Televizyon dizisi ara...' : 'Search TV series...')
            }
            value={spotlightSearchInput}
            onChange={(e) => setSpotlightSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-white outline-none placeholder-neutral-500 font-medium py-1"
          />
          
          {/* Voice Search Button */}
          <button type="button"
            onClick={handleVoiceSearch}
            className={`p-1.5 rounded-lg border transition-all shrink-0 cursor-pointer flex items-center justify-center ${
              isListening
                ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse'
                : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title={language === 'tr' ? 'Sesle Ara' : 'Voice Search'}
          >
            <Mic size={14} />
          </button>

          {spotlightSearchInput && (
            <button type="button"
              onClick={() => setSpotlightSearchInput('')}
              className="p-1 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all shrink-0 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 shrink-0 ml-2 select-none">
            <span className="text-[9px] font-black text-neutral-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded shadow-sm tracking-wider font-mono">ESC</span>
          </div>
        </div>

        {/* Scope Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900/40 border-b border-white/5 shrink-0 overflow-x-auto hide-scrollbar">
          {scopesList.map((scope) => {
            const Icon = scope.icon;
            const isActive = spotlightScope === scope.id;
            return (
              <button type="button"
                key={scope.id}
                onClick={() => setSpotlightScope(scope.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-[var(--accent-color)]/15 border-[var(--accent-color)]/30 text-[var(--accent-color)] shadow-sm'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon size={12} />
                <span>{scope.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Results Area */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto hide-scrollbar p-3 max-h-[60vh] flex flex-col gap-1 pr-1.5"
        >
          {isListening && (
            <div className="flex flex-col items-center justify-center py-16 text-center select-none animate-pulse">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mb-4 text-red-500 relative">
                <span className="absolute inset-0 rounded-full bg-red-500/10 animate-ping"></span>
                <Volume2 size={24} />
              </div>
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest">
                {language === 'tr' ? 'Dinleniyor...' : 'Listening...'}
              </h4>
              <p className="text-[11px] text-neutral-500 mt-2">
                {language === 'tr' ? 'Konuşmaya başlayın...' : 'Speak now...'}
              </p>
            </div>
          )}

          {!isListening && !spotlightSearchInput.trim() ? (
            /* Recent Searches & Recommendations Split Layout */
            recentSearches.length > 0 ? (
              <div className="flex flex-col gap-4 py-2 px-1 select-none">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-extrabold tracking-wider uppercase text-neutral-400 flex items-center gap-1.5 font-mono">
                    <Clock size={11} />
                    {language === 'tr' ? 'SON ARAMALAR' : 'RECENT SEARCHES'}
                  </span>
                  <button type="button"
                    onClick={clearAllRecent}
                    className="text-[9px] font-bold text-red-400/70 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    {language === 'tr' ? 'Tümünü Temizle' : 'Clear All'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recentSearches.map((match, idx) => {
                    const { type, item } = match;
                    const title = type === 'series' ? cleanMovieName(item.name) : (item.type === 'movie' ? cleanMovieName(item.name) : item.name);
                    const sub = type === 'series' ? (language === 'tr' ? 'Dizi' : 'Series') : (item.type === 'movie' ? (language === 'tr' ? 'Film' : 'Movie') : (language === 'tr' ? 'Canlı TV' : 'Live TV'));
                    const isFocused = focusedResultIndex === idx;

                    return (
                      <div
                        key={`recent-${item.id}-${idx}`}
                        onClick={() => handleSelectResult(match)}
                        onMouseEnter={() => setFocusedResultIndex(idx)}
                        className={`recent-item group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all duration-150 border ${
                          isFocused
                            ? 'bg-white/[0.06] border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.25)] scale-[1.01]'
                            : 'bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`relative rounded-md overflow-hidden bg-neutral-900 border border-white/5 flex items-center justify-center shrink-0 w-7 h-9`}>
                            <ImageWithFallback
                              src={item.logo || ''}
                              name={title}
                              group={sub}
                              size="sm"
                              itemType={type}
                            />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-xs font-semibold truncate transition-colors ${
                              isFocused ? 'text-white' : 'text-neutral-300'
                            }`}>
                              {title}
                            </span>
                            <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-wide mt-0.5">
                              {sub}
                            </span>
                          </div>
                        </div>
                        
                        <button type="button"
                          onClick={(e) => removeRecentSearch(e, item.id)}
                          className={`p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-red-400 transition-all cursor-pointer mr-1 ${
                            isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title={language === 'tr' ? 'Kaldır' : 'Remove'}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Completely Empty State */
              <div className="flex flex-col items-center justify-center py-20 text-center select-none opacity-60">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 text-[var(--accent-color)] shadow-inner">
                  <Search size={22} />
                </div>
                <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest">
                  {language === 'tr' ? 'Aramaya Başlayın' : 'Start Searching'}
                </h4>
                <p className="text-[11px] text-neutral-500 max-w-xs mt-2 leading-relaxed">
                  {language === 'tr'
                    ? `Aradığınız içeriği hızlıca bulmak için yazmaya başlayın veya ses simgesini kullanın.`
                    : `Start typing to search and discover items instantly, or use voice search.`}
                </p>
              </div>
            )
          ) : !isListening && spotlightSearchResults.length === 0 ? (
            /* No Results State */
            <div className="flex flex-col items-center justify-center py-20 text-center select-none opacity-60">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 text-neutral-400">
                <X size={22} />
              </div>
              <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest">
                {language === 'tr' ? 'Sonuç Bulunamadı' : 'No Results Found'}
              </h4>
              <p className="text-[11px] text-neutral-500 max-w-xs mt-2 leading-relaxed">
                {language === 'tr'
                  ? 'Aradığınız kelimeye uygun içerik bulunamadı. Lütfen kelimeleri kontrol edin.'
                  : 'No content found matching your query. Please double-check spelling.'}
              </p>
            </div>
          ) : (
            /* Search Results Layout with Zengin Kartlar & Canlılık Efektleri */
            !isListening && spotlightSearchResults.slice(0, 50).map((match, idx) => {
              const type = match.type;
              const item = match.item;

              const isLive = type === 'live';
              const isMovie = type === 'movie';
              const isSeries = type === 'series';

              let logoSrc: string;
              let titleName: string;
              let subtext: string;

              if (isSeries) {
                const series = item as GroupedSeries;
                logoSrc = series.logo || '';
                titleName = cleanMovieName(series.name);
                const seasonsCount = Object.keys(series.seasons).length;
                subtext = language === 'tr'
                  ? `${seasonsCount} Sezon • ${series.episodesCount} Bölüm`
                  : `${seasonsCount} Season${seasonsCount > 1 ? 's' : ''} • ${series.episodesCount} Episode${series.episodesCount > 1 ? 's' : ''}`;
              } else {
                const plItem = item as PlaylistItem;
                logoSrc = plItem.logo || '';
                titleName = plItem.type === 'movie' ? cleanMovieName(plItem.name) : plItem.name;
                subtext = plItem.group || (language === 'tr' ? 'GENEL' : 'GENERAL');
              }

              const isFocused = focusedResultIndex === idx;

              return (
                <div
                  key={`${type}-${item.id}`}
                  onClick={() => handleSelectResult(match)}
                  onMouseEnter={() => setFocusedResultIndex(idx)}
                  className={`result-item group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 border ${
                    isFocused
                      ? 'bg-white/[0.06] border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.35)] scale-[1.01] translate-x-1'
                      : 'bg-transparent border-transparent hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Item Thumbnail */}
                    <div className={`relative rounded-lg overflow-hidden bg-neutral-900 border border-white/5 flex items-center justify-center shrink-0 shadow-md ${
                      isLive ? 'w-10 h-10 p-1' : 'w-8 h-11'
                    }`}>
                      <ImageWithFallback
                        src={logoSrc}
                        name={titleName}
                        group={subtext}
                        size="sm"
                        itemType={type}
                      />
                    </div>
                    {/* Item Text */}
                    <div className="flex flex-col min-w-0">
                      <span className={`text-xs font-bold transition-colors truncate ${
                        isFocused ? 'text-white' : 'text-neutral-300'
                      }`}>
                        {titleName}
                      </span>
                      <span className={`text-[10px] font-semibold transition-colors mt-0.5 truncate uppercase tracking-wider ${
                        isFocused ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        {subtext}
                      </span>
                    </div>
                  </div>

                  {/* Actions / Badges */}
                  <div className="shrink-0 flex items-center gap-2 pl-2 select-none">
                    {isFocused ? (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 text-[8px] font-black text-[var(--accent-color)] uppercase tracking-widest">
                        <span>{language === 'tr' ? 'Oynat/Aç' : 'Play/Open'}</span>
                        <span className="text-[10px] font-medium leading-none mb-0.5 font-sans">↵</span>
                      </div>
                    ) : (
                      <>
                        {isLive && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest flex items-center">
                            <span className="relative flex h-1.5 w-1.5 mr-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            {language === 'tr' ? 'CANLI' : 'LIVE'}
                          </span>
                        )}
                        {isMovie && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[8px] font-black uppercase tracking-widest">
                            {language === 'tr' ? 'SİNEMA' : 'MOVIE'}
                          </span>
                        )}
                        {isSeries && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-black uppercase tracking-widest">
                            {language === 'tr' ? 'DİZİ' : 'SERIES'}
                          </span>
                        )}
                        <ChevronRight size={12} className="text-neutral-700 group-hover:text-neutral-500 transition-colors ml-1" />
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Command Palette Footer */}
        <div className="px-4 py-2 border-t border-white/5 bg-neutral-950 flex items-center justify-between text-[9px] font-semibold text-neutral-500 shrink-0 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-neutral-400 font-mono">↑↓</kbd>
              <span>{language === 'tr' ? 'Gezin' : 'Navigate'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-neutral-400 font-mono">Enter</kbd>
              <span>{language === 'tr' ? 'Oynat/Aç' : 'Play/Open'}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-neutral-400 font-mono">ESC</kbd>
            <span>{language === 'tr' ? 'Kapat' : 'Close'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
