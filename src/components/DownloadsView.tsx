import { useState, useMemo, useCallback, memo } from "react";
import {
  ArrowLeft,
  Search,
  Trash2,
  Play,
  Inbox,
  RefreshCw,
  X,
  FolderOpen,
  Info,
  Pause,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { useDownloads } from "../hooks/useDownloads";
import type { AppProviderValue } from "../hooks/useAppProvider";
import type { DownloadItem, DownloadStatus } from "../hooks/useDownloads";
import { ImageWithFallback } from "./ImageWithFallback";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import {
  parseSeriesEpisodeInfo,
  type SeriesEpisode,
} from "../utils/seriesGroupers";

interface DownloadsViewProps {
  app: AppProviderValue;
}

export interface GroupedDownloadItem {
  id: string; // e.g. series-alef-s1 or movie-download-id
  name: string; // e.g. "Alef - 1. Sezon" or movie name
  group: string;
  type: "movie" | "series";
  logo?: string;
  status: DownloadStatus;
  progress: number;
  speed?: string;
  timeLeft?: string;
  size: string;
  addedAt: number;
  completedAt?: number;
  episodes: DownloadItem[];
  seasonNumber?: number;
  seriesTitle?: string;
}

function parseSizeToMB(sizeStr?: string): number {
  if (!sizeStr) return 0;
  const cleaned = sizeStr.trim().replace(",", ".");
  const match = cleaned.match(/^([\d.,]+)\s*([a-zA-Z]+)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit.startsWith("K")) return num / 1024;
  if (unit.startsWith("M")) return num;
  if (unit.startsWith("G")) return num * 1024;
  if (unit.startsWith("T")) return num * 1024 * 1024;
  return num;
}

function formatTotalSize(totalMB: number): string {
  if (totalMB === 0) return "0 MB";
  if (totalMB < 1024) return `${totalMB.toFixed(1)} MB`;
  const gb = totalMB / 1024;
  if (gb < 1024) return `${gb.toFixed(2)} GB`;
  const tb = gb / 1024;
  return `${tb.toFixed(2)} TB`;
}

const groupDownloadsHelper = (rawItems: DownloadItem[]): GroupedDownloadItem[] => {
    const result: GroupedDownloadItem[] = [];
    const seriesGroups: Record<string, DownloadItem[]> = {};

    rawItems.forEach((item) => {
      if (item.type === "movie") {
        result.push({
          id: item.id,
          name: item.name,
          group: item.group,
          type: "movie",
          logo: item.logo,
          status: item.status,
          progress: item.progress,
          speed: item.speed,
          timeLeft: item.timeLeft,
          size: item.size || "0 MB",
          addedAt: item.addedAt,
          completedAt: item.completedAt,
          episodes: [item],
        });
      } else {
        const info = parseSeriesEpisodeInfo(item.name);
        const key = `series-${info.cleanTitle.toLowerCase()}-s${info.season}`;
        if (!seriesGroups[key]) {
          seriesGroups[key] = [];
        }
        seriesGroups[key].push(item);
      }
    });

    Object.keys(seriesGroups).forEach((key) => {
      const groupItems = seriesGroups[key];
      const firstItem = groupItems[0];
      const info = parseSeriesEpisodeInfo(firstItem.name);

      groupItems.sort((a, b) => {
        const aEp = parseSeriesEpisodeInfo(a.name).episode;
        const bEp = parseSeriesEpisodeInfo(b.name).episode;
        return aEp - bEp;
      });

      const totalMB = groupItems.reduce(
        (acc, item) => acc + parseSizeToMB(item.size),
        0,
      );
      const formattedSize = formatTotalSize(totalMB);

      let status: DownloadStatus = "completed";
      const hasDownloading = groupItems.some((i) => i.status === "downloading");
      const hasPending = groupItems.some((i) => i.status === "pending");
      const hasPaused = groupItems.some((i) => i.status === "paused");
      const hasFailed = groupItems.some((i) => i.status === "failed");

      if (hasDownloading) status = "downloading";
      else if (hasPending) status = "pending";
      else if (hasPaused) status = "paused";
      else if (hasFailed) status = "failed";

      let avgProgress: number;
      if (hasDownloading) {
        const downloadingItems = groupItems.filter(
          (i) => i.status === "downloading",
        );
        avgProgress = Math.round(
          downloadingItems.reduce((acc, i) => acc + i.progress, 0) /
            downloadingItems.length,
        );
      } else if (hasPending) {
        avgProgress = 0;
      } else if (hasPaused) {
        const pausedItems = groupItems.filter((i) => i.status === "paused");
        avgProgress =
          pausedItems.length > 0
            ? Math.round(
                pausedItems.reduce((acc, i) => acc + i.progress, 0) /
                  pausedItems.length,
              )
            : 0;
      } else if (hasFailed) {
        const failedItems = groupItems.filter((i) => i.status === "failed");
        avgProgress =
          failedItems.length > 0
            ? Math.round(
                failedItems.reduce((acc, i) => acc + i.progress, 0) /
                  failedItems.length,
              )
            : 0;
      } else {
        avgProgress = 100;
      }

      const activeDl = groupItems.find((i) => i.status === "downloading");
      const speed = activeDl?.speed;
      const timeLeft = activeDl?.timeLeft;

      const groupName =
        info.season > 0
          ? `${info.cleanTitle} - ${info.season}. Sezon`
          : info.cleanTitle;

      result.push({
        id: key,
        name: groupName,
        group: firstItem.group || "Diziler",
        type: "series",
        logo: firstItem.logo,
        status,
        progress: avgProgress,
        speed,
        timeLeft,
        size: formattedSize,
        addedAt: Math.min(...groupItems.map((i) => i.addedAt)),
        completedAt: groupItems.every((i) => i.status === "completed")
          ? Math.max(...groupItems.map((i) => i.completedAt || i.addedAt))
          : undefined,
        episodes: groupItems,
        seasonNumber: info.season,
        seriesTitle: info.cleanTitle,
      });
    });

    return result;
  };

export function DownloadsView({ app }: DownloadsViewProps) {
  const { language } = useSettings();
  const { setSelectedGroup } = app.navigation;

  const {
    downloads,
    cancelDownload,
    retryDownload,
    deleteDownload,
    playDownload,
    prioritizeDownload,
    pauseAll,
    resumeAll,
  } = useDownloads();

  // Plays a saved download inside the app's own player when a local
  // app-file:// URL is available, instead of always shelling out to the
  // OS's default video player.
  const playDownloadInternal = useCallback(
    async (downloadId: string) => {
      const item = downloads.find((d) => d.id === downloadId);
      if (!item) return;

      let playUrl = item.playUrl;
      // Older completed entries sometimes only have filePath — refresh playUrl.
      if (!playUrl && item.status === "completed" && window.electronAPI?.getSavedMediaInfo) {
        try {
          const info = await window.electronAPI.getSavedMediaInfo({
            downloadId: item.id,
            type: item.type,
            name: item.name,
            streamUrl: item.streamUrl,
          });
          if (info?.exists && info.playUrl) {
            playUrl = info.playUrl;
          }
        } catch {
          // fall through to external open
        }
      }

      if (playUrl) {
        app.playback.handlePlayStream({
          id: item.id,
          name: item.name,
          logo: item.logo || "",
          group: item.group,
          url: playUrl,
          type: item.type,
        });
        return;
      }

      if (item.filePath) {
        playDownload(downloadId);
        return;
      }

      // Last resort: stream original IPTV URL if local file is missing.
      if (item.streamUrl) {
        app.playback.handlePlayStream({
          id: item.id,
          name: item.name,
          logo: item.logo || "",
          group: item.group,
          url: item.streamUrl,
          type: item.type,
        });
      }
    },
    [downloads, app.playback, playDownload],
  );

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "active" | "movie" | "series"
  >("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    group: GroupedDownloadItem;
  } | null>(null);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Group downloads function helper


  // Size calculations
  const totalSizeMB = useMemo(() => {
    return downloads
      .filter((download) => download.status === "completed")
      .reduce((acc, download) => acc + parseSizeToMB(download.size), 0);
  }, [downloads]);

  const formattedTotalSize = useMemo(() => {
    return formatTotalSize(totalSizeMB);
  }, [totalSizeMB]);

  // Combined group filters
  const filteredDownloads = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLocaleLowerCase(language === "tr" ? "tr-TR" : undefined);

    // 1. Filter raw items based on category selection
    const filteredRaw = downloads
      .filter((d) => {
        if (categoryFilter === "active") {
          return (
            d.status === "downloading" ||
            d.status === "pending" ||
            d.status === "paused"
          );
        }
        if (categoryFilter === "movie") {
          return d.type === "movie" && d.status === "completed";
        }
        if (categoryFilter === "series") {
          return d.type === "series" && d.status === "completed";
        }
        return true; // all
      })
      .filter((d) => {
        if (!normalizedQuery) return true;
        const haystack = `${d.name} ${d.group}`.toLocaleLowerCase(
          language === "tr" ? "tr-TR" : undefined,
        );
        return haystack.includes(normalizedQuery);
      });

    // 2. Perform Series + Season Grouping
    const grouped = groupDownloadsHelper(filteredRaw);

    // 3. Sort grouped items by their latest activity/added timestamp descending
    return grouped.sort((a, b) => {
      // Active groups go to the top
      const aActive = a.status === "downloading" || a.status === "pending";
      const bActive = b.status === "downloading" || b.status === "pending";
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      const aTime = a.completedAt || a.addedAt;
      const bTime = b.completedAt || b.addedAt;
      return bTime - aTime;
    });
  }, [downloads, language, query, categoryFilter]);

  // Group handlers
  const handleOpenGroupDetails = (group: GroupedDownloadItem) => {
    if (group.type === "series" && group.seriesTitle) {
      const cleanTitle = group.seriesTitle;
      const match = app.catalog.allGroupedSeries?.find(
        (s) =>
          parseSeriesEpisodeInfo(s.name).cleanTitle.toLowerCase() ===
          cleanTitle.toLowerCase(),
      );
      if (match) {
        const clickedEp = group.episodes[0];
        const flatItem = {
          id: clickedEp.id,
          name: clickedEp.name,
          group: clickedEp.group || "",
          type: "series" as const,
          url: clickedEp.streamUrl,
          logo: clickedEp.logo || "",
        };
        app.catalog.handleOpenSeriesModalDirect(match, flatItem);
      } else {
        const seasonsMap: Record<number, SeriesEpisode[]> = {};
        let episodesCount = 0;

        group.episodes.forEach((sib) => {
          const p = parseSeriesEpisodeInfo(sib.name);
          if (!seasonsMap[p.season]) {
            seasonsMap[p.season] = [];
          }
          const exists = seasonsMap[p.season].some(
            (ep) => ep.episodeNumber === p.episode,
          );
          if (!exists) {
            seasonsMap[p.season].push({
              episodeNumber: p.episode,
              seasonNumber: p.season,
              item: {
                id: sib.id,
                name: sib.name,
                group: sib.group || "İndirilenler",
                type: "series",
                url: sib.streamUrl,
                logo: sib.logo || "",
              },
            });
            episodesCount++;
          }
        });

        for (const seasonNo in seasonsMap) {
          seasonsMap[seasonNo].sort(
            (a, b) => a.episodeNumber - b.episodeNumber,
          );
        }

        app.catalog.handleOpenSeriesModalDirect({
          id: group.id,
          name: cleanTitle,
          logo: group.logo || "",
          group: group.group || "İndirilenler",
          type: "series",
          seasons: seasonsMap,
          episodesCount,
        });
      }
    } else {
      // Movie: if it has already finished saving, play the local file
      // directly inside the app instead of opening the online details modal.
      const primaryEpisode = group.episodes[0];
      if (group.status === "completed" && primaryEpisode?.playUrl) {
        playDownloadInternal(primaryEpisode.id);
        return;
      }

      const match = app.catalog.items.find(
        (m) =>
          m.type === "movie" &&
          m.name.toLowerCase() === group.name.toLowerCase(),
      );
      if (match) {
        app.catalog.handleOpenDetails(match);
      } else {
        app.catalog.handleOpenDetails({
          id: group.id,
          name: group.name,
          group: group.group,
          type: "movie",
          url: group.episodes[0].streamUrl,
          logo: group.logo || "",
        });
      }
    }
  };

  const handlePauseGroup = (group: GroupedDownloadItem) => {
    group.episodes.forEach((ep) => {
      if (ep.status === "downloading" || ep.status === "pending") {
        cancelDownload(ep.id);
      }
    });
  };

  const handleResumeGroup = (group: GroupedDownloadItem) => {
    group.episodes.forEach((ep) => {
      if (ep.status === "paused" || ep.status === "failed") {
        retryDownload(ep.id);
      }
    });
  };

  const handleDeleteGroup = (group: GroupedDownloadItem) => {
    group.episodes.forEach((ep) => {
      deleteDownload(ep.id);
    });
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-fade-in pb-16 min-h-[calc(100vh-140px)]">
      {/* Minimal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button type="button"
            onClick={() => setSelectedGroup("Ayarlar")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            title="Geri Dön"
           aria-label="Geri Dön">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2 select-none">
              <span>{language === "tr" ? "İndirilenler" : "Downloads"}</span>
            </h1>
            <p className="text-[11px] text-neutral-400 mt-1 select-none font-medium">
              {language === "tr"
                ? `Çevrimdışı izlenebilir içerikleriniz · ${formattedTotalSize} kullanılan alan`
                : `Your offline watchable content · ${formattedTotalSize} space used`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-[240px]">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === "tr" ? "Ara..." : "Search..."}
            className="h-8.5 w-full rounded-full border border-white/5 bg-black/15 pl-8.5 pr-8 text-xs font-semibold text-white outline-none transition-all placeholder:text-neutral-600 focus:border-white/12 focus:bg-black/25"
          />
          {query && (
            <button type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors cursor-pointer"
             aria-label="Close">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Minimal Category Pills & Action */}
      <div className="flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          {[
            { id: "all", label: language === "tr" ? "Tümü" : "All" },
            { id: "active", label: language === "tr" ? "Aktif" : "Active" },
            { id: "movie", label: language === "tr" ? "Filmler" : "Movies" },
            { id: "series", label: language === "tr" ? "Diziler" : "Series" },
          ].map((pill) => {
            const active = categoryFilter === pill.id;
            return (
              <button type="button"
                key={pill.id}
                onClick={() => setCategoryFilter(pill.id as any)}
                className={`px-3 py-1 text-[10px] font-bold tracking-wide transition-all border rounded-full cursor-pointer ${
                  active
                    ? "bg-white text-black border-white shadow-sm font-black"
                    : "bg-white/[0.02] text-neutral-400 border-white/5 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {downloads.some(
            (d) => d.status === "downloading" || d.status === "pending",
          ) ? (
            <button type="button"
              onClick={pauseAll}
              className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide transition-all border border-white/5 rounded-full cursor-pointer bg-white/[0.02] hover:bg-amber-500/10 hover:border-amber-500/20 text-neutral-400 hover:text-amber-400"
             aria-label="Pause">
              <Pause size={11} />
              <span>{language === "tr" ? "Tümünü Duraklat" : "Pause All"}</span>
            </button>
          ) : downloads.some(
              (d) => d.status === "paused" || d.status === "failed",
            ) ? (
            <button type="button"
              onClick={resumeAll}
              className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide transition-all border border-white/5 rounded-full cursor-pointer bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/20 text-neutral-400 hover:text-emerald-400"
             aria-label="Play">
              <Play size={11} fill="currentColor" />
              <span>{language === "tr" ? "Tümünü Başlat" : "Resume All"}</span>
            </button>
          ) : null}

          <button type="button"
            onClick={() => void window.electronAPI?.openDownloadsFolder?.()}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide transition-all border rounded-full cursor-pointer bg-white/[0.02] text-neutral-400 border-white/5 hover:text-white hover:bg-white/[0.05]"
          >
            <FolderOpen size={11} className="text-neutral-400" />
            <span>
              {language === "tr"
                ? "Dosya Konumunu Aç"
                : "Open Downloads Location"}
            </span>
          </button>
        </div>
      </div>

      {/* Netflix-style Clean List */}
      {filteredDownloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center select-none">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-600">
            <Inbox size={20} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-bold text-neutral-500">
            {downloads.length === 0
              ? language === "tr"
                ? "Kütüphaneniz boş. Çevrimdışı izlemek için içerik indirin."
                : "Your library is empty. Download content to watch offline."
              : language === "tr"
                ? "Aramanızla eşleşen öge bulunamadı."
                : "No matching items found."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 border-b border-white/5">
          {filteredDownloads.map((group) => (
            <DownloadItemRow
              key={group.id}
              download={group}
              language={language}
              isExpanded={!!expandedGroups[group.id]}
              onToggle={() => toggleGroup(group.id)}
              onPlay={handleOpenGroupDetails}
              onCancel={handlePauseGroup}
              onRetry={handleResumeGroup}
              onDelete={handleDeleteGroup}
              onContextMenu={(x, y, g) => setContextMenu({ x, y, group: g })}
              onPlayEpisode={playDownloadInternal}
              onCancelEpisode={cancelDownload}
              onRetryEpisode={retryDownload}
              onDeleteEpisode={deleteDownload}
              onPrioritizeEpisode={prioritizeDownload}
            />
          ))}
        </div>
      )}

      {contextMenu && (
        <DownloadsContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          group={contextMenu.group}
          downloads={downloads}
          onClose={() => setContextMenu(null)}
          onDelete={deleteDownload}
          onPlay={handleOpenGroupDetails}
          onRetry={retryDownload}
          language={language}
        />
      )}
    </div>
  );
}

// 1. Netflix-style Horizontal Row for Grouped Items
interface DownloadItemRowProps {
  download: GroupedDownloadItem;
  language: string;
  isExpanded: boolean;
  onToggle: () => void;
  onPlay: (group: GroupedDownloadItem) => void;
  onCancel: (group: GroupedDownloadItem) => void;
  onRetry: (group: GroupedDownloadItem) => void;
  onDelete: (group: GroupedDownloadItem) => void;
  onContextMenu: (x: number, y: number, group: GroupedDownloadItem) => void;
  onPlayEpisode: (id: string) => void;
  onCancelEpisode: (id: string) => void;
  onRetryEpisode: (id: string) => void;
  onDeleteEpisode: (id: string) => void;
  onPrioritizeEpisode: (id: string) => void;
}

const DownloadItemRow = memo(function DownloadItemRow({
  download,
  language,
  isExpanded,
  onToggle,
  onPlay,
  onCancel,
  onRetry,
  onDelete,
  onContextMenu,
  onPlayEpisode,
  onCancelEpisode,
  onRetryEpisode,
  onDeleteEpisode,
  onPrioritizeEpisode,
}: DownloadItemRowProps) {
  const isDownloading = download.status === "downloading";
  const isPending = download.status === "pending";
  const isFailed = download.status === "failed";
  const isPaused = download.status === "paused";

  // Parse active and pending episode numbers for detailed stats rendering
  const activeEpisodes = useMemo(() => {
    return download.episodes
      .filter((e) => e.status === "downloading")
      .map((e) => parseSeriesEpisodeInfo(e.name).episode)
      .sort((a, b) => a - b);
  }, [download.episodes]);

  const pendingEpisodes = useMemo(() => {
    return download.episodes
      .filter((e) => e.status === "pending")
      .map((e) => parseSeriesEpisodeInfo(e.name).episode)
      .sort((a, b) => a - b);
  }, [download.episodes]);

  return (
    <div className="flex flex-col border-b border-white/5 py-4">
      {/* Main Row Block */}
      <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => {
          if (download.type === "series") {
            onToggle();
          } else {
            onPlay(download);
          }
        })(); } }} tabIndex={0} role="button"
        className="group flex flex-row items-center gap-4 transition-all duration-300 cursor-pointer"
        onClick={() => {
          if (download.type === "series") {
            onToggle();
          } else {
            onPlay(download);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY, download);
        }}
      >
        {/* Thumbnail area */}
        <div className="relative w-24 md:w-32 aspect-video overflow-hidden rounded-md border border-white/5 bg-white/[0.01] shrink-0 shadow-inner">
          <ImageWithFallback
            src={download.logo}
            name={download.name}
            group={download.group || "MOVIE"}
            itemType={download.type}
            aspect="landscape"
            size="md"
          />
        </div>

        {/* Media info */}
        <div className="flex-1 min-w-0 pr-2">
          <h4
            className="truncate text-xs md:text-sm font-extrabold text-white tracking-wide leading-tight group-hover:text-[var(--accent-color)] transition-colors select-none flex items-center gap-2"
            title={download.name}
          >
            <span>{download.name}</span>
            {download.type === "series" && (
              <span className="text-neutral-500 group-hover:text-white transition-colors">
                {isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </span>
            )}
          </h4>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[10px] font-semibold text-neutral-500 select-none">
            <span className="capitalize">
              {download.type === "movie"
                ? language === "tr"
                  ? "Sinema"
                  : "Movie"
                : language === "tr"
                  ? "Dizi"
                  : "Series"}
            </span>
            {download.group && (
              <>
                <span className="text-white/10 select-none">•</span>
                <span className="truncate max-w-[150px]" title={download.group}>
                  {download.group}
                </span>
              </>
            )}

            {/* Clean metadata details for completed */}
            {download.status === "completed" && (
              <>
                <span className="text-white/10 select-none">•</span>
                <span className="text-neutral-400 font-bold">
                  {download.type === "series"
                    ? `${download.episodes.length} ${language === "tr" ? "Bölüm" : "Episodes"}`
                    : language === "tr"
                      ? "Tamamlandı"
                      : "Completed"}
                </span>
                <span className="text-white/10 select-none">•</span>
                <span>{download.size}</span>
              </>
            )}
          </div>

          {/* High-contrast and spaced layout for active/paused downloads */}
          {isDownloading && (
            <div className="flex flex-wrap items-center gap-2 mt-2 select-none">
              <span className="px-2 py-0.5 rounded bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[9px] font-extrabold uppercase tracking-wider border border-[var(--accent-color)]/20 shadow-sm">
                {language === "tr" ? "İndiriliyor" : "Downloading"}
              </span>
              <span className="text-[10px] font-black text-neutral-300">
                {language === "tr" ? "Bölüm" : "Ep."}{" "}
                {activeEpisodes.join(", ")}
              </span>
              <span className="text-[10px] font-bold text-neutral-400">
                • {download.progress}%
              </span>
              {(download.speed || download.timeLeft) && (
                <span className="text-[10px] font-semibold text-neutral-500">
                  • {download.speed}{" "}
                  {download.timeLeft ? `(${download.timeLeft})` : ""}
                </span>
              )}
            </div>
          )}

          {isPending && (
            <div className="flex flex-wrap items-center gap-2 mt-2 select-none">
              <span className="px-2 py-0.5 rounded bg-white/5 text-neutral-400 text-[9px] font-extrabold uppercase tracking-wider border border-white/5">
                {language === "tr" ? "Sırada" : "Queued"}
              </span>
              <span className="text-[10px] font-black text-neutral-300">
                {language === "tr" ? "Bölüm" : "Ep."}{" "}
                {pendingEpisodes.join(", ")}
              </span>
            </div>
          )}

          {isPaused && (
            <div className="flex flex-wrap items-center gap-2 mt-2 select-none">
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-extrabold uppercase tracking-wider border border-amber-500/20 shadow-sm">
                {language === "tr" ? "Duraklatıldı" : "Paused"}
              </span>
              {download.type === "series" && (
                <span className="text-[10px] font-bold text-neutral-400">
                  • {download.episodes.length}{" "}
                  {language === "tr" ? "Bölüm" : "Episodes"}
                </span>
              )}
            </div>
          )}

          {isFailed && (
            <div className="flex flex-wrap items-center gap-2 mt-2 select-none">
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-extrabold uppercase tracking-wider border border-red-500/20 shadow-sm">
                {language === "tr" ? "Hata" : "Failed"}
              </span>
              {download.type === "series" && (
                <span className="text-[10px] font-bold text-neutral-400">
                  • {download.episodes.length}{" "}
                  {language === "tr" ? "Bölüm" : "Episodes"}
                </span>
              )}
            </div>
          )}

          {/* Thin progress bar under title for active download */}
          {isDownloading && (
            <div className="mt-2.5 max-w-xs h-0.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-color)] transition-all duration-300"
                style={{ width: `${download.progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Action buttons (Netflix-style simple actions) */}
        <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ((e) => e.stopPropagation())(e as any); } }} tabIndex={0} role="button"
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Active download circle, pause and cancel */}
          {isDownloading && (
            <>
              <div className="relative flex items-center justify-center h-8 w-8 shrink-0">
                <svg
                  className="h-full w-full transform -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <circle
                    className="text-white/10"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="transparent"
                    r="13"
                    cx="18"
                    cy="18"
                  />
                  <circle
                    className="text-[var(--accent-color)] transition-all duration-300"
                    strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 13} ${2 * Math.PI * 13}`}
                    style={{
                      strokeDashoffset:
                        2 * Math.PI * 13 -
                        (download.progress / 100) * 2 * Math.PI * 13,
                    }}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="13"
                    cx="18"
                    cy="18"
                  />
                </svg>
                <span className="absolute text-[8px] font-black font-mono text-white/90">
                  {download.progress}
                </span>
              </div>

              {/* Pause button */}
              <button type="button"
                onClick={() => onCancel(download)}
                title={language === "tr" ? "Duraklat" : "Pause"}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all active:scale-95"
               aria-label={language === "tr" ? "Duraklat" : "Pause"}>
                <Pause size={10} fill="currentColor" />
              </button>

              {/* Cancel (Delete) button */}
              <button type="button"
                onClick={() => onDelete(download)}
                title={language === "tr" ? "İptal Et" : "Cancel"}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-500 hover:text-red-400 hover:border-red-500/15 hover:bg-red-500/5 cursor-pointer transition-all active:scale-95"
               aria-label={language === "tr" ? "İptal Et" : "Cancel"}>
                <X size={12} />
              </button>
            </>
          )}

          {/* Queued / Pending cancel */}
          {isPending && (
            <>
              <button type="button"
                onClick={() => onDelete(download)}
                title={language === "tr" ? "İptal Et" : "Cancel"}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-500 hover:text-red-400 hover:border-red-500/15 hover:bg-red-500/5 cursor-pointer transition-all active:scale-95"
               aria-label={language === "tr" ? "İptal Et" : "Cancel"}>
                <X size={12} />
              </button>
            </>
          )}

          {/* Retry on fail / resume on paused */}
          {(isFailed || isPaused) && (
            <>
              <button type="button"
                onClick={() => onRetry(download)}
                title={
                  language === "tr"
                    ? isPaused
                      ? "Devam Et"
                      : "Yeniden Dene"
                    : isPaused
                      ? "Resume"
                      : "Retry"
                }
                className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-500/10 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15 cursor-pointer transition-all active:scale-95"
               aria-label={
                  language === "tr"
                    ? isPaused
                      ? "Devam Et"
                      : "Yeniden Dene"
                    : isPaused
                      ? "Resume"
                      : "Retry"
                }>
                {isPaused ? (
                  <Play size={10} fill="currentColor" className="ml-0.5" />
                ) : (
                  <RefreshCw size={11} />
                )}
              </button>
              <button type="button"
                onClick={() => onDelete(download)}
                title={language === "tr" ? "Sil" : "Delete"}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-500 hover:text-red-400 hover:border-red-500/15 hover:bg-red-500/5 cursor-pointer transition-all active:scale-95"
               aria-label={language === "tr" ? "Sil" : "Delete"}>
                <Trash2 size={12} />
              </button>
            </>
          )}

          {/* Play (Completed) / See Episodes */}
          {download.status === "completed" && (
            <>
              <button type="button"
                onClick={() => onPlay(download)}
                title={
                  download.type === "series"
                    ? language === "tr"
                      ? "Bölümleri Gör"
                      : "See Episodes"
                    : language === "tr"
                      ? "Oynat"
                      : "Play"
                }
                className="flex h-8.5 px-3 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md text-[10px] font-bold gap-1"
               aria-label={
                  download.type === "series"
                    ? language === "tr"
                      ? "Bölümleri Gör"
                      : "See Episodes"
                    : language === "tr"
                      ? "Oynat"
                      : "Play"
                }>
                {download.type === "series" ? (
                  <>
                    <Info size={11} />
                    <span>
                      {language === "tr" ? "Bölümleri Gör" : "See Episodes"}
                    </span>
                  </>
                ) : (
                  <>
                    <Play size={11} fill="currentColor" className="ml-0.5" />
                    <span>{language === "tr" ? "Oynat" : "Play"}</span>
                  </>
                )}
              </button>
              <button type="button"
                onClick={() => onDelete(download)}
                title={language === "tr" ? "Sil" : "Delete"}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-500 hover:text-red-400 hover:border-red-500/15 hover:bg-red-500/5 cursor-pointer transition-all active:scale-95"
               aria-label={language === "tr" ? "Sil" : "Delete"}>
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapsible Episodes List (Indented) */}
      {download.type === "series" && isExpanded && (
        <div className="mt-4 ml-8 pl-4 border-l-2 border-white/5 flex flex-col gap-3.5 animate-slide-down">
          {download.episodes.map((ep) => {
            const epInfo = parseSeriesEpisodeInfo(ep.name);
            return (
              <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ((e) => e.stopPropagation())(e as any); } }} tabIndex={0} role="button"
                key={ep.id}
                className="flex items-center justify-between py-1 group/ep"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Left: Episode Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1 select-none">
                  <span className="text-[10px] font-black text-neutral-500 w-16 uppercase tracking-wider shrink-0">
                    {language === "tr"
                      ? `${epInfo.episode}. Bölüm`
                      : `Ep. ${epInfo.episode}`}
                  </span>
                  <span className="text-xs font-bold text-neutral-300 group-hover/ep:text-white transition-colors truncate">
                    {ep.name}
                  </span>
                </div>

                {/* Right: Status labels and specific actions */}
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  {/* Status labels */}
                  {ep.status === "completed" ? (
                    <span className="text-[10px] font-bold text-neutral-500 select-none">
                      {ep.size}
                    </span>
                  ) : ep.status === "downloading" ? (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded border border-[var(--accent-color)]/20 animate-pulse select-none">
                      {ep.progress}%{" "}
                      {language === "tr" ? "İndiriliyor" : "Downloading"}
                    </span>
                  ) : ep.status === "pending" ? (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-neutral-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 select-none">
                      {language === "tr" ? "Sırada" : "Queued"}
                    </span>
                  ) : ep.status === "paused" ? (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 select-none">
                      {language === "tr" ? "Duraklatıldı" : "Paused"}
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 select-none">
                      {language === "tr" ? "Hata" : "Failed"}
                    </span>
                  )}

                  {/* Actions for single episode */}
                  <div className="flex items-center gap-1.5">
                    {ep.status === "completed" && (
                      <>
                        <button type="button"
                          onClick={() => void onPlayEpisode(ep.id)}
                          title={language === "tr" ? "Oynat" : "Play"}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 cursor-pointer transition-all active:scale-95 shadow-sm"
                         aria-label={language === "tr" ? "Oynat" : "Play"}>
                          <Play
                            size={10}
                            fill="currentColor"
                            className="ml-0.5"
                          />
                        </button>
                        <button type="button"
                          onClick={() => onDeleteEpisode(ep.id)}
                          title={language === "tr" ? "Sil" : "Delete"}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-500 hover:text-red-400 hover:bg-red-500/5 cursor-pointer transition-all active:scale-95"
                         aria-label={language === "tr" ? "Sil" : "Delete"}>
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}

                    {ep.status === "pending" && (
                      <>
                        <button type="button"
                          onClick={() => onPrioritizeEpisode(ep.id)}
                          title={
                            language === "tr"
                              ? "Şimdi İndir (Öncelik Ver)"
                              : "Download Now (Prioritize)"
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/15 cursor-pointer transition-all active:scale-95 shadow-sm"
                         aria-label={
                            language === "tr"
                              ? "Şimdi İndir (Öncelik Ver)"
                              : "Download Now (Prioritize)"
                          }>
                          <Zap size={10} fill="currentColor" />
                        </button>
                        <button type="button"
                          onClick={() => onCancelEpisode(ep.id)}
                          title={language === "tr" ? "İptal Et" : "Cancel"}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-500 hover:text-red-400 hover:bg-red-500/5 cursor-pointer transition-all active:scale-95"
                         aria-label={language === "tr" ? "İptal Et" : "Cancel"}>
                          <X size={11} />
                        </button>
                      </>
                    )}

                    {ep.status === "downloading" && (
                      <>
                        <button type="button"
                          onClick={() => onCancelEpisode(ep.id)}
                          title={language === "tr" ? "Duraklat" : "Pause"}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all active:scale-95"
                         aria-label={language === "tr" ? "Duraklat" : "Pause"}>
                          <Pause size={10} fill="currentColor" />
                        </button>
                        <button type="button"
                          onClick={() => onDeleteEpisode(ep.id)}
                          title={language === "tr" ? "İptal Et" : "Cancel"}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-500 hover:text-red-400 hover:bg-red-500/5 cursor-pointer transition-all active:scale-95"
                         aria-label={language === "tr" ? "İptal Et" : "Cancel"}>
                          <X size={11} />
                        </button>
                      </>
                    )}

                    {(ep.status === "paused" || ep.status === "failed") && (
                      <>
                        <button type="button"
                          onClick={() => onRetryEpisode(ep.id)}
                          title={
                            language === "tr"
                              ? ep.status === "paused"
                                ? "Devam Et"
                                : "Yeniden Dene"
                              : ep.status === "paused"
                                ? "Resume"
                                : "Retry"
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-500/10 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15 cursor-pointer transition-all active:scale-95"
                         aria-label={
                            language === "tr"
                              ? ep.status === "paused"
                                ? "Devam Et"
                                : "Yeniden Dene"
                              : ep.status === "paused"
                                ? "Resume"
                                : "Retry"
                          }>
                          {ep.status === "paused" ? (
                            <Play
                              size={9}
                              fill="currentColor"
                              className="ml-0.5"
                            />
                          ) : (
                            <RefreshCw size={10} />
                          )}
                        </button>
                        <button type="button"
                          onClick={() => onDeleteEpisode(ep.id)}
                          title={language === "tr" ? "Sil" : "Delete"}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-white/[0.01] text-neutral-500 hover:text-red-400 hover:bg-red-500/5 cursor-pointer transition-all active:scale-95"
                         aria-label={language === "tr" ? "Sil" : "Delete"}>
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

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

function DownloadsContextMenu({
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

  // Play/Details
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

  // Sezonu Sil (series only)
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

    // Diziyi tamamen kaldır
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
    // Movie delete
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

  // Resume on paused / retry on fail
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
