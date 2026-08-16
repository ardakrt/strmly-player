import type { DownloadItem } from './downloadTypes';

export async function syncDownloadsWithDisk(
  downloads: DownloadItem[],
): Promise<{ changed: boolean; downloads: DownloadItem[] }> {
  const getSavedMediaInfo = window.electronAPI?.getSavedMediaInfo;
  if (!getSavedMediaInfo) return { changed: false, downloads };
  let changed = false;
  const updated = await Promise.all(downloads.map(async download => {
    try {
      const info = await getSavedMediaInfo({
        downloadId: download.id,
        type: download.type,
        name: download.name,
        streamUrl: download.streamUrl,
      });
      if (info?.exists && info.filePath && download.status !== 'completed') {
        changed = true;
        return {
          ...download,
          status: 'completed' as const,
          progress: 100,
          speed: '',
          timeLeft: '',
          size: info.size || download.size,
          filePath: info.filePath,
          playUrl: info.playUrl || download.playUrl,
          completedAt: download.completedAt || Date.now(),
        };
      }
      if (!info?.exists && download.status === 'completed') {
        changed = true;
        return {
          ...download,
          status: 'paused' as const,
          progress: 0,
          filePath: '',
          playUrl: undefined,
          size: '',
        };
      }
    } catch (error) {
      console.warn('Sync lookup failed for item:', download.name, error);
    }
    return download;
  }));
  return { changed, downloads: updated };
}
