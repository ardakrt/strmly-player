import React, { useState, useEffect } from 'react';
import {
  Search, Heart, Trash2, Tv, Play, Download,
  Trophy, Film, Newspaper, Music, Gamepad, Compass,
  Sparkles, Star, Radio
} from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import { ImageWithFallback } from './ImageWithFallback';
import { VirtualizedGrid } from './VirtualizedGrid';
import { MediaCardContextMenu } from './MediaCardContextMenu';
import { useSettings } from '../context/SettingsContext';
import { cleanMovieName, getCachedTmdbResult } from '../utils/tmdb';
import { useDownloads } from '../hooks/useDownloads';

// Helper to map category names to Lucide icons dynamically
export const getCategoryIcon = (name: string) => {
  const upper = name.toUpperCase();
  if (upper.includes('SPOR') || upper.includes('SPORT')) return Trophy;
  if (upper.includes('SİNEMA') || upper.includes('FİLM') || upper.includes('MOVIE') || upper.includes('CİNEMA') || upper.includes('ACTION') || upper.includes('VOD') || upper.includes('VİZYON') || upper.includes('LİSTE')) return Film;
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

interface MoviesViewProps {
  selectedGroup: string;
  activeMovieCategory: string;
  setActiveMovieCategory: (cat: string) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (query: string) => void;
  movieFavCatsToShow: string[];
  movieCat: {
    editMode: boolean;
    setEditMode: (mode: boolean) => void;
    draggedCategory: string | null;
    handleDragStart: (e: React.DragEvent, group: string) => void;
    handleDrop: (e: React.DragEvent, group: string) => void;
    toggleFavorite: (group: string, e: React.MouseEvent) => void;
    handleHide: (group: string, e: React.MouseEvent) => void;
    filteredOtherCategories: string[];
  };
  visibleMovieCategoryLimit: number;
  setVisibleMovieCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  filteredDisplayItems: PlaylistItem[];
  handleMainScroll: (e: React.UIEvent<HTMLElement>) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  handlePlayStream: (item: PlaylistItem) => void;
  checkedStatusMap: Record<string, 'online' | 'offline'>;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

const getQualityLabel = (name: string): string | null => {
  const lower = name.toLowerCase();
  if (lower.includes('4k') || lower.includes('uhd')) return '4K';
  if (lower.includes('1080p') || lower.includes('fhd') || lower.includes('1080')) return 'FHD';
  if (lower.includes('720p') || lower.includes('hd') || lower.includes('720')) return 'HD';
  return null;
};

export const MovieCard = React.memo(({
  channel,
  onClick,
  isOnline,
  isFavorite,
  isDownloading = false,
  onToggleFavorite,
  onDownload,
  isGenericLogo,
  onContextMenu
}: {
  channel: PlaylistItem;
  onClick: (item: PlaylistItem) => void;
  isOnline: 'online' | 'offline' | undefined;
  isFavorite: boolean;
  isDownloading?: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  onDownload?: (item: PlaylistItem) => void;
  isGenericLogo: boolean;
  onContextMenu?: (event: React.MouseEvent, item: PlaylistItem) => void;
}) => {
  const { language } = useSettings();
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getCachedTmdbResult('movie', channel.name).then((res: any) => {
      if (active && res && res.vote_average) {
        setRating(res.vote_average);
      }
    });
    return () => { active = false; };
  }, [channel.name]);

  const quality = getQualityLabel(channel.name);
  return (
<<<<<<< HEAD
    <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => onClick(channel))(); } }} role="button"
=======
    <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => onClick(channel))(e as any); } }} role="button"
