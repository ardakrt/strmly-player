import React from 'react';
import { Search, Heart, Trash2, Tv, Play } from 'lucide-react';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { ImageWithFallback } from './ImageWithFallback';
import { VirtualizedGrid } from './VirtualizedGrid';

interface SeriesViewProps {
  selectedGroup: string;
  activeSeriesCategory: string;
  setActiveSeriesCategory: (cat: string) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (query: string) => void;
  seriesFavCatsToShow: string[];
  seriesCat: {
    editMode: boolean;
    setEditMode: (mode: boolean) => void;
    draggedCategory: string | null;
    handleDragStart: (e: React.DragEvent, group: string) => void;
    handleDrop: (e: React.DragEvent, group: string) => void;
    toggleFavorite: (group: string, e: React.MouseEvent) => void;
    handleHide: (group: string, e: React.MouseEvent) => void;
    filteredOtherCategories: string[];
  };
  visibleSeriesCategoryLimit: number;
  setVisibleSeriesCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  groupedSeriesList: GroupedSeries[];
  handleMainScroll: (e: React.UIEvent<HTMLElement>) => void;
  handleOpenSeriesModalDirect: (series: GroupedSeries) => void;
  genericLogosSet: Set<string>;
  toggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

export const SeriesCard = React.memo(({
  series,
  onClick,
  isFavorite,
  onToggleFavorite,
  isGenericLogo,
  seasonsCount
}: {
  series: GroupedSeries;
  onClick: (series: GroupedSeries) => void;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  isGenericLogo: boolean;
  seasonsCount: number;
}) => {
  return (
    <div
      className="group flex flex-col gap-2.5 cursor-pointer relative"
      onClick={() => onClick(series)}
    >
      <div className="premium-card aspect-[2/3] flex items-center justify-center">
        <ImageWithFallback
          src={series.logo}
          name={series.name}
          group={series.group || 'SERIES'}
          itemType="series"
          isGenericLogo={isGenericLogo}
          aspect="portrait"
        />

        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play size={16} fill="#000" className="ml-0.5" />
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(series.id, e);
          }}
          className={`absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 ${
            isFavorite ? 'opacity-100 text-red-500' : 'opacity-0 group-hover:opacity-100'
          }`}
          title={isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
        >
          <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>
      <div className="flex flex-col px-1.5">
        <span className="text-xs font-bold premium-card-title truncate">{series.name}</span>
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mt-0.5">
          {seasonsCount} Sezon • {series.episodesCount} Bölüm
        </span>
        {series.group && (
          <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider truncate mt-1 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded w-fit">
            {series.group}
          </span>
        )}
      </div>
    </div>
  );
});

