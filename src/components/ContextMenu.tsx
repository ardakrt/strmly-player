import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  subtitle?: string;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, title, subtitle, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const margin = 12;
    const rect = menu.getBoundingClientRect();
    setPosition({
      x: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      y: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin))
    });
  }, [x, y, items.length]);

  useEffect(() => {
    const close = () => onClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', close, { capture: true });
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wheel', close, { capture: true });
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[7000] w-[280px] overflow-hidden rounded-2xl border border-white/15 bg-[#0b0b0d]/98 p-2 text-white shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-2xl animate-scale-in select-none"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {(title || subtitle) && (
        <div className="px-3.5 py-3 border-b border-white/10 mb-1.5">
          {title && <div className="text-[13px] leading-5 font-extrabold text-white truncate">{title}</div>}
          {subtitle && <div className="mt-1 text-[10px] leading-4 font-bold uppercase tracking-[0.08em] text-neutral-400 truncate">{subtitle}</div>}
        </div>
      )}
      {items.map((item) => (
        <div key={item.id} className={item.separatorBefore ? 'mt-1 pt-1 border-t border-white/[0.07]' : ''}>
          <button
            type="button"
            role="menuitem"
            className={`w-full h-11 px-3.5 rounded-xl flex items-center gap-3.5 text-left text-[13px] leading-none font-semibold transition-colors ${
              item.danger
                ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
                : 'text-neutral-100 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-current">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
