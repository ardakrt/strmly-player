import React from 'react';
import { 
  Search, Heart, Trash2, Tv, Play, 
  Trophy, Film, Newspaper, Music, Gamepad, Compass, 
  Sparkles, Star, Radio 
} from 'lucide-react';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { ImageWithFallback } from './ImageWithFallback';
import { VirtualizedGrid } from './VirtualizedGrid';
import { MediaCardContextMenu } from './MediaCardContextMenu';
import { useSettings } from '../context/SettingsContext';

// Helper to map category names to Lucide icons dynamically
export const getCategoryIcon = (name: string) => {
  const upper = name.toUpperCase();
  if (upper.includes('SPOR') || upper.includes('SPORT')) return Trophy;
  if (upper.includes('SİNEMA') || upper.includes('FİLM') || upper.includes('MOVIE') || upper.includes('CİNEMA') || upper.includes('ACTION') || upper.includes('VOD') || upper.includes('VİZYON')) return Film;
  if (upper.includes('HABER') || upper.includes('NEWS') || upper.includes('INFO')) return Newspaper;
  if (upper.includes('MÜZİK') || upper.includes('MUSIC') || upper.includes('KLİP')) return Music;
  if (upper.includes('ÇOCUK') || upper.includes('KİD') || upper.includes('GAME') || upper.includes('GAMİNG') || upper.includes('ANİME') || upper.includes('KARTON')) return Gamepad;
  if (upper.includes('BELGESEL') || upper.includes('DOCUMENTARY') || upper.includes('WİLD') || upper.includes('NAT') || upper.includes('GEOGRAPHIC')) return Compass;
  if (
    upper.includes('NETFLIX') || upper.includes('AMAZON') || upper.includes('HBO') || 
    upper.includes('DISNEY') || upper.includes('TOD') || upper.includes('BEIN') || 
    upper.includes('EXXEN') || upper.includes('GAIN') || upper.includes('PREMIUM') || 
    upper.includes('VIP') || upper.includes('ÖZEL') || upper.includes('SEÇKİN') || 
    upper.includes('PLATINUM')
  ) return Sparkles;
  if (upper.includes('FAVORİ') || upper.includes('FAV')) return Star;
  return Tv;
};

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
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

export const SeriesCard = React.memo(({
  series,
  onClick,
  isFavorite,
  onToggleFavorite,
  isGenericLogo,
  seasonsCount,
  onContextMenu
}: {
  series: GroupedSeries;
  onClick: (series: GroupedSeries) => void;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  isGenericLogo: boolean;
  seasonsCount: number;
  onContextMenu?: (event: React.MouseEvent, series: GroupedSeries) => void;
}) => {
  const { language } = useSettings();
  return (
    <div
      className="group flex flex-col gap-2.5 cursor-pointer relative focusable-item"
      tabIndex={0}
      onClick={() => onClick(series)}
      onContextMenu={(event) => onContextMenu?.(event, series)}
    >
      <div className="premium-card aspect-[2/3] flex items-center justify-center relative">
        <ImageWithFallback
          src={series.logo}
          name={series.name}
          group={series.group || 'SERIES'}
          itemType="series"
          isGenericLogo={isGenericLogo}
          aspect="portrait"
        />

        {/* Seasons/Episodes Badge Overlay */}
        <div className="absolute bottom-2.5 left-2.5 z-20 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-black uppercase tracking-wider text-neutral-300">
          {language === 'tr'
            ? `${seasonsCount} S • ${series.episodesCount} B`
            : `${seasonsCount} S • ${series.episodesCount} E`}
        </div>

        {/* Hover Glassmorphism Play Button */}
        <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 duration-300">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-all duration-300 border border-white/20">
            <Play size={15} fill="#000" className="ml-0.5" />
          </div>
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(series.id, e);
          }}
          className={`absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 cursor-pointer ${
            isFavorite ? 'opacity-100 text-red-500 border-red-500/20' : 'opacity-0 group-hover:opacity-100'
          }`}
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
        >
          <Heart size={11} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>
      <div className="flex flex-col px-1">
        <span className="text-xs font-bold premium-card-title truncate">{series.name}</span>
      </div>
    </div>
  );
});