export function SeriesView({
  selectedGroup,
  activeSeriesCategory,
  setActiveSeriesCategory,
  categorySearchQuery,
  setCategorySearchQuery,
  seriesFavCatsToShow,
  seriesCat,
  visibleSeriesCategoryLimit,
  setVisibleSeriesCategoryLimit,
  groupedSeriesList,
  handleMainScroll,
  handleOpenSeriesModalDirect,
  genericLogosSet,
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: SeriesViewProps) {
  if (selectedGroup !== 'Diziler') return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const otherCategories = seriesCat.filteredOtherCategories;

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in pb-12">
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2 bg-neutral-950/40 border border-white/5 rounded-[24px] p-4 h-full overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">Kategoriler</span>
          <button
            onClick={() => seriesCat.setEditMode(!seriesCat.editMode)}
            className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition-colors ${seriesCat.editMode ? 'bg-[var(--accent-color)] text-black' : 'bg-white/5 hover:bg-white/10 text-neutral-400'}`}
          >
            {seriesCat.editMode ? 'Bitti' : 'Düzenle'}
          </button>
        </div>
        <div className="relative mb-2 shrink-0">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Kategori ara..."
            value={categorySearchQuery}
            onChange={(e) => setCategorySearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/5 focus:border-[var(--accent-color)] rounded-lg text-[11px] text-white outline-none placeholder-neutral-500 transition-all"
          />
        </div>

        <button
          onClick={() => { setActiveSeriesCategory('Tümü'); setVisibleCount(100); }}
          className={`text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all ${activeSeriesCategory === 'Tümü' ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
        >
          Tüm Diziler
        </button>
        {seriesFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
            <span className="text-[9px] tracking-widest font-extrabold text-red-500/50 uppercase px-2 mb-1 flex items-center gap-1.5"><Heart size={10} /> Favoriler</span>
            {seriesFavCatsToShow.map(group => (
              <div
                key={`fav-series-${group}`}
                className={`relative flex items-center group transition-transform ${seriesCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${seriesCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                draggable={seriesCat.editMode}
                onDragStart={(e) => seriesCat.handleDragStart(e, group)}
                onDragOver={handleDragOver}
                onDrop={(e) => seriesCat.handleDrop(e, group)}
              >
                <button
                  onClick={() => { setActiveSeriesCategory(group); setVisibleCount(100); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all ${seriesCat.editMode ? 'pr-16' : 'pr-4'} ${activeSeriesCategory === group ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}
                >
                  {group}
                </button>
                {seriesCat.editMode && (
                  <div className="absolute right-2.5 flex items-center gap-1 z-20">
                    <button
                      onClick={(e) => seriesCat.toggleFavorite(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                      title="Favorilerden Çıkar"
                    >
                      <Heart size={11} fill="currentColor" />
                    </button>
                    <button
                      onClick={(e) => seriesCat.handleHide(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                      title="Kategoriyi Kaldır"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
          <span className="text-[9px] tracking-widest font-extrabold text-neutral-600 uppercase px-2 mb-1">Diğerleri</span>
          {otherCategories.slice(0, visibleSeriesCategoryLimit).map(group => (
            <div
              key={group}
              className={`relative flex items-center group transition-transform ${seriesCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${seriesCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
              draggable={seriesCat.editMode}
              onDragStart={(e) => seriesCat.handleDragStart(e, group)}
              onDragOver={handleDragOver}
              onDrop={(e) => seriesCat.handleDrop(e, group)}
            >
              <button
                onClick={() => { setActiveSeriesCategory(group); setVisibleCount(100); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all ${seriesCat.editMode ? 'pr-16' : 'pr-4'} ${activeSeriesCategory === group ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
              >
                {group}
              </button>
              {seriesCat.editMode && (
                <div className="absolute right-2.5 flex items-center gap-1 z-20">
                  <button
                    onClick={(e) => seriesCat.toggleFavorite(group, e)}
                    className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                    title="Favorilere Ekle"
                  >
                    <Heart size={11} />
                  </button>
                  <button
                    onClick={(e) => seriesCat.handleHide(group, e)}
                    className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                    title="Kategoriyi Kaldır"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {otherCategories.length > visibleSeriesCategoryLimit && (
            <button
              onClick={() => setVisibleSeriesCategoryLimit(prev => prev + 50)}
              className="w-full py-2.5 mt-1 rounded-xl text-[10px] font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all tracking-wider uppercase border border-white/5"
            >
              Daha Fazla Göster (+{otherCategories.length - visibleSeriesCategoryLimit})
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-3 h-full">
        <div className="flex-1 overflow-y-auto bg-neutral-950/20 border border-white/5 rounded-[24px] p-2 md:p-4 shadow-inner" onScroll={handleMainScroll}>
          {groupedSeriesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-20 opacity-50">
              <Tv size={32} className="text-neutral-500 mb-3" />
              <h3 className="text-base font-semibold text-neutral-300">Dizi Bulunamadı</h3>
            </div>
          ) : (
            <VirtualizedGrid
              items={groupedSeriesList}
              renderItem={(series) => (
                <SeriesCard
                  key={series.id}
                  series={series}
                  onClick={handleOpenSeriesModalDirect}
                  isFavorite={globalFavorites.includes(series.id)}
                  onToggleFavorite={toggleFavorite}
                  isGenericLogo={series.logo ? genericLogosSet.has(series.logo) : false}
                  seasonsCount={Object.keys(series.seasons).length}
                />
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
