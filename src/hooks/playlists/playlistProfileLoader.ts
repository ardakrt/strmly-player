import type { SavedPlaylist } from "../../types";
import {
  getPlaylistMode,
  hasXtreamCredentials,
  normalizeAutoUpdateInterval,
} from "./playlistHelpers";

export async function prepareProfilePlaylists(
  savedPlaylists: unknown,
  profileId: string,
) {
  if (!Array.isArray(savedPlaylists)) {
    return { playlists: [] as SavedPlaylist[], restoredCredentials: false };
  }

  let restoredCredentials = false;
  let playlists: SavedPlaylist[] = savedPlaylists.map((playlist: SavedPlaylist) => ({
    ...playlist,
    playlistMode: getPlaylistMode(playlist),
    autoUpdateIntervalHours: normalizeAutoUpdateInterval(
      playlist.autoUpdateIntervalHours,
    ),
  }));

  try {
    const browserStorageKey = `profile_${profileId}_cinema_playlists`;
    const browserPlaylists = JSON.parse(
      localStorage.getItem(browserStorageKey) || "[]",
    ) as SavedPlaylist[];
    if (Array.isArray(browserPlaylists)) {
      const browserById = new Map(
        browserPlaylists.map((playlist) => [playlist.id, playlist]),
      );
      playlists = playlists.map((playlist) => {
        if (
          playlist.playlistMode !== "xtream" ||
          hasXtreamCredentials(playlist)
        ) {
          return playlist;
        }
        const localPlaylist = browserById.get(playlist.id);
        if (!hasXtreamCredentials(localPlaylist)) return playlist;
        restoredCredentials = true;
        return {
          ...playlist,
          xtreamUrl: localPlaylist.xtreamUrl.trim(),
          xtreamUser: localPlaylist.xtreamUser.trim(),
          xtreamPass: localPlaylist.xtreamPass.trim(),
        };
      });
    }
  } catch {
    // A malformed browser fallback must not block durable playlist loading.
  }

  if (window.electronAPI?.recoverPlaylistCredentials) {
    playlists = await Promise.all(
      playlists.map(async (playlist) => {
        if (
          playlist.playlistMode !== "xtream" ||
          hasXtreamCredentials(playlist)
        ) {
          return playlist;
        }
        try {
          const result = await window.electronAPI!.recoverPlaylistCredentials!(
            profileId,
            playlist.id,
          );
          if (!result.success || !hasXtreamCredentials(result.playlist)) {
            return playlist;
          }
          restoredCredentials = true;
          return result.playlist;
        } catch {
          // Credential recovery is optional during renderer/main hot reload skew.
          return playlist;
        }
      }),
    );
  }

  return { playlists, restoredCredentials };
}
