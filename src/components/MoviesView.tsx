import React from 'react';
import { Search, Heart, Trash2, Tv, Play } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import { ImageWithFallback } from './ImageWithFallback';
import { VirtualizedGrid } from './VirtualizedGrid';
import { MediaCardContextMenu } from './MediaCardContextMenu';
import { useSettings } from '../context/SettingsContext';

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
  genericLogosSet: Set<string>;
  checkedStatusMap: Record<string, 'online' | 'offline'>;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

export const MovieCard = React.memo(({
  channel,
  onClick,
  isOnline,
  isFavorite,
  onToggleFavorite,
  isGenericLogo,
  onContextMenu
}: {
  channel: PlaylistItem;
  onClick: (item: PlaylistItem) => void;
  isOnline: 'online' | 'offline' | undefined;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  isGenericLogo: boolean;
  onContextMenu?: (event: React.MouseEvent, item: PlaylistItem) => void;
}) => {
  return (
    <div
      className="group flex flex-col gap-2.5 cursor-pointer focusable-item"
      tabIndex={0}
      onClick={() => onClick(channel)}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
    >
      <div className="premium-card aspect-[2/3] flex items-center justify-center">
        <ImageWithFallback
          src={channel.logo}
          name={channel.name}
          group={channel.group || 'MOVIE'}
          itemType={channel.type}
          isGenericLogo={isGenericLogo}
          aspect="portrait"
        />

        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play size={16} fill="#000" className="ml-0.5" />
          </div>
        </div>

        {isOnline && (
          <div
            className={`absolute bottom-2.5 left-2.5 z-20 w-2 h-2 rounded-full border border-black/40 shadow-sm ${
              isOnline === 'online' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={isOnline === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
          />
        )}
        <button
          onClick={(e) => onToggleFavorite(channel.id, e)}
          className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110"
          title="Favorilere Ekle"
        >
          <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>
      <div className="flex flex-col px-1.5">
        <span className="text-xs font-bold premium-card-title truncate">{channel.name}</span>
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mt-0.5">{channel.group || 'Genel'}</span>
      </div>
    </div>
  );
});

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
  genericLogosSet,
  checkedStatusMap,
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: MoviesViewProps) {
  const { t, language } = useSettings();
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; item: PlaylistItem } | null>(null);

  if (selectedGroup !== 'Sinema') return null;

  const openContextMenu = (event: React.MouseEvent, item: PlaylistItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const otherCategories = movieCat.filteredOtherCategories;

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in pb-12" onContextMenu={() => setContextMenu(null)}>
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2 bg-neutral-950/40 border border-white/5 rounded-[24px] p-4 h-full overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">{language === 'tr' ? 'Kategoriler' : 'Categories'}</span>
          <button
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

        <button
          onClick={() => { setActiveMovieCategory('Tümü'); setVisibleCount(100); }}
          className={`text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all focusable-item ${activeMovieCategory === 'Tümü' ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
        >
          {language === 'tr' ? 'Tüm Filmler' : 'All Movies'}
        </button>
        {movieFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
            <span className="text-[9px] tracking-widest font-extrabold text-red-500/50 uppercase px-2 mb-1 flex items-center gap-1.5"><Heart size={10} /> {t('navbar.favorites')}</span>
            {movieFavCatsToShow.map(group => (
              <div
                key={`fav-movie-${group}`}
                className={`relative flex items-center group transition-transform ${movieCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${movieCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                draggable={movieCat.editMode}
                onDragStart={(e) => movieCat.handleDragStart(e, group)}
                onDragOver={handleDragOver}
                onDrop={(e) => movieCat.handleDrop(e, group)}
              >
                <button
                  onClick={() => { setActiveMovieCategory(group); setVisibleCount(100); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all focusable-item ${movieCat.editMode ? 'pr-16' : 'pr-4'} ${activeMovieCategory === group ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}
                >
                  {group}
                </button>
                {movieCat.editMode && (
                  <div className="absolute right-2.5 flex items-center gap-1 z-20">
                    <button
                      onClick={(e) => movieCat.toggleFavorite(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                      title={language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'}
                    >
                      <Heart size={11} fill="currentColor" />
                    </button>
                    <button
                      onClick={(e) => movieCat.handleHide(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                      title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
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
          <span className="text-[9px] tracking-widest font-extrabold text-neutral-600 uppercase px-2 mb-1">{language === 'tr' ? 'Diğerleri' : 'Others'}</span>
          {otherCategories.slice(0, visibleMovieCategoryLimit).map(group => (
            <div
              key={group}
              className={`relative flex items-center group transition-transform ${movieCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${movieCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
              draggable={movieCat.editMode}
              onDragStart={(e) => movieCat.handleDragStart(e, group)}
              onDragOver={handleDragOver}
              onDrop={(e) => movieCat.handleDrop(e, group)}
            >
              <button
                onClick={() => { setActiveMovieCategory(group); setVisibleCount(100); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all focusable-item ${movieCat.editMode ? 'pr-16' : 'pr-4'} ${activeMovieCategory === group ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
              >
                {group}
              </button>
              {movieCat.editMode && (
                <div className="absolute right-2.5 flex items-center gap-1 z-20">
                  <button
                    onClick={(e) => movieCat.toggleFavorite(group, e)}
                    className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                    title={language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
                  >
                    <Heart size={11} />
                  </button>
                  <button
                    onClick={(e) => movieCat.handleHide(group, e)}
                    className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                    title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {otherCategories.length > visibleMovieCategoryLimit && (
            <button
              onClick={() => setVisibleMovieCategoryLimit(prev => prev + 50)}
              className="w-full py-2.5 mt-1 rounded-xl text-[10px] font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all tracking-wider uppercase border border-white/5 focusable-item"
            >
              {language === 'tr' ? 'Daha Fazla Göster' : 'Show More'} (+{otherCategories.length - visibleMovieCategoryLimit})
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-3 h-full">
        <div className="flex-1 overflow-y-auto bg-neutral-950/20 border border-white/5 rounded-[24px] p-2 md:p-4 shadow-inner" onScroll={handleMainScroll}>
          {filteredDisplayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-20 opacity-50">
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
                  onToggleFavorite={toggleFavorite}
                  isGenericLogo={channel.logo ? genericLogosSet.has(channel.logo) : false}
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
          onPlay={handlePlayStream}
          onOpenDetails={(item) => handleOpenDetails(item as PlaylistItem)}
          onToggleFavorite={(id) => toggleFavorite(id)}
        />
      )}
    </div>
  );
});
