import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';

const getColumnsCount = (width: number, size: string) => {
  if (size === 'small') {
    if (width < 480) return 3;
    if (width < 768) return 4;
    if (width < 1024) return 5;
    if (width < 1280) return 6;
    return 7;
  } else if (size === 'large') {
    if (width < 540) return 2;
    if (width < 960) return 3;
    return 4;
  } else { // medium
    if (width < 540) return 2;
    if (width < 800) return 3;
    if (width < 1100) return 4;
    return 5;
  }
};

interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  buffer?: number;
}

export function VirtualizedGrid<T>({
  items,
  renderItem,
  buffer = 300
}: VirtualizedGridProps<T>) {
  const { cardLayoutSize } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(1000);

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
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setClientHeight(target.clientHeight);
        const w = entry.contentRect.width;
        setContainerWidth(w);
      }
    });

    resizeObserver.observe(el);
    target.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      target.removeEventListener('scroll', handleScroll);
    };
  }, []);



  const columns = useMemo(
    () => getColumnsCount(containerWidth, cardLayoutSize),
    [containerWidth, cardLayoutSize],
  );

  const rowHeight = useMemo(() => {
    // Gap size is 24px (gap-6)
    const totalGapWidth = (columns - 1) * 24;
    const widthToUse = Math.max(containerWidth, 400);
    const cardWidth = (widthToUse - totalGapWidth) / columns;
    const cardHeight = cardWidth * 1.5;
    // Extra height for card details (10px gap + 16px title + 2px margin + 16px subtitle = ~44px)
    // plus the grid gap-6 between rows (24px)
    const extraHeight = 44 + 24;
    return Math.ceil(cardHeight + extraHeight);
  }, [containerWidth, columns]);

  const totalRows = useMemo(
    () => Math.ceil(items.length / columns) || 0,
    [items.length, columns],
  );

  // Calculate visible rows without materializing the full item list.
  const { startRow, endRow } = useMemo(() => {
    if (rowHeight <= 0 || totalRows === 0) {
      return { startRow: 0, endRow: 0 };
    }
    const start = Math.max(0, Math.floor((scrollTop - buffer) / rowHeight));
    const end = Math.min(totalRows, Math.ceil((scrollTop + clientHeight + buffer) / rowHeight));
    return { startRow: start, endRow: end };
  }, [totalRows, scrollTop, clientHeight, rowHeight, buffer]);

  const paddingTop = startRow * rowHeight;
  const paddingBottom = Math.max(0, (totalRows - endRow) * rowHeight);

  // Precompute visible row indices once per scroll window (avoid Array.from + map churn).
  const visibleRowCount = Math.max(0, endRow - startRow);

  if (items.length === 0) {
    return (
      <div ref={containerRef} className="w-full">
        <div className="flex flex-col gap-6 w-full animate-fade-in">
          <div 
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns * 2 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="flex flex-col gap-2.5">
                <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-white/5 skeleton-card-shimmer" />
                <div className="h-4 w-3/4 rounded bg-white/5 skeleton-card-shimmer mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const rows: React.ReactNode[] = [];
  for (let rowIndex = 0; rowIndex < visibleRowCount; rowIndex++) {
    const actualRowIndex = startRow + rowIndex;
    const rowStart = actualRowIndex * columns;
    const rowEnd = Math.min(items.length, rowStart + columns);
    const cells: React.ReactNode[] = [];
    for (let flatIndex = rowStart; flatIndex < rowEnd; flatIndex++) {
      cells.push(
        <React.Fragment key={flatIndex}>{renderItem(items[flatIndex], flatIndex)}</React.Fragment>,
      );
    }
    rows.push(
      <div
        key={`row-${actualRowIndex}`}
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cells}
      </div>,
    );
  }

  return (
    <div ref={containerRef} style={{ paddingTop, paddingBottom, width: '100%' }}>
      <div className="flex flex-col gap-6 w-full">{rows}</div>
    </div>
  );
}
