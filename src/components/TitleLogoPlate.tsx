import { memo, useMemo } from 'react';

/** Stable 0–1 hash from a string (for per-title color) */
function hashTitle(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function titlePalette(name: string) {
  const t = hashTitle(name.toLowerCase());
  // Muted cinematic hues — not neon, not gray void
  const hue = Math.floor(t * 360);
  const hue2 = (hue + 28 + Math.floor(t * 40)) % 360;
  return {
    from: `hsl(${hue} 28% 14%)`,
    mid: `hsl(${hue2} 22% 10%)`,
    to: `hsl(${hue} 18% 6%)`,
    glow: `hsla(${hue} 55% 48% / 0.35)`,
    edge: `hsla(${hue} 40% 55% / 0.22)`,
    monogram: `hsla(${hue} 45% 72% / 0.2)`,
  };
}

/** First 1–2 initials for monogram */
function monogramFrom(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export interface TitleLogoPlateProps {
  /** Preferred: official TMDB title; fallback: cleaned playlist name */
  title: string;
  kind?: 'movie' | 'series' | 'live' | string;
  size?: 'sm' | 'md' | 'lg';
  aspect?: 'portrait' | 'landscape' | string;
  language?: string;
}

/**
 * Custom title-as-logo when TMDB poster/backdrop is missing.
 * Uses the resolved series/movie name (TMDB title preferred) for a unique plate.
 */
export const TitleLogoPlate = memo(function TitleLogoPlate({
  title,
  kind = 'movie',
  size = 'md',
  aspect = 'portrait',
  language = 'tr',
}: TitleLogoPlateProps) {
  const display = (title || '').trim() || (language === 'tr' ? 'İsimsiz' : 'Untitled');
  const colors = useMemo(() => titlePalette(display), [display]);
  const mono = useMemo(() => monogramFrom(display), [display]);
  const isPortrait = aspect !== 'landscape';
  const isLg = size === 'lg';

  const titleSize = isLg
    ? 'text-lg md:text-xl'
    : isPortrait
      ? 'text-[13px] sm:text-sm'
      : 'text-sm sm:text-[15px]';

  const monoSize = isLg
    ? 'text-4xl'
    : isPortrait
      ? 'text-2xl sm:text-3xl'
      : 'text-3xl';

  const kindLabel =
    kind === 'series'
      ? language === 'tr'
        ? 'DİZİ'
        : 'SERIES'
      : kind === 'movie'
        ? language === 'tr'
          ? 'FİLM'
          : 'MOVIE'
        : '';

  // Split long titles for 2-line logo feel
  const lines = useMemo(() => {
    const words = display.split(/\s+/).filter(Boolean);
    if (words.length <= 2 || display.length <= 16) return [display];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }, [display]);

  return (
    <div
      className="absolute inset-0 z-[1] flex flex-col items-center justify-center select-none overflow-hidden"
      style={{
        background: `linear-gradient(155deg, ${colors.from} 0%, ${colors.mid} 48%, ${colors.to} 100%)`,
      }}
      title={display}
      data-title-logo="1"
    >
      {/* Soft vignette + glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 50% 42%, ${colors.glow} 0%, transparent 70%),
            radial-gradient(ellipse 100% 80% at 50% 100%, rgba(0,0,0,0.55) 0%, transparent 55%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          boxShadow: `inset 0 0 0 1px ${colors.edge}`,
        }}
      />

      {/* Monogram watermark */}
      <span
        className={`pointer-events-none absolute font-black tracking-tighter ${monoSize}`}
        style={{ color: colors.monogram }}
        aria-hidden
      >
        {mono}
      </span>

      <div className="relative z-10 flex max-w-[88%] flex-col items-center gap-1.5 px-2 text-center">
        {kindLabel ? (
          <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-white/35">
            {kindLabel}
          </span>
        ) : null}

        <div className={`${titleSize} font-extrabold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]`}>
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </div>

        {/* Underline accent like a logo mark */}
        <span
          className="mt-0.5 h-[2px] w-8 rounded-full opacity-80"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.edge}, transparent)`,
          }}
        />
      </div>
    </div>
  );
});
