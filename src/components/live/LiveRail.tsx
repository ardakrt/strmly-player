import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, History, Heart } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { LiveChannelTile } from './LiveChannelTile';

export interface LiveRailProps {
  title: string;
  icon?: 'recent' | 'favorites';
  channels: PlaylistItem[];
  onChannelClick: (item: PlaylistItem) => void;
  favoritesSet: Set<string>;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  openContextMenu: (event: React.MouseEvent, item: PlaylistItem) => void;
  checkedStatusMap: Record<string, 'online' | 'offline'>;
  seeAllCategory?: string;
  onSeeAll?: (category: string) => void;
  language: string;
  initialVisible?: boolean;
}

/**
 * Horizontal live channel rail. Mirrors SeriesRail: mounts tiles when the
 * sentinel nears the viewport, offscreen paint skipped via .lazy-row-shell.
 */
export const LiveRail = React.memo(({
  title,
  icon,
  channels,
  onChannelClick,
  favoritesSet,
  toggleFavorite,
  openContextMenu,
  checkedStatusMap,
  seeAllCategory,
  onSeeAll,
  language,
  initialVisible = false
}: LiveRailProps) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initialVisible);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (initialVisible) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '2400px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [initialVisible]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setAnimateIn(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setAnimateIn(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro?.disconnect();
    };
  }, [visible, updateArrows]);

  const scrollPage = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  }, []);

  // Same rail arrow styling as the Home/Series rails
  const railArrowClass =
    'absolute top-[38%] -translate-y-1/2 z-30 w-9 h-9 rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer ';

  return (
    <section className="lazy-row-shell mb-6" ref={sentinelRef}>
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {icon === 'recent' && <History size={11} className="shrink-0 text-white/40" />}
          {icon === 'favorites' && <Heart size={11} className="shrink-0 text-red-400/70" />}
          <h3 className="truncate text-[12.5px] font-bold tracking-tight text-white/85">{title}</h3>
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/28">{channels.length}</span>
        </div>
        {onSeeAll && seeAllCategory && (
          <button
            type="button"
            onClick={() => onSeeAll(seeAllCategory)}
            className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-white/35 transition-colors hover:text-white/75 cursor-pointer "
          >
            {language === 'tr' ? 'Tümünü Gör' : 'See All'}
          </button>
        )}
      </div>

      {!visible ? (
        <div className="flex gap-3 overflow-hidden px-0.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="w-52 shrink-0">
              <div className="aspect-video rounded-2xl border border-white/[0.05] skeleton-card-shimmer" />
            </div>
          ))}
        </div>
      ) : (
        <div className="group/row relative">
          <div
            ref={scrollRef}
            className="hide-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-0.5 pb-1"
          >
            {channels.map((channel, index) => (
              <div
                key={channel.id}
                className={`w-52 shrink-0 ${animateIn && index < 8 ? 'series-card-enter' : ''}`}
                style={animateIn && index < 8 ? { animationDelay: `${index * 45}ms` } : undefined}
              >
                <LiveChannelTile
                  channel={channel}
                  onClick={onChannelClick}
                  isOnline={checkedStatusMap[channel.id]}
                  isFavorite={favoritesSet.has(channel.id)}
                  onToggleFavorite={toggleFavorite}
                  onContextMenu={openContextMenu}
                />
              </div>
            ))}
          </div>

          {canLeft && (
            <button
              type="button"
              aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'}
              onClick={() => scrollPage(-1)}
              className={`${railArrowClass} left-1`}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {canRight && (
            <button
              type="button"
              aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'}
              onClick={() => scrollPage(1)}
              className={`${railArrowClass} right-1`}
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      )}
    </section>
  );
});
