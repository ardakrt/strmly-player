import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { getMediaCardLabels } from '../../utils/mediaLabels';
import { ImageWithFallback } from '../ImageWithFallback';
import { TiltHoverCard } from '../TiltHoverCard';
import { HomeRailHeader } from './HomeVodCards';

interface ContinueWatchingRailProps {
  language: 'tr' | 'en';
  title: string;
  clearLabel: string;
  items: PlaylistItem[];
  railArrowClass: string;
  onClear: () => void;
  onScroll: (direction: 'left' | 'right') => void;
  onPlay: (item: PlaylistItem) => void;
  onContextMenu: (event: React.MouseEvent, item: PlaylistItem) => void;
}

export function ContinueWatchingRail({ language, title, clearLabel, items, railArrowClass, onClear, onScroll, onPlay, onContextMenu }: ContinueWatchingRailProps) {
  return (
    <div className="order-1 relative z-20 flex flex-col gap-2.5 select-none animate-fade-in">
      <HomeRailHeader title={title} actionLabel={clearLabel} onAction={onClear} />
      <div className="relative group/row">
        <button type="button" aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'} onClick={() => onScroll('left')} className={`${railArrowClass} left-1`}><ChevronLeft size={18} /></button>
        <div id="slider-history" className="flex gap-3.5 overflow-x-auto pb-5 pt-1 pr-10 hide-scrollbar snap-x scroll-smooth slider-fading-mask">
          {items.map((channel) => {
            const labels = getMediaCardLabels(channel, language);
            const progress = channel.progress ?? 0;
            const subtitle = labels.subtitle || (progress > 0 ? (language === 'tr' ? `Kaldığın yer %${Math.round(progress)}` : `${Math.round(progress)}% watched`) : '');
            return (
              <div key={`recent-${channel.id}-${labels.title}`} tabIndex={0} role="button" className="group/history flex w-[152px] shrink-0 cursor-pointer snap-start flex-col gap-1.5 transition-colors duration-300 md:w-[176px]" onClick={() => onPlay(channel)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPlay(channel); } }} onContextMenu={(event) => onContextMenu(event, channel)}>
                <TiltHoverCard className="w-full rounded-[18px]"><div className="relative aspect-[2/3] w-full overflow-hidden rounded-[18px] border border-white/[0.08] bg-[var(--bg-card)] shadow-[0_10px_28px_rgba(0,0,0,0.35)]"><ImageWithFallback name={labels.searchTitle} group={channel.group || 'VOD'} itemType={channel.type === 'series' || channel.type === 'movie' ? channel.type : 'movie'} isGenericLogo aspect="portrait" lazy={false} /><div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover/history:opacity-100"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg"><Play size={14} fill="#000" className="ml-0.5" /></div></div>{progress > 0 && <div className="absolute bottom-0 left-0 z-20 h-[3px] w-full bg-white/10"><div className="h-full bg-white transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>}</div></TiltHoverCard>
                <div className="min-w-0 px-0.5"><p className="truncate text-[12.5px] font-semibold leading-snug text-white">{labels.title}</p>{(subtitle || progress > 0) && <p className="mt-0.5 truncate text-[10.5px] font-medium text-white/45">{subtitle}{progress > 0 && progress < 100 ? `${subtitle ? ' · ' : ''}%${Math.round(progress)}` : ''}</p>}</div>
              </div>
            );
          })}
        </div>
        <button type="button" aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'} onClick={() => onScroll('right')} className={`${railArrowClass} right-1`}><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}
