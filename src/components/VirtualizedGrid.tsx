import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';

const getColumnsCount = (width: number, size: string, compactLargeCards = false) => {
  let columns: number;
  if (size === 'small') {
    if (width < 480) columns = 3;
    else if (width < 768) columns = 4;
    else if (width < 1024) columns = 5;
    else if (width < 1280) columns = 6;
    else columns = 7;
  } else if (size === 'large') {
    if (width < 540) columns = 2;
    else if (width < 960) columns = 3;
    else columns = 4;
  } else { // medium
    if (width < 540) columns = 2;
    else if (width < 800) columns = 3;
    else if (width < 1100) columns = 4;
    else columns = 5;
  }

  // Catalog pages with a permanent sidebar need a predictable dense layout.
  // Apply it independently of the global card-size preference; otherwise the
  // medium preference keeps wide desktop catalog cards at five columns.
  if (compactLargeCards && width >= 1280) {
    return 7;
  }

  if (compactLargeCards && width >= 720) {
    return Math.max(columns, 5);
  }

  return columns;
};

interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  buffer?: number;
  compactLargeCards?: boolean;
}

export function VirtualizedGrid<T>({
  items,
  renderItem,
  buffer = 300,
  compactLargeCards = false,
}: VirtualizedGridProps<T>) {
  const { cardLayoutSize } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(1000);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Prefer a nearby overflow container that is actually height-constrained.
    // Walking to the page shell first caused clipped "half cards" when the
    // catalog stage used its own scrollport.
    const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
      let current = node;
      while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
        if (canScroll && current.scrollHeight >= current.clientHeight - 1) {
          // Prefer the nearest scrollport that is visibly constrained.
          if (current.clientHeight > 0 && current.clientHeight < window.innerHeight * 0.98) {
            return current;
          }
          if (current.clientHeight > 0) {
            return current;
          }
        }
        current = current.parentElement;
      }
      return null;
    };

    const parent = getScrollParent(el.parentElement);
    const target: HTMLElement | Document = parent || document.documentElement;

    const readScrollTop = () =>
      target === document.documentElement
        ? window.scrollY || document.documentElement.scrollTop
        : (target as HTMLElement).scrollTop || 0;

    const readClientHeight = () =>
      target === document.documentElement
        ? window.innerHeight
        : (target as HTMLElement).clientHeight;

    setClientHeight(readClientHeight());
    setScrollTop(readScrollTop());

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollTop(readScrollTop());
          ticking = false;
        });
        ticking = true;
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setClientHeight(readClientHeight());
        setContainerWidth(entry.contentRect.width);
      }
    });

    // Also observe the scroll parent so height changes reflow virtualization.
    resizeObserver.observe(el);
    if (parent) resizeObserver.observe(parent);

    const scrollTarget: HTMLElement | Window = parent || window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      scrollTarget.removeEventListener('scroll', handleScroll);
    };
  }, []);



  const columns = useMemo(
    () => getColumnsCount(containerWidth, cardLayoutSize, compactLargeCards),
    [containerWidth, cardLayoutSize, compactLargeCards],
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
