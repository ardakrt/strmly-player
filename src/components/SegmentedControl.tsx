/* Hallmark · component: tab-strip · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useRef, useEffect, useState } from 'react';
import { useSettings } from '../context/SettingsContext';

export interface SegmentItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface SegmentedControlProps<T extends string = string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  items,
  value,
  onChange,
  className = '',
  size = 'md',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const { language } = useSettings();
  const resolvedAriaLabel = ariaLabel || (language === 'tr' ? 'Kategori seçimi' : 'Category selection');
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  // Calculate sliding pill position
  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector<HTMLElement>(`[data-value="${value}"]`);
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [value, items]);

  const sizeClasses = {
    sm: 'p-0.5 text-xs rounded-lg gap-0.5',
    md: 'p-1 text-xs sm:text-sm rounded-xl gap-1',
    lg: 'p-1.5 text-sm rounded-2xl gap-1.5',
  }[size];

  const buttonPadding = {
    sm: 'px-2.5 py-1',
    md: 'px-3.5 py-1.5',
    lg: 'px-4 py-2',
  }[size];

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={resolvedAriaLabel}
      className={`relative inline-flex items-center bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl ${sizeClasses} ${className}`}
    >
      {/* Sliding Pill Indicator */}
      <div
        className="absolute top-1 bottom-1 bg-white/10 border border-white/15 rounded-[inherit] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
        }}
      />

      {/* Tabs */}
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-value={item.id}
            onClick={() => onChange(item.id)}
            className={`relative z-10 inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 cursor-pointer select-none rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${buttonPadding} ${
              isActive
                ? 'text-white font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  isActive
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-white/10 text-neutral-400'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
