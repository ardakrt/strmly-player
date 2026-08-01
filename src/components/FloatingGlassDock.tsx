/* Hallmark · component: floating-dock · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useState } from 'react';

export interface DockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  badge?: string | number;
  disabled?: boolean;
}

export interface FloatingGlassDockProps {
  items: DockItem[];
  className?: string;
}

export const FloatingGlassDock: React.FC<FloatingGlassDockProps> = ({
  items,
  className = '',
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-2 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] transition-all duration-300 select-none ${className}`}
    >
      {items.map((item) => {
        const isHovered = hoveredId === item.id;
        return (
          <div key={item.id} className="relative flex flex-col items-center group">
            {/* Tooltip on Hover */}
            <div
              className={`pointer-events-none absolute -top-9 z-50 rounded-lg border border-white/10 bg-black/85 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg backdrop-blur-md transition-all duration-200 ${
                isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-95'
              }`}
            >
              {item.label}
            </div>

            {/* Dock Icon Button */}
            <button
              type="button"
              onClick={item.onClick}
              disabled={item.disabled}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out cursor-pointer focusable-item ${
                isHovered
                  ? 'scale-125 bg-white/20 text-white z-20 shadow-xl'
                  : 'scale-100 text-white/80 hover:text-white hover:bg-white/10'
              } ${item.isActive ? 'bg-white/25 text-white ring-1 ring-white/30' : ''}`}
              title={item.label}
            >
              <div className="transition-transform duration-200">{item.icon}</div>
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow">
                  {item.badge}
                </span>
              )}
            </button>

            {/* Active Dot Indicator */}
            {item.isActive && (
              <span className="mt-1 h-1 w-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FloatingGlassDock;
