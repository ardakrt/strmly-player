import React from 'react';
import { Heart, Tv } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { ImageWithFallback } from '../ImageWithFallback';
import { useSettings } from '../../context/SettingsContext';
import { getQualityBadge, cleanChannelName } from './channelHelpers';

/**
 * 16:9 glass channel tile used by showcase rails and the virtualized grid.
 * The channel name is always visible because playlist logos can be missing or
 * ambiguous; focus adds stronger feedback for keyboard and D-pad navigation.
 */
export const LiveChannelTile = React.memo(({
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
  onToggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent, item: PlaylistItem) => void;
}) => {
  const { language } = useSettings();
  const quality = getQualityBadge(channel.name);
  const cleanedName = cleanChannelName(channel.name);

  return (
    <div
      onClick={() => onClick(channel)}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
      onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(channel); } }}
      role="button"
      tabIndex={0}
      aria-label={cleanedName}
      className="live-channel-tile group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-neutral-900/40 transition-all duration-200  cursor-pointer hover:-translate-y-0.5 hover:border-white/[0.18] hover:bg-white/[0.05] hover:shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
    >
      {/* Channel logo (playlist logo; live items never hit TMDB) */}
      {channel.logo ? (
        <ImageWithFallback src={channel.logo} name={cleanedName} itemType="live" aspect="landscape" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Tv size={22} className="text-neutral-600" />
        </div>
      )}

      {/* Quality badge */}
      {quality && (
        <span className="absolute left-2 top-2 z-20 rounded border border-white/5 bg-black/60 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-neutral-400">
          {quality}
        </span>
      )}

      {/* Online status + favorite action (top-right) */}
      <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
        {isOnline && (
          <span
            className={`h-1.5 w-1.5 rounded-full border border-black/40 shadow-sm ${
              isOnline === 'online' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={isOnline === 'online' ? (language === 'tr' ? 'Çevrimiçi' : 'Online') : (language === 'tr' ? 'Çevrimdışı' : 'Offline')}
          />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.id, e); }}
          className={`grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/65 text-neutral-300 shadow-md transition-all hover:scale-110 hover:text-red-500 focus-visible:opacity-100 cursor-pointer ${
            isFavorite ? 'opacity-100 text-red-500' : 'opacity-0 group-hover:opacity-100'
          }`}
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
          aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
          aria-pressed={isFavorite}
        >
          <Heart size={10} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>

      {/* Persistent name plate: channel identity must not depend on logo quality. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-neutral-950 via-neutral-950/88 to-transparent px-3 pb-2.5 pt-8">
        <span className="block w-full truncate text-left text-[12px] font-bold leading-none tracking-[-0.01em] text-white/92 drop-shadow-sm">
          {cleanedName}
        </span>
      </div>
    </div>
  );
});
