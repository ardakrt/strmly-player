import type { DownloadItem, DownloadPersistAdapter } from './downloadTypes';

export const DOWNLOADS_SETTING_KEY = 'strmly_downloads';
export const LEGACY_LOCAL_STORAGE_KEY = 'strmly_downloads:v1';

const statusScore: Record<DownloadItem['status'], number> = {
  completed: 5,
  downloading: 4,
  pending: 3,
  paused: 2,
  failed: 1,
};

export function sanitizeLoadedDownloads(parsed: unknown): DownloadItem[] {
  if (!Array.isArray(parsed)) return [];
  const groups = new Map<string, DownloadItem[]>();
  for (const item of parsed as DownloadItem[]) {
    if (!item?.streamUrl) continue;
    const group = groups.get(item.streamUrl) || [];
    group.push(item);
    groups.set(item.streamUrl, group);
  }
  return [...groups.values()].map(items => {
    const best = { ...items.sort((a, b) => statusScore[b.status] - statusScore[a.status])[0] };
    if (best.status === 'downloading' || best.status === 'pending') {
      best.status = 'paused';
      best.queuePosition = undefined;
    }
    return best;
  });
}

export async function loadPersistedDownloads(adapter: DownloadPersistAdapter) {
  let stored = await adapter.load(DOWNLOADS_SETTING_KEY, true);
  if (!stored || (Array.isArray(stored) && stored.length === 0)) {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
          stored = legacyParsed;
          adapter.save(DOWNLOADS_SETTING_KEY, legacyParsed);
          localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
        }
      }
    } catch {
      // Ignore malformed legacy data.
    }
  }
  return sanitizeLoadedDownloads(stored);
}

export function persistDownloads(
  downloads: DownloadItem[],
  adapter: DownloadPersistAdapter | null,
) {
  if (adapter) {
    adapter.save(DOWNLOADS_SETTING_KEY, downloads);
    return;
  }
  try {
    localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(downloads));
  } catch (error) {
    console.error('Failed to save downloads:', error);
  }
}
