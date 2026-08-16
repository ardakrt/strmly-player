import React from 'react';
import {
  Search, Heart, Trash2, X, Sparkles, LayoutGrid, SlidersHorizontal, GripVertical
} from 'lucide-react';

export interface LiveCategoryManager {
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
  draggedCategory: string | null;
  handleDragStart: (e: React.DragEvent, group: string) => void;
  handleDrop: (e: React.DragEvent, group: string) => void;
  toggleFavorite: (group: string, e: React.MouseEvent) => void;
  handleHide: (group: string, e: React.MouseEvent) => void;
  filteredOtherCategories: string[];
}

interface LiveCategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  liveCat: LiveCategoryManager;
  liveFavCatsToShow: string[];
  activeLiveCategory: string;
  setActiveLiveCategory: (cat: string) => void;
  setVisibleCount: (count: number) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (q: string) => void;
  visibleLiveCategoryLimit: number;
  setVisibleLiveCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  language: string;
  t: (key: string) => string;
}

const handleDragOverHelper = (e: React.DragEvent) => { e.preventDefault(); };

export const LiveCategoryDrawer = React.memo(({
  open,
  onClose,
  liveCat,
  liveFavCatsToShow,
  activeLiveCategory,
  setActiveLiveCategory,
  setVisibleCount,
  categorySearchQuery,
  setCategorySearchQuery,
  visibleLiveCategoryLimit,
  setVisibleLiveCategoryLimit,
  language,
  t
}: LiveCategoryDrawerProps) => {
  if (!open) return null;

  const renderRow = (group: string, favorite = false) => {
    const isActive = activeLiveCategory === group;
    return (
      <div
        key={`${favorite ? 'fav' : 'cat'}-${group}`}
        className={`relative flex items-center ${liveCat.draggedCategory === group ? 'opacity-40' : ''} ${
          liveCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        draggable={liveCat.editMode}
        onDragStart={(e) => liveCat.handleDragStart(e, group)}
        onDragOver={handleDragOverHelper}
        onDrop={(e) => liveCat.handleDrop(e, group)}
      >
        <button
          type="button"
          onClick={() => { setActiveLiveCategory(group); setVisibleCount(100); onClose(); }}
          className={`series-category-item relative ${isActive ? 'is-active' : ''} flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors  cursor-pointer ${
            liveCat.editMode ? 'pr-16' : ''
          } ${isActive ? 'border-white/[0.12] bg-white/[0.06] text-white' : 'border-transparent text-white/62 hover:bg-white/[0.04] hover:text-white/92'}`}
          aria-current={isActive ? 'true' : undefined}
        >
          {isActive && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-white/90" aria-hidden="true" />}
          {liveCat.editMode && <GripVertical size={11} className="shrink-0 text-white/25" />}
          {favorite ? (
            <Heart size={11} fill="currentColor" className="shrink-0 text-red-400" />
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
              <span className="text-[10px] font-black text-white/45">{group.slice(0, 1).toUpperCase()}</span>
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{group}</span>
        </button>

        {liveCat.editMode && (
          <div className="absolute right-1.5 z-20 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => liveCat.toggleFavorite(group, e)}
              className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                favorite ? 'text-red-400 hover:bg-red-400/10' : 'text-white/35 hover:bg-white/[0.06] hover:text-red-300'
              }`}
              title={favorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
            >
              <Heart size={11} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={(e) => liveCat.handleHide(group, e)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-red-400/10 hover:text-red-400 cursor-pointer"
              title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/20 to-transparent cursor-pointer"
      />
      <aside className="series-catalog-panel series-category-panel relative flex h-full w-[268px] flex-col overflow-hidden border-l border-white/[0.07] shadow-[-24px_0_60px_rgba(0,0,0,0.45)] animate-fade-in">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
            <SlidersHorizontal size={11} />
            {language === 'tr' ? 'Kategoriler' : 'Categories'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => liveCat.setEditMode(!liveCat.editMode)}
              className={`h-6 rounded-md border border-transparent px-1.5 text-[8.5px] font-bold uppercase transition-colors  cursor-pointer ${
                liveCat.editMode ? 'bg-white/[0.08] text-white' : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'
              }`}
            >
              {liveCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
            </button>
            <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer" aria-label={language === 'tr' ? 'Kapat' : 'Close'}>
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="relative shrink-0 px-3 pt-3">
          <Search size={12} className="pointer-events-none absolute left-6 top-1/2 mt-1.5 -translate-y-1/2 text-white/28" />
          <input
            type="text"
            placeholder={language === 'tr' ? 'Kategori ara…' : 'Search category…'}
            value={categorySearchQuery}
            onChange={(e) => setCategorySearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-white/[0.06] bg-black/15 pl-8 pr-3 text-[10.5px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/12 focus:bg-white/[0.035] "
          />
        </div>

        <div className="custom-catalog-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => { setActiveLiveCategory('Tümü'); setVisibleCount(100); onClose(); }}
            className={`series-category-item ${activeLiveCategory === 'Tümü' ? 'is-active' : ''} mb-1 flex w-full items-center rounded-lg border px-3 py-1.5 text-left text-[11.5px] font-medium transition-colors  cursor-pointer ${
              activeLiveCategory === 'Tümü' ? 'border-white/[0.07] text-white' : 'border-transparent text-white/52 hover:bg-white/[0.035] hover:text-white/82'
            }`}
            aria-current={activeLiveCategory === 'Tümü' ? 'true' : undefined}
          >
            <Sparkles size={11} className="mr-2 shrink-0 text-amber-400/80" />
            <span className="min-w-0 flex-1 truncate">{language === 'tr' ? 'Tüm Kanallar' : 'All Channels'}</span>
          </button>

          {liveFavCatsToShow.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-red-400/45">
                <Heart size={10} /> {t('navbar.favorites')}
              </span>
              {liveFavCatsToShow.map((group) => renderRow(group, true))}
            </div>
          )}

          {liveCat.filteredOtherCategories.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
                <LayoutGrid size={9} /> {language === 'tr' ? 'Diğerleri' : 'Others'}
                <span className="tabular-nums text-white/25">{liveCat.filteredOtherCategories.length}</span>
              </span>
              {liveCat.filteredOtherCategories.slice(0, visibleLiveCategoryLimit).map((group) => renderRow(group))}
            </div>
          )}

          {liveCat.filteredOtherCategories.length > visibleLiveCategoryLimit && (
            <button
              type="button"
              onClick={() => setVisibleLiveCategoryLimit((prev) => prev + 50)}
              className="mt-2 w-full rounded-xl py-2 text-[10px] font-semibold tracking-wide text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/70  cursor-pointer"
            >
              {language === 'tr' ? 'Daha fazla' : 'Show more'} (+{liveCat.filteredOtherCategories.length - visibleLiveCategoryLimit})
            </button>
          )}

          {liveFavCatsToShow.length === 0 && liveCat.filteredOtherCategories.length === 0 && (
            <p className="px-2 py-8 text-center text-[10.5px] text-white/35">
              {language === 'tr' ? 'Kategori bulunamadı' : 'No categories found'}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
});