>>>>>>> e7193502944587c0e2e5b766aff7f4e46bf08d6f
      className="group flex flex-col gap-2.5 cursor-pointer relative focusable-item"
      tabIndex={0}
      onClick={() => onClick(channel)}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
    >
      <div className="premium-card aspect-[2/3] flex items-center justify-center relative">
        <ImageWithFallback
          src={channel.logo}
          name={channel.name}
          group={channel.group || 'MOVIE'}
          itemType={channel.type}
          isGenericLogo={isGenericLogo}
          aspect="portrait"
        />

        {rating !== null && rating > 0 && (
          <div className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/10 text-[9px] font-black text-amber-400 flex items-center gap-0.5 shadow-md">
            <Star size={9} fill="currentColor" />
            <span>{rating.toFixed(1)}</span>
          </div>
        )}

        {quality && (
          <div className="absolute bottom-2.5 left-2.5 z-20 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[8px] font-extrabold uppercase tracking-wider text-neutral-300 shadow-md">
            {quality}
          </div>
        )}

        {/* Hover Glassmorphism Play Button */}
        <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 duration-300">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-all duration-300 border border-white/20">
              <Play size={15} fill="#000" className="ml-0.5" />
            </div>
            {onDownload && (
              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDownloading) onDownload(channel);
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-all duration-300 border cursor-pointer ${
                  isDownloading
                    ? 'bg-blue-500/80 text-white border-blue-400/30 animate-pulse'
                    : 'bg-white/90 text-black border-white/20 hover:bg-white'
                }`}
                title={isDownloading ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}
               aria-label={isDownloading ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}>
                <Download size={15} className={isDownloading ? 'animate-bounce' : ''} />
              </button>
            )}
          </div>
        </div>

        {isOnline && (
          <div
            className={`absolute bottom-2.5 left-2.5 z-20 w-2 h-2 rounded-full border border-black/40 shadow-sm ${
              isOnline === 'online' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={isOnline === 'online' ? (language === 'tr' ? 'Çevrimiçi' : 'Online') : (language === 'tr' ? 'Çevrimdışı' : 'Offline')}
          />
        )}
        <button type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel.id, e);
          }}
          className={`absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 cursor-pointer ${
            isFavorite ? 'opacity-100 text-red-500 border-red-500/20' : 'opacity-0 group-hover:opacity-100'
          }`}
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
         aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}>
          <Heart size={11} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>
      <div className="flex flex-col px-1">
        <span className="text-xs font-bold premium-card-title truncate" title={channel.name}>{cleanMovieName(channel.name)}</span>
      </div>
    </div>
  );
});

const handleDragOverHelper = (e: React.DragEvent) => {
  e.preventDefault();
};

