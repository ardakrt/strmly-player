import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Search, Tv, X, Sparkles, LayoutGrid, SlidersHorizontal, Clapperboard, ArrowLeft } from 'lucide-react';
import type { GroupedSeries } from '../../utils/seriesGroupers';
import { VirtualizedGrid } from '../VirtualizedGrid';
import { MediaCardContextMenu } from '../MediaCardContextMenu';
import { AnimatedTicker } from '../AnimatedTicker';
import { useSettings } from '../../context/SettingsContext';
import { useDownloads } from '../../hooks/useDownloads';
import { APP_VIEWS } from '../../navigation/views';
import { SeriesCard } from './SeriesCard';
import { SeriesRail } from './SeriesRail';
import { SeriesScrollbar } from './SeriesScrollbar';
import { CategoryDrawer, type SeriesCategoryManager } from './SeriesCategoryDrawer';
import {
  getCategoryPresentation, classifyCategories,
  getCategoryMergeKey, resolvePlatformLogoUrl, getPlatformConfig,
} from './seriesPlatforms';

// Re-exported for FavoritesView, which reuses the same card design.
export { SeriesCard };

const MAX_ROW_ITEMS = 15;

type ViewMode = 'showcase' | 'grid';

interface SeriesViewProps {
  selectedGroup: string;
  activeSeriesCategory: string;
  setActiveSeriesCategory: (cat: string) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (query: string) => void;
  seriesFavCatsToShow: string[];
  seriesCat: SeriesCategoryManager;
  visibleSeriesCategoryLimit: number;
  setVisibleSeriesCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  groupedSeriesList: GroupedSeries[];
  seriesCategoryCounts: Map<string, number>;
  handleMainScroll: (e: React.UIEvent<HTMLElement>) => void;
  handleOpenSeriesModalDirect: (series: GroupedSeries) => void;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

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
  seriesCategoryCounts,
  handleMainScroll,
  handleOpenSeriesModalDirect,
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: SeriesViewProps) {
  const { t, language } = useSettings();
  const { addDownload, isDownloading } = useDownloads();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: GroupedSeries } | null>(null);
  const [seriesSearchInput, setSeriesSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('showcase');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const hasBeenActiveRef = useRef(selectedGroup === APP_VIEWS.series);
  if (selectedGroup === APP_VIEWS.series) hasBeenActiveRef.current = true;
  const favoritesSet = useMemo(() => new Set(globalFavorites), [globalFavorites]);

  const otherCategories = seriesCat.filteredOtherCategories;
  const classified = useMemo(() => classifyCategories(otherCategories), [otherCategories]);

  // Filter by the toolbar search input
  const filteredList = useMemo(() => {
    let list = groupedSeriesList;
    if (seriesSearchInput.trim()) {
      const query = seriesSearchInput.toLowerCase().trim();
      list = list.filter((s) => s.name.toLowerCase().includes(query));
    }
    return list;
  }, [groupedSeriesList, seriesSearchInput]);

  // Exact-match lookup per category (single pass, memoized)
  const seriesByGroup = useMemo(() => {
    const map = new Map<string, GroupedSeries[]>();
    for (const s of filteredList) {
      const key = s.group || '';
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
    }
    return map;
  }, [filteredList]);

  const getSeriesForRow = useCallback(
    (categories: string[]) => {
      if (categories.length === 1) return seriesByGroup.get(categories[0]) || [];
      const seen = new Set<string>();
      const merged: GroupedSeries[] = [];
      for (const cat of categories) {
        for (const s of seriesByGroup.get(cat) || []) {
          if (!seen.has(s.id)) { seen.add(s.id); merged.push(s); }
        }
      }
      return merged;
    },
    [seriesByGroup]
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
    seriesFavCatsToShow.forEach((cat) => addRow(cat, 'fav'));
    classified.platforms.forEach((cat) => addRow(cat, 'plat'));
    classified.genres.forEach((cat) => addRow(cat, 'genre'));
    classified.regions.forEach((cat) => addRow(cat, 'region'));
    classified.others.slice(0, visibleSeriesCategoryLimit).forEach((cat) => addRow(cat, 'other'));
    return out;
  }, [seriesFavCatsToShow, classified, visibleSeriesCategoryLimit]);

  // Precompute each row's capped item list once (memoized) instead of
  // slice()-ing during render — a fresh array per render would defeat
  // SeriesRail's React.memo and cascade into every card.
  const rowEntries = useMemo(() => {
    const entries: { row: { key: string; title: string; dotColor?: string; logoUrl?: string; categories: string[] }; items: GroupedSeries[]; hasMore: boolean }[] = [];
    for (const row of rows) {
      const all = getSeriesForRow(row.categories);
      if (all.length === 0) continue;
      const hasMore = all.length > MAX_ROW_ITEMS;
      entries.push({ row, items: hasMore ? all.slice(0, MAX_ROW_ITEMS) : all, hasMore });
    }
    return entries;
  }, [rows, getSeriesForRow]);
  const renderedRowEntries = selectedGroup === APP_VIEWS.series || hasBeenActiveRef.current
    ? rowEntries
    : rowEntries.slice(0, 2);

  const openContextMenu = useCallback((event: React.MouseEvent, item: GroupedSeries) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  }, []);

  // Stable handlers: inline closures per row/card would break the
  // React.memo guards on SeriesRail/SeriesCard and re-render every card on
  // each app-level state change.
  const handleSeeAll = useCallback((category: string) => {
    setActiveSeriesCategory(category);
    setVisibleCount(100);
  }, [setActiveSeriesCategory, setVisibleCount]);

  const handleBackToAll = useCallback(() => {
    setActiveSeriesCategory('Tümü');
    setVisibleCount(100);
  }, [setActiveSeriesCategory, setVisibleCount]);

  const handleCardDownload = useCallback((series: GroupedSeries) => {
    const firstEpisode = Object.values(series.seasons)[0]?.[0]?.item;
    if (firstEpisode) void addDownload(firstEpisode);
  }, [addDownload]);

  // Sibling variants can share a merged row ("[TR] Netflix Dizi" + "[TR] Netflix
  // Film"); See All must jump to the variant that actually holds the series,
  // not whichever was listed first.
  const richestCategory = useCallback((categories: string[]) => {
    let best = categories[0];
    let bestCount = seriesCategoryCounts.get(best) || 0;
    for (let i = 1; i < categories.length; i++) {
      const count = seriesCategoryCounts.get(categories[i]) || 0;
      if (count > bestCount) { best = categories[i]; bestCount = count; }
    }
    return best;
  }, [seriesCategoryCounts]);

  const activeTitle =
    activeSeriesCategory === 'Tümü'
      ? language === 'tr' ? 'Tüm Diziler' : 'All Series'
      : getCategoryPresentation(activeSeriesCategory);

  const searching = seriesSearchInput.trim().length > 0;
  // Showcase rails only make sense for the full catalog; once a specific
  // category is active (drawer pick or "See All"), render the complete
  // grid so every item in the category is visible, not just a 15-card rail.
  const singleCategory = activeSeriesCategory !== 'Tümü';
  const renderGrid = () => (
    <VirtualizedGrid
      items={filteredList}
      compactLargeCards
      renderItem={(series, index) => {
        const firstEpisode = Object.values(series.seasons)[0]?.[0]?.item;
        return (
          // Scroll-reveal: virtualized rows mount just as they near the
          // viewport, so the slide-up plays while the row scrolls into view;
          // column-based delay produces a left→right stagger per row.
          <div
            key={series.id}
            className="series-card-enter"
            style={{ animationDelay: `${(index % 7) * 40}ms` }}
          >
            <SeriesCard
              series={series}
              onClick={handleOpenSeriesModalDirect}
              isFavorite={favoritesSet.has(series.id)}
              isDownloading={firstEpisode ? isDownloading(firstEpisode.url) : false}
              onToggleFavorite={toggleFavorite}
              onDownload={firstEpisode ? handleCardDownload : undefined}
              isGenericLogo={!!series.isGenericLogo}
              seasonsCount={Object.keys(series.seasons).length}
              onContextMenu={openContextMenu}
            />
          </div>
        );
      }}
    />
  );

  return (
    <div
      aria-hidden={selectedGroup !== APP_VIEWS.series}
      className={`relative h-full min-h-0 flex-1 flex-col overflow-hidden page-transition-enter ${
        selectedGroup === APP_VIEWS.series ? 'flex' : 'hidden'
      }`}
      onContextMenu={() => setContextMenu(null)}
    >
      {/* Full-bleed scroll shell like Home: the scrollport starts at the very
          top of the window, so rows scroll up behind/under the floating
          transparent navbar. The header never collapses — collapsing it with a
          max-height/padding animation shifted content mid-scroll and caused
          title text to flicker, so it is now static geometry. */}
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
                <Clapperboard size={10} />
                {language === 'tr' ? 'Diziler' : 'Series'}
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

              {/* Series search */}
              <div className="relative flex items-center">
                <Search size={12} className="pointer-events-none absolute left-3 text-white/28" />
                <input
                  type="text"
                  placeholder={language === 'tr' ? 'Dizi ara…' : 'Search series…'}
                  value={seriesSearchInput}
                  onChange={(e) => setSeriesSearchInput(e.target.value)}
                  className="h-8 w-36 rounded-lg border border-white/[0.06] bg-black/15 pl-8 pr-7 text-[10.5px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/12 focus:bg-white/[0.035]  sm:w-48"
                />
                {seriesSearchInput && (
                  <button type="button" onClick={() => setSeriesSearchInput('')} className="absolute right-2.5 text-white/35 transition-colors hover:text-white cursor-pointer" aria-label={language === 'tr' ? 'Aramayı Temizle' : 'Clear search'}>
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Count badge */}
              <span className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38 md:flex">
                <AnimatedTicker value={filteredList.length} />
                <span>{language === 'tr' ? 'dizi' : 'series'}</span>
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
                <Tv size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white/55">
                {searching
                  ? (language === 'tr' ? 'Aramanızla eşleşen dizi bulunamadı' : 'No series matched your search')
                  : (language === 'tr' ? 'Bu kategoride dizi bulunamadı' : 'No series found in this category')}
              </h3>
              {searching && (
                <button
                  type="button"
                  onClick={() => setSeriesSearchInput('')}
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
                <SeriesRail
                  key={row.key}
                  title={row.title}
                  dotColor={row.dotColor}
                  logoUrl={row.logoUrl}
                  seriesList={items}
                  onCardClick={handleOpenSeriesModalDirect}
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

      {/* Custom DOM scrollbar: the native one is hidden via .hide-scrollbar
          because Chromium's standard scrollbar properties (set globally via
          `*`) override any ::-webkit-scrollbar styling and paint a dark track
          over the cards. This overlay renders only a slim thumb. */}
      <SeriesScrollbar targetRef={scrollRef} />

      {/* Category manager drawer — outside the scrollport so it never
          scrolls with the content */}
      <CategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        seriesCat={seriesCat}
        seriesFavCatsToShow={seriesFavCatsToShow}
        classified={classified}
        activeSeriesCategory={activeSeriesCategory}
        setActiveSeriesCategory={setActiveSeriesCategory}
        setVisibleCount={setVisibleCount}
        seriesCategoryCounts={seriesCategoryCounts}
        categorySearchQuery={categorySearchQuery}
        setCategorySearchQuery={setCategorySearchQuery}
        visibleSeriesCategoryLimit={visibleSeriesCategoryLimit}
        setVisibleSeriesCategoryLimit={setVisibleSeriesCategoryLimit}
        language={language}
        t={t}
      />

      {/* Context menu */}
      {contextMenu && (() => {
        const firstEpisode = Object.values(contextMenu.item.seasons)[0]?.[0]?.item;
        return (
          <MediaCardContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            item={contextMenu.item}
            isFavorite={favoritesSet.has(contextMenu.item.id)}
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
