import { memo, useMemo } from "react";
import { Info, Pause, Play, RefreshCw, Trash2, X } from "lucide-react";
import type { DownloadItem } from "../hooks/useDownloads";
import { parseSeriesEpisodeInfo } from "../utils/seriesGroupers";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { ImageWithFallback } from "./ImageWithFallback";
import { TiltHoverCard } from "./TiltHoverCard";
import { statusDotClass, statusLabel, statusTone, type GroupedDownloadItem } from "./downloadsHelpers";

interface ActiveDownloadPanelProps {
  download: GroupedDownloadItem;
  language: string;
  onPlay: (group: GroupedDownloadItem) => void;
  onCancel: (group: GroupedDownloadItem) => void;
  onRetry: (group: GroupedDownloadItem) => void;
  onDelete: (group: GroupedDownloadItem) => void;
  onContextMenu: (x: number, y: number, group: GroupedDownloadItem) => void;
}

export const ActiveDownloadPanel = memo(function ActiveDownloadPanel({
  download,
  language,
  onPlay,
  onCancel,
  onRetry,
  onDelete,
  onContextMenu,
}: ActiveDownloadPanelProps) {
  const isDownloading = download.status === "downloading";
  const isPending = download.status === "pending";
  const isFailed = download.status === "failed";
  const isPaused = download.status === "paused";
  const statusText = statusLabel(download.status, language);
  const progress = Math.min(100, Math.max(0, download.progress || 0));

  const railClass = isFailed
    ? "bg-red-400"
    : isPaused
      ? "bg-amber-400"
      : "bg-white";

  return (
    <div
      className="group/active overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0e0e10]/90 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY, download);
      }}
    >
      <div className="flex">
        {/* Poster column */}
        <button
          type="button"
          onClick={() => onPlay(download)}
          className="relative w-[88px] shrink-0 self-stretch overflow-hidden bg-neutral-950 cursor-pointer sm:w-[100px]"
          aria-label={
            language === "tr"
              ? `${download.name} detay`
              : `${download.name} details`
          }
        >
          <ImageWithFallback
            src={download.logo}
            name={
              download.type === "series"
                ? download.seriesTitle ||
                  parseSeriesEpisodeInfo(download.name).cleanTitle ||
                  download.name
                : download.name
            }
            group={download.group || "MOVIE"}
            itemType={download.type}
            aspect="landscape"
            size="sm"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/40" />
        </button>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className="truncate text-[15px] font-semibold tracking-tight text-white"
                title={download.name}
              >
                {download.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                {statusText && (
                  <span
                    className={`inline-flex items-center gap-1.5 font-semibold ${statusTone(download.status)}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${statusDotClass(download.status)} ${
                        isDownloading ? "animate-pulse" : ""
                      }`}
                    />
                    {statusText}
                  </span>
                )}
                {download.type === "series" && (
                  <span className="font-medium text-white/35">
                    · {download.episodes.length}{" "}
                    {language === "tr" ? "bölüm" : "eps"}
                  </span>
                )}
              </div>
            </div>

            <div
              className="flex shrink-0 items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {isDownloading && (
                <button
                  type="button"
                  onClick={() => onCancel(download)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition-colors hover:bg-white hover:text-black cursor-pointer"
                  title={language === "tr" ? "Duraklat" : "Pause"}
                  aria-label={language === "tr" ? "Duraklat" : "Pause"}
                >
                  <Pause size={14} fill="currentColor" />
                </button>
              )}
              {(isPaused || isFailed) && (
                <button
                  type="button"
                  onClick={() => onRetry(download)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition-opacity hover:opacity-90 cursor-pointer"
                  title={
                    language === "tr"
                      ? isPaused
                        ? "Devam et"
                        : "Yeniden dene"
                      : isPaused
                        ? "Resume"
                        : "Retry"
                  }
                  aria-label={
                    language === "tr"
                      ? isPaused
                        ? "Devam et"
                        : "Yeniden dene"
                      : isPaused
                        ? "Resume"
                        : "Retry"
                  }
                >
                  {isPaused ? (
                    <Play size={13} fill="currentColor" className="ml-0.5" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(download)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] text-white/40 transition-colors hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                title={
                  isDownloading || isPending
                    ? language === "tr"
                      ? "İptal"
                      : "Cancel"
                    : language === "tr"
                      ? "Sil"
                      : "Delete"
                }
                aria-label={
                  isDownloading || isPending
                    ? language === "tr"
                      ? "İptal"
                      : "Cancel"
                    : language === "tr"
                      ? "Sil"
                      : "Delete"
                }
              >
                {isDownloading || isPending ? (
                  <X size={15} />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          </div>

          {/* Progress + stats block */}
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium tabular-nums text-white/40">
                {download.size && download.size !== "0 MB" && (
                  <span>{download.size}</span>
                )}
                {(isDownloading || isPaused) && download.speed && (
                  <>
                    <span className="text-white/15">·</span>
                    <span>{download.speed}</span>
                  </>
                )}
                {(isDownloading || isPaused) && download.timeLeft && (
                  <>
                    <span className="text-white/15">·</span>
                    <span>
                      {language === "tr"
                        ? `${download.timeLeft} kaldı`
                        : `${download.timeLeft} left`}
                    </span>
                  </>
                )}
                {isPending && (
                  <span>
                    {language === "tr" ? "Sırada bekliyor" : "Waiting in queue"}
                  </span>
                )}
              </div>
              {!isPending && (
                <span
                  className={`shrink-0 text-[18px] font-semibold leading-none tabular-nums tracking-tight ${
                    isFailed
                      ? "text-red-400"
                      : isPaused
                        ? "text-amber-400"
                        : "text-white"
                  }`}
                >
                  {Math.round(progress)}
                  <span className="ml-0.5 text-[11px] font-medium text-white/35">
                    %
                  </span>
                </span>
              )}
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              {isPending ? (
                <div className="h-full w-1/4 animate-pulse rounded-full bg-white/20" />
              ) : (
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ease-out ${railClass} ${
                    isDownloading
                      ? "shadow-[0_0_12px_rgba(255,255,255,0.22)]"
                      : ""
                  }`}
                  style={{ width: `${progress}%` }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   Library poster card — Apple TV / Netflix shelf tile
   ═══════════════════════════════════════════════════════════════ */

interface LibraryPosterCardProps {
  download: GroupedDownloadItem;
  language: string;
  onActivate: () => void;
  onDelete: () => void;
  onContextMenu: (x: number, y: number) => void;
}

export const LibraryPosterCard = memo(function LibraryPosterCard({
  download,
  language,
  onActivate,
  onDelete,
  onContextMenu,
}: LibraryPosterCardProps) {
  const isSeries = download.type === "series";
  const epCount = download.episodes.length;

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (isSeries) {
      parts.push(
        language === "tr"
          ? `${epCount} bölüm`
          : `${epCount} ep${epCount === 1 ? "" : "s"}`,
      );
      if (download.seasonNumber && download.seasonNumber > 0) {
        parts.unshift(`S${download.seasonNumber}`);
      }
    } else {
      parts.push(language === "tr" ? "Film" : "Movie");
    }
    if (download.size) parts.push(download.size);
    return parts.join(" · ");
  }, [isSeries, epCount, download.seasonNumber, download.size, language]);

  const displayTitle =
    isSeries && download.seriesTitle ? download.seriesTitle : download.name;

  return (
    <div
      className="group/card flex flex-col gap-2.5"
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
    >
      <TiltHoverCard className="w-full">
        <button
          type="button"
          onClick={onActivate}
          className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-neutral-900 text-left cursor-pointer outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white/30 ring-1 ring-white/[0.07] shadow-[0_12px_32px_rgba(0,0,0,0.32)] hover:ring-white/20 hover:scale-[1.03] hover:shadow-[0_18px_44px_rgba(0,0,0,0.45)]"
          aria-label={
            isSeries
              ? language === "tr"
                ? `${displayTitle} detay`
                : `${displayTitle} details`
              : language === "tr"
                ? `${displayTitle} oynat`
                : `Play ${displayTitle}`
          }
          aria-haspopup={isSeries ? "dialog" : undefined}
        >
          <ImageWithFallback
            src={download.logo}
            name={
              isSeries
                ? download.seriesTitle ||
                  parseSeriesEpisodeInfo(download.name).cleanTitle ||
                  download.name
                : download.name
            }
            group={download.group || "MOVIE"}
            itemType={download.type}
            aspect="landscape"
            size="md"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-80" />

          <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover/card:scale-105">
              <Play size={18} fill="currentColor" className="ml-0.5" />
            </div>
          </div>

          <div className="absolute left-2.5 top-2.5 flex items-center gap-1">
            <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/85 backdrop-blur-md border border-white/10">
              {isSeries
                ? language === "tr"
                  ? "Dizi"
                  : "Series"
                : language === "tr"
                  ? "Film"
                  : "Movie"}
            </span>
          </div>

          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-2 pointer-events-none">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-semibold text-white/75 backdrop-blur-md border border-white/10">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              {language === "tr" ? "Hazır" : "Ready"}
            </span>
          </div>
        </button>
      </TiltHoverCard>

      <div className="px-0.5 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-white/92 leading-snug"
            title={displayTitle}
          >
            {displayTitle}
          </h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/0 opacity-0 transition-all group-hover/card:text-white/35 group-hover/card:opacity-100 hover:!text-red-400 hover:bg-red-500/10 cursor-pointer"
            title={language === "tr" ? "Sil" : "Delete"}
            aria-label={language === "tr" ? "Sil" : "Delete"}
          >
            <Trash2 size={12} />
          </button>
        </div>
        <p className="truncate text-[11px] font-medium text-white/35">
          {subtitle}
        </p>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   Context menu
   ═══════════════════════════════════════════════════════════════ */

interface DownloadsContextMenuProps {
  x: number;
  y: number;
  group: GroupedDownloadItem;
  downloads: DownloadItem[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onPlay: (group: GroupedDownloadItem) => void;
  onRetry: (id: string) => void;
  language: string;
}

export function DownloadsContextMenu({
  x,
  y,
  group,
  downloads,
  onPlay,
  onRetry,
  onDelete,
  onClose,
  language,
}: DownloadsContextMenuProps) {
  const isSeries = group.type === "series";
  const menuItems: ContextMenuItem[] = [];

  menuItems.push({
    id: "details",
    label: isSeries
      ? language === "tr"
        ? "Sezon detayına git"
        : "Go to season details"
      : language === "tr"
        ? "Film detayına git"
        : "Go to movie details",
    icon: <Info size={14} />,
    onSelect: () => onPlay(group),
  });

  if (isSeries && group.seasonNumber !== undefined) {
    menuItems.push({
      id: "delete-season",
      label:
        language === "tr"
          ? `${group.seasonNumber}. Sezonu sil`
          : `Delete Season ${group.seasonNumber}`,
      icon: <Trash2 size={14} />,
      danger: true,
      separatorBefore: true,
      onSelect: () => {
        group.episodes.forEach((ep) => onDelete(ep.id));
      },
    });

    menuItems.push({
      id: "delete-series",
      label:
        language === "tr" ? "Diziyi tamamen kaldır" : "Remove entire series",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => {
        if (group.seriesTitle) {
          const cleanTitle = group.seriesTitle.toLowerCase();
          downloads.forEach((d) => {
            if (d.type === "series") {
              const dInfo = parseSeriesEpisodeInfo(d.name);
              if (dInfo.cleanTitle.toLowerCase() === cleanTitle) {
                onDelete(d.id);
              }
            }
          });
        }
      },
    });
  } else {
    menuItems.push({
      id: "delete-movie",
      label: language === "tr" ? "Filmi sil" : "Delete movie",
      icon: <Trash2 size={14} />,
      danger: true,
      separatorBefore: true,
      onSelect: () => {
        group.episodes.forEach((ep) => onDelete(ep.id));
      },
    });
  }

  const hasIncomplete = group.episodes.some(
    (ep) => ep.status === "paused" || ep.status === "failed",
  );
  if (hasIncomplete) {
    menuItems.push({
      id: "resume-group",
      label: language === "tr" ? "Kalanları devam ettir" : "Resume incomplete",
      icon: <RefreshCw size={13} />,
      separatorBefore: true,
      onSelect: () => {
        group.episodes.forEach((ep) => {
          if (ep.status === "paused" || ep.status === "failed") {
            onRetry(ep.id);
          }
        });
      },
    });
  }

  return (
    <ContextMenu
      x={x}
      y={y}
      title={group.name}
      subtitle={
        group.group ||
        (isSeries
          ? language === "tr"
            ? "Dizi"
            : "Series"
          : language === "tr"
            ? "Medya"
            : "Media")
      }
      items={menuItems}
      onClose={onClose}
    />
  );
}

