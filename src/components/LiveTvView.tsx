import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Search, Tv, X, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import { VirtualizedGrid } from './VirtualizedGrid';
import { MediaCardContextMenu } from './MediaCardContextMenu';
import { AnimatedTicker } from './AnimatedTicker';
import { SeriesScrollbar } from './series/SeriesScrollbar';
import { useSettings } from '../context/SettingsContext';
import { APP_VIEWS } from '../navigation/views';
import { LiveChannelTile } from './live/LiveChannelTile';
import { LiveRail } from './live/LiveRail';
import { LiveCategoryDrawer, type LiveCategoryManager } from './live/LiveCategoryDrawer';

const MAX_ROW_ITEMS = 30;

interface LiveRailEntry {
  key: string;
  title: string;
  icon?: 'recent' | 'favorites';
  channels: PlaylistItem[];
  hasMore: boolean;
  category?: string;
}

interface LiveTvViewProps {
  selectedGroup: string;
  activeLiveCategory: string;
  setActiveLiveCategory: (cat: string) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (query: string) => void;
  liveFavCatsToShow: string[];
  liveCat: LiveCategoryManager;
  visibleLiveCategoryLimit: number;
  setVisibleLiveCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  allLiveItems: PlaylistItem[];
  recentlyWatched: PlaylistItem[];
  handleMainScroll: (e: React.UIEvent<HTMLElement>) => void;
  handlePlayStream: (item: PlaylistItem) => void;
  checkedStatusMap: Record<string, 'online' | 'offline'>;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

export const LiveTvView = React.memo(function LiveTvView({
  selectedGroup,
  activeLiveCategory,
  setActiveLiveCategory,
  categorySearchQuery,
  setCategorySearchQuery,
  liveFavCatsToShow,
  liveCat,
  visibleLiveCategoryLimit,
  setVisibleLiveCategoryLimit,
  allLiveItems,
  recentlyWatched,
  handleMainScroll,
  handlePlayStream,
  checkedStatusMap,
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: LiveTvViewProps) {
  const { t, language } = useSettings();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: PlaylistItem } | null>(null);
  const [channelSearchInput, setChannelSearchInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const favoritesSet = useMemo(() => new Set(globalFavorites), [globalFavorites]);

  const searching = channelSearchInput.trim().length > 0;
  const singleCategory = activeLiveCategory !== 'Tümü';

  // Grid-mode list: category filter + toolbar search over the full live catalog
  const filteredList = useMemo(() => {
    let list = allLiveItems;
    if (singleCategory) list = list.filter((item) => item.group === activeLiveCategory);
    if (channelSearchInput.trim()) {
      const query = channelSearchInput.toLowerCase().trim();
      list = list.filter((item) => item.name.toLowerCase().includes(query));
    }
    return list;
  }, [allLiveItems, singleCategory, activeLiveCategory, channelSearchInput]);

  // Single-pass grouping for showcase rails
  const channelsByGroup = useMemo(() => {
    const map = new Map<string, PlaylistItem[]>();
    for (const item of allLiveItems) {
      const key = item.group || '';
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [allLiveItems]);

  const recentLive = useMemo(
    () => recentlyWatched.filter((item) => item.type === 'live' || item.type === undefined),
    [recentlyWatched]
  );
  const favoriteLive = useMemo(
    () => allLiveItems.filter((item) => favoritesSet.has(item.id)),
    [allLiveItems, favoritesSet]
  );

  // Precompute capped rail entries once (memoized) so LiveRail's React.memo
  // never sees fresh arrays per render.
  const rowEntries = useMemo(() => {
    const entries: LiveRailEntry[] = [];
    const push = (key: string, title: string, icon: 'recent' | 'favorites' | undefined, all: PlaylistItem[], category?: string) => {
      if (all.length === 0) return;
      const hasMore = category !== undefined && all.length > MAX_ROW_ITEMS;
      entries.push({ key, title, icon, channels: all.slice(0, MAX_ROW_ITEMS), hasMore, category });
    };
    push('recent', language === 'tr' ? 'Son İzlenenler' : 'Recently Watched', 'recent', recentLive);
    push('favorites', language === 'tr' ? 'Favoriler' : 'Favorites', 'favorites', favoriteLive);
    liveFavCatsToShow.forEach((cat) => push(`fav-${cat}`, cat, undefined, channelsByGroup.get(cat) || [], cat));
    liveCat.filteredOtherCategories
      .slice(0, visibleLiveCategoryLimit)
      .forEach((cat) => push(`cat-${cat}`, cat, undefined, channelsByGroup.get(cat) || [], cat));
    return entries;
  }, [recentLive, favoriteLive, liveFavCatsToShow, liveCat.filteredOtherCategories, visibleLiveCategoryLimit, channelsByGroup, language]);

  const openContextMenu = useCallback((event: React.MouseEvent, item: PlaylistItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  }, []);

  const handleSeeAll = useCallback((category: string) => {
    setActiveLiveCategory(category);
    setVisibleCount(100);
  }, [setActiveLiveCategory, setVisibleCount]);

  const handleBackToAll = useCallback(() => {
    setChannelSearchInput('');
    setActiveLiveCategory('Tümü');
    setVisibleCount(100);
  }, [setActiveLiveCategory, setVisibleCount]);

  if (selectedGroup !== APP_VIEWS.live) return null;

  const activeTitle = singleCategory
    ? activeLiveCategory
    : (language === 'tr' ? 'Tüm Kanallar' : 'All Channels');
  const displayCount = singleCategory || searching ? filteredList.length : allLiveItems.length;

  const renderGrid = () => (
    <VirtualizedGrid
      items={filteredList}
      renderItem={(channel, index) => (
        <div
          key={channel.id}
          className="series-card-enter"
          style={{ animationDelay: `${(index % 7) * 40}ms` }}
        >
          <LiveChannelTile
            channel={channel}
            onClick={handlePlayStream}
            isOnline={checkedStatusMap[channel.id]}
            isFavorite={favoritesSet.has(channel.id)}
            onToggleFavorite={toggleFavorite}
            onContextMenu={openContextMenu}
          />
        </div>
      )}
    />
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden page-transition-enter"
      onContextMenu={() => setContextMenu(null)}
    >
      {/* Full-bleed scroll shell like SeriesView: static header geometry,
          content scrolls under the floating transparent navbar. */}
      <section ref={scrollRef} className="hide-scrollbar relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-8" onScroll={handleMainScroll}>
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 pb-3.5 pt-[5.75rem] lg:px-6">
          <div className="min-w-0">
            {singleCategory || searching ? (
              <button
                type="button"
                onClick={handleBackToAll}
                className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-white/70 transition-all hover:border-white/[0.18] hover:bg-white/[0.1] hover:text-white cursor-pointer "
                title={language === 'tr' ? 'Raflara Geri Dön' : 'Back to Rails'}
              >
                <ArrowLeft size={11} />
                {language === 'tr' ? 'Geri Dön' : 'Go Back'}
              </button>
            ) : (
              <p className="mb-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                <Tv size={10} />
                {language === 'tr' ? 'Canlı TV' : 'Live TV'}
              </p>
            )}
            <h2 className="truncate text-[18px] font-bold tracking-[-0.02em] text-white/92 lg:text-[20px]">
              {activeTitle}
            </h2>
          </div>

          {/* Toolbar: centered on the title line */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.035] px-3 text-[10.5px] font-semibold text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/85  cursor-pointer"
                title={language === 'tr' ? 'Kategorileri Yönet' : 'Manage Categories'}
              >
                <SlidersHorizontal size={11} />
                <span className="hidden md:inline">{language === 'tr' ? 'Kategoriler' : 'Categories'}</span>
              </button>

              <div className="relative flex items-center">
                <Search size={12} className="pointer-events-none absolute left-3 text-white/28" />
                <input
                  type="text"
                  placeholder={language === 'tr' ? 'Kanal ara…' : 'Search channels…'}
                  value={channelSearchInput}
                  onChange={(e) => setChannelSearchInput(e.target.value)}
                  className="h-8 w-36 rounded-lg border border-white/[0.06] bg-black/15 pl-8 pr-7 text-[10.5px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/12 focus:bg-white/[0.035]  sm:w-48"
                />
                {channelSearchInput && (
                  <button type="button" onClick={() => setChannelSearchInput('')} className="absolute right-2.5 text-white/35 transition-colors hover:text-white cursor-pointer" aria-label={language === 'tr' ? 'Aramayı Temizle' : 'Clear search'}>
                    <X size={11} />
                  </button>
                )}
              </div>

              <span className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38 md:flex">
                <AnimatedTicker value={displayCount} />
                <span>{language === 'tr' ? 'kanal' : 'channels'}</span>
              </span>
            </div>
          </div>

          <div aria-hidden="true" />
        </header>

        <div className="flex min-h-full flex-col px-4 pt-4 lg:px-5 lg:pt-5">
          {allLiveItems.length === 0 ? (
            <div className="flex min-h-full flex-1 flex-col items-center justify-center py-20 text-center select-none">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                <Tv size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white/55">
                {language === 'tr' ? 'Kanal bulunamadı' : 'No channels found'}
              </h3>
            </div>
          ) : singleCategory || searching ? (
            filteredList.length === 0 ? (
              <div className="flex min-h-full flex-1 flex-col items-center justify-center py-20 text-center select-none">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                  <Tv size={24} />
                </div>
                <h3 className="text-sm font-semibold text-white/55">
                  {searching
                    ? (language === 'tr' ? 'Aramanızla eşleşen kanal bulunamadı' : 'No channels matched your search')
                    : (language === 'tr' ? 'Bu kategoride kanal bulunamadı' : 'No channels found in this category')}
                </h3>
                {searching && (
                  <button
                    type="button"
                    onClick={() => setChannelSearchInput('')}
                    className="mt-3.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/[0.09] hover:text-white cursor-pointer "
                  >
                    {language === 'tr' ? 'Aramayı Temizle' : 'Clear Search'}
                  </button>
                )}
              </div>
            ) : (
              renderGrid()
            )
          ) : (
            rowEntries.map((entry, index) => (
              <LiveRail
                key={entry.key}
                title={entry.title}
                icon={entry.icon}
                channels={entry.channels}
                onChannelClick={handlePlayStream}
                favoritesSet={favoritesSet}
                toggleFavorite={toggleFavorite}
                openContextMenu={openContextMenu}
                checkedStatusMap={checkedStatusMap}
                seeAllCategory={entry.hasMore ? entry.category : undefined}
                onSeeAll={entry.hasMore ? handleSeeAll : undefined}
                language={language}
                initialVisible={index < 2}
              />
            ))
          )}
        </div>
      </section>

      <SeriesScrollbar targetRef={scrollRef} />

      <LiveCategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        liveCat={liveCat}
        liveFavCatsToShow={liveFavCatsToShow}
        activeLiveCategory={activeLiveCategory}
        setActiveLiveCategory={setActiveLiveCategory}
        setVisibleCount={setVisibleCount}
        categorySearchQuery={categorySearchQuery}
        setCategorySearchQuery={setCategorySearchQuery}
        visibleLiveCategoryLimit={visibleLiveCategoryLimit}
        setVisibleLiveCategoryLimit={setVisibleLiveCategoryLimit}
        language={language}
        t={t}
      />

      {contextMenu && (
        <MediaCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isFavorite={favoritesSet.has(contextMenu.item.id)}
          onClose={() => setContextMenu(null)}
          onPlay={handlePlayStream}
          onToggleFavorite={(id) => toggleFavorite(id)}
        />
      )}
    </div>
  );
});
