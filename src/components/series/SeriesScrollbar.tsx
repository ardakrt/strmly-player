import React, { useCallback, useEffect, useRef, useState } from 'react';

// DOM-based scrollbar for the Series page.
//
// Why not CSS: Chromium ignores every ::-webkit-scrollbar-* rule as soon as
// any standard scrollbar property (scrollbar-width/scrollbar-color) resolves
// on the element — and this codebase sets them globally via `* { ... }`.
// The result was an OS-drawn dark track painted over the catalog cards that
// no amount of pseudo-element styling could remove. Rendering the thumb as a
// real element sidesteps the engine entirely: fully transparent track,
// pixel-perfect styling, zero layout footprint.

const PAD = 10; // vertical inset of the thumb travel area
const MIN_THUMB = 48;
const HIDE_DELAY = 1100;

interface SeriesScrollbarProps {
  targetRef: React.RefObject<HTMLElement | null>;
}

export const SeriesScrollbar = React.memo(function SeriesScrollbar({ targetRef }: SeriesScrollbarProps) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef(0);
  const [geometry, setGeometry] = useState<{ thumb: number; travel: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Recompute thumb size from the scroller's metrics; hide entirely when
  // nothing overflows.
  const measure = useCallback(() => {
    const el = targetRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setGeometry(null);
      return;
    }
    const travel = track.clientHeight - PAD * 2;
    const thumb = Math.max((clientHeight / scrollHeight) * travel, MIN_THUMB);
    setGeometry((prev) =>
      prev && prev.thumb === thumb && prev.travel === travel ? prev : { thumb, travel },
    );
    setProgress(scrollTop / (scrollHeight - clientHeight));
  }, [targetRef]);

  const flash = useCallback(() => {
    setVisible(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!dragging.current) setVisible(false);
    }, HIDE_DELAY);
  }, []);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const handleScroll = () => {
      measure();
      flash();
    };
    const resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(el);

    el.addEventListener('scroll', handleScroll, { passive: true });
    measure();
    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [targetRef, measure, flash]);

  // Track click: jump so the thumb centers on the pointer, then start a drag.
  const handleTrackPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = targetRef.current;
      const thumb = thumbRef.current;
      const track = trackRef.current;
      if (!el || !thumb || !track || !geometry) return;
      const trackRect = track.getBoundingClientRect();
      const thumbTop = PAD + progress * (geometry.travel - geometry.thumb);
      const clickY = event.clientY - trackRect.top;

      if (clickY < thumbTop || clickY > thumbTop + geometry.thumb) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        const ratio = (clickY - PAD - geometry.thumb / 2) / (geometry.travel - geometry.thumb);
        el.scrollTop = Math.max(0, Math.min(1, ratio)) * maxScroll;
      }

      dragging.current = true;
      const thumbRect = thumb.getBoundingClientRect();
      dragOffset.current = event.clientY - thumbRect.top;
      thumb.setPointerCapture(event.pointerId);
      setVisible(true);
    },
    [targetRef, geometry, progress],
  );

  const handleThumbPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = targetRef.current;
      const track = trackRef.current;
      if (!dragging.current || !el || !track || !geometry) return;
      const trackRect = track.getBoundingClientRect();
      const top = event.clientY - trackRect.top - dragOffset.current - PAD;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const ratio = top / (geometry.travel - geometry.thumb);
      el.scrollTop = Math.max(0, Math.min(1, ratio)) * maxScroll;
    },
    [targetRef, geometry],
  );

  const handleThumbPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    thumbRef.current?.releasePointerCapture(event.pointerId);
    flash();
  }, [flash]);

  const show = visible && geometry !== null;
  const thumbTop = geometry ? PAD + progress * (geometry.travel - geometry.thumb) : 0;

  return (
    <div
      ref={trackRef}
      onPointerDown={handleTrackPointerDown}
      className="pointer-events-auto absolute inset-y-0 right-0 z-30 w-3 select-none"
      aria-hidden="true"
    >
      <div
        ref={thumbRef}
        onPointerMove={handleThumbPointerMove}
        onPointerUp={handleThumbPointerUp}
        onPointerCancel={handleThumbPointerUp}
        className={`absolute left-1/2 w-[4px] -translate-x-1/2 rounded-full bg-white/40 transition-[opacity,background-color] duration-200 hover:bg-white/70 active:bg-white/90 cursor-grab active:cursor-grabbing ${
          show ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ top: thumbTop, height: geometry?.thumb ?? 0 }}
      />
    </div>
  );
});
