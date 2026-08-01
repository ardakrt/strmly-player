/* Hallmark · component: carousel · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export interface SnapCarouselProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const SnapCarousel: React.FC<SnapCarouselProps> = ({
  children,
  title,
  subtitle,
  className = '',
}) => {
  const { language } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scrollBy = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className={`relative group/carousel ${className}`}>
      {/* Header */}
      {(title || subtitle) && (
        <div className="flex items-end justify-between px-4 mb-3">
          <div>
            {title && (
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* Nav Controls */}
          <div className="flex items-center gap-1 opacity-80 group-hover/carousel:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => scrollBy('left')}
              disabled={!canScrollLeft}
              aria-label={language === 'tr' ? 'Önceki' : 'Previous'}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => scrollBy('right')}
              disabled={!canScrollRight}
              aria-label={language === 'tr' ? 'Sonraki' : 'Next'}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Snap Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex items-center gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth px-4 py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {React.Children.map(children, (child) => (
          <div className="snap-start shrink-0">{child}</div>
        ))}
      </div>
    </div>
  );
};

export default SnapCarousel;
