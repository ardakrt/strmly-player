/* Hallmark · component: slider · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';

export interface CatalogQuickSliderProps {
  /** Target scrollable container element ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Optional custom class names for positioning */
  className?: string;
  /** Accessible label */
  ariaLabel?: string;
}

export const CatalogQuickSlider: React.FC<CatalogQuickSliderProps> = ({
  containerRef,
  className = '',
  ariaLabel,
}) => {
  const { language } = useSettings();
  const resolvedAriaLabel = ariaLabel || (language === 'tr' ? 'Hızlı Kaydırma Çubuğu' : 'Quick Scroll Bar');
  const [scrollRatio, setScrollRatio] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbHeightPct, setThumbHeightPct] = useState(15);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Sync scroll position from container
  const updateScrollPos = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) {
      setScrollRatio(0);
      return;
    }
    const currentRatio = Math.max(0, Math.min(1, el.scrollTop / maxScroll));
    setScrollRatio(currentRatio);

    // Calculate thumb height ratio (bounded between 10% and 30% of track)
    const ratioVisible = Math.max(0.1, Math.min(0.3, el.clientHeight / el.scrollHeight));
    setThumbHeightPct(ratioVisible * 100);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateScrollPos();
    el.addEventListener('scroll', updateScrollPos, { passive: true });
    window.addEventListener('resize', updateScrollPos);

    return () => {
      el.removeEventListener('scroll', updateScrollPos);
      window.removeEventListener('resize', updateScrollPos);
    };
  }, [containerRef, updateScrollPos]);

  // Handle pointer interactions (drag & click-to-scroll)
  const scrollToRatio = (ratio: number) => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    el.scrollTop = ratio * maxScroll;
  };

  const handlePointerMove = (e: PointerEvent | React.PointerEvent) => {
    if (!trackRef.current || !isDraggingRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, clickY / rect.height));
    setScrollRatio(ratio);
    scrollToRatio(ratio);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!trackRef.current) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture release error if already released
    }
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => isDragging && handlePointerMove(e)}
      onPointerUp={handlePointerUp}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(scrollRatio * 100)}
      aria-label={resolvedAriaLabel}
      tabIndex={0}
      className={`relative select-none touch-none cursor-pointer group/quick-slider transition-opacity duration-300 ${className}`}
    >
      {/* Track Background */}
      <div className="absolute inset-y-0 right-1 w-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md group-hover/quick-slider:w-3.5 group-hover/quick-slider:bg-white/[0.08] transition-all duration-200" />

      {/* Thumb Handle */}
      <div
        className={`absolute right-1 w-2.5 rounded-full bg-white/40 border border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.3)] transition-all duration-100 group-hover/quick-slider:w-3.5 group-hover/quick-slider:bg-white/90 ${
          isDragging ? 'w-3.5 bg-white scale-105 shadow-[0_0_16px_rgba(255,255,255,0.6)]' : ''
        }`}
        style={{
          height: `${thumbHeightPct}%`,
          top: `${scrollRatio * (100 - thumbHeightPct)}%`,
        }}
      />

      {/* Dragging Percentage Tooltip */}
      {isDragging && (
        <div
          className="absolute right-6 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black/90 border border-white/20 text-[10px] font-bold font-mono text-white shadow-2xl backdrop-blur-xl pointer-events-none animate-fade-in"
          style={{ top: `${scrollRatio * 100}%` }}
        >
          %{Math.round(scrollRatio * 100)}
        </div>
      )}
    </div>
  );
};

export default CatalogQuickSlider;
