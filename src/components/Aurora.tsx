import { useEffect, useRef } from 'react';

import './Aurora.css';

interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  time?: number;
  speed?: number;
}

// The aurora renders in a dedicated Web Worker driving an OffscreenCanvas
// (see ./aurora.worker.ts). The render loop is therefore decoupled from the
// main thread, so heavy boot work (playlist parsing, catalog preparation,
// TMDB lookups) cannot stall the animation frames — this is what keeps the
// splash smooth from the first frame to the last, not only the first moments.
export default function Aurora({
  colorStops = ['#5227FF', '#7cff67', '#5227FF'],
  amplitude = 1.0,
  blend = 0.5,
  time,
  speed = 1.0
}: AuroraProps) {
  const ctnDom = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    // Create the canvas per mount so remounts (e.g. StrictMode) always get a
    // fresh, non-transferred canvas.
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctn.appendChild(canvas);

    const worker = new Worker(new URL('./aurora.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    // If the worker fails, the splash still has its ambient gradient layer,
    // so the boot screen is never left blank — log for debuggability.
    worker.onerror = (err) => {
      console.error('Aurora worker failed to render:', err);
    };

    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage(
      {
        type: 'init',
        canvas: offscreen,
        width: ctn.offsetWidth || 1,
        height: ctn.offsetHeight || 1,
        amplitude,
        blend,
        time,
        speed,
        colorStops
      },
      [offscreen]
    );

    // Keep the worker's internal buffer aspect in sync with the container.
    const ro = new ResizeObserver(() => {
      const w = ctn.offsetWidth;
      const h = ctn.offsetHeight;
      if (w > 0 && h > 0) worker.postMessage({ type: 'resize', width: w, height: h });
    });
    ro.observe(ctn);

    return () => {
      ro.disconnect();
      worker.terminate();
      workerRef.current = null;
      if (canvas.parentNode === ctn) ctn.removeChild(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forward live prop changes to the worker (cheap structured-clone posts).
  useEffect(() => {
    workerRef.current?.postMessage({ type: 'props', amplitude, blend, time, speed, colorStops });
  }, [amplitude, blend, time, speed, colorStops]);

  return <div ref={ctnDom} className="aurora-container" />;
}
