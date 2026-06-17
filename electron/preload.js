const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  playExternal: (url, playerType) => ipcRenderer.invoke('play-external', { url, playerType }),
  saveConfig: (key, value) => ipcRenderer.invoke('save-config', { key, value }),
  saveConfigSync: (key, value) => ipcRenderer.sendSync('save-config-sync', { key, value }),
  loadConfig: (key) => ipcRenderer.invoke('load-config', { key }),
  savePlaylistItems: (id, items) => ipcRenderer.invoke('save-playlist-items', { id, items }),
  loadPlaylistItems: (id) => ipcRenderer.invoke('load-playlist-items', { id }),
  deletePlaylistItems: (id) => ipcRenderer.invoke('delete-playlist-items', { id }),
  fetchTmdb: (path) => ipcRenderer.invoke('fetch-tmdb', { path }),
  fetchTmdbImage: (path, size) => ipcRenderer.invoke('fetch-tmdb-image', { path, size }),
  startFfmpegProxy: (url, startTime, audioStreamId) => ipcRenderer.invoke('start-ffmpeg-proxy', { url, startTime, audioStreamId }),
  stopFfmpegProxy: () => ipcRenderer.invoke('stop-ffmpeg-proxy'),
  checkFfmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  probeAudioCodec: (url) => ipcRenderer.invoke('probe-audio-codec', { url }),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update-status', subscription);
    return () => ipcRenderer.off('update-status', subscription);
  },
  onUpdateProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update-progress', subscription);
    return () => ipcRenderer.off('update-progress', subscription);
  }
});
