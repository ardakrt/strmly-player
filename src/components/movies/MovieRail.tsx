import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { MovieCard } from './MovieCard';
import { BrandLogo } from '../series/BrandLogo';

export interface MovieRailProps {
  title: string;
  dotColor?: string;
  logoUrl?: string;
  items: PlaylistItem[];
  onCardClick: (item: PlaylistItem) => void;
  favoritesSet: Set<string>;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  openContextMenu: (event: React.MouseEvent, item: PlaylistItem) => void;
  isDownloading: (url: string) => boolean;
  addDownload: (item: PlaylistItem) => void;
  seeAllCategory?: string;
  onSeeAll?: (category: string) => void;
  language: string;
  initialVisible?: boolean;
  scrollRootRef: React.RefObject<HTMLElement | null>;
}

/**
 * Horizontal showcase rail for movies — mirrors SeriesRail exactly: mounts its
 * cards only when the sentinel nears the viewport, then stays mounted.
 * The deferred mount keeps distant rows cheap without suspending an in-flight
 * entrance animation via content-visibility.
 */
export const MovieRail = React.memo(({
  title,
  dotColor,
  logoUrl,
  items,
  onCardClick,
  favoritesSet,
  toggleFavorite,
  openContextMenu,
  isDownloading,
  addDownload,
  seeAllCategory,
  onSeeAll,
  language,
  initialVisible = false,
  scrollRootRef,
}: MovieRailProps) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initialVisible);
  /** Scroll-reveal: flipped when the rail actually nears the viewport, so
   *  cards slide in as the user scrolls — not when they mount 2400px ahead. */

  useEffect(() => {
    if (initialVisible) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const root = scrollRootRef.current;
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      const railRect = el.getBoundingClientRect();
      const rootRect = root?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
      if (railRect.bottom >= rootRect.top - 2400 && railRect.top <= rootRect.bottom + 2400) {
        revealed = true;
        setVisible(true);
        observer.disconnect();
        root?.removeEventListener('scroll', reveal);
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          reveal();
        }
      },
      { root, rootMargin: '2400px 0px' }
    );
    observer.observe(el);
    root?.addEventListener('scroll', reveal, { passive: true });
    reveal();
    return () => {
      observer.disconnect();
      root?.removeEventListener('scroll', reveal);
    };
  }, [initialVisible, scrollRootRef]);

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

  // Same rail arrow styling as the Home page rails (HomeView railArrowClass)
  const railArrowClass =
    'absolute top-[38%] -translate-y-1/2 z-30 w-9 h-9 rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer ';

  return (
    <section className="mb-6" ref={sentinelRef}>
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {logoUrl ? (
            <BrandLogo src={logoUrl} dotColor={dotColor} title={title} />
          ) : (
            <>
              {dotColor && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}66` }} />
              )}
              <h3 className="truncate text-[12.5px] font-bold tracking-tight text-white/85">{title}</h3>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/28">{items.length}</span>
            </>
          )}
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
            <div key={i} className="w-[138px] shrink-0">
              <div className="aspect-[2/3] rounded-[20px] border border-white/[0.05] skeleton-card-shimmer" />
              <div className="mt-2 h-3 w-3/4 rounded bg-white/[0.05] skeleton-card-shimmer" />
            </div>
          ))}
        </div>
      ) : (
        <div className="group/row relative">
          <div
            ref={scrollRef}
            className="hide-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-0.5 pb-1"
          >
            {items.map((item) => (
              <div
                key={item.id}
                className="w-[138px] shrink-0"
              >
                <MovieCard
                  channel={item}
                  onClick={onCardClick}
                  isFavorite={favoritesSet.has(item.id)}
                  isDownloading={isDownloading(item.url)}
                  onToggleFavorite={toggleFavorite}
                  onDownload={addDownload}
                  isGenericLogo={!!item.isGenericLogo}
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
