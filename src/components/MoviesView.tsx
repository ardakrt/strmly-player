import React, { useState, useEffect } from 'react';
import {
  Search, Heart, Trash2, Tv, Play, Download,
  Trophy, Film, Newspaper, Music, Gamepad, Compass,
  Sparkles, Star
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
    <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => onClick(channel))(); } }} role="button"
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

  const categoryBtnClass = (isActive: boolean, editPad = false) =>
    `series-category-item ${isActive ? 'is-active' : ''} w-full flex items-center text-left px-3 py-1.5 rounded-lg border text-[11.5px] font-medium transition-colors focusable-item ${
      editPad ? 'pr-14' : ''
    } ${
      isActive
        ? 'border-white/[0.07] text-white'
        : 'border-transparent text-white/52 hover:bg-white/[0.035] hover:text-white/82'
    }`;

  const activeTitle =
    activeMovieCategory === 'Tümü'
      ? language === 'tr'
        ? 'Tüm Filmler'
        : 'All Movies'
      : activeMovieCategory;

  const visibleCategories = otherCategories.slice(0, visibleMovieCategoryLimit);

  const renderCategoryRow = (group: string, favorite = false) => {
    const isActive = activeMovieCategory === group;

    return (
      <div
        key={`${favorite ? 'favorite' : 'category'}-${group}`}
        className={`relative flex items-center group ${
          movieCat.draggedCategory === group ? 'opacity-50' : ''
        } ${movieCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={movieCat.editMode}
        onDragStart={(event) => movieCat.handleDragStart(event, group)}
        onDragOver={handleDragOverHelper}
        onDrop={(event) => movieCat.handleDrop(event, group)}
      >
        <button
          type="button"
          onClick={() => {
            setActiveMovieCategory(group);
            setVisibleCount(100);
          }}
          className={categoryBtnClass(isActive, movieCat.editMode)}
          title={group}
          aria-current={isActive ? 'true' : undefined}
        >
          <span className="min-w-0 flex-1 truncate">{group}</span>
        </button>

        {movieCat.editMode && (
          <div className="absolute right-1.5 flex items-center gap-0.5 z-20">
            <button
              type="button"
              onClick={(event) => movieCat.toggleFavorite(group, event)}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                favorite ? 'text-red-400 hover:bg-red-400/10' : 'text-white/35 hover:bg-white/[0.06] hover:text-red-300'
              }`}
              title={favorite
                ? language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'
                : language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
              aria-label={favorite
                ? language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'
                : language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
            >
              <Heart size={11} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={(event) => movieCat.handleHide(group, event)}
              className="w-6 h-6 rounded-lg text-white/35 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-colors cursor-pointer"
              title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
              aria-label={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="series-catalog-shell grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden page-transition-enter md:grid-cols-[218px_minmax(0,1fr)] md:grid-rows-1 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-3"
      onContextMenu={() => setContextMenu(null)}
    >
      <aside className="series-catalog-panel series-category-panel flex min-h-0 max-h-[36vh] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-white/[0.06] p-3 select-none hide-scrollbar md:max-h-none">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[9px] tracking-[0.16em] font-bold text-white/28 uppercase">
            {language === 'tr' ? 'Kategoriler' : 'Categories'}
          </span>
          <button
            type="button"
            onClick={() => movieCat.setEditMode(!movieCat.editMode)}
            className={`h-6 rounded-md border border-transparent px-1.5 text-[8.5px] font-bold uppercase transition-colors focusable-item cursor-pointer ${
              movieCat.editMode
                ? 'bg-white/[0.08] text-white'
                : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'
            }`}
          >
            {movieCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
          </button>
        </div>

        <div className="relative mb-2 shrink-0">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/28" />
          <input
            type="text"
            placeholder={language === 'tr' ? 'Kategori ara…' : 'Search category…'}
            value={categorySearchQuery}
            onChange={(e) => setCategorySearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-white/[0.06] bg-black/15 pl-8 pr-3 text-[10.5px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/12 focus:bg-white/[0.035] focusable-item"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveMovieCategory('Tümü');
            setVisibleCount(100);
          }}
          className={categoryBtnClass(activeMovieCategory === 'Tümü')}
          aria-current={activeMovieCategory === 'Tümü' ? 'true' : undefined}
        >
          <span className="min-w-0 flex-1 truncate">{language === 'tr' ? 'Tüm Filmler' : 'All Movies'}</span>
        </button>

        {movieFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-white/[0.05]">
            <span className="text-[9px] tracking-[0.14em] font-bold text-red-400/45 uppercase px-2 mb-1 flex items-center gap-1.5">
              <Heart size={10} /> {t('navbar.favorites')}
            </span>
            {movieFavCatsToShow.map((group) => renderCategoryRow(group, true))}
          </div>
        )}

        {visibleCategories.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-white/[0.05]">
            <span className="text-[9px] tracking-[0.14em] font-bold text-white/22 uppercase px-2 mb-1">
              {language === 'tr' ? 'Diğerleri' : 'Others'}
            </span>
            {visibleCategories.map((group) => renderCategoryRow(group))}
          </div>
        )}

        {otherCategories.length > visibleMovieCategoryLimit && (
          <button
            type="button"
            onClick={() => setVisibleMovieCategoryLimit((prev) => prev + 50)}
            className="w-full py-2 mt-2 rounded-xl text-[10px] font-semibold text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-colors tracking-wide focusable-item cursor-pointer"
          >
            {language === 'tr' ? 'Daha fazla' : 'Show more'} (+
            {otherCategories.length - visibleMovieCategoryLimit})
          </button>
        )}
      </aside>

      <section className="series-catalog-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.07]">
        <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5 lg:px-6">
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
              {language === 'tr' ? 'Filmler' : 'Movies'}
            </p>
            <h2 className="truncate text-[18px] font-bold tracking-[-0.02em] text-white/92 lg:text-[20px]">
              {activeTitle}
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38">
            {filteredDisplayItems.length > 0
              ? language === 'tr'
                ? `${filteredDisplayItems.length} film`
                : `${filteredDisplayItems.length} movies`
              : null}
          </span>
        </header>

        <div
          className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4 lg:px-5 lg:pt-5"
          onScroll={handleMainScroll}
        >
          {filteredDisplayItems.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-20 text-center select-none">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                <Tv size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white/55">
                {language === 'tr' ? 'Film bulunamadı' : 'No movies found'}
              </h3>
            </div>
          ) : (
            <VirtualizedGrid
              items={filteredDisplayItems}
              compactLargeCards
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
      </section>
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
