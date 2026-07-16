import { useState, useMemo, useCallback, memo } from "react";
import {
  Search,
  Trash2,
  Play,
  HardDrive,
  RefreshCw,
  X,
  FolderOpen,
  Info,
  Pause,
  Film,
  Clapperboard,
  Download,
  ArrowUpDown,
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { useDownloads } from "../hooks/useDownloads";
import type { AppProviderValue } from "../hooks/useAppProvider";
import type { DownloadItem, DownloadStatus } from "../hooks/useDownloads";
import { ImageWithFallback } from "./ImageWithFallback";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { parseSeriesEpisodeInfo } from "../utils/seriesGroupers";

interface DownloadsViewProps {
  app: AppProviderValue;
}

export interface GroupedDownloadItem {
  id: string;
  name: string;
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

    // Prefer any episode that actually has artwork (playlist logos are often empty)
    const logoFromEpisodes =
      groupItems.find((i) => i.logo && String(i.logo).trim())?.logo ||
      firstItem.logo;

    result.push({
      id: key,
      name: groupName,
      group: firstItem.group || "Diziler",
      type: "series",
      logo: logoFromEpisodes,
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

/** Prefer catalog series artwork when the download entry has no logo. */
function resolveGroupArtwork(
  group: GroupedDownloadItem,
  catalogSeries?: { name: string; logo?: string }[] | null,
): string | undefined {
  if (group.logo && String(group.logo).trim()) return group.logo;
  if (group.type !== "series" || !catalogSeries?.length) return group.logo;

  const titleKey = (
    group.seriesTitle ||
    parseSeriesEpisodeInfo(group.name).cleanTitle ||
    group.name
  ).toLowerCase();

  const match = catalogSeries.find((s) => {
    const sTitle = (parseSeriesEpisodeInfo(s.name).cleanTitle || s.name).toLowerCase();
    return sTitle === titleKey && s.logo && String(s.logo).trim();
  });
  return match?.logo || group.logo;
}

function isActiveStatus(status: DownloadStatus): boolean {
  return (
    status === "downloading" ||
    status === "pending" ||
    status === "paused" ||
    status === "failed"
  );
}

function statusLabel(status: DownloadStatus, language: string): string | null {
  if (status === "downloading")
    return language === "tr" ? "Kaydediliyor" : "Saving";
  if (status === "pending")
    return language === "tr" ? "Sırada" : "Queued";
  if (status === "paused")
    return language === "tr" ? "Duraklatıldı" : "Paused";
  if (status === "failed") return language === "tr" ? "Hata" : "Failed";
  return null;
}

function statusTone(status: DownloadStatus): string {
  if (status === "downloading") return "text-emerald-400";
  if (status === "pending") return "text-white/45";
  if (status === "paused") return "text-amber-400";
  if (status === "failed") return "text-red-400";
  return "text-white/40";
}

function statusDotClass(status: DownloadStatus): string {
  if (status === "downloading") return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]";
  if (status === "pending") return "bg-white/35";
  if (status === "paused") return "bg-amber-400";
  if (status === "failed") return "bg-red-400";
  return "bg-transparent";
}

export function DownloadsView({ app }: DownloadsViewProps) {
  const { language, t } = useSettings();

  const {
    downloads,
    cancelDownload,
    retryDownload,
    deleteDownload,
    playDownload,
    pauseAll,
    resumeAll,
  } = useDownloads();

  const playDownloadInternal = useCallback(
    async (downloadId: string) => {
      const item = downloads.find((d) => d.id === downloadId);
      if (!item) return;

      let playUrl = item.playUrl;
      if (
        !playUrl &&
        item.status === "completed" &&
        window.electronAPI?.getSavedMediaInfo
      ) {
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
          // fall through
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
  const [sortBy, setSortBy] = useState<"recent" | "name" | "size">("recent");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    group: GroupedDownloadItem;
  } | null>(null);

  const totalSizeMB = useMemo(() => {
    return downloads
      .filter((download) => download.status === "completed")
      .reduce((acc, download) => acc + parseSizeToMB(download.size), 0);
  }, [downloads]);

  const formattedTotalSize = useMemo(
    () => formatTotalSize(totalSizeMB),
    [totalSizeMB],
  );

  const filteredDownloads = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLocaleLowerCase(language === "tr" ? "tr-TR" : undefined);

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
        return true;
      })
      .filter((d) => {
        if (!normalizedQuery) return true;
        const haystack = `${d.name} ${d.group}`.toLocaleLowerCase(
          language === "tr" ? "tr-TR" : undefined,
        );
        return haystack.includes(normalizedQuery);
      });

    const grouped = groupDownloadsHelper(filteredRaw);

    return grouped.sort((a, b) => {
      const aActive = isActiveStatus(a.status);
      const bActive = isActiveStatus(b.status);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      if (sortBy === "name") {
        return a.name.localeCompare(b.name, language === "tr" ? "tr-TR" : undefined);
      }
      if (sortBy === "size") {
        return parseSizeToMB(b.size) - parseSizeToMB(a.size);
      }

      const aTime = a.completedAt || a.addedAt;
      const bTime = b.completedAt || b.addedAt;
      return bTime - aTime;
    });
  }, [downloads, language, query, categoryFilter, sortBy]);

  const activeGroups = useMemo(
    () => filteredDownloads.filter((g) => isActiveStatus(g.status)),
    [filteredDownloads],
  );

  const libraryGroups = useMemo(
    () => filteredDownloads.filter((g) => g.status === "completed"),
    [filteredDownloads],
  );

  const activeDownloadCards = useMemo(
    () => activeGroups.map((group) => ({
      ...group,
      logo: resolveGroupArtwork(group, app.catalog.allGroupedSeries),
    })),
    [activeGroups, app.catalog.allGroupedSeries],
  );

  const libraryDownloadCards = useMemo(
    () => libraryGroups.map((group) => ({
      ...group,
      logo: resolveGroupArtwork(group, app.catalog.allGroupedSeries),
    })),
    [libraryGroups, app.catalog.allGroupedSeries],
  );

  const handleOpenGroupDetails = (group: GroupedDownloadItem) => {
    // Series → full SeriesModal (all seasons/episodes from playlist, not only saved)
    if (group.type === "series") {
      const cleanTitle =
        group.seriesTitle ||
        parseSeriesEpisodeInfo(group.name).cleanTitle ||
        group.name;
      const titleKey = cleanTitle.toLowerCase();

      const preferEp =
        group.episodes.find((ep) => {
          const p = parseSeriesEpisodeInfo(ep.name);
          return (
            group.seasonNumber != null &&
            group.seasonNumber > 0 &&
            p.season === group.seasonNumber
          );
        }) || group.episodes[0];

      const flatItem = {
        id: preferEp.id,
        name: preferEp.name,
        group: preferEp.group || group.group || "",
        type: "series" as const,
        url: preferEp.streamUrl,
        logo: preferEp.logo || group.logo || "",
      };

      const match = app.catalog.allGroupedSeries?.find((s) => {
        const sTitle = parseSeriesEpisodeInfo(s.name).cleanTitle || s.name;
        return sTitle.toLowerCase() === titleKey;
      });

      if (match) {
        void app.catalog.handleOpenSeriesModalDirect(match, flatItem);
        return;
      }

      // Rebuild full series from live playlist siblings
      void app.catalog.handleOpenDetails(flatItem);
      return;
    }

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
      void app.catalog.handleOpenDetails(match);
    } else {
      void app.catalog.handleOpenDetails({
        id: group.id,
        name: group.name,
        group: group.group,
        type: "movie",
        url: group.episodes[0].streamUrl,
        logo: group.logo || "",
      });
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

  const libraryStats = useMemo(() => {
    const all = groupDownloadsHelper(downloads);
    const series = all.filter((g) => g.type === "series").length;
    const movies = all.filter((g) => g.type === "movie").length;
    const activeCount = downloads.filter((d) =>
      isActiveStatus(d.status),
    ).length;
    return { series, movies, total: all.length, activeCount };
  }, [downloads]);

  const hasActiveDownloads = downloads.some(
    (d) => d.status === "downloading" || d.status === "pending",
  );
  const hasPausedOrFailed = downloads.some(
    (d) => d.status === "paused" || d.status === "failed",
  );

  const filterPills = useMemo(
    () =>
      [
        {
          id: "all" as const,
          label: language === "tr" ? "Tümü" : "All",
          count: libraryStats.total,
        },
        {
          id: "active" as const,
          label: language === "tr" ? "Aktif" : "Active",
          count: libraryStats.activeCount,
        },
        {
          id: "movie" as const,
          label: language === "tr" ? "Filmler" : "Movies",
          count: libraryStats.movies,
        },
        {
          id: "series" as const,
          label: language === "tr" ? "Diziler" : "Series",
          count: libraryStats.series,
        },
      ] as const,
    [language, libraryStats],
  );

  const emptyTitle =
    downloads.length === 0
      ? t("downloads.empty")
      : language === "tr"
        ? "Sonuç bulunamadı"
        : "No matches";

  const emptyDesc =
    downloads.length === 0
      ? t("downloads.emptyDesc")
      : language === "tr"
        ? "Farklı bir arama veya filtre dene."
        : "Try a different search or filter.";

  const activeFilter = filterPills.find((pill) => pill.id === categoryFilter);
  const completedMovieSizeMB = downloads
    .filter((download) => download.status === "completed" && download.type === "movie")
    .reduce((total, download) => total + parseSizeToMB(download.size), 0);
  const movieStoragePercent = totalSizeMB > 0
    ? Math.min(100, (completedMovieSizeMB / totalSizeMB) * 100)
    : 0;

  return (
    <div className="series-catalog-shell grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden animate-fade-in md:grid-cols-[218px_minmax(0,1fr)] md:grid-rows-1 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-3">
      <aside className="series-catalog-panel series-category-panel flex min-h-0 max-h-[38vh] flex-col overflow-y-auto rounded-2xl border border-white/[0.06] p-3 select-none hide-scrollbar md:max-h-none">
        <div className="border-b border-white/[0.05] px-1 pb-3">
          <div className="mb-2 inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/28">
            <HardDrive size={11} />
            {language === "tr" ? "Kütüphane" : "Library"}
          </div>
          <h1 className="text-[20px] font-bold tracking-[-0.03em] text-white/92">
            {t("downloads.title")}
          </h1>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/32">
            {language === "tr" ? "Çevrimdışı izleme alanın." : "Your offline viewing library."}
          </p>
        </div>

        <nav className="mt-3 flex flex-col gap-0.5" aria-label={language === "tr" ? "Kaydedilen filtreleri" : "Saved filters"}>
          {filterPills.map((pill) => {
            const active = categoryFilter === pill.id;
            const PillIcon = pill.id === "movie"
              ? Film
              : pill.id === "series"
                ? Clapperboard
                : pill.id === "active"
                  ? Download
                  : HardDrive;
            return (
              <button
                type="button"
                key={pill.id}
                onClick={() => setCategoryFilter(pill.id)}
                className={`series-category-item ${active ? "is-active" : ""} flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[11.5px] font-medium transition-colors focusable-item cursor-pointer ${
                  active
                    ? "border-white/[0.07] text-white"
                    : "border-transparent text-white/52 hover:bg-white/[0.035] hover:text-white/82"
                }`}
                aria-current={active ? "true" : undefined}
              >
                <PillIcon size={13} className={active ? "text-white/70" : "text-white/28"} />
                <span className="min-w-0 flex-1 truncate">{pill.label}</span>
                <span className="min-w-[1.3rem] rounded-md bg-white/[0.05] px-1.5 py-0.5 text-center text-[9px] font-bold tabular-nums text-white/38">
                  {pill.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/25">
                {language === "tr" ? "Kullanılan alan" : "Storage used"}
              </p>
              <p className="mt-1 text-[16px] font-semibold tracking-tight text-white/82">{formattedTotalSize}</p>
            </div>
            <HardDrive size={15} className="text-white/25" />
          </div>
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            {totalSizeMB > 0 && (
              <>
                <span className="h-full bg-white/75" style={{ width: `${movieStoragePercent}%` }} />
                <span className="h-full flex-1 bg-white/22" />
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[9.5px] font-medium text-white/32">
            <span>{libraryStats.movies} {language === "tr" ? "film" : "movies"}</span>
            <span>{libraryStats.series} {language === "tr" ? "dizi" : "series"}</span>
          </div>
        </div>

        <div className="mt-auto space-y-2 pt-4">
          {hasActiveDownloads ? (
            <button type="button" onClick={pauseAll} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] text-[10.5px] font-semibold text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white cursor-pointer focusable-item">
              <Pause size={12} fill="currentColor" />
              {language === "tr" ? "Tümünü duraklat" : "Pause all"}
            </button>
          ) : hasPausedOrFailed ? (
            <button type="button" onClick={resumeAll} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white text-[10.5px] font-semibold text-black transition-opacity hover:opacity-90 cursor-pointer focusable-item">
              <Play size={11} fill="currentColor" />
              {language === "tr" ? "Tümünü başlat" : "Resume all"}
            </button>
          ) : null}
          <button type="button" onClick={() => void window.electronAPI?.openDownloadsFolder?.()} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] text-[10.5px] font-semibold text-white/48 transition-colors hover:bg-white/[0.07] hover:text-white cursor-pointer focusable-item">
            <FolderOpen size={13} />
            {language === "tr" ? "Klasörü aç" : "Open folder"}
          </button>
        </div>
      </aside>

      <section className="series-catalog-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.07]">
        <header className="flex min-h-[76px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5 lg:px-6">
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
              {language === "tr" ? "Kaydedilenler" : "Saved"}
            </p>
            <div className="flex items-center gap-2.5">
              <h2 className="truncate text-[18px] font-bold tracking-[-0.02em] text-white/92 lg:text-[20px]">
                {activeFilter?.label}
              </h2>
              {libraryStats.activeCount > 0 && categoryFilter !== "movie" && categoryFilter !== "series" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.08] px-2 py-0.5 text-[9px] font-semibold text-emerald-300/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {libraryStats.activeCount} {language === "tr" ? "aktif" : "active"}
                </span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="relative w-[190px] lg:w-[230px]">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/28" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === "tr" ? "Kaydedilenlerde ara…" : "Search saved…"} className="h-9 w-full rounded-xl border border-white/[0.07] bg-black/15 pl-9 pr-8 text-[11px] font-medium text-white outline-none placeholder:text-white/25 focus:border-white/14 focus:bg-white/[0.035]" />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-white/30 hover:bg-white/[0.07] hover:text-white cursor-pointer" aria-label={language === "tr" ? "Aramayı temizle" : "Clear search"}>
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="relative">
              <ArrowUpDown size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "recent" | "name" | "size")} className="h-9 appearance-none rounded-xl border border-white/[0.07] bg-[#101012] pl-8 pr-7 text-[10.5px] font-semibold text-white/52 outline-none transition-colors hover:bg-white/[0.05] focus:border-white/14 cursor-pointer" aria-label={language === "tr" ? "Sıralama" : "Sort"}>
                <option value="recent">{language === "tr" ? "Son eklenen" : "Most recent"}</option>
                <option value="name">{language === "tr" ? "Ada göre" : "Name"}</option>
                <option value="size">{language === "tr" ? "Boyuta göre" : "Size"}</option>
              </select>
            </div>
            <span className="hidden shrink-0 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38 sm:inline-flex">
              {filteredDownloads.length}
            </span>
          </div>
        </header>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4 lg:px-5 lg:pt-5">
          {filteredDownloads.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-20 text-center select-none">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                <Download size={24} />
              </div>
              <p className="text-sm font-semibold text-white/58">{emptyTitle}</p>
              <p className="mt-2 max-w-sm text-[11.5px] leading-relaxed text-white/30">{emptyDesc}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
          {/* ── Active queue ── */}
          {activeGroups.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/45">
                    {language === "tr" ? "Devam eden" : "In progress"}
                  </h2>
                  <span className="h-px w-10 bg-gradient-to-r from-white/20 to-transparent" />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-white/30">
                  {activeGroups.length}
                </span>
              </div>

              <div className="grid gap-3 2xl:grid-cols-2">
                {activeDownloadCards.map((group) => (
                  <ActiveDownloadPanel
                    key={group.id}
                    download={group}
                    language={language}
                    onPlay={handleOpenGroupDetails}
                    onCancel={handlePauseGroup}
                    onRetry={handleResumeGroup}
                    onDelete={handleDeleteGroup}
                    onContextMenu={(x, y, g) =>
                      setContextMenu({ x, y, group: g })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Library grid ── */}
          {libraryGroups.length > 0 && (
            <section className="flex flex-col gap-4">
              {activeGroups.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/45">
                      {language === "tr" ? "Hazır" : "Ready"}
                    </h2>
                    <span className="h-px w-10 bg-gradient-to-r from-white/20 to-transparent" />
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-white/30">
                    {libraryGroups.length}
                  </span>
                </div>
              )}

              <div className="grid justify-start gap-x-4 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(148px,178px))]">
                {libraryDownloadCards.map((group) => (
                  <LibraryPosterCard
                    key={group.id}
                    download={group}
                    language={language}
                    onActivate={() => handleOpenGroupDetails(group)}
                    onDelete={() => handleDeleteGroup(group)}
                    onContextMenu={(x, y) =>
                      setContextMenu({ x, y, group })
                    }
                  />
                ))}
              </div>
            </section>
          )}
            </div>
          )}
        </div>
      </section>

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

/* ═══════════════════════════════════════════════════════════════
   Active download panel — compact dock (macOS / Apple TV style)
   Contained width, poster + stacked meta + progress, no empty ocean
   ═══════════════════════════════════════════════════════════════ */

interface ActiveDownloadPanelProps {
  download: GroupedDownloadItem;
  language: string;
  onPlay: (group: GroupedDownloadItem) => void;
  onCancel: (group: GroupedDownloadItem) => void;
  onRetry: (group: GroupedDownloadItem) => void;
  onDelete: (group: GroupedDownloadItem) => void;
  onContextMenu: (x: number, y: number, group: GroupedDownloadItem) => void;
}

const ActiveDownloadPanel = memo(function ActiveDownloadPanel({
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
            aspect="portrait"
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

const LibraryPosterCard = memo(function LibraryPosterCard({
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
      <button
        type="button"
        onClick={onActivate}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-[18px] bg-neutral-900 text-left cursor-pointer outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white/30 ring-1 ring-white/[0.07] shadow-[0_12px_32px_rgba(0,0,0,0.32)] hover:ring-white/20 hover:scale-[1.03] hover:shadow-[0_18px_44px_rgba(0,0,0,0.45)]"
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
          aspect="portrait"
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
