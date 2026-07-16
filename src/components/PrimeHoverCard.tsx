import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Heart, Info, Plus } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { TmdbMetadata } from '../utils/vodHelpers';
import { useSettings } from '../context/SettingsContext';
import { cleanMediaTitle, parseSeriesEpisodeInfo } from '../utils/seriesGroupers';

const PREVIEW_WIDTH = 352;
export const HOVER_EXIT_MS = 200;
const OPEN_DELAY_MS = 400;
const CLOSE_DELAY_MS = 120;

interface PrimeHoverCardProps {
  channel: PlaylistItem;
  metadata: TmdbMetadata | null;
  cardRef: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  onClose: () => void;
  onPreviewEnter?: () => void;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  handleOpenDetails: (item: PlaylistItem) => void;
  handlePlayStream?: (item: PlaylistItem) => void;
}

/**
 * Shared hover-preview open/close timing.
 * `mountPreview` is true only while the portal should exist (open + exit anim),
 * so closed cards do not pay PrimeHoverCard render cost.
 */
export function useHoverPreview(openDelay = OPEN_DELAY_MS, closeDelay = CLOSE_DELAY_MS) {
  const [showPreview, setShowPreview] = useState(false);
  const [mountPreview, setMountPreview] = useState(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const unmountTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (unmountTimer.current) window.clearTimeout(unmountTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
    unmountTimer.current = null;
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (unmountTimer.current) {
      window.clearTimeout(unmountTimer.current);
      unmountTimer.current = null;
    }
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => {
      setMountPreview(true);
      setShowPreview(true);
      openTimer.current = null;
    }, openDelay);
  }, [openDelay]);

  const handleMouseLeave = useCallback(() => {
    if (openTimer.current) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (unmountTimer.current) window.clearTimeout(unmountTimer.current);

    closeTimer.current = window.setTimeout(() => {
      setShowPreview(false);
      closeTimer.current = null;
      unmountTimer.current = window.setTimeout(() => {
        setMountPreview(false);
        unmountTimer.current = null;
      }, HOVER_EXIT_MS);
    }, closeDelay);
  }, [closeDelay]);

  const handlePreviewEnter = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (unmountTimer.current) {
      window.clearTimeout(unmountTimer.current);
      unmountTimer.current = null;
    }
    if (openTimer.current) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    setMountPreview(true);
    setShowPreview(true);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    showPreview,
    mountPreview,
    handleMouseEnter,
    handleMouseLeave,
    handlePreviewEnter,
  };
}

function measureCoords(cardEl: HTMLElement) {
  const rect = cardEl.getBoundingClientRect();
  const width = PREVIEW_WIDTH;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - width / 2, 12),
    window.innerWidth - width - 12,
  );

  // Media area (16:9) + meta block ≈ stable height for viewport clamp
  const estimatedHeight = Math.round(width * (9 / 16)) + 168;
  let top = rect.top + rect.height / 2 - estimatedHeight / 2;
  if (top < 12) top = 12;
  if (top + estimatedHeight > window.innerHeight - 12) {
    top = Math.max(12, window.innerHeight - estimatedHeight - 12);
  }

  return {
    left,
    top,
    width,
    originX: Math.round(rect.left + rect.width / 2 - left),
    originY: Math.round(rect.top + rect.height / 2 - top),
  };
}