export const SeriesView = React.memo(function SeriesView({
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
  const { t, language } = useSettings();
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; item: GroupedSeries } | null>(null);

  if (selectedGroup !== 'Diziler') return null;

  const openContextMenu = (event: React.MouseEvent, item: GroupedSeries) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const otherCategories = seriesCat.filteredOtherCategories;

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in pb-12" onContextMenu={() => setContextMenu(null)}>
      {/* 1. Left Categories Sidebar */}
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2 bg-neutral-950/40 border border-white/5 rounded-[24px] p-4 h-full overflow-y-auto shadow-lg select-none hide-scrollbar">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">{language === 'tr' ? 'Kategoriler' : 'Categories'}</span>
          <button
            onClick={() => seriesCat.setEditMode(!seriesCat.editMode)}
            className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition-colors focusable-item ${seriesCat.editMode ? 'bg-[var(--accent-color)] text-black' : 'bg-white/5 hover:bg-white/10 text-neutral-400'}`}
          >
            {seriesCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
          </button>
        </div>
        <div className="relative mb-2 shrink-0">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder={language === 'tr' ? 'Kategori ara...' : 'Search category...'}
            value={categorySearchQuery}
            onChange={(e) => setCategorySearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/5 focus:border-[var(--accent-color)] rounded-lg text-[11px] text-white outline-none placeholder-neutral-500 transition-all focusable-item"
          />
        </div>

        {/* All Series Button */}
        <button
          onClick={() => { setActiveSeriesCategory('Tümü'); setVisibleCount(100); }}
          className={`flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${
            activeSeriesCategory === 'Tümü'
              ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
              : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
          }`}
        >
          <Radio size={14} className={activeSeriesCategory === 'Tümü' ? 'text-[var(--accent-color)]' : 'text-neutral-500'} />
          <span>{language === 'tr' ? 'Tüm Diziler' : 'All Series'}</span>
        </button>

        {/* Favorites Categories Section */}
        {seriesFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/5">
            <span className="text-[9px] tracking-widest font-extrabold text-red-500/50 uppercase px-2 mb-1 flex items-center gap-1.5"><Heart size={10} /> {t('navbar.favorites')}</span>
            {seriesFavCatsToShow.map(group => {
              const CatIcon = getCategoryIcon(group);
              const isCatActive = activeSeriesCategory === group;
              return (
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
                    className={`w-full flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${seriesCat.editMode ? 'pr-16' : 'pr-4'} ${
                      isCatActive
                        ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
                        : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
                    }`}
                  >
                    <CatIcon size={14} className={isCatActive ? 'text-[var(--accent-color)] animate-pulse' : 'text-neutral-500'} />
                    <span className="truncate">{group}</span>
                  </button>
                  {seriesCat.editMode && (
                    <div className="absolute right-2.5 flex items-center gap-1 z-20">
                      <button
                        onClick={(e) => seriesCat.toggleFavorite(group, e)}
                        className="w-6 h-6 rounded-md bg-black/40 text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                        title={language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'}
                      >
                        <Heart size={11} fill="currentColor" />
                      </button>
                      <button
                        onClick={(e) => seriesCat.handleHide(group, e)}
                        className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                        title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Other Categories Section */}
        <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/5">
          <span className="text-[9px] tracking-widest font-extrabold text-neutral-600 uppercase px-2 mb-1">{language === 'tr' ? 'Diğerleri' : 'Others'}</span>
          {otherCategories.slice(0, visibleSeriesCategoryLimit).map(group => {
            const CatIcon = getCategoryIcon(group);
            const isCatActive = activeSeriesCategory === group;
            return (
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
                  className={`w-full flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${seriesCat.editMode ? 'pr-16' : 'pr-4'} ${
                    isCatActive
                      ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
                      : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
                  }`}
                >
                  <CatIcon size={14} className={isCatActive ? 'text-[var(--accent-color)] animate-pulse' : 'text-neutral-500'} />
                  <span className="truncate">{group}</span>
                </button>
                {seriesCat.editMode && (
                  <div className="absolute right-2.5 flex items-center gap-1 z-20">
                    <button
                      onClick={(e) => seriesCat.toggleFavorite(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                      title={language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
                    >
                      <Heart size={11} />
                    </button>
                    <button
                      onClick={(e) => seriesCat.handleHide(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                      title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {otherCategories.length > visibleSeriesCategoryLimit && (
            <button
              onClick={() => setVisibleSeriesCategoryLimit(prev => prev + 50)}
              className="w-full py-2.5 mt-1 rounded-xl text-[10px] font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all tracking-wider uppercase border border-white/5 focusable-item cursor-pointer"
            >
              {language === 'tr' ? 'Daha Fazla Göster' : 'Show More'} (+{otherCategories.length - visibleSeriesCategoryLimit})
            </button>
          )}
        </div>
      </div>

      {/* 2. Middle Content Grid */}
      <div className="flex-1 flex flex-col gap-3 h-full">
        <div className="flex-1 overflow-y-auto bg-neutral-950/20 border border-white/5 rounded-[24px] p-2 md:p-4 shadow-inner" onScroll={handleMainScroll}>
          {groupedSeriesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-20 opacity-50 select-none">
              <Tv size={32} className="text-neutral-500 mb-3" />
              <h3 className="text-base font-semibold text-neutral-300">{language === 'tr' ? 'Dizi Bulunamadı' : 'No Series Found'}</h3>
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
                  onContextMenu={openContextMenu}
                />
              )}
            />
          )}
        </div>
      </div>
      {contextMenu && (
        <MediaCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isFavorite={globalFavorites.includes(contextMenu.item.id)}
          onClose={() => setContextMenu(null)}
          onOpenDetails={(item) => handleOpenSeriesModalDirect(item as GroupedSeries)}
          onToggleFavorite={(id) => toggleFavorite(id)}
        />
      )}
    </div>
  );
});
