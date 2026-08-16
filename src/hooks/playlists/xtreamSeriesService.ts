import type { SavedPlaylist, PlaylistItem } from "../../types";
import type { GroupedSeries, SeriesEpisode } from "../../utils/seriesGroupers";
import { cleanMovieName } from "../../utils/tmdb";

interface XtreamSeriesEpisode {
  id?: string | number;
  episode_num?: string | number;
  title?: string;
  container_extension?: string;
  info?: {
    movie_image?: string;
    duration_secs?: string | number;
  };
}

interface XtreamSeriesInfoResponse {
  info?: {
    name?: string;
    cover?: string;
    movie_image?: string;
  };
  episodes?: Record<string, XtreamSeriesEpisode[]>;
}

export function getXtreamSeriesId(item: PlaylistItem | null) {
  if (!item) return null;
  const match = item.id.match(/^xt-series-(\d+)$/);
  return match ? match[1] : null;
}

interface BuildXtreamSeriesOptions {
  sourceItem: PlaylistItem | null;
  fallbackSeries?: GroupedSeries;
  activePlaylist?: SavedPlaylist;
}

export async function fetchXtreamSeriesGroup({
  sourceItem,
  fallbackSeries,
  activePlaylist,
}: BuildXtreamSeriesOptions): Promise<GroupedSeries | null> {
  const seriesId = getXtreamSeriesId(sourceItem);
  if (
    !sourceItem ||
    !seriesId ||
    !activePlaylist?.xtreamUrl ||
    !activePlaylist.xtreamUser ||
    !activePlaylist.xtreamPass
  ) {
    return null;
  }

  const baseUrl = activePlaylist.xtreamUrl.replace(/\/$/, "");
  const username = encodeURIComponent(activePlaylist.xtreamUser);
  const password = encodeURIComponent(activePlaylist.xtreamPass);
  const apiUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
  const response = await fetch(apiUrl, {
    cache: "no-store",
    headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = (await response.json()) as XtreamSeriesInfoResponse;
  if (!data.episodes || typeof data.episodes !== "object") return null;

  const seasons: Record<number, SeriesEpisode[]> = {};
  let episodesCount = 0;
  const seriesTitle = cleanMovieName(
    data.info?.name || fallbackSeries?.name || sourceItem.name,
  );
  const logo =
    data.info?.cover ||
    data.info?.movie_image ||
    fallbackSeries?.logo ||
    sourceItem.logo ||
    "";

  Object.entries(data.episodes).forEach(([seasonKey, seasonEpisodes]) => {
    const seasonNumber = Number(seasonKey) || 1;
    if (!Array.isArray(seasonEpisodes)) return;
    if (!seasons[seasonNumber]) seasons[seasonNumber] = [];

    seasonEpisodes.forEach((episode, index) => {
      const episodeId = episode.id !== undefined ? String(episode.id) : "";
      if (!episodeId) return;
      const episodeNumber = Number(episode.episode_num) || index + 1;
      const extension = episode.container_extension || "mp4";
      const episodeTitle = episode.title?.trim();
      const paddedSeason = String(seasonNumber).padStart(2, "0");
      const paddedEpisode = String(episodeNumber).padStart(2, "0");
      const streamUrl = `${baseUrl}/series/${username}/${password}/${encodeURIComponent(episodeId)}.${extension}`;
      const item: PlaylistItem = {
        id: `xt-episode-${seriesId}-${episodeId}`,
        name: episodeTitle
          ? `${seriesTitle} S${paddedSeason}E${paddedEpisode} - ${episodeTitle}`
          : `${seriesTitle} S${paddedSeason}E${paddedEpisode}`,
        logo: episode.info?.movie_image || logo,
        group: sourceItem.group || fallbackSeries?.group || "Genel",
        url: streamUrl,
        type: "series",
        xtreamSeriesId: seriesId,
        xtreamEpisodeId: episodeId,
      };

      seasons[seasonNumber].push({ episodeNumber, seasonNumber, item });
      episodesCount += 1;
    });
  });

  Object.values(seasons).forEach((episodes) => {
    episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
  });
  if (episodesCount === 0) return null;

  return {
    id: fallbackSeries?.id || `series-${sourceItem.id}`,
    name: seriesTitle,
    logo,
    group: sourceItem.group || fallbackSeries?.group || "Genel",
    type: "series",
    seasons,
    episodesCount,
  };
}