function PrimeHoverCardInner({
  channel,
  metadata,
  cardRef,
  visible,
  onClose,
  onPreviewEnter,
  toggleFavorite,
  globalFavorites,
  handleOpenDetails,
  handlePlayStream,
}: PrimeHoverCardProps) {
  const { language } = useSettings();
  const [coords] = useState(() =>
    cardRef.current ? measureCoords(cardRef.current) : null,
  );
  const [phase, setPhase] = useState<'in' | 'out'>(visible ? 'in' : 'out');

  useEffect(() => {
    if (visible) {
      setPhase('in');
      return;
    }
    setPhase('out');
  }, [visible]);

  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleScroll);
    };
  }, [onClose]);

  const isFavorite = globalFavorites.includes(channel.id);
  const isLive = channel.type === 'live';
  const isSeries = channel.type === 'series';

  const rating = metadata?.rating;
  const matchScore = useMemo(() => {
    if (!rating) return null;
    const score = Math.round(parseFloat(rating) * 10);
    if (!Number.isFinite(score) || score <= 0) return null;
    return language === 'tr' ? `%${score} Eşleşme` : `${score}% Match`;
  }, [rating, language]);

  if (!coords) return null;

  const posterSrc = metadata?.posterUrl || (!isLive ? channel.logo : null) || null;
  const backdropSrc = metadata?.backdropUrl || null;
  // True landscape only when backdrop is present and different from portrait poster
  const hasLandscapeArt = Boolean(
    backdropSrc && (!posterSrc || backdropSrc !== posterSrc),
  );
  const previewImageSrc = isLive
    ? channel.logo
    : (hasLandscapeArt ? backdropSrc : posterSrc);

  const fallbackTitle = isSeries
    ? parseSeriesEpisodeInfo(channel.name).cleanTitle || cleanMediaTitle(channel.name)
    : cleanMediaTitle(channel.name);
  const displayTitle = (metadata?.title || fallbackTitle || channel.name).trim();

  const year = metadata?.year || '';
  const duration = metadata?.duration || '';
  const genres = metadata && metadata.genres.length > 0
    ? metadata.genres.slice(0, 3)
    : (channel.group ? [channel.group] : []);

  const displayOverview = isLive
    ? (language === 'tr'
      ? 'Kesintisiz canlı yayını şimdi izleyin.'
      : 'Watch the live broadcast now.')
    : (metadata?.overview || '');

  const typeLabel = isLive
    ? (language === 'tr' ? 'Canlı' : 'Live')
    : isSeries
      ? (language === 'tr' ? 'Dizi' : 'Series')
      : (language === 'tr' ? 'Film' : 'Movie');

  const primaryLabel = isLive
    ? (language === 'tr' ? 'İzle' : 'Watch')
    : isSeries
      ? (language === 'tr' ? 'Bölümler' : 'Episodes')
      : (language === 'tr' ? 'Oynat' : 'Play');

  const metaBits = [year, duration].filter(Boolean);

  return createPortal(
    <div
      onMouseEnter={() => onPreviewEnter?.()}
      onMouseLeave={onClose}
      className={`prime-hover-card fixed z-[220] flex flex-col select-none ${
        phase === 'in' ? 'prime-hover-card--in' : 'prime-hover-card--out'
      }`}
      style={{
        left: coords.left,
        top: coords.top,
        width: coords.width,
        transformOrigin: `${coords.originX}px ${coords.originY}px`,
      }}
      role="dialog"
      aria-label={displayTitle}
    >
      {/* Media */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[#09090b]">
        {previewImageSrc ? (
          hasLandscapeArt || isLive ? (
            <img
              src={previewImageSrc}
              alt=""
              draggable={false}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <img
                src={previewImageSrc}
                alt=""
                draggable={false}
                decoding="async"
                aria-hidden
                className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl"
              />
              <img
                src={previewImageSrc}
                alt=""
                draggable={false}
                decoding="async"
                className="absolute inset-0 h-full w-full object-contain object-center"
              />
            </>
          )
        ) : (
          <div className="absolute inset-0 bg-neutral-900" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/40 to-black/10" />

        <div className="absolute left-3 top-3 z-10 pointer-events-none">
          {isLive ? (
            <span className="inline-flex h-[22px] items-center rounded-md bg-red-600 px-2 text-[10px] font-bold tracking-wide text-white shadow-md">
              {typeLabel}
            </span>
          ) : (
            <span className="inline-flex h-[22px] items-center rounded-md border border-white/12 bg-black/75 px-2 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-sm">
              {typeLabel}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 px-3.5 pb-3 pt-12">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (handlePlayStream && !isSeries) {
                handlePlayStream(channel);
              } else {
                handleOpenDetails(channel);
              }
              onClose();
            }}
            aria-label={primaryLabel}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[12px] font-bold text-black shadow-lg transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
          >
            <Play size={14} fill="currentColor" className="ml-0.5" />
            {primaryLabel}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(channel.id, e);
            }}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border backdrop-blur-md transition-colors duration-150 cursor-pointer ${
              isFavorite
                ? 'border-red-400/30 bg-red-500/20 text-red-400'
                : 'border-white/15 bg-black/60 text-white/90 hover:bg-white/12 hover:text-white'
            }`}
            title={isFavorite
              ? (language === 'tr' ? 'Favoriden çıkar' : 'Remove favorite')
              : (language === 'tr' ? 'Favoriye ekle' : 'Add favorite')}
            aria-label={isFavorite
              ? (language === 'tr' ? 'Favoriden çıkar' : 'Remove favorite')
              : (language === 'tr' ? 'Favoriye ekle' : 'Add favorite')}
          >
            {isFavorite ? <Heart size={15} fill="currentColor" /> : <Plus size={16} strokeWidth={2.25} />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetails(channel);
              onClose();
            }}
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/60 text-white/90 backdrop-blur-md transition-colors duration-150 hover:bg-white/12 hover:text-white cursor-pointer"
            title={language === 'tr' ? 'Detaylar' : 'Details'}
            aria-label={language === 'tr' ? 'Detaylar' : 'Details'}
          >
            <Info size={15} />
          </button>
        </div>
      </div>

      {/* Meta — opaque so text never bleeds over cards underneath */}
      <div className="relative z-10 flex flex-col gap-1.5 bg-[#0c0c0e] px-3.5 pb-3.5 pt-3">
        <h4 className="line-clamp-1 text-[15px] font-bold tracking-tight text-white leading-snug">
          {displayTitle}
        </h4>

        {(matchScore || metaBits.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-white/55">
            {matchScore && (
              <span className="font-semibold text-emerald-400/95">{matchScore}</span>
            )}
            {matchScore && metaBits.length > 0 && (
              <span className="text-white/20">·</span>
            )}
            {metaBits.map((bit, i) => (
              <span key={`${bit}-${i}`} className="inline-flex items-center">
                {i > 0 && <span className="mr-2 text-white/20">·</span>}
                {bit}
              </span>
            ))}
          </div>
        )}

        {displayOverview ? (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-white/48">
            {displayOverview}
          </p>
        ) : null}

        {genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="inline-flex h-[20px] max-w-[9rem] items-center truncate rounded-md border border-white/[0.08] bg-white/[0.05] px-1.5 text-[10px] font-medium capitalize text-white/50"
              >
                {genre.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export const PrimeHoverCard = memo(PrimeHoverCardInner);
