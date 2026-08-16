import React from 'react';
import {
  Search, Heart, Trash2, Tv, X, Sparkles, LayoutGrid, SlidersHorizontal,
  GripVertical, Film, Star
} from 'lucide-react';
import { BrandLogo } from '../series/BrandLogo';
import {
  getCategoryPresentation, getPlatformConfig, resolvePlatformLogoUrl,
  getCategoryMergeKey, type CategoryGroups,
} from '../series/seriesPlatforms';

export interface MovieCategoryManager {
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
  draggedCategory: string | null;
  handleDragStart: (e: React.DragEvent, group: string) => void;
  handleDrop: (e: React.DragEvent, group: string) => void;
  toggleFavorite: (group: string, e: React.MouseEvent) => void;
  handleHide: (group: string, e: React.MouseEvent) => void;
  filteredOtherCategories: string[];
}

interface MovieCategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  movieCat: MovieCategoryManager;
  movieFavCatsToShow: string[];
  classified: CategoryGroups;
  activeMovieCategory: string;
  setActiveMovieCategory: (cat: string) => void;
  setVisibleCount: (count: number) => void;
  movieCategoryCounts: Map<string, number>;
  categorySearchQuery: string;
  setCategorySearchQuery: (q: string) => void;
  visibleMovieCategoryLimit: number;
  setVisibleMovieCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  language: string;
  t: (key: string) => string;
}

const handleDragOverHelper = (e: React.DragEvent) => { e.preventDefault(); };

// Merge-key dedupe: playlist vendors often ship sibling categories that render
// identically once decorative words are stripped. Collapse each merge key to a
// single representative so the drawer lists one entry per platform, mirroring
// the showcase rails. The representative is the variant with the most movies
// (a richer sibling found later upgrades it), so selecting the row shows real
// content instead of the stray 1-item variant.
const useDedupedGroups = (
  movieFavCatsToShow: string[],
  classified: CategoryGroups,
  movieCategoryCounts: Map<string, number>,
) =>
  React.useMemo(() => {
    const registry = new Map<string, { arr: string[]; idx: number }>();
    const take = (cats: string[], arr: string[]) => {
      for (const cat of cats) {
        const key = getCategoryMergeKey(cat);
        const slot = registry.get(key);
        if (slot) {
          const current = slot.arr[slot.idx];
          if ((movieCategoryCounts.get(cat) || 0) > (movieCategoryCounts.get(current) || 0)) {
            slot.arr[slot.idx] = cat;
          }
          continue;
        }
        registry.set(key, { arr, idx: arr.length });
        arr.push(cat);
      }
    };
    const favorites: string[] = [];
    const platforms: string[] = [];
    const genres: string[] = [];
    const regions: string[] = [];
    const others: string[] = [];
    take(movieFavCatsToShow, favorites);
    take(classified.platforms, platforms);
    take(classified.genres, genres);
    take(classified.regions, regions);
    take(classified.others, others);
    return { favorites, platforms, genres, regions, others };
  }, [movieFavCatsToShow, classified, movieCategoryCounts]);

