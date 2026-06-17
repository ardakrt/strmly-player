import React from 'react';
import { Play, Film, Tv, Search, ArrowLeft, ChevronRight, X } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';

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
  spotlightActiveStep,
  setSpotlightActiveStep,
  focusedButtonIndex,
  setFocusedButtonIndex,
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
  if (!showSpotlight) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4 animate-fade-in"
      onClick={() => setShowSpotlight(false)}
    >
      <div
        className="relative w-full max-w-md bg-neutral-950/90 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 overflow-hidden glass-slide-up max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {spotlightActiveStep === 'select_scope' ? (
          <div className="flex flex-col gap-2.5 py-1">
            <div className="flex items-center justify-between px-1 mb-2 shrink-0">
              <span className="text-[9px] tracking-widest font-black text-neutral-500 uppercase">
                Kategori Seçin
              </span>
              <div className="flex items-center gap-1.5 select-none">
                <span className="text-[8px] font-bold text-neutral-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded">Yön Tuşları & Enter</span>
              </div>
            </div>
            {[
              { id: 'series', label: 'Dizi Ara', desc: 'Diziler ve bölümler arasında arama yapın.', icon: Play },
              { id: 'movie', label: 'Film Ara', desc: 'Sinema filmleri ve VOD içerikleri arayın.', icon: Film },
              { id: 'live', label: 'Canlı Kanal Ara', desc: 'Canlı TV kanalları ve yayınları arayın.', icon: Tv }
            ].map((btn, idx) => {
              const Icon = btn.icon;
              const isFocused = focusedButtonIndex === idx;
              return (
                <div
                  key={btn.id}
                  onMouseEnter={() => setFocusedButtonIndex(idx)}
                  onClick={() => {
                    setSpotlightScope(btn.id as any);
                    setSpotlightActiveStep('searching');
                  }}
                  className={`relative w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all duration-200 cursor-pointer ${isFocused
                      ? 'bg-white/[0.06] border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                      : 'bg-white/[0.01] border-transparent hover:bg-white/[0.03]'
                    }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all ${isFocused
                        ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/25 text-[var(--accent-color)]'
                        : 'bg-white/[0.03] border-white/5 text-neutral-500'
                      }`}>
                      <Icon size={14} fill={isFocused && btn.id !== 'all' ? 'currentColor' : 'none'} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-xs font-bold transition-colors ${isFocused ? 'text-white' : 'text-neutral-300'}`}>
                        {btn.label}
                      </span>
                      <span className={`text-[10px] mt-0.5 truncate transition-colors ${isFocused ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        {btn.desc}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center pl-2">
                    {isFocused ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-bold text-neutral-400 select-none uppercase tracking-wider">
                        <span>SEÇ</span>
                        <span className="text-[9px] opacity-60">↵</span>
                      </div>
                    ) : (
                      <ChevronRight size={12} className="text-neutral-700" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="relative flex items-center shrink-0 gap-2.5">
              <button
                onClick={() => setSpotlightActiveStep('select_scope')}
                className="w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
                title="Geri Dön"
              >
                <ArrowLeft size={13} />
              </button>

              <div className="relative flex-1 flex items-center">
                <Search size={14} className="absolute left-3.5 text-[var(--accent-color)]" />
                <input
                  ref={spotlightInputRef}
                  type="text"
                  placeholder={
                    spotlightScope === 'live'
                      ? 'Canlı TV kanalı ara...'
                      : spotlightScope === 'movie'
                        ? 'Sinema filmi ara...'
                        : 'Televizyon dizisi ara...'
                  }
                  value={spotlightSearchInput}
                  onChange={(e) => setSpotlightSearchInput(e.target.value)}
                  className="w-full pl-10 pr-16 py-2.5 bg-white/[0.03] border border-white/5 focus:border-white/[0.08] rounded-xl text-xs text-white outline-none placeholder-neutral-500 transition-all font-medium"
                />
                <div className="absolute right-3.5 flex items-center gap-1.5 select-none">
                  <span className="text-[8px] font-extrabold text-neutral-400 bg-white/5 border border-white/15 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {spotlightScope === 'live' ? 'CANLI' : spotlightScope === 'movie' ? 'FİLM' : 'DİZİ'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto hide-scrollbar max-h-[50vh] flex flex-col gap-1.5 pr-1 mt-2">
              {!spotlightSearchInput.trim() ? (
                <div className="flex flex-col items-center justify-center py-16 text-center select-none opacity-50">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Search size={20} className="text-neutral-400" />
                  </div>
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Aramaya Başlayın</h4>
                  <p className="text-[11px] text-neutral-500 max-w-xs mt-1.5 leading-relaxed">
                    Aradığınız {spotlightScope === 'live' ? 'kanalı' : spotlightScope === 'movie' ? 'filmi' : 'diziyi'} bulmak için klavyeden yazmaya başlayın.
                  </p>
                </div>
              ) : spotlightSearchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center select-none opacity-50">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <X size={20} className="text-neutral-400" />
                  </div>
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Sonuç Bulunamadı</h4>
                  <p className="text-[11px] text-neutral-500 max-w-xs mt-1.5 leading-relaxed">
                    Aradığınız kelimeye uygun içerik bulunamadı. Lütfen kelimelerin doğruluğunu kontrol edin.
                  </p>
                </div>
              ) : (
                spotlightSearchResults.slice(0, 50).map(match => {
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
                    titleName = series.name;
                    const seasonsCount = Object.keys(series.seasons).length;
                    subtext = `${seasonsCount} Sezon • ${series.episodesCount} Bölüm`;
                  } else {
                    const plItem = item as PlaylistItem;
                    logoSrc = plItem.logo || '';
                    titleName = plItem.name;
                    subtext = plItem.group || 'GENEL';
                  }

                  const handleSelectResult = () => {
                    setShowSpotlight(false);
                    if (isLive) {
                      handlePlayStream(item as PlaylistItem);
                    } else if (isMovie) {
                      handleOpenDetails(item as PlaylistItem);
                    } else if (isSeries) {
                      handleOpenSeriesModalDirect(item as GroupedSeries);
                    }
                  };

                  return (
                    <div
                      key={`${type}-${item.id}`}
                      onClick={handleSelectResult}
                      className="group flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/5 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`relative rounded-xl overflow-hidden bg-neutral-900 border border-white/5 flex items-center justify-center shrink-0 shadow-md ${isLive ? 'w-10 h-10 p-1' : 'w-8.5 h-12'
                          }`}>
                          <ImageWithFallback
                            src={logoSrc}
                            name={titleName}
                            group={subtext}
                            size="sm"
                            itemType={type}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors truncate">
                            {titleName}
                          </span>
                          <span className="text-[10px] font-semibold text-neutral-500 group-hover:text-neutral-400 transition-colors mt-0.5 truncate uppercase tracking-wider">
                            {subtext}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 pl-2">
                        {isLive && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest">
                            CANLI
                          </span>
                        )}
                        {isMovie && (
                          <span className="px-2 py-0.5 rounded-full bg-neutral-100/10 text-neutral-300 border border-white/10 text-[8px] font-black uppercase tracking-widest">
                            SİNEMA
                          </span>
                        )}
                        {isSeries && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 text-[8px] font-black uppercase tracking-widest">
                            DİZİLER
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
