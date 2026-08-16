import React from 'react';
import { Heart, Tv } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { useSettings } from '../../context/SettingsContext';
import { getQualityBadge, cleanChannelName } from './channelHelpers';

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
      onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') onClick(channel); }}
      className={`group flex items-center justify-between p-2 pl-3.5 rounded-xl transition-all  cursor-pointer border ${
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