export const MoviesView = React.memo(function MoviesView({
  selectedGroup,
  activeMovieCategory,
  setActiveMovieCategory,
  categorySearchQuery,
  setCategorySearchQuery,
  movieFavCatsToShow,
  movieCat,
  visibleMovieCategoryLimit,
  setVisibleMovieCategoryLimit,
  filteredDisplayItems,
  handleMainScroll,
  handleOpenDetails,
  handlePlayStream,
  checkedStatusMap,
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: MoviesViewProps) {
  const { t, language } = useSettings();
  const { addDownload, isDownloading } = useDownloads();
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; item: PlaylistItem } | null>(null);

  if (selectedGroup !== 'Sinema') return null;

  const openContextMenu = (event: React.MouseEvent, item: PlaylistItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  };



  const otherCategories = movieCat.filteredOtherCategories;

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] page-transition-enter pb-12" onContextMenu={() => setContextMenu(null)}>
      {/* 1. Left Categories Sidebar */}
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2 bg-neutral-950/40 border border-white/5 rounded-[24px] p-4 h-full overflow-y-auto shadow-lg select-none hide-scrollbar">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">{language === 'tr' ? 'Kategoriler' : 'Categories'}</span>
          <button type="button"
            onClick={() => movieCat.setEditMode(!movieCat.editMode)}
            className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition-colors focusable-item ${movieCat.editMode ? 'bg-[var(--accent-color)] text-black' : 'bg-white/5 hover:bg-white/10 text-neutral-400'}`}
          >
            {movieCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
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

        {/* All Movies Button */}
        <button type="button"
          onClick={() => { setActiveMovieCategory('Tümü'); setVisibleCount(100); }}
          className={`flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${
            activeMovieCategory === 'Tümü'
              ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
              : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
          }`}
        >
          <Radio size={14} className={activeMovieCategory === 'Tümü' ? 'text-[var(--accent-color)]' : 'text-neutral-500'} />
          <span>{language === 'tr' ? 'Tüm Filmler' : 'All Movies'}</span>
        </button>

        {/* Favorites Categories Section */}
        {movieFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/5">
            <span className="text-[9px] tracking-widest font-extrabold text-red-500/50 uppercase px-2 mb-1 flex items-center gap-1.5"><Heart size={10} /> {t('navbar.favorites')}</span>
            {movieFavCatsToShow.map(group => {
              const CatIcon = getCategoryIcon(group);
              const isCatActive = activeMovieCategory === group;
              return (
                <div
                  key={`fav-movie-${group}`}
                  className={`relative flex items-center group transition-transform ${movieCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${movieCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  draggable={movieCat.editMode}
                  onDragStart={(e) => movieCat.handleDragStart(e, group)}
                  onDragOver={handleDragOverHelper}
                  onDrop={(e) => movieCat.handleDrop(e, group)}
                >
                  <button type="button"
                    onClick={() => { setActiveMovieCategory(group); setVisibleCount(100); }}
                    className={`w-full flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${movieCat.editMode ? 'pr-16' : 'pr-4'} ${
                      isCatActive
                        ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
                        : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
                    }`}
                  >
                    <CatIcon size={14} className={isCatActive ? 'text-[var(--accent-color)] animate-pulse' : 'text-neutral-500'} />
                    <span className="truncate">{group}</span>
                  </button>
                  {movieCat.editMode && (
                    <div className="absolute right-2.5 flex items-center gap-1 z-20">
                      <button type="button"
                        onClick={(e) => movieCat.toggleFavorite(group, e)}
                        className="w-6 h-6 rounded-md bg-black/40 text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                        title={language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'}
                       aria-label={language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'}>
                        <Heart size={11} fill="currentColor" />
                      </button>
                      <button type="button"
                        onClick={(e) => movieCat.handleHide(group, e)}
                        className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                        title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                       aria-label={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}>
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
          {otherCategories.slice(0, visibleMovieCategoryLimit).map(group => {
            const CatIcon = getCategoryIcon(group);
            const isCatActive = activeMovieCategory === group;
            return (
              <div
                key={group}
                className={`relative flex items-center group transition-transform ${movieCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${movieCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                draggable={movieCat.editMode}
                onDragStart={(e) => movieCat.handleDragStart(e, group)}
                onDragOver={handleDragOverHelper}
                onDrop={(e) => movieCat.handleDrop(e, group)}
              >
                <button type="button"
                  onClick={() => { setActiveMovieCategory(group); setVisibleCount(100); }}
                  className={`w-full flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${movieCat.editMode ? 'pr-16' : 'pr-4'} ${
                    isCatActive
                      ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
                      : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
                  }`}
                >
                  <CatIcon size={14} className={isCatActive ? 'text-[var(--accent-color)] animate-pulse' : 'text-neutral-500'} />
                  <span className="truncate">{group}</span>
                </button>
                {movieCat.editMode && (
                  <div className="absolute right-2.5 flex items-center gap-1 z-20">
                    <button type="button"
                      onClick={(e) => movieCat.toggleFavorite(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                      title={language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
                     aria-label={language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}>
                      <Heart size={11} />
                    </button>
                    <button type="button"
                      onClick={(e) => movieCat.handleHide(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                      title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                     aria-label={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {otherCategories.length > visibleMovieCategoryLimit && (
            <button type="button"
              onClick={() => setVisibleMovieCategoryLimit(prev => prev + 50)}
              className="w-full py-2.5 mt-1 rounded-xl text-[10px] font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all tracking-wider uppercase border border-white/5 focusable-item cursor-pointer"
            >
              {language === 'tr' ? 'Daha Fazla Göster' : 'Show More'} (+{otherCategories.length - visibleMovieCategoryLimit})
            </button>
          )}
        </div>
      </div>

      {/* 2. Middle Content Grid */}
      <div className="flex-1 flex flex-col gap-3 h-full">
        <div className="flex-1 overflow-y-auto bg-neutral-950/20 border border-white/5 rounded-[24px] p-2 md:p-4 shadow-inner" onScroll={handleMainScroll}>
          {filteredDisplayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-20 opacity-50 select-none">
              <Tv size={32} className="text-neutral-500 mb-3" />
              <h3 className="text-base font-semibold text-neutral-300">{language === 'tr' ? 'Film Bulunamadı' : 'No Movies Found'}</h3>
            </div>
          ) : (
            <VirtualizedGrid
              items={filteredDisplayItems}
              renderItem={(channel) => (
                <MovieCard
                  key={channel.id}
                  channel={channel}
                  onClick={handleOpenDetails}
                  isOnline={checkedStatusMap[channel.id]}
                  isFavorite={globalFavorites.includes(channel.id)}
                  isDownloading={isDownloading(channel.url)}
                  onToggleFavorite={toggleFavorite}
                  onDownload={addDownload}
                  isGenericLogo={!!channel.isGenericLogo}
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
          isDownloading={isDownloading(contextMenu.item.url)}
          onClose={() => setContextMenu(null)}
          onPlay={handlePlayStream}
          onOpenDetails={(item) => handleOpenDetails(item as PlaylistItem)}
          onToggleFavorite={(id) => toggleFavorite(id)}
          onDownload={addDownload}
        />
      )}
    </div>
  );
});
