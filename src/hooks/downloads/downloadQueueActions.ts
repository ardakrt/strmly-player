import type { DownloadItem, DownloadQueueItem } from "./downloadTypes";

interface QueueActionDependencies {
  getDownloads: () => DownloadItem[];
  getQueue: () => DownloadQueueItem[];
  setQueue: (queue: DownloadQueueItem[]) => void;
  getActiveDownloadId: () => string | null;
  setDownloads: (updater: (downloads: DownloadItem[]) => DownloadItem[]) => void;
  updateQueuePositions: () => void;
  startNextDownload: () => void;
}

export function createDownloadQueueActions(deps: QueueActionDependencies) {
  const removeQueued = (downloadId: string) => {
    deps.setQueue(deps.getQueue().filter((item) => item.id !== downloadId));
  };

  const cancelDownload = (downloadId: string) => {
    removeQueued(downloadId);
    if (deps.getActiveDownloadId() === downloadId) {
      void window.electronAPI?.cancelDownload?.(downloadId);
    }
    deps.setDownloads((current) =>
      current.map((download) =>
        download.id === downloadId
          ? {
              ...download,
              status: "paused",
              speed: "",
              timeLeft: "",
              queuePosition: undefined,
            }
          : download,
      ),
    );
    deps.updateQueuePositions();
    deps.startNextDownload();
  };

  const retryDownload = (downloadId: string) => {
    const download = deps
      .getDownloads()
      .find((item) => item.id === downloadId);
    if (!download) return;

    removeQueued(downloadId);
    deps.setQueue([
      ...deps.getQueue(),
      {
        id: download.id,
        url: download.streamUrl,
        type: download.type,
        name: download.name,
      },
    ]);
    deps.setDownloads((current) =>
      current.map((item) =>
        item.id === downloadId
          ? {
              ...item,
              status: "pending",
              speed: "",
              timeLeft: "",
              error: undefined,
            }
          : item,
      ),
    );
    deps.updateQueuePositions();
    deps.startNextDownload();
  };

  const deleteDownload = (downloadId: string) => {
    const download = deps
      .getDownloads()
      .find((item) => item.id === downloadId);
    if (!download) return;

    if (download.status === "downloading") {
      void window.electronAPI?.cancelDownload?.(downloadId);
    }
    removeQueued(downloadId);
    if (download.filePath) {
      void window.electronAPI?.deleteFile?.(download.filePath);
    }
    deps.setDownloads((current) =>
      current.filter((item) => item.id !== downloadId),
    );
    deps.updateQueuePositions();
  };

  const clearAll = () => {
    deps.getDownloads().forEach((download) => {
      if (download.status === "downloading") {
        void window.electronAPI?.cancelDownload?.(download.id);
      }
      if (download.filePath) {
        void window.electronAPI?.deleteFile?.(download.filePath);
      }
    });
    deps.setQueue([]);
    deps.setDownloads(() => []);
  };

  const playDownload = (downloadId: string) => {
    const download = deps
      .getDownloads()
      .find((item) => item.id === downloadId);
    if (download?.filePath) {
      void window.electronAPI?.playFile?.(download.filePath);
    }
  };

  const prioritizeDownload = (downloadId: string) => {
    const nextQueue = [...deps.getQueue()];
    const index = nextQueue.findIndex((item) => item.id === downloadId);
    if (index === -1) return;

    const [item] = nextQueue.splice(index, 1);
    nextQueue.unshift(item);

    const activeDownloadId = deps.getActiveDownloadId();
    if (activeDownloadId && activeDownloadId !== downloadId) {
      const active = deps
        .getDownloads()
        .find((download) => download.id === activeDownloadId);
      if (active) {
        void window.electronAPI?.cancelDownload?.(activeDownloadId);
        nextQueue.splice(1, 0, {
          id: active.id,
          url: active.streamUrl,
          type: active.type,
          name: active.name,
        });
        deps.setDownloads((current) =>
          current.map((download) =>
            download.id === activeDownloadId
              ? { ...download, status: "pending", speed: "", timeLeft: "" }
              : download,
          ),
        );
      }
    }

    deps.setQueue(nextQueue);
    deps.updateQueuePositions();
    deps.startNextDownload();
  };

  const resumeAll = () => {
    const nextQueue = [...deps.getQueue()];
    const toResume = deps
      .getDownloads()
      .filter(
        (download) =>
          download.status === "paused" || download.status === "failed",
      );
    toResume.forEach((download) => {
      if (!nextQueue.some((queued) => queued.id === download.id)) {
        nextQueue.push({
          id: download.id,
          url: download.streamUrl,
          type: download.type,
          name: download.name,
        });
      }
    });
    deps.setQueue(nextQueue);
    deps.setDownloads((current) =>
      current.map((download) =>
        download.status === "paused" || download.status === "failed"
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
    deps.updateQueuePositions();
    deps.startNextDownload();
  };

  return {
    cancelDownload,
    retryDownload,
    deleteDownload,
    clearAll,
    playDownload,
    prioritizeDownload,
    resumeAll,
  };
}
