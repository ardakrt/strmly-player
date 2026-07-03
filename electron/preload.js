const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  playExternal: (url, playerType) => ipcRenderer.invoke('play-external', { url, playerType }),
  saveConfig: (key, value) => ipcRenderer.invoke('save-config', { key, value }),
  saveConfigSync: (key, value) => ipcRenderer.sendSync('save-config-sync', { key, value }),
  saveConfigBatchSync: (entries) => ipcRenderer.sendSync('save-config-batch-sync', entries),
  loadConfig: (key) => ipcRenderer.invoke('load-config', { key }),
  savePlaylistItems: (id, items) => ipcRenderer.invoke('save-playlist-items', { id, items }),
  loadPlaylistItems: (id) => ipcRenderer.invoke('load-playlist-items', { id }),
  deletePlaylistItems: (id) => ipcRenderer.invoke('delete-playlist-items', { id }),
  fetchTmdb: (path) => ipcRenderer.invoke('fetch-tmdb', { path }),
  fetchTmdbImage: (path, size) => ipcRenderer.invoke('fetch-tmdb-image', { path, size }),
  startFfmpegProxy: (url, startTime, audioStreamId, transcodeMode) => ipcRenderer.invoke('start-ffmpeg-proxy', { url, startTime, audioStreamId, transcodeMode }),
  stopFfmpegProxy: () => ipcRenderer.invoke('stop-ffmpeg-proxy'),
  checkFfmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  probeAudioCodec: (url) => ipcRenderer.invoke('probe-audio-codec', { url }),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update-status', subscription);
    return () => ipcRenderer.off('update-status', subscription);
  },
  onUpdateProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update-progress', subscription);
    return () => ipcRenderer.off('update-progress', subscription);
  },
  downloadStream: (params) => ipcRenderer.invoke('download-stream', params),
  getSavedMediaInfo: (params) => ipcRenderer.invoke('get-saved-media-info', params),
  cancelDownload: (downloadId) => ipcRenderer.invoke('cancel-download', { downloadId }),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', { filePath }),
  playFile: (filePath) => ipcRenderer.invoke('play-file', { filePath }),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  selectDownloadsFolder: () => ipcRenderer.invoke('select-downloads-folder'),
  setDownloadsFolder: (params) => ipcRenderer.invoke('set-downloads-folder', params),
  getDownloadsFolder: () => ipcRenderer.invoke('get-downloads-folder'),
  onDownloadProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download-progress', subscription);
    return () => ipcRenderer.off('download-progress', subscription);
  },
  onDownloadComplete: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download-complete', subscription);
    return () => ipcRenderer.off('download-complete', subscription);
  },
  onMoveDownloadsProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('move-downloads-progress', subscription);
    return () => ipcRenderer.off('move-downloads-progress', subscription);
  },
  onNavigateBack: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('navigate-back', subscription);
    return () => ipcRenderer.off('navigate-back', subscription);
  },
  onNavigateForward: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('navigate-forward', subscription);
    return () => ipcRenderer.off('navigate-forward', subscription);
  }
});
