import React, { useState, useCallback } from 'react';

/**
 * Official brand logo rendered white-on-transparent with graceful fallback.
 * `badge` renders the compact variant for drawer rows, where the label text
 * lives beside the logo tile and a failed logo degrades to a colored dot.
 *
 * Runtime guards (canvas pixel sampling):
 *  - fully transparent asset → fallback
 *  - opaque four corners (filled background, would become a solid white box
 *    under the brightness-0+invert filter) → fallback
 */
export const BrandLogo = React.memo(({ src, dotColor, title, badge = false }: { src: string; dotColor?: string; title: string; badge?: boolean }) => {
  const [failed, setFailed] = useState(false);
  const handleLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) {
      setFailed(true);
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.naturalWidth, 64);
      canvas.height = Math.min(img.naturalHeight, 64);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let hasVisiblePixel = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 16) { hasVisiblePixel = true; break; }
      }
      if (!hasVisiblePixel) { setFailed(true); return; }
      const w = canvas.width;
      const cornerAlphas = [
        data[3],
        data[(w - 1) * 4 + 3],
        data[(canvas.height - 1) * w * 4 + 3],
        data[data.length - 1],
      ];
      if (cornerAlphas.every((a) => a > 240)) setFailed(true);
    } catch {
      // Cross-origin taint blocks pixel inspection — keep the logo as-is.
    }
  }, []);
  if (failed) {
    if (badge) {
      return dotColor ? (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}66` }} />
      ) : (
        <span className="text-[11px] font-black leading-none text-white/75">{title.trim().slice(0, 1).toUpperCase()}</span>
      );
    }
    return (
      <>
        {dotColor && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}66` }} />
        )}
        <h3 className="truncate text-[12.5px] font-bold tracking-tight text-white/85">{title}</h3>
      </>
    );
  }
  return (
    <img
      src={src}
      alt={title}
      crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
      draggable={false}
      onLoad={handleLoad}
      onError={() => setFailed(true)}
      className={badge
        ? 'h-3.5 w-auto max-w-[60px] shrink-0 object-contain opacity-95 brightness-0 invert select-none'
        : 'h-5.5 md:h-6.5 w-auto max-w-[110px] shrink-0 object-contain opacity-95 brightness-0 invert select-none'}
    />
  );
});
