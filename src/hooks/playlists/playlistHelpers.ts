import { DEFAULT_AUTO_UPDATE_INTERVAL_HOURS } from "../../constants";
import type { SavedPlaylist } from "../../types";

export const AUTO_UPDATE_INTERVALS = [6, 12, 24, 168] as const;
export type AutoUpdateInterval = (typeof AUTO_UPDATE_INTERVALS)[number];

export function normalizeAutoUpdateInterval(
  value: unknown,
): AutoUpdateInterval {
  const numeric = Number(value);
  return AUTO_UPDATE_INTERVALS.includes(numeric as AutoUpdateInterval)
    ? (numeric as AutoUpdateInterval)
    : DEFAULT_AUTO_UPDATE_INTERVAL_HOURS;
}

export function getCacheBustedUrl(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_cb=${Date.now()}`;
}

export function hasXtreamCredentials(
  playlist: SavedPlaylist | undefined,
): playlist is SavedPlaylist & {
  xtreamUrl: string;
  xtreamUser: string;
  xtreamPass: string;
} {
  return Boolean(
    playlist?.xtreamUrl?.trim() &&
      playlist.xtreamUser?.trim() &&
      playlist.xtreamPass?.trim(),
  );
}

export function getPlaylistMode(playlist: SavedPlaylist) {
  return (
    playlist.playlistMode ||
    (playlist.xtreamUrl ? "xtream" : playlist.url ? "m3u" : undefined)
  );
}
