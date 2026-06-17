import React, { useState, useEffect, useMemo, useRef } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  buffer?: number;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight = 74,
  buffer = 200
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
      if (!node) return null;
      const overflowY = window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
      if (isScrollable) return node;
      return getScrollParent(node.parentElement);
    };

    const parent = getScrollParent(el.parentElement);
    const target = parent || document.documentElement;

    setClientHeight(target.clientHeight);
    setScrollTop(target.scrollTop);

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollTop(target.scrollTop || 0);
          ticking = false;
        });
        ticking = true;
      }
    };
    const handleResize = () => {
      setClientHeight(target.clientHeight);
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        setClientHeight(target.clientHeight);
      });
      resizeObserver.observe(target);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      target.removeEventListener('scroll', handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  const { visibleItems, startIdx, endIdx } = useMemo(() => {
    const total = items.length;
    const startIdx = Math.max(0, Math.floor((scrollTop - buffer) / itemHeight));
    const endIdx = Math.min(total, Math.ceil((scrollTop + clientHeight + buffer) / itemHeight));
    return {
      visibleItems: items.slice(startIdx, endIdx),
      startIdx,
      endIdx
    };
  }, [items, scrollTop, clientHeight, itemHeight, buffer]);

  const paddingTop = startIdx * itemHeight;
  const paddingBottom = (items.length - endIdx) * itemHeight;

  return (
    <div ref={containerRef} style={{ paddingTop, paddingBottom, width: '100%' }}>
      <div className="flex flex-col gap-2.5 w-full">
        {visibleItems.map((item, index) => renderItem(item, startIdx + index))}
      </div>
    </div>
  );
}
