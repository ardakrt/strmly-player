export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'paused';

export interface DownloadItem {
  id: string;
  name: string;
  group: string;
  type: 'movie' | 'series';
  streamUrl: string;
  logo?: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  timeLeft: string;
  size: string;
  filePath: string;
  playUrl?: string;
  error?: string;
  addedAt: number;
  completedAt?: number;
  queuePosition?: number;
  retryCount?: number;
}

export interface DownloadQueueItem {
  id: string;
  url: string;
  type: 'movie' | 'series';
  name: string;
}

export interface DownloadPersistAdapter {
  save: (key: string, value: unknown) => void;
  load: (key: string, isJson?: boolean) => Promise<unknown>;
}
