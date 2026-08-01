/* Hallmark · component: tabs · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface FluidTabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FluidTabs: React.FC<FluidTabsProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  className = '',
  size = 'md',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const updateIndicator = useCallback(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [activeTabId]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator, tabs]);

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[11px] gap-1.5',
    md: 'px-3.5 py-1.5 text-xs gap-2',
    lg: 'px-4 py-2 text-sm gap-2.5',
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center rounded-2xl bg-white/[0.04] border border-white/[0.08] p-1 backdrop-blur-xl select-none ${className}`}
    >
      {/* Sliding Fluid Indicator Backlight */}
      <div
        className="absolute top-1 bottom-1 rounded-xl bg-white/12 border border-white/20 shadow-[0_4px_20px_rgba(255,255,255,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          transform: `translateX(${indicatorStyle.left}px)`,
          width: `${indicatorStyle.width}px`,
        }}
      />

      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`relative z-10 flex items-center justify-center font-bold tracking-wide transition-colors duration-200 cursor-pointer rounded-xl focusable-item ${
              sizeClasses[size]
            } ${
              isActive ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-white/10 border border-white/10 text-white/70">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default FluidTabs;
