import type { PlaylistItem } from "../../utils/m3uParser";
import type { DownloadItem, DownloadQueueItem } from "./downloadTypes";

type SetDownloads = (
  updater: (downloads: DownloadItem[]) => DownloadItem[],
) => void;

interface DownloadAddDependencies {
  getDownloads: () => DownloadItem[];
  removeQueued: (downloadId: string) => void;
  enqueue: (item: DownloadQueueItem) => void;
  setDownloads: SetDownloads;
  updateQueuePositions: () => void;
  startNextDownload: () => void;
}

function classifyDownload(item: PlaylistItem): "series" | "movie" {
  const isSeriesItem =
    item.type === "series" ||
    /s\d{1,2}e\d{1,3}|\d{1,2}\.?\s*sezon/i.test(item.name) ||
    /(dizi|series)/i.test(item.group || "");
  return isSeriesItem ? "series" : "movie";
}

export async function addDownloadItem(
  item: PlaylistItem,
  dependencies: DownloadAddDependencies,
) {
  const {
    getDownloads,
    removeQueued,
    enqueue,
    setDownloads,
    updateQueuePositions,
    startNextDownload,
  } = dependencies;
  const type = classifyDownload(item);
  const existing = getDownloads().find(
    (download) => download.streamUrl === item.url,
  );

  if (existing) {
    if (
      existing.status === "pending" ||
      existing.status === "downloading" ||
      existing.status === "completed"
    ) {
      return existing.id;
    }
    if (existing.status === "paused" || existing.status === "failed") {
      removeQueued(existing.id);
      enqueue({
        id: existing.id,
        url: existing.streamUrl,
        type: existing.type,
        name: existing.name,
      });
      setDownloads((current) =>
        current.map((download) =>
          download.id === existing.id
            ? {
                ...download,
                status: "pending",
                speed: "",
                timeLeft: "",
                error: undefined,
              }
            : download,
        ),
      );
      updateQueuePositions();
      startNextDownload();
      return existing.id;
    }
  }

  const id = `download-${item.id}-${Date.now()}`;

  try {
    if (window.electronAPI?.getSavedMediaInfo) {
      const savedMedia = await window.electronAPI.getSavedMediaInfo({
        downloadId: id,
        type,
        name: item.name,
        streamUrl: item.url,
      });

      if (savedMedia?.exists && savedMedia.filePath) {
        const completedDownload: DownloadItem = {
          id,
          name: item.name,
          group: item.group,
          type,
          streamUrl: item.url,
          logo: item.logo,
          status: "completed",
          progress: 100,
          speed: "",
          timeLeft: "",
          size: savedMedia.size || "",
          filePath: savedMedia.filePath,
          playUrl: savedMedia.playUrl,
          addedAt: Date.now(),
          completedAt: Date.now(),
        };
        setDownloads((current) => [
          completedDownload,
          ...current.filter((download) => download.streamUrl !== item.url),
        ]);
        return id;
      }

      setDownloads((current) =>
        current.filter(
          (download) =>
            !(
              download.streamUrl === item.url &&
              download.status === "completed"
            ),
        ),
      );
    }
  } catch (error) {
    console.warn("Saved media lookup failed, continuing with save:", error);
  }

  const newDownload: DownloadItem = {
    id,
    name: item.name,
    group: item.group,
    type,
    streamUrl: item.url,
    logo: item.logo,
    status: "pending",
    progress: 0,
    speed: "",
    timeLeft: "",
    size: "",
    filePath: "",
    addedAt: Date.now(),
  };

  enqueue({ id, url: item.url, type, name: item.name });
  setDownloads((current) => [newDownload, ...current]);
  updateQueuePositions();
  startNextDownload();

  return id;
}
