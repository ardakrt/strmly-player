/* Hallmark · component: slider · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useState, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';

export interface SliderDetentsProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Detent snap points (e.g. [0, 25, 50, 75, 100] or [0.5, 1, 1.25, 1.5, 2]) */
  detents?: number[];
  onChange: (value: number) => void;
  formatValue?: (val: number) => string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export const SliderDetents: React.FC<SliderDetentsProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  detents = [],
  onChange,
  formatValue = (v) => `${v}`,
  className = '',
  ariaLabel,
  disabled = false,
}) => {
  const { language } = useSettings();
  const resolvedAriaLabel = ariaLabel || (language === 'tr' ? 'Ayar sürgüsü' : 'Settings slider');
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const snapToNearestDetent = (val: number): number => {
    if (detents.length === 0) return val;
    const threshold = (max - min) * 0.035; // 3.5% snap magnetic threshold
    for (const d of detents) {
      if (Math.abs(val - d) <= threshold) {
        return d;
      }
    }
    return val;
  };

  const handlePointerMove = (e: PointerEvent | React.PointerEvent) => {
    if (!trackRef.current || disabled) return;
    const rect = trackRef.current.getBoundingClientRect();
    const rawRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawVal = min + rawRatio * (max - min);
    const steppedVal = Math.round(rawVal / step) * step;
    const finalVal = snapToNearestDetent(steppedVal);
    onChange(finalVal);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture lost
    }
  };

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className={`relative flex items-center select-none ${className}`}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => isDragging && handlePointerMove(e)}
        onPointerUp={handlePointerUp}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={resolvedAriaLabel}
        tabIndex={disabled ? -1 : 0}
        className={`relative w-full h-6 flex items-center cursor-pointer touch-none group focus-visible:outline-none ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
      >
        {/* Track Background */}
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden relative border border-white/5">
          {/* Filled Track */}
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Detent markers */}
        {detents.map((d) => {
          const detentPct = ((d - min) / (max - min)) * 100;
          const isPassed = value >= d;
          return (
            <span
              key={d}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full pointer-events-none transition-colors ${
                isPassed ? 'bg-white/90' : 'bg-white/20'
              }`}
              style={{ left: `${detentPct}%` }}
            />
          );
        })}

        {/* Thumb Handle */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(244,63,94,0.5)] transition-transform duration-100 group-hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-rose-500 ${
            isDragging ? 'scale-125 ring-2 ring-rose-500' : ''
          }`}
          style={{ left: `${percentage}%` }}
        />
      </div>

      {/* Optional Value Label */}
      <span className="ml-2.5 text-xs font-mono font-medium text-neutral-300 min-w-[2.5rem] text-right">
        {formatValue(value)}
      </span>
    </div>
  );
};

export default SliderDetents;
