import type { PlaylistItem } from "../../types";
import {
  deletePlaylistFromBrowserStorage,
  loadPlaylistFromBrowserStorage,
  savePlaylistToBrowserStorage,
} from "../../utils/playlistStorage";

export async function savePlaylistData(
  id: string,
  playlistItems: PlaylistItem[],
) {
  if (window.electronAPI?.savePlaylistItems) {
    await window.electronAPI.savePlaylistItems(id, playlistItems);
    return;
  }
  await savePlaylistToBrowserStorage(id, playlistItems);
}

export async function loadPlaylistData(id: string): Promise<PlaylistItem[]> {
  if (window.electronAPI?.loadPlaylistItems) {
    return window.electronAPI.loadPlaylistItems(id);
  }
  return loadPlaylistFromBrowserStorage(id);
}

export async function deletePlaylistData(id: string) {
  if (window.electronAPI?.deletePlaylistItems) {
    await window.electronAPI.deletePlaylistItems(id);
    return;
  }
  await deletePlaylistFromBrowserStorage(id);
}
