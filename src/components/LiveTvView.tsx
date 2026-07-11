import React from 'react';
import { 
  Search, Heart, Trash2, Tv, Play, Grid, List, 
  Film, Trophy, Newspaper, Music, Gamepad, Compass, 
  Sparkles, Star, Radio, Info 
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

// Helper to map category names to Lucide icons dynamically
const getCategoryIcon = (name: string) => {
  const upper = name.toUpperCase();
  if (upper.includes('SPOR') || upper.includes('SPORT')) return Trophy;
  if (upper.includes('SİNEMA') || upper.includes('FİLM') || upper.includes('MOVIE') || upper.includes('CİNEMA') || upper.includes('ACTION') || upper.includes('VOD') || upper.includes('VİZYON')) return Film;
  if (upper.includes('HABER') || upper.includes('NEWS') || upper.includes('INFO')) return Newspaper;
  if (upper.includes('MÜZİK') || upper.includes('MUSIC') || upper.includes('KLİP')) return Music;
  if (upper.includes('ÇOCUK') || upper.includes('KİD') || upper.includes('GAME') || upper.includes('GAMİNG') || upper.includes('ANİME') || upper.includes('KARTON')) return Gamepad;
  if (upper.includes('BELGESEL') || upper.includes('DOCUMENTARY') || upper.includes('WİLD') || upper.includes('NAT') || upper.includes('GEOGRAPHIC')) return Compass;
  if (upper.includes('PREMIUM') || upper.includes('VIP') || upper.includes('ÖZEL') || upper.includes('SEÇKİN') || upper.includes('PLATINUM')) return Sparkles;
  if (upper.includes('FAVORİ') || upper.includes('FAV')) return Star;
  return Tv;
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
      className={`group flex items-center justify-between p-2 rounded-xl transition-all focusable-item cursor-pointer border ${
        isActive
          ? 'bg-white/[0.06] border-white/10 border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 scale-[1.01]'
          : 'bg-neutral-900/30 hover:bg-white/5 border-transparent hover:border-white/10'
      }`}
      tabIndex={0}
      style={{ height: '56px' }}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          {channel.logo ? (
            <img 
              src={channel.logo} 
              alt=""
              className="max-w-[70%] max-h-[70%] object-contain" 
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
      {/* Channel Logo Frame */}
      <div className="w-11 h-11 rounded-xl bg-neutral-950/60 border border-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105 mb-1.5">
        {channel.logo ? (
          <img 
            src={channel.logo} 
            alt=""
            className="max-w-[70%] max-h-[70%] object-contain" 
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
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] page-transition-enter pb-12" onContextMenu={() => setContextMenu(null)}>
      {/* 1. Left Categories Sidebar */}
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2 bg-neutral-950/40 border border-white/5 rounded-[24px] p-4 h-full overflow-y-auto shadow-lg select-none hide-scrollbar">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">{language === 'tr' ? 'Kategoriler' : 'Categories'}</span>
          <button type="button"
            onClick={() => liveCat.setEditMode(!liveCat.editMode)}
            className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition-colors focusable-item ${liveCat.editMode ? 'bg-[var(--accent-color)] text-black' : 'bg-white/5 hover:bg-white/10 text-neutral-400'}`}
          >
            {liveCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
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

        {/* All Channels Button */}
        <button type="button"
          onClick={() => { setActiveLiveCategory('Tümü'); setVisibleCount(100); }}
          className={`flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${
            activeLiveCategory === 'Tümü'
              ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
              : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
          }`}
        >
          <Radio size={14} className={activeLiveCategory === 'Tümü' ? 'text-[var(--accent-color)]' : 'text-neutral-500'} />
          <span>{language === 'tr' ? 'Tüm Kanallar' : 'All Channels'}</span>
        </button>

        {/* Favorites Categories Section */}
        {liveFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/5">
            <span className="text-[9px] tracking-widest font-extrabold text-red-500/50 uppercase px-2 mb-1 flex items-center gap-1.5"><Heart size={10} /> {t('navbar.favorites')}</span>
            {liveFavCatsToShow.map(group => {
              const CatIcon = getCategoryIcon(group);
              const isCatActive = activeLiveCategory === group;
              return (
                <div
                  key={`fav-${group}`}
                  className={`relative flex items-center group transition-transform ${liveCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${liveCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  draggable={liveCat.editMode}
                  onDragStart={(e) => liveCat.handleDragStart(e, group)}
                  onDragOver={handleDragOverHelper}
                  onDrop={(e) => liveCat.handleDrop(e, group)}
                >
                  <button type="button"
                    onClick={() => { setActiveLiveCategory(group); setVisibleCount(100); }}
                    className={`w-full flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${liveCat.editMode ? 'pr-16' : 'pr-4'} ${
                      isCatActive
                        ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
                        : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
                    }`}
                  >
                    <CatIcon size={14} className={isCatActive ? 'text-[var(--accent-color)] animate-pulse' : 'text-neutral-500'} />
                    <span className="truncate">{group}</span>
                  </button>
                  {liveCat.editMode && (
                    <div className="absolute right-2.5 flex items-center gap-1 z-20">
                      <button type="button"
                        onClick={(e) => liveCat.toggleFavorite(group, e)}
                        className="w-6 h-6 rounded-md bg-black/40 text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                        title={language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'}
                        aria-label={language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'}
                      >
                        <Heart size={11} fill="currentColor" />
                      </button>
                      <button type="button"
                        onClick={(e) => liveCat.handleHide(group, e)}
                        className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                        title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                        aria-label={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                      >
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
          {otherCategories.slice(0, visibleLiveCategoryLimit).map(group => {
            const CatIcon = getCategoryIcon(group);
            const isCatActive = activeLiveCategory === group;
            return (
              <div
                key={group}
                className={`relative flex items-center group transition-transform ${liveCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${liveCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                draggable={liveCat.editMode}
                onDragStart={(e) => liveCat.handleDragStart(e, group)}
                onDragOver={handleDragOverHelper}
                onDrop={(e) => liveCat.handleDrop(e, group)}
              >
                <button type="button"
                  onClick={() => { setActiveLiveCategory(group); setVisibleCount(100); }}
                  className={`w-full flex items-center gap-3 text-left px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all focusable-item ${liveCat.editMode ? 'pr-16' : 'pr-4'} ${
                    isCatActive
                      ? 'bg-white/[0.06] border-white/10 text-white border-l-[3px] border-l-[var(--accent-color)] shadow-md shadow-black/20 font-bold scale-[1.01]'
                      : 'text-neutral-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
                  }`}
                >
                  <CatIcon size={14} className={isCatActive ? 'text-[var(--accent-color)] animate-pulse' : 'text-neutral-500'} />
                  <span className="truncate">{group}</span>
                </button>
                {liveCat.editMode && (
                  <div className="absolute right-2.5 flex items-center gap-1 z-20">
                    <button type="button"
                      onClick={(e) => liveCat.toggleFavorite(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                      title={language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
                      aria-label={language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
                    >
                      <Heart size={11} />
                    </button>
                    <button type="button"
                      onClick={(e) => liveCat.handleHide(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
                      title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                      aria-label={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {otherCategories.length > visibleLiveCategoryLimit && (
            <button type="button"
              onClick={() => setVisibleLiveCategoryLimit(prev => prev + 50)}
              className="w-full py-2.5 mt-1 rounded-xl text-[10px] font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all tracking-wider uppercase border border-white/5 focusable-item cursor-pointer"
            >
              {language === 'tr' ? 'Daha Fazla Göster' : 'Show More'} (+{otherCategories.length - visibleLiveCategoryLimit})
            </button>
          )}
        </div>
      </div>

      {/* 2. Middle Content Column: Channel List */}
      <div className="flex-1 flex flex-col gap-3 h-full">
        {/* Header Panel */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-950/40 border border-white/5 rounded-[20px] gap-3 shadow-md shrink-0 select-none">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-400 uppercase">
            {language === 'tr'
              ? `${filteredDisplayItems.length} Kanal`
              : `${filteredDisplayItems.length} Channel${filteredDisplayItems.length > 1 ? 's' : ''}`}
          </span>
          <div className="flex items-center gap-1.5">
            {/* View Mode Switcher */}
            <button type="button"
              onClick={handleToggleViewMode}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer focusable-item"
              title={viewMode === 'list' ? (language === 'tr' ? 'Izgara Görünümü' : 'Grid View') : (language === 'tr' ? 'Liste Görünümü' : 'List View')}
              aria-label={viewMode === 'list' ? (language === 'tr' ? 'Izgara Görünümü' : 'Grid View') : (language === 'tr' ? 'Liste Görünümü' : 'List View')}
            >
              {viewMode === 'list' ? <Grid size={13} /> : <List size={13} />}
            </button>
            {/* Preview Panel Toggle */}
            <button type="button"
              onClick={handleTogglePreviewCollapse}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer focusable-item"
              title={isPreviewCollapsed ? (language === 'tr' ? 'Detayları Göster' : 'Detayları Gizle') : (language === 'tr' ? 'Detayları Gizle' : 'Show Details')}
              aria-label={isPreviewCollapsed ? (language === 'tr' ? 'Detayları Göster' : 'Detayları Gizle') : (language === 'tr' ? 'Detayları Gizle' : 'Show Details')}
            >
              <Info size={13} className={isPreviewCollapsed ? 'opacity-40' : 'text-[var(--accent-color)]'} />
            </button>
          </div>
        </div>

        {/* Scroll Container */}
        <div className="flex-1 overflow-y-auto bg-neutral-950/20 border border-white/5 rounded-[24px] p-2 md:p-4 shadow-inner" onScroll={handleMainScroll}>
          {filteredDisplayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-20 opacity-50 select-none">
              <Tv size={32} className="text-neutral-500 mb-3" />
              <h3 className="text-base font-semibold text-neutral-300">{language === 'tr' ? 'Kanal Bulunamadı' : 'No Channels Found'}</h3>
            </div>
          ) : viewMode === 'grid' ? (
            <VirtualizedList
              items={chunkedDisplayItems}
              itemHeight={112}
              renderItem={(rowItems) => (
                <div className="grid grid-cols-4 gap-3 w-full py-1">
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
      </div>

      {/* 3. Right Column: Preview/Details Panel */}
      {!isPreviewCollapsed && (
        previewChannel ? (
          <div className="hidden lg:flex w-80 shrink-0 flex-col gap-4 bg-neutral-950/40 border border-white/5 rounded-[24px] p-4.5 h-full overflow-y-auto shadow-lg text-left select-none hide-scrollbar">
            {/* Logo Card Frame */}
            <div className="relative w-full aspect-video rounded-xl bg-neutral-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group">
              {previewChannel.logo ? (
                <img 
                  src={previewChannel.logo} 
                  alt=""
                  decoding="async"
                  loading="lazy"
                  className="max-h-[55%] max-w-[55%] object-contain z-10 transition-transform duration-500 group-hover:scale-105" 
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
          </div>
        ) : (
          <div className="hidden lg:flex w-80 shrink-0 flex-col items-center justify-center text-center p-6 bg-neutral-950/40 border border-white/5 rounded-[24px] h-full shadow-lg opacity-40 select-none">
            <Tv size={32} className="text-neutral-500 mb-3" />
            <span className="text-xs font-semibold">{language === 'tr' ? 'Kanal Seçin' : 'Select a Channel'}</span>
          </div>
        )
      )}
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
