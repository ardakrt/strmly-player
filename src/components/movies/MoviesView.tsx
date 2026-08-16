import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Search, Film, X, Sparkles, LayoutGrid, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { VirtualizedGrid } from '../VirtualizedGrid';
import { MediaCardContextMenu } from '../MediaCardContextMenu';
import { AnimatedTicker } from '../AnimatedTicker';
import { useSettings } from '../../context/SettingsContext';
import { useDownloads } from '../../hooks/useDownloads';
import { APP_VIEWS } from '../../navigation/views';
import { MovieCard } from './MovieCard';
import { MovieRail } from './MovieRail';
import { MovieCategoryDrawer, type MovieCategoryManager } from './MovieCategoryDrawer';
import { SeriesScrollbar } from '../series/SeriesScrollbar';
import {
  getCategoryPresentation, classifyCategories,
  getCategoryMergeKey, resolvePlatformLogoUrl, getPlatformConfig,
} from '../series/seriesPlatforms';

// Re-exported for FavoritesView, which reuses the same card design.
export { MovieCard };

const MAX_ROW_ITEMS = 15;

type ViewMode = 'showcase' | 'grid';

interface MoviesViewProps {
  selectedGroup: string;
  activeMovieCategory: string;
  setActiveMovieCategory: (cat: string) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (query: string) => void;
  movieFavCatsToShow: string[];
  movieCat: MovieCategoryManager;
  visibleMovieCategoryLimit: number;
  setVisibleMovieCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  movieCatalogItems: PlaylistItem[];
  movieCategoryCounts: Map<string, number>;
  handleMainScroll: (e: React.UIEvent<HTMLElement>) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  handlePlayStream: (item: PlaylistItem) => void;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

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
  movieCatalogItems,
  movieCategoryCounts,
  handleMainScroll,
  handleOpenDetails,
  handlePlayStream,
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: MoviesViewProps) {
  const { t, language } = useSettings();
  const { addDownload, isDownloading } = useDownloads();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: PlaylistItem } | null>(null);
  const [movieSearchInput, setMovieSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('showcase');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const hasBeenActiveRef = useRef(selectedGroup === APP_VIEWS.movies);
  if (selectedGroup === APP_VIEWS.movies) hasBeenActiveRef.current = true;
  const favoritesSet = useMemo(() => new Set(globalFavorites), [globalFavorites]);

  const otherCategories = movieCat.filteredOtherCategories;
  const classified = useMemo(() => classifyCategories(otherCategories), [otherCategories]);

  // Filter by the toolbar search input
  const filteredList = useMemo(() => {
    let list = movieCatalogItems;
    if (movieSearchInput.trim()) {
      const query = movieSearchInput.toLowerCase().trim();
      list = list.filter((item) => item.name.toLowerCase().includes(query));
    }
    return list;
  }, [movieCatalogItems, movieSearchInput]);

  // Exact-match lookup per category (single pass, memoized)
  const moviesByGroup = useMemo(() => {
    const map = new Map<string, PlaylistItem[]>();
    for (const item of filteredList) {
      const key = item.group || '';
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [filteredList]);

  const getMoviesForRow = useCallback(
    (categories: string[]) => {
      if (categories.length === 1) return moviesByGroup.get(categories[0]) || [];
      const seen = new Set<string>();
      const merged: PlaylistItem[] = [];
      for (const cat of categories) {
        for (const item of moviesByGroup.get(cat) || []) {
          if (!seen.has(item.id)) { seen.add(item.id); merged.push(item); }
        }
      }
      return merged;
    },
    [moviesByGroup]
  );

  // Flattened row list: favorites → platforms → genres → regions → others
  // Same-named category variants (e.g. "NETFLIX" + "NETFLIX 1") merge into one row
  const rows = useMemo(() => {
    const out: { key: string; title: string; dotColor?: string; logoUrl?: string; categories: string[] }[] = [];
    const addRow = (cat: string, prefix: string) => {
      const mergeKey = getCategoryMergeKey(cat) || cat.toUpperCase();
      const title = getCategoryPresentation(cat);
      const platform = getPlatformConfig(cat);
      const existing = out.find((r) => r.key === `${prefix}-${mergeKey}`);
      if (existing) {
        if (!existing.categories.includes(cat)) existing.categories.push(cat);
        if (title.length < existing.title.length) existing.title = title;
        if (!existing.dotColor) existing.dotColor = platform?.dotColor;
        if (!existing.logoUrl) existing.logoUrl = resolvePlatformLogoUrl(platform);
        return;
      }
      out.push({
        key: `${prefix}-${mergeKey}`,
        title,
        dotColor: platform?.dotColor,
        logoUrl: resolvePlatformLogoUrl(platform),
        categories: [cat]
      });
    };
    movieFavCatsToShow.forEach((cat) => addRow(cat, 'fav'));
    classified.platforms.forEach((cat) => addRow(cat, 'plat'));
    classified.genres.forEach((cat) => addRow(cat, 'genre'));
    classified.regions.forEach((cat) => addRow(cat, 'region'));
    classified.others.slice(0, visibleMovieCategoryLimit).forEach((cat) => addRow(cat, 'other'));
    return out;
  }, [movieFavCatsToShow, classified, visibleMovieCategoryLimit]);

  // Precompute each row's capped item list once (memoized) instead of
  // slice()-ing during render — a fresh array per render would defeat
  // MovieRail's React.memo and cascade into every card.
  const rowEntries = useMemo(() => {
    const entries: { row: { key: string; title: string; dotColor?: string; logoUrl?: string; categories: string[] }; items: PlaylistItem[]; hasMore: boolean }[] = [];
    for (const row of rows) {
      const all = getMoviesForRow(row.categories);
      if (all.length === 0) continue;
      const hasMore = all.length > MAX_ROW_ITEMS;
      entries.push({ row, items: hasMore ? all.slice(0, MAX_ROW_ITEMS) : all, hasMore });
    }
    return entries;
  }, [rows, getMoviesForRow]);
  const renderedRowEntries = selectedGroup === APP_VIEWS.movies || hasBeenActiveRef.current
    ? rowEntries
    : rowEntries.slice(0, 2);

  const openContextMenu = useCallback((event: React.MouseEvent, item: PlaylistItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  }, []);

  // Stable handlers: inline closures per row/card would break the
  // React.memo guards on MovieRail/MovieCard and re-render every card on
  // each app-level state change.
  const handleSeeAll = useCallback((category: string) => {
    setActiveMovieCategory(category);
    setVisibleCount(100);
  }, [setActiveMovieCategory, setVisibleCount]);

  const handleBackToAll = useCallback(() => {
    setActiveMovieCategory('Tümü');
    setVisibleCount(100);
  }, [setActiveMovieCategory, setVisibleCount]);

  // Sibling variants can share a merged row; See All must jump to the
  // variant that actually holds the movies, not whichever was listed first.
  const richestCategory = useCallback((categories: string[]) => {
    let best = categories[0];
    let bestCount = movieCategoryCounts.get(best) || 0;
    for (let i = 1; i < categories.length; i++) {
      const count = movieCategoryCounts.get(categories[i]) || 0;
      if (count > bestCount) { best = categories[i]; bestCount = count; }
    }
    return best;
  }, [movieCategoryCounts]);

  const activeTitle =
    activeMovieCategory === 'Tümü'
      ? language === 'tr' ? 'Tüm Filmler' : 'All Movies'
      : getCategoryPresentation(activeMovieCategory);

  const searching = movieSearchInput.trim().length > 0;
  // Showcase rails only make sense for the full catalog; once a specific
  // category is active (drawer pick or "See All"), render the complete
  // grid so every item in the category is visible, not just a 15-card rail.
  const singleCategory = activeMovieCategory !== 'Tümü';
  const renderGrid = () => (
    <VirtualizedGrid
      items={filteredList}
      compactLargeCards
      renderItem={(item, index) => (
        // Scroll-reveal: virtualized rows mount just as they near the
        // viewport, so the slide-up plays while the row scrolls into view;
        // column-based delay produces a left→right stagger per row.
        <div
          key={item.id}
          className="series-card-enter"
          style={{ animationDelay: `${(index % 7) * 40}ms` }}
        >
          <MovieCard
            channel={item}
            onClick={handleOpenDetails}
            isFavorite={favoritesSet.has(item.id)}
            isDownloading={isDownloading(item.url)}
            onToggleFavorite={toggleFavorite}
            onDownload={addDownload}
            isGenericLogo={!!item.isGenericLogo}
            onContextMenu={openContextMenu}
          />
        </div>
      )}
    />
  );

  return (
    <div
      aria-hidden={selectedGroup !== APP_VIEWS.movies}
      className={`relative h-full min-h-0 flex-1 flex-col overflow-hidden page-transition-enter ${
        selectedGroup === APP_VIEWS.movies ? 'flex' : 'hidden'
      }`}
      onContextMenu={() => setContextMenu(null)}
    >
      {/* Full-bleed scroll shell like the Series page: the scrollport starts
          at the very top of the window, so rows scroll up behind/under the
          floating transparent navbar. The header geometry is static. */}
      <section ref={scrollRef} className="hide-scrollbar relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-8" onScroll={handleMainScroll}>
        {/* Header — fixed geometry; top padding clears the floating navbar.
            Grid layout keeps the toolbar truly centered without fragile
            absolute overlays. */}
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 pb-3.5 pt-[5.75rem] lg:px-6">
          <div className="min-w-0">
            {singleCategory ? (
              <button
                type="button"
                onClick={handleBackToAll}
                className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-white/70 transition-all hover:border-white/[0.18] hover:bg-white/[0.1] hover:text-white cursor-pointer "
                title={language === 'tr' ? 'Tümüne Geri Dön' : 'Back to All'}
              >
                <ArrowLeft size={11} />
                {language === 'tr' ? 'Geri Dön' : 'Go Back'}
              </button>
            ) : (
              <p className="mb-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                <Film size={10} />
                {language === 'tr' ? 'Filmler' : 'Movies'}
              </p>
            )}
            <h2 className="truncate text-[18px] font-bold tracking-[-0.02em] text-white/92 lg:text-[20px]">
              {activeTitle}
            </h2>
          </div>

          {/* Toolbar: centered on the title line */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2">
              {/* Category manager */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.035] px-3 text-[10.5px] font-semibold text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/85  cursor-pointer"
                title={language === 'tr' ? 'Kategorileri Yönet' : 'Manage Categories'}
              >
                <SlidersHorizontal size={11} />
                <span className="hidden md:inline">{language === 'tr' ? 'Kategoriler' : 'Categories'}</span>
              </button>

              {/* View mode toggle */}
              <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.035] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('showcase')}
                  className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-bold transition-all cursor-pointer ${
                    viewMode === 'showcase' ? 'bg-white/[0.1] text-white shadow-sm' : 'text-white/40 hover:text-white/75'
                  }`}
                  title={language === 'tr' ? 'Vitrin' : 'Showcase'}
                >
                  <Sparkles size={11} />
                  <span className="hidden lg:inline">{language === 'tr' ? 'Vitrin' : 'Showcase'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-bold transition-all cursor-pointer ${
                    viewMode === 'grid' ? 'bg-white/[0.1] text-white shadow-sm' : 'text-white/40 hover:text-white/75'
                  }`}
                  title={language === 'tr' ? 'Izgara' : 'Grid'}
                >
                  <LayoutGrid size={11} />
                  <span className="hidden lg:inline">{language === 'tr' ? 'Izgara' : 'Grid'}</span>
                </button>
              </div>

              {/* Movie search */}
              <div className="relative flex items-center">
                <Search size={12} className="pointer-events-none absolute left-3 text-white/28" />
                <input
                  type="text"
                  placeholder={language === 'tr' ? 'Film ara…' : 'Search movies…'}
                  value={movieSearchInput}
                  onChange={(e) => setMovieSearchInput(e.target.value)}
                  className="h-8 w-36 rounded-lg border border-white/[0.06] bg-black/15 pl-8 pr-7 text-[10.5px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/12 focus:bg-white/[0.035]  sm:w-48"
                />
                {movieSearchInput && (
                  <button type="button" onClick={() => setMovieSearchInput('')} className="absolute right-2.5 text-white/35 transition-colors hover:text-white cursor-pointer" aria-label={language === 'tr' ? 'Aramayı Temizle' : 'Clear search'}>
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Count badge */}
              <span className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38 md:flex">
                <AnimatedTicker value={filteredList.length} />
                <span>{language === 'tr' ? 'film' : 'movies'}</span>
              </span>
            </div>
          </div>

          <div aria-hidden="true" />
        </header>

        {/* Scrollable content (the section above is the scrollport) */}
        <div className="flex min-h-full flex-col px-4 pt-4 lg:px-5 lg:pt-5">
          {filteredList.length === 0 ? (
            <div className="flex min-h-full flex-1 flex-col items-center justify-center py-20 text-center select-none">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                <Film size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white/55">
                {searching
                  ? (language === 'tr' ? 'Aramanızla eşleşen film bulunamadı' : 'No movies matched your search')
                  : (language === 'tr' ? 'Bu kategoride film bulunamadı' : 'No movies found in this category')}
              </h3>
              {searching && (
                <button
                  type="button"
                  onClick={() => setMovieSearchInput('')}
                  className="mt-3.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/[0.09] hover:text-white cursor-pointer "
                >
                  {language === 'tr' ? 'Aramayı Temizle' : 'Clear Search'}
                </button>
              )}
            </div>
          ) : viewMode === 'grid' || searching || singleCategory ? (
            renderGrid()
          ) : (
            <>
              {renderedRowEntries.map(({ row, items, hasMore }, index) => (
                <MovieRail
                  key={row.key}
                  title={row.title}
                  dotColor={row.dotColor}
                  logoUrl={row.logoUrl}
                  items={items}
                  onCardClick={handleOpenDetails}
                  favoritesSet={favoritesSet}
                  toggleFavorite={toggleFavorite}
                  openContextMenu={openContextMenu}
                  isDownloading={isDownloading}
                  addDownload={addDownload}
                  seeAllCategory={hasMore ? richestCategory(row.categories) : undefined}
                  onSeeAll={hasMore ? handleSeeAll : undefined}
                  language={language}
                  initialVisible={index < 2}
                  scrollRootRef={scrollRef}
                />
              ))}
            </>
          )}
        </div>
      </section>

      {/* Custom DOM scrollbar — same overlay as the Series page. */}
      <SeriesScrollbar targetRef={scrollRef} />

      {/* Category manager drawer — outside the scrollport so it never
          scrolls with the content */}
      <MovieCategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        movieCat={movieCat}
        movieFavCatsToShow={movieFavCatsToShow}
        classified={classified}
        activeMovieCategory={activeMovieCategory}
        setActiveMovieCategory={setActiveMovieCategory}
        setVisibleCount={setVisibleCount}
        movieCategoryCounts={movieCategoryCounts}
        categorySearchQuery={categorySearchQuery}
        setCategorySearchQuery={setCategorySearchQuery}
        visibleMovieCategoryLimit={visibleMovieCategoryLimit}
        setVisibleMovieCategoryLimit={setVisibleMovieCategoryLimit}
        language={language}
        t={t}
      />

      {/* Context menu */}
      {contextMenu && (
        <MediaCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isFavorite={favoritesSet.has(contextMenu.item.id)}
          isDownloading={isDownloading(contextMenu.item.url)}
          onClose={() => setContextMenu(null)}
          onPlay={(item) => handlePlayStream(item)}
          onOpenDetails={(item) => handleOpenDetails(item as PlaylistItem)}
          onToggleFavorite={(id) => toggleFavorite(id)}
          onDownload={(item) => addDownload(item)}
        />
      )}
    </div>
  );
});