export const MovieCategoryDrawer = React.memo(({
  open,
  onClose,
  movieCat,
  movieFavCatsToShow,
  classified,
  activeMovieCategory,
  setActiveMovieCategory,
  setVisibleCount,
  movieCategoryCounts,
  categorySearchQuery,
  setCategorySearchQuery,
  visibleMovieCategoryLimit,
  setVisibleMovieCategoryLimit,
  language,
  t
}: MovieCategoryDrawerProps) => {
  const deduped = useDedupedGroups(movieFavCatsToShow, classified, movieCategoryCounts);
  if (!open) return null;

  const renderRow = (group: string, favorite = false) => {
    // Compare by merge key so a selected sibling variant still highlights its
    // collapsed representative row.
    const isActive = getCategoryMergeKey(activeMovieCategory) === getCategoryMergeKey(group);
    const platform = getPlatformConfig(group);
    const logoUrl = resolvePlatformLogoUrl(platform);
    return (
      <div
        key={`${favorite ? 'fav' : 'cat'}-${group}`}
        className={`relative flex items-center ${movieCat.draggedCategory === group ? 'opacity-40' : ''} ${
          movieCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        draggable={movieCat.editMode}
        onDragStart={(e) => movieCat.handleDragStart(e, group)}
        onDragOver={handleDragOverHelper}
        onDrop={(e) => movieCat.handleDrop(e, group)}
      >
        <button
          type="button"
          onClick={() => { setActiveMovieCategory(group); setVisibleCount(100); onClose(); }}
          className={`series-category-item relative ${isActive ? 'is-active' : ''} flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors  cursor-pointer ${
            movieCat.editMode ? 'pr-16' : ''
          } ${isActive ? 'border-white/[0.12] bg-white/[0.06] text-white' : 'border-transparent text-white/62 hover:bg-white/[0.04] hover:text-white/92'}`}
          aria-current={isActive ? 'true' : undefined}
        >
          {isActive && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-white/90" aria-hidden="true" />}
          {movieCat.editMode && <GripVertical size={11} className="shrink-0 text-white/25" />}
          {logoUrl ? (
            <span className="grid h-7 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.045] px-1.5">
              <BrandLogo badge src={logoUrl} dotColor={platform?.dotColor} title={getCategoryPresentation(group)} />
            </span>
          ) : platform ? (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.045]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: platform.dotColor, boxShadow: `0 0 8px ${platform.dotColor}66` }} />
            </span>
          ) : favorite ? (
            <Heart size={11} fill="currentColor" className="shrink-0 text-red-400" />
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
              <span className="text-[10px] font-black text-white/45">{getCategoryPresentation(group).slice(0, 1).toUpperCase()}</span>
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{getCategoryPresentation(group)}</span>
        </button>

        {movieCat.editMode && (
          <div className="absolute right-1.5 z-20 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => movieCat.toggleFavorite(group, e)}
              className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                favorite ? 'text-red-400 hover:bg-red-400/10' : 'text-white/35 hover:bg-white/[0.06] hover:text-red-300'
              }`}
              title={favorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
            >
              <Heart size={11} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={(e) => movieCat.handleHide(group, e)}
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
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-[2px] cursor-pointer" />
      <aside className="series-catalog-panel series-category-panel relative flex h-full w-[268px] flex-col overflow-hidden border-l border-white/[0.07] shadow-[-24px_0_60px_rgba(0,0,0,0.45)] animate-fade-in">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
            <SlidersHorizontal size={11} />
            {language === 'tr' ? 'Kategoriler' : 'Categories'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => movieCat.setEditMode(!movieCat.editMode)}
              className={`h-6 rounded-md border border-transparent px-1.5 text-[8.5px] font-bold uppercase transition-colors  cursor-pointer ${
                movieCat.editMode ? 'bg-white/[0.08] text-white' : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'
              }`}
            >
              {movieCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
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
            onClick={() => { setActiveMovieCategory('Tümü'); setVisibleCount(100); onClose(); }}
            className={`series-category-item ${activeMovieCategory === 'Tümü' ? 'is-active' : ''} mb-1 flex w-full items-center rounded-lg border px-3 py-1.5 text-left text-[11.5px] font-medium transition-colors  cursor-pointer ${
              activeMovieCategory === 'Tümü' ? 'border-white/[0.07] text-white' : 'border-transparent text-white/52 hover:bg-white/[0.035] hover:text-white/82'
            }`}
            aria-current={activeMovieCategory === 'Tümü' ? 'true' : undefined}
          >
            <Sparkles size={11} className="mr-2 shrink-0 text-amber-400/80" />
            <span className="min-w-0 flex-1 truncate">{language === 'tr' ? 'Tüm Filmler' : 'All Movies'}</span>
          </button>

          {deduped.favorites.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-red-400/45">
                <Heart size={10} /> {t('navbar.favorites')}
              </span>
              {deduped.favorites.map((group) => renderRow(group, true))}
            </div>
          )}

          {deduped.platforms.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
                <Tv size={9} /> {language === 'tr' ? 'Platformlar' : 'Platforms'}
                <span className="tabular-nums text-white/25">{deduped.platforms.length}</span>
              </span>
              {deduped.platforms.map((group) => renderRow(group))}
            </div>
          )}

          {deduped.genres.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
                <Film size={9} /> {language === 'tr' ? 'Türler' : 'Genres'}
                <span className="tabular-nums text-white/25">{deduped.genres.length}</span>
              </span>
              {deduped.genres.map((group) => renderRow(group))}
            </div>
          )}

          {deduped.regions.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
                <Star size={9} /> {language === 'tr' ? 'Bölgeler' : 'Regions'}
                <span className="tabular-nums text-white/25">{deduped.regions.length}</span>
              </span>
              {deduped.regions.map((group) => renderRow(group))}
            </div>
          )}

          {deduped.others.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
                <LayoutGrid size={9} /> {language === 'tr' ? 'Diğerleri' : 'Others'}
                <span className="tabular-nums text-white/25">{deduped.others.length}</span>
              </span>
              {deduped.others.slice(0, visibleMovieCategoryLimit).map((group) => renderRow(group))}
            </div>
          )}

          {deduped.others.length > visibleMovieCategoryLimit && (
            <button
              type="button"
              onClick={() => setVisibleMovieCategoryLimit((prev) => prev + 50)}
              className="mt-2 w-full rounded-xl py-2 text-[10px] font-semibold tracking-wide text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/70  cursor-pointer"
            >
              {language === 'tr' ? 'Daha fazla' : 'Show more'} (+{deduped.others.length - visibleMovieCategoryLimit})
            </button>
          )}

          {deduped.favorites.length === 0 && deduped.platforms.length === 0 && deduped.genres.length === 0 && deduped.regions.length === 0 && deduped.others.length === 0 && (
            <p className="px-2 py-8 text-center text-[10.5px] text-white/35">
              {language === 'tr' ? 'Kategori bulunamadı' : 'No categories found'}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
});
