import React, { useState, useEffect } from 'react';
import {
  Search, Heart, Trash2, Tv, Play, Download, Star
} from 'lucide-react';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { ImageWithFallback } from './ImageWithFallback';
import { VirtualizedGrid } from './VirtualizedGrid';
import { MediaCardContextMenu } from './MediaCardContextMenu';
import { useSettings } from '../context/SettingsContext';
import { cleanMovieName, getCachedTmdbResult } from '../utils/tmdb';
import { useDownloads } from '../hooks/useDownloads';

const getCategoryPresentation = (name: string) => {
  const label = name
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\bDiziler?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return label || name;
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

export const SeriesCard = React.memo(({
  series,
  onClick,
  isFavorite,
  isDownloading = false,
  onToggleFavorite,
  onDownload,
  isGenericLogo,
  seasonsCount,
  onContextMenu
}: {
  series: GroupedSeries;
  onClick: (series: GroupedSeries) => void;
  isFavorite: boolean;
  isDownloading?: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  onDownload?: (series: GroupedSeries) => void;
  isGenericLogo: boolean;
  seasonsCount: number;
  onContextMenu?: (event: React.MouseEvent, series: GroupedSeries) => void;
}) => {
  const { language } = useSettings();
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getCachedTmdbResult('tv', series.name).then((res) => {
      if (active && res && res.vote_average) {
        setRating(res.vote_average);
      }
    });
    return () => { active = false; };
  }, [series.name]);

  const quality = getQualityLabel(series.name);
  return (
    <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => onClick(series))(); } }} role="button"
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

        {rating !== null && rating > 0 && (
          <div className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/10 text-[9px] font-black text-amber-400 flex items-center gap-0.5 shadow-md animate-fade-in">
            <Star size={9} fill="currentColor" />
            <span>{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Seasons/Episodes Badge Overlay */}
        <div className="absolute bottom-2.5 left-2.5 z-20 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5 shadow-md">
          <span>
            {language === 'tr'
              ? `${seasonsCount} S • ${series.episodesCount} B`
              : `${seasonsCount} S • ${series.episodesCount} E`}
          </span>
          {quality && (
            <span className="px-1 rounded bg-[var(--accent-color)]/25 text-[var(--accent-color)] text-[8px] font-black">{quality}</span>
          )}
        </div>

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
                  if (!isDownloading) onDownload(series);
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

        {/* Favorite Button */}
        <button type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(series.id, e);
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
        <span className="text-xs font-bold premium-card-title truncate" title={series.name}>{cleanMovieName(series.name)}</span>
      </div>
    </div>
  );
});

