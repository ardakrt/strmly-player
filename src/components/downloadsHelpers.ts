import type { DownloadItem, DownloadStatus } from "../hooks/useDownloads";
import { parseSeriesEpisodeInfo } from "../utils/seriesGroupers";

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

export function parseSizeToMB(sizeStr?: string): number {
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

export function formatTotalSize(totalMB: number): string {
  if (totalMB === 0) return "0 MB";
  if (totalMB < 1024) return `${totalMB.toFixed(1)} MB`;
  const gb = totalMB / 1024;
  if (gb < 1024) return `${gb.toFixed(2)} GB`;
  const tb = gb / 1024;
  return `${tb.toFixed(2)} TB`;
}

export const groupDownloadsHelper = (rawItems: DownloadItem[]): GroupedDownloadItem[] => {
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
export function resolveGroupArtwork(
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

export function isActiveStatus(status: DownloadStatus): boolean {
  return (
    status === "downloading" ||
    status === "pending" ||
    status === "paused" ||
    status === "failed"
  );
}

export function statusLabel(status: DownloadStatus, language: string): string | null {
  if (status === "downloading")
    return language === "tr" ? "Kaydediliyor" : "Saving";
  if (status === "pending")
    return language === "tr" ? "Sırada" : "Queued";
  if (status === "paused")
    return language === "tr" ? "Duraklatıldı" : "Paused";
  if (status === "failed") return language === "tr" ? "Hata" : "Failed";
  return null;
}

export function statusTone(status: DownloadStatus): string {
  if (status === "downloading") return "text-emerald-400";
  if (status === "pending") return "text-white/45";
  if (status === "paused") return "text-amber-400";
  if (status === "failed") return "text-red-400";
  return "text-white/40";
}

export function statusDotClass(status: DownloadStatus): string {
  if (status === "downloading") return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]";
  if (status === "pending") return "bg-white/35";
  if (status === "paused") return "bg-amber-400";
  if (status === "failed") return "bg-red-400";
  return "bg-transparent";
}
