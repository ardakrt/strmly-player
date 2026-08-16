import type { DownloadItem } from "./downloadTypes";

type SetDownloads = (
  updater: (downloads: DownloadItem[]) => DownloadItem[],
  options?: { forceSave?: boolean; throttleUi?: boolean },
) => void;

let listenersReady = false;
const printedDownloaders = new Set<string>();

export function ensureDownloadIpcListeners(setDownloads: SetDownloads) {
  if (listenersReady) return;
  listenersReady = true;

  window.electronAPI?.onDownloadProgress?.((data) => {
    if (data.downloader && !printedDownloaders.has(data.downloadId)) {
      printedDownloaders.add(data.downloadId);
      console.log(
        `%c[Strmly Downloader]%c Starting download %c${data.downloadId}%c via %c${
          data.downloader === "segmented"
            ? "🚀 MULTI-CONNECTION HLS SEGMENTED DOWNLOADER"
            : "📼 STANDARD FFmpeg SINGLE-THREAD DOWNLOADER"
        }`,
        "color: #ffffff; background: #3b82f6; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
        "color: #94a3b8; font-weight: normal;",
        "color: #60a5fa; font-weight: bold;",
        "color: #94a3b8; font-weight: normal;",
        data.downloader === "segmented"
          ? "color: #34d399; font-weight: bold;"
          : "color: #f59e0b; font-weight: bold;",
      );
    }

    const isError = data.error === "DISK_FULL";
    setDownloads(
      (downloads) =>
        downloads.map((download) => {
          if (download.id === data.downloadId) {
            if (isError) {
              window.dispatchEvent(
                new CustomEvent("show-toast", {
                  detail: {
                    message: "Disk alanı yetersiz! İndirme durduruldu. / Disk space is full!",
                  },
                }),
              );
              return {
                ...download,
                status: "failed",
                error: "Disk alanı yetersiz! / Disk space is full!",
                speed: "",
                timeLeft: "",
              };
            }
            if (download.status === "paused") {
              return download;
            }
            return {
              ...download,
              progress: data.progress,
              speed: data.speed,
              timeLeft: data.timeLeft,
              size: data.size,
              status: "downloading",
            };
          }
          return download;
        }),
      isError ? { forceSave: true } : { throttleUi: true },
    );
  });

  window.electronAPI?.onDownloadComplete?.((data) => {
    setDownloads(
      (downloads) =>
        downloads.map((download) =>
          download.id === data.downloadId
            ? {
                ...download,
                status: "completed",
                progress: 100,
                speed: "",
                timeLeft: "",
                filePath: data.filePath,
                playUrl: data.playUrl || download.playUrl,
                completedAt: Date.now(),
                queuePosition: undefined,
                retryCount: 0,
                error: undefined,
              }
            : download,
        ),
      { forceSave: true },
    );
  });
}
