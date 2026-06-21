import React from 'react';
import { Search, Heart, Trash2, Tv } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import { VirtualizedList } from './VirtualizedList';
import { MediaCardContextMenu } from './MediaCardContextMenu';
import { useSettings } from '../context/SettingsContext';

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

export const LiveChannelCard = React.memo(({
  channel,
  onClick,
  isOnline,
  isFavorite,
  onToggleFavorite,
  onContextMenu
}: {
  channel: PlaylistItem;
  onClick: (item: PlaylistItem) => void;
  isOnline: 'online' | 'offline' | undefined;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent, item: PlaylistItem) => void;
}) => {
  const { language } = useSettings();
  return (
    <div
      onClick={() => onClick(channel)}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
      className="group flex items-center justify-between p-3 rounded-2xl bg-neutral-900/30 hover:bg-white/5 border border-transparent hover:border-white/10 cursor-pointer transition-all focusable-item"
      tabIndex={0}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-neutral-950 border border-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          {channel.logo ? (
            <img 
              src={channel.logo} 
              className="max-w-[70%] max-h-[70%] object-contain" 
              onError={(e) => { (e.target as HTMLImageElement).src = ''; }} 
            />
          ) : (
            <Tv size={16} className="text-neutral-500" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold premium-card-title">{channel.name}</span>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">{channel.group || (language === 'tr' ? 'Genel' : 'General')}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {isOnline && (
          <div
            className={`w-2 h-2 rounded-full border border-black/40 shadow-sm ${
              isOnline === 'online' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={isOnline === 'online' ? (language === 'tr' ? 'Çevrimiçi' : 'Online') : (language === 'tr' ? 'Çevrimdışı' : 'Offline')}
          />
        )}
        <button
          onClick={(e) => onToggleFavorite(channel.id, e)}
          className="w-8 h-8 rounded-full bg-black/40 hover:bg-black border border-white/10 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 shadow-md"
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
        >
          <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>
    </div>
  );
});

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

  if (selectedGroup !== 'Canlı TV') return null;

  const openContextMenu = (event: React.MouseEvent, item: PlaylistItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const otherCategories = liveCat.filteredOtherCategories;

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in pb-12" onContextMenu={() => setContextMenu(null)}>
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2 bg-neutral-950/40 border border-white/5 rounded-[24px] p-4 h-full overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">{language === 'tr' ? 'Kategoriler' : 'Categories'}</span>
          <button
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

        <button
          onClick={() => { setActiveLiveCategory('Tümü'); setVisibleCount(100); }}
          className={`text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all focusable-item ${activeLiveCategory === 'Tümü' ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
        >
          {language === 'tr' ? 'Tüm Kanallar' : 'All Channels'}
        </button>
        {liveFavCatsToShow.length > 0 && (
          <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
            <span className="text-[9px] tracking-widest font-extrabold text-red-500/50 uppercase px-2 mb-1 flex items-center gap-1.5"><Heart size={10} /> {t('navbar.favorites')}</span>
            {liveFavCatsToShow.map(group => (
              <div
                key={`fav-${group}`}
                className={`relative flex items-center group transition-transform ${liveCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${liveCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                draggable={liveCat.editMode}
                onDragStart={(e) => liveCat.handleDragStart(e, group)}
                onDragOver={handleDragOver}
                onDrop={(e) => liveCat.handleDrop(e, group)}
              >
                <button
                  onClick={() => { setActiveLiveCategory(group); setVisibleCount(100); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all focusable-item ${liveCat.editMode ? 'pr-16' : 'pr-4'} ${activeLiveCategory === group ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}
                >
                  {group}
                </button>
                {liveCat.editMode && (
                  <div className="absolute right-2.5 flex items-center gap-1 z-20">
                    <button
                      onClick={(e) => liveCat.toggleFavorite(group, e)}
                      className="w-6 h-6 rounded-md bg-black/40 text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                      title={language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'}
                    >
                      <Heart size={11} fill="currentColor" />
                    </button>
                    <button
                      onClick={(e) => liveCat.handleHide(group, e)}
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
          {otherCategories.slice(0, visibleLiveCategoryLimit).map(group => (
            <div
              key={group}
              className={`relative flex items-center group transition-transform ${liveCat.draggedCategory === group ? 'opacity-50 scale-95' : 'opacity-100'} ${liveCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
              draggable={liveCat.editMode}
              onDragStart={(e) => liveCat.handleDragStart(e, group)}
              onDragOver={handleDragOver}
              onDrop={(e) => liveCat.handleDrop(e, group)}
            >
              <button
                onClick={() => { setActiveLiveCategory(group); setVisibleCount(100); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold transition-all focusable-item ${liveCat.editMode ? 'pr-16' : 'pr-4'} ${activeLiveCategory === group ? 'bg-[var(--accent-color)] text-black shadow-md' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
              >
                {group}
              </button>
              {liveCat.editMode && (
                <div className="absolute right-2.5 flex items-center gap-1 z-20">
                  <button
                    onClick={(e) => liveCat.toggleFavorite(group, e)}
                    className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                    title={language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
                  >
                    <Heart size={11} />
                  </button>
                  <button
                    onClick={(e) => liveCat.handleHide(group, e)}
                    className="w-6 h-6 rounded-md bg-black/40 text-neutral-400 hover:text-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                    title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {otherCategories.length > visibleLiveCategoryLimit && (
            <button
              onClick={() => setVisibleLiveCategoryLimit(prev => prev + 50)}
              className="w-full py-2.5 mt-1 rounded-xl text-[10px] font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all tracking-wider uppercase border border-white/5 focusable-item"
            >
              {language === 'tr' ? 'Daha Fazla Göster' : 'Show More'} (+{otherCategories.length - visibleLiveCategoryLimit})
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-950/40 border border-white/5 rounded-[20px] gap-3 shadow-md shrink-0">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-400 uppercase">
            {language === 'tr'
              ? `${filteredDisplayItems.length} Kanal`
              : `${filteredDisplayItems.length} Channel${filteredDisplayItems.length > 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto bg-neutral-950/20 border border-white/5 rounded-[24px] p-2 md:p-4 shadow-inner" onScroll={handleMainScroll}>
          {filteredDisplayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-20 opacity-50">
              <Tv size={32} className="text-neutral-500 mb-3" />
              <h3 className="text-base font-semibold text-neutral-300">{language === 'tr' ? 'Kanal Bulunamadı' : 'No Channels Found'}</h3>
            </div>
          ) : (
            <VirtualizedList
              items={filteredDisplayItems}
              itemHeight={74}
              renderItem={(channel) => (
                <LiveChannelCard
                  key={channel.id}
                  channel={channel}
                  onClick={handlePlayStream}
                  isOnline={checkedStatusMap[channel.id]}
                  isFavorite={globalFavorites.includes(channel.id)}
                  onToggleFavorite={toggleFavorite}
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
          onToggleFavorite={(id) => toggleFavorite(id)}
        />
      )}
    </div>
  );
});