const handleDragOverHelper = (e: React.DragEvent) => {
  e.preventDefault();
};

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
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: SeriesViewProps) {
  const { t, language } = useSettings();
  const { addDownload, isDownloading } = useDownloads();
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; item: GroupedSeries } | null>(null);

  if (selectedGroup !== 'Diziler') return null;

  const openContextMenu = (event: React.MouseEvent, item: GroupedSeries) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  };



  const otherCategories = seriesCat.filteredOtherCategories;

  const categoryBtnClass = (isActive: boolean, editPad = false) =>
    `series-category-item ${isActive ? 'is-active' : ''} w-full flex items-center text-left px-3 py-1.5 rounded-lg border text-[11.5px] font-medium transition-colors focusable-item ${
      editPad ? 'pr-14' : ''
    } ${
      isActive
        ? 'border-white/[0.07] text-white'
        : 'border-transparent text-white/52 hover:bg-white/[0.035] hover:text-white/82'
    }`;

  const activeTitle =
    activeSeriesCategory === 'Tümü'
      ? language === 'tr'
        ? 'Tüm Diziler'
        : 'All Series'
      : activeSeriesCategory;

  const visibleCategories = otherCategories.slice(0, visibleSeriesCategoryLimit);

  const renderCategoryRow = (group: string, favorite = false) => {
    const isActive = activeSeriesCategory === group;
    const label = getCategoryPresentation(group);

    return (
      <div
        key={`${favorite ? 'favorite' : 'category'}-${group}`}
        className={`relative flex items-center group ${
          seriesCat.draggedCategory === group ? 'opacity-50' : ''
        } ${seriesCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={seriesCat.editMode}
        onDragStart={(event) => seriesCat.handleDragStart(event, group)}
        onDragOver={handleDragOverHelper}
        onDrop={(event) => seriesCat.handleDrop(event, group)}
      >
        <button
          type="button"
          onClick={() => {
            setActiveSeriesCategory(group);
            setVisibleCount(100);
          }}
          className={categoryBtnClass(isActive, seriesCat.editMode)}
          title={group}
          aria-current={isActive ? 'true' : undefined}
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </button>

        {seriesCat.editMode && (
          <div className="absolute right-1.5 flex items-center gap-0.5 z-20">
            <button
              type="button"
              onClick={(event) => seriesCat.toggleFavorite(group, event)}
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
              onClick={(event) => seriesCat.handleHide(group, event)}
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
      className="series-catalog-shell grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden md:grid-cols-[218px_minmax(0,1fr)] md:grid-rows-1 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-3"
      onContextMenu={() => setContextMenu(null)}
    >
      {/* Categories — flush rail, full height under navbar */}
      <aside className="series-catalog-panel series-category-panel flex min-h-0 max-h-[36vh] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-white/[0.06] p-3 select-none hide-scrollbar md:max-h-none">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[9px] tracking-[0.16em] font-bold text-white/28 uppercase">
            {language === 'tr' ? 'Kategoriler' : 'Categories'}
          </span>
          <button
            type="button"
            onClick={() => seriesCat.setEditMode(!seriesCat.editMode)}
            className={`h-6 rounded-md border border-transparent px-1.5 text-[8.5px] font-bold uppercase transition-colors focusable-item cursor-pointer ${
              seriesCat.editMode
                ? 'bg-white/[0.08] text-white'
                : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'
            }`}
          >
            {seriesCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
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
            setActiveSeriesCategory('Tümü');
            setVisibleCount(100);
          }}
          className={categoryBtnClass(activeSeriesCategory === 'Tümü')}
          aria-current={activeSeriesCategory === 'Tümü' ? 'true' : undefined}
        >
          <span className="min-w-0 flex-1 truncate">{language === 'tr' ? 'Tüm Diziler' : 'All Series'}</span>
        </button>

        {seriesFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-white/[0.05]">
            <span className="text-[9px] tracking-[0.14em] font-bold text-red-400/45 uppercase px-2 mb-1 flex items-center gap-1.5">
              <Heart size={10} /> {t('navbar.favorites')}
            </span>
            {seriesFavCatsToShow.map((group) => renderCategoryRow(group, true))}
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

        {otherCategories.length > visibleSeriesCategoryLimit && (
          <button
            type="button"
            onClick={() => setVisibleSeriesCategoryLimit((prev) => prev + 50)}
            className="w-full py-2 mt-2 rounded-xl text-[10px] font-semibold text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-colors tracking-wide focusable-item cursor-pointer"
          >
            {language === 'tr' ? 'Daha fazla' : 'Show more'} (+
            {otherCategories.length - visibleSeriesCategoryLimit})
          </button>
        )}
      </aside>

      {/* Series grid — edge-to-edge; divider runs full height of shell content */}
      <section className="series-catalog-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.07]">
        <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5 lg:px-6">
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
              {language === 'tr' ? 'Diziler' : 'Series'}
            </p>
            <h2 className="truncate text-[18px] font-bold tracking-[-0.02em] text-white/92 lg:text-[20px]">
              {activeTitle}
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38">
            {groupedSeriesList.length > 0
              ? language === 'tr'
                ? `${groupedSeriesList.length} dizi`
                : `${groupedSeriesList.length} series`
              : null}
          </span>
        </header>

        <div
          className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4 lg:px-5 lg:pt-5"
          onScroll={handleMainScroll}
        >
          {groupedSeriesList.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-20 text-center select-none">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                <Tv size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white/55">
                {language === 'tr' ? 'Dizi bulunamadı' : 'No series found'}
              </h3>
            </div>
          ) : (
            <VirtualizedGrid
              items={groupedSeriesList}
              compactLargeCards
              renderItem={(series) => {
                const firstEpisode = series.seasons[1]?.[0]?.item;
                return (
                  <SeriesCard
                    key={series.id}
                    series={series}
                    onClick={handleOpenSeriesModalDirect}
                    isFavorite={globalFavorites.includes(series.id)}
                    isDownloading={firstEpisode ? isDownloading(firstEpisode.url) : false}
                    onToggleFavorite={toggleFavorite}
                    onDownload={firstEpisode ? () => addDownload(firstEpisode) : undefined}
                    isGenericLogo={!!series.isGenericLogo}
                    seasonsCount={Object.keys(series.seasons).length}
                    onContextMenu={openContextMenu}
                  />
                );
              }}
            />
          )}
        </div>
      </section>

      {contextMenu &&
        (() => {
          const firstEpisode = contextMenu.item.seasons[1]?.[0]?.item;
          return (
            <MediaCardContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              item={contextMenu.item}
              isFavorite={globalFavorites.includes(contextMenu.item.id)}
              isDownloading={firstEpisode ? isDownloading(firstEpisode.url) : false}
              onClose={() => setContextMenu(null)}
              onOpenDetails={(item) => handleOpenSeriesModalDirect(item as GroupedSeries)}
              onToggleFavorite={(id) => toggleFavorite(id)}
              onDownload={firstEpisode ? () => addDownload(firstEpisode) : undefined}
            />
          );
        })()}
    </div>
  );
});
