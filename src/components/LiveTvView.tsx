import React from 'react';
import { 
  Search, Heart, Trash2, Tv, Play, Grid, List, Info
} from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import { VirtualizedList } from './VirtualizedList';
import { MediaCardContextMenu } from './MediaCardContextMenu';
import { useSettings } from '../context/SettingsContext';

// Helper to extract stream quality from channel names
const getQualityBadge = (name: string): string | null => {
  const upper = name.toUpperCase();
  if (/\b(4K|UHD|ULTRA\s*HD)\b/.test(upper)) return '4K';
  if (/\b(1080P?|FHD|FULL\s*HD)\b/.test(upper)) return 'FHD';
  if (/\b(720P?|HD)\b/.test(upper)) return 'HD';
  if (/\b(SD|480P?|576P?)\b/.test(upper)) return 'SD';
  return null;
};

// Helper to clean resolution garbage from names for display
const cleanChannelName = (name: string): string => {
  return name
    .replace(/\[\s*(4K|UHD|ULTRA\s*HD|FHD|FULL\s*HD|HD|SD|1080P?|720P?|576P?|480P?|50FPS|60FPS|HEVC|H265|RAW)\s*\]/gi, '')
    .replace(/\(\s*(4K|UHD|ULTRA\s*HD|FHD|FULL\s*HD|HD|SD|1080P?|720P?|576P?|480P?|50FPS|60FPS|HEVC|H265|RAW)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

interface LiveTvViewProps {
  selectedGroup: string;
  activeLiveCategory: string;
  setActiveLiveCategory: (cat: string) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (query: string) => void;
  liveFavCatsToShow: string[];
  liveCat: {
    editMode: boolean;
    setEditMode: (mode: boolean) => void;
    draggedCategory: string | null;
    handleDragStart: (e: React.DragEvent, group: string) => void;
    handleDrop: (e: React.DragEvent, group: string) => void;
    toggleFavorite: (group: string, e: React.MouseEvent) => void;
    handleHide: (group: string, e: React.MouseEvent) => void;
    filteredOtherCategories: string[];
  };
  visibleLiveCategoryLimit: number;
  setVisibleLiveCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  filteredDisplayItems: PlaylistItem[];
  handleMainScroll: (e: React.UIEvent<HTMLElement>) => void;
  handlePlayStream: (item: PlaylistItem) => void;
  checkedStatusMap: Record<string, 'online' | 'offline'>;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

// 1. Compact Channel Row Card (List View)
export const LiveChannelCard = React.memo(({
  channel,
  onClick,
  isOnline,
  isFavorite,
  onToggleFavorite,
  onContextMenu,
  onActive,
  isActive
}: {
  channel: PlaylistItem;
  onClick: (item: PlaylistItem) => void;
  isOnline: 'online' | 'offline' | undefined;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent, item: PlaylistItem) => void;
  onActive?: (channel: PlaylistItem) => void;
  isActive?: boolean;
}) => {
  const { language } = useSettings();
  const quality = getQualityBadge(channel.name);
  const cleanedName = cleanChannelName(channel.name);

  return (
    <div
      onClick={() => onClick(channel)}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
      onMouseEnter={() => onActive?.(channel)}
      onFocus={() => onActive?.(channel)}
      role="button"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(channel); }}
      className={`group flex items-center justify-between p-2 pl-3.5 rounded-xl transition-all focusable-item cursor-pointer border ${
        isActive
          ? 'bg-white/[0.06] border-white/10 border-l-[3px] border-l-[var(--accent-color)] pl-[11px] shadow-md shadow-black/20 scale-[1.01]'
          : 'bg-neutral-900/30 hover:bg-white/5 border-transparent hover:border-white/10'
      }`}
      tabIndex={0}
      style={{ height: '56px' }}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 rounded-full bg-gradient-to-b from-neutral-900 to-neutral-950 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
          {channel.logo ? (
            <img 
              src={channel.logo} 
              alt=""
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = ''; }} 
            />
          ) : (
            <Tv size={14} className="text-neutral-500" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="text-xs font-bold premium-card-title truncate">{cleanedName}</span>
            {quality && (
              <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 border border-white/5 uppercase tracking-wider shrink-0">
                {quality}
              </span>
            )}
          </div>
          <span className="text-[9px] font-semibold tracking-wider uppercase text-neutral-500 text-left truncate">{channel.group || (language === 'tr' ? 'Genel' : 'General')}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {isOnline && (
          <div
            className={`w-1.5 h-1.5 rounded-full border border-black/40 shadow-sm ${
              isOnline === 'online' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={isOnline === 'online' ? (language === 'tr' ? 'Çevrimiçi' : 'Online') : (language === 'tr' ? 'Çevrimdışı' : 'Offline')}
          />
        )}
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.id, e); }}
          className="w-7 h-7 rounded-full bg-black/40 hover:bg-black border border-white/10 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 shadow-md cursor-pointer"
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
          aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
        >
          <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>
    </div>
  );
});

// 2. yatay Izgara Kartı (Grid View)
export const LiveChannelGridCard = React.memo(({
  channel,
  onClick,
  isOnline,
  isFavorite,
  onToggleFavorite,
  onContextMenu,
  onActive,
  isActive
}: {
  channel: PlaylistItem;
  onClick: (item: PlaylistItem) => void;
  isOnline: 'online' | 'offline' | undefined;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent, item: PlaylistItem) => void;
  onActive?: (channel: PlaylistItem) => void;
  isActive?: boolean;
}) => {
  const { language } = useSettings();
  const quality = getQualityBadge(channel.name);
  const cleanedName = cleanChannelName(channel.name);

  return (
    <div
      onClick={() => onClick(channel)}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
      onMouseEnter={() => onActive?.(channel)}
      onFocus={() => onActive?.(channel)}
      role="button"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(channel); }}
      className={`group relative flex flex-col items-center justify-center aspect-video p-3 rounded-2xl transition-all duration-300 focusable-item cursor-pointer border ${
        isActive
          ? 'bg-white/[0.08] border-white/20 shadow-[0_0_20px_var(--accent-glow)] scale-[1.03]'
          : 'bg-neutral-900/40 hover:bg-white/5 border-transparent hover:border-white/10 hover:scale-[1.01]'
      }`}
      style={{
        boxShadow: isActive ? '0 0 20px var(--accent-glow)' : undefined,
        borderColor: isActive ? 'var(--accent-color)' : undefined
      }}
      tabIndex={0}
    >
      <div className="w-11 h-11 rounded-full bg-gradient-to-b from-neutral-900 to-neutral-950 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105 mb-1.5">
        {channel.logo ? (
          <img 
            src={channel.logo} 
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = ''; }} 
          />
        ) : (
          <Tv size={16} className="text-neutral-500" />
        )}
      </div>

      {/* Text Info Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 pt-6 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent rounded-b-2xl text-center flex flex-col items-center">
        <span className="text-[10px] font-bold premium-card-title truncate w-full px-1">{cleanedName}</span>
      </div>

      {/* Top Floating Badges */}
      <div className="absolute top-2 left-2 flex items-center gap-1">
        {quality && (
          <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-black/60 text-neutral-400 border border-white/5 uppercase tracking-wider scale-90">
            {quality}
          </span>
        )}
      </div>

      {/* Hover Actions / Status */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        {isOnline && (
          <div
            className={`w-1.5 h-1.5 rounded-full border border-black/40 shadow-sm ${
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
          className="w-6 h-6 rounded-full bg-black/65 hover:bg-black border border-white/10 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 shadow-md cursor-pointer"
          aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
        >
          <Heart size={10} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>
    </div>
  );
});

const handleDragOverHelper = (e: React.DragEvent) => {
  e.preventDefault();
};

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
  filteredDisplayItems,
  handleMainScroll,
  handlePlayStream,
  checkedStatusMap,
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: LiveTvViewProps) {
  const { t, language } = useSettings();
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; item: PlaylistItem } | null>(null);
  const [selectedChannel, setSelectedChannel] = React.useState<PlaylistItem | null>(null);
  const previewChannel = selectedChannel && filteredDisplayItems.some(item => item.id === selectedChannel.id)
    ? selectedChannel
    : (filteredDisplayItems[0] || null);

  const favoritesSet = React.useMemo(() => new Set(globalFavorites), [globalFavorites]);
  
  // Persisted view mode: 'list' | 'grid'
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('strmly_livetv_viewmode') as 'list' | 'grid') || 'list';
  });

  // Persisted preview collapsible state
  const [isPreviewCollapsed, setIsPreviewCollapsed] = React.useState<boolean>(() => {
    return localStorage.getItem('strmly_livetv_preview_collapsed') === 'true';
  });

  const handleToggleViewMode = () => {
    const next = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(next);
    localStorage.setItem('strmly_livetv_viewmode', next);
  };

  const handleTogglePreviewCollapse = () => {
    const next = !isPreviewCollapsed;
    setIsPreviewCollapsed(next);
    localStorage.setItem('strmly_livetv_preview_collapsed', String(next));
  };

  // Selected channel is automatically kept in sync with filteredDisplayItems via computed previewChannel

  if (selectedGroup !== 'Canlı TV') return null;

  const openContextMenu = (event: React.MouseEvent, item: PlaylistItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  };



  const otherCategories = liveCat.filteredOtherCategories;

  const categoryBtnClass = (isActive: boolean, editPad = false) =>
    `series-category-item ${isActive ? 'is-active' : ''} w-full flex items-center text-left px-3 py-1.5 rounded-lg border text-[11.5px] font-medium transition-colors focusable-item ${
      editPad ? 'pr-14' : ''
    } ${
      isActive
        ? 'border-white/[0.07] text-white'
        : 'border-transparent text-white/52 hover:bg-white/[0.035] hover:text-white/82'
    }`;

  const activeTitle =
    activeLiveCategory === 'Tümü'
      ? language === 'tr'
        ? 'Tüm Kanallar'
        : 'All Channels'
      : activeLiveCategory;

  const visibleCategories = otherCategories.slice(0, visibleLiveCategoryLimit);

  const renderCategoryRow = (group: string, favorite = false) => {
    const isActive = activeLiveCategory === group;

    return (
      <div
        key={`${favorite ? 'favorite' : 'category'}-${group}`}
        className={`relative flex items-center group ${
          liveCat.draggedCategory === group ? 'opacity-50' : ''
        } ${liveCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={liveCat.editMode}
        onDragStart={(event) => liveCat.handleDragStart(event, group)}
        onDragOver={handleDragOverHelper}
        onDrop={(event) => liveCat.handleDrop(event, group)}
      >
        <button
          type="button"
          onClick={() => {
            setActiveLiveCategory(group);
            setVisibleCount(100);
          }}
          className={categoryBtnClass(isActive, liveCat.editMode)}
          title={group}
          aria-current={isActive ? 'true' : undefined}
        >
          <span className="min-w-0 flex-1 truncate">{group}</span>
        </button>

        {liveCat.editMode && (
          <div className="absolute right-1.5 flex items-center gap-0.5 z-20">
            <button
              type="button"
              onClick={(event) => liveCat.toggleFavorite(group, event)}
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
              onClick={(event) => liveCat.handleHide(group, event)}
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

  // Grid view chunking logic: group items into rows of 4 columns
  const chunkedDisplayItems = (() => {
    if (viewMode !== 'grid') return [];
    const chunks: PlaylistItem[][] = [];
    const cols = 4;
    for (let i = 0; i < filteredDisplayItems.length; i += cols) {
      chunks.push(filteredDisplayItems.slice(i, i + cols));
    }
    return chunks;
  })();



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
            onClick={() => liveCat.setEditMode(!liveCat.editMode)}
            className={`h-6 rounded-md border border-transparent px-1.5 text-[8.5px] font-bold uppercase transition-colors focusable-item cursor-pointer ${
              liveCat.editMode
                ? 'bg-white/[0.08] text-white'
                : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'
            }`}
          >
            {liveCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
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
            setActiveLiveCategory('Tümü');
            setVisibleCount(100);
          }}
          className={categoryBtnClass(activeLiveCategory === 'Tümü')}
          aria-current={activeLiveCategory === 'Tümü' ? 'true' : undefined}
        >
          <span className="min-w-0 flex-1 truncate">{language === 'tr' ? 'Tüm Kanallar' : 'All Channels'}</span>
        </button>

        {/* Favorites Categories Section */}
        {liveFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-white/[0.05]">
            <span className="text-[9px] tracking-[0.14em] font-bold text-red-400/45 uppercase px-2 mb-1 flex items-center gap-1.5">
              <Heart size={10} /> {t('navbar.favorites')}
            </span>
            {liveFavCatsToShow.map((group) => renderCategoryRow(group, true))}
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

        {otherCategories.length > visibleLiveCategoryLimit && (
          <button
            type="button"
            onClick={() => setVisibleLiveCategoryLimit((prev) => prev + 50)}
            className="w-full py-2 mt-2 rounded-xl text-[10px] font-semibold text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-colors tracking-wide focusable-item cursor-pointer"
          >
            {language === 'tr' ? 'Daha fazla' : 'Show more'} (+
            {otherCategories.length - visibleLiveCategoryLimit})
          </button>
        )}
      </aside>

      <section className="series-catalog-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.07]">
        <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5 lg:px-6">
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
              {language === 'tr' ? 'Canlı TV' : 'Live TV'}
            </p>
            <h2 className="truncate text-[18px] font-bold tracking-[-0.02em] text-white/92 lg:text-[20px]">
              {activeTitle}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38">
              {filteredDisplayItems.length > 0
                ? language === 'tr'
                  ? `${filteredDisplayItems.length} kanal`
                  : `${filteredDisplayItems.length} channels`
                : null}
            </span>
            {/* View Mode Switcher */}
            <button
              type="button"
              onClick={handleToggleViewMode}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.035] text-white/38 transition-colors hover:bg-white/[0.07] hover:text-white cursor-pointer focusable-item"
              title={viewMode === 'list' ? (language === 'tr' ? 'Izgara Görünümü' : 'Grid View') : (language === 'tr' ? 'Liste Görünümü' : 'List View')}
              aria-label={viewMode === 'list' ? (language === 'tr' ? 'Izgara Görünümü' : 'Grid View') : (language === 'tr' ? 'Liste Görünümü' : 'List View')}
            >
              {viewMode === 'list' ? <Grid size={13} /> : <List size={13} />}
            </button>
            <button
              type="button"
              onClick={handleTogglePreviewCollapse}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.035] text-white/38 transition-colors hover:bg-white/[0.07] hover:text-white cursor-pointer focusable-item"
              title={isPreviewCollapsed ? (language === 'tr' ? 'Detayları Göster' : 'Detayları Gizle') : (language === 'tr' ? 'Detayları Gizle' : 'Show Details')}
              aria-label={isPreviewCollapsed ? (language === 'tr' ? 'Detayları Göster' : 'Detayları Gizle') : (language === 'tr' ? 'Detayları Gizle' : 'Show Details')}
            >
              <Info size={13} className={isPreviewCollapsed ? 'opacity-40' : 'text-[var(--accent-color)]'} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            className="hide-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4 lg:px-5 lg:pt-5"
            onScroll={handleMainScroll}
          >
          {filteredDisplayItems.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-20 text-center select-none">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                <Tv size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white/55">
                {language === 'tr' ? 'Kanal bulunamadı' : 'No channels found'}
              </h3>
            </div>
          ) : viewMode === 'grid' ? (
            <VirtualizedList
              items={chunkedDisplayItems}
              itemHeight={112}
              renderItem={(rowItems) => (
                <div className="grid w-full grid-cols-2 gap-3 py-1 xl:grid-cols-3 2xl:grid-cols-4">
                  {rowItems.map((channel) => (
                    <LiveChannelGridCard
                      key={channel.id}
                      channel={channel}
                      onClick={handlePlayStream}
                      isOnline={checkedStatusMap[channel.id]}
                      isFavorite={favoritesSet.has(channel.id)}
                      onToggleFavorite={toggleFavorite}
                      onContextMenu={openContextMenu}
                      onActive={setSelectedChannel}
                      isActive={previewChannel?.id === channel.id}
                    />
                  ))}
                </div>
              )}
            />
          ) : (
            <VirtualizedList
              items={filteredDisplayItems}
              itemHeight={58}
              renderItem={(channel) => (
                <LiveChannelCard
                  key={channel.id}
                  channel={channel}
                  onClick={handlePlayStream}
                  isOnline={checkedStatusMap[channel.id]}
                  isFavorite={globalFavorites.includes(channel.id)}
                  onToggleFavorite={toggleFavorite}
                  onContextMenu={openContextMenu}
                  onActive={setSelectedChannel}
                  isActive={previewChannel?.id === channel.id}
                />
              )}
            />
          )}
          </div>

          {!isPreviewCollapsed && (
        previewChannel ? (
          <aside className="hidden w-[286px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/[0.06] bg-black/10 p-5 text-left select-none hide-scrollbar xl:flex 2xl:w-80">
            {/* Logo Card Frame */}
            <div className="relative w-full aspect-video rounded-xl bg-neutral-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group">
              {previewChannel.logo ? (
                <img 
                  src={previewChannel.logo} 
                  alt=""
                  decoding="async"
                  loading="lazy"
                  className="max-h-[75%] max-w-[75%] object-contain z-10 transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => { e.currentTarget.hidden = true; }}
                />
              ) : (
                <Tv size={32} className="text-neutral-500 z-10" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent pointer-events-none" />
              {/* Pulsing Live Tag */}
              <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 bg-red-600/20 border border-red-500/30 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[8px] font-black text-red-300 uppercase tracking-widest">{language === 'tr' ? 'CANLI' : 'LIVE'}</span>
              </div>
              {getQualityBadge(previewChannel.name) && (
                <div className="absolute top-2.5 right-2.5 z-20">
                  <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[7px] font-black text-neutral-300 uppercase tracking-widest">
                    {getQualityBadge(previewChannel.name)}
                  </span>
                </div>
              )}
            </div>

            {/* Info Group */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <span className="text-[9px] font-extrabold tracking-widest uppercase text-[var(--accent-color)]">
                {previewChannel.group || (language === 'tr' ? 'GENEL KATALOG' : 'GENERAL CATALOG')}
              </span>
              <h3 className="text-base font-black text-white leading-tight truncate">
                {cleanChannelName(previewChannel.name)}
              </h3>
            </div>



            {/* Play Button */}
            <div className="flex flex-col gap-2 mt-auto shrink-0">
              <button type="button"
                onClick={() => handlePlayStream(previewChannel)}
                className="w-full py-3 bg-white hover:bg-neutral-200 text-black rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.97] cursor-pointer"
               aria-label="Play">
                <Play size={12} fill="#000" /> {language === 'tr' ? 'Kanalı İzle' : 'Watch Channel'}
              </button>
              
              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(previewChannel.id, e);
                }}
                className={`w-full py-2.5 border rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.97] cursor-pointer ${
                  globalFavorites.includes(previewChannel.id)
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
                    : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
                }`}
              >
                <Heart size={12} fill={globalFavorites.includes(previewChannel.id) ? "currentColor" : "none"} />
                {globalFavorites.includes(previewChannel.id)
                  ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') 
                  : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
              </button>
            </div>
          </aside>
        ) : (
          <aside className="hidden w-[286px] shrink-0 flex-col items-center justify-center border-l border-white/[0.06] bg-black/10 p-6 text-center text-white/35 select-none xl:flex 2xl:w-80">
            <Tv size={28} className="mb-3" />
            <span className="text-xs font-semibold">{language === 'tr' ? 'Kanal seçin' : 'Select a channel'}</span>
          </aside>
        )
          )}
        </div>
      </section>
      {contextMenu && (
        <MediaCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isFavorite={globalFavorites.includes(contextMenu.item.id)}
          onClose={() => setContextMenu(null)}
          onPlay={handlePlayStream}
          onToggleFavorite={(id) => toggleFavorite(id)}
        />
      )}
    </div>
  );
});
