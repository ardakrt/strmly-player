import type { PlaylistItem, TmdbData } from "../../types";
import { cleanMediaTitle } from "../../utils/seriesGroupers";
import type { SeriesEpisode } from "../../utils/seriesGroupers";

export interface EpisodeMeta {
  stillPath?: string;
  runtime?: number;
  overview?: string;
  name?: string;
}

export function findResumeEpisode(
  seasons: Record<number, SeriesEpisode[]>,
  recentlyWatched: PlaylistItem[],
) {
  let resumeEpisode: SeriesEpisode | null = null;
  let bestHistoryIndex = -1;

  for (const seasonEpisodes of Object.values(seasons)) {
    for (const episode of seasonEpisodes) {
      const historyIndex = recentlyWatched.findIndex(
        (item) => item.id === episode.item.id,
      );
      if (
        historyIndex !== -1 &&
        (bestHistoryIndex === -1 || historyIndex < bestHistoryIndex)
      ) {
        bestHistoryIndex = historyIndex;
        resumeEpisode = episode;
      }
    }
  }

  return resumeEpisode;
}

export function cleanSeriesGroup(group?: string) {
  if (!group) return "";
  let cleaned = String(group)
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\b(4k|uhd|fhd|hd|sd|1080p|720p|2160p|hdr|dv|atmos)\b/gi, " ")
    .replace(/[|/\\]+/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 32) cleaned = `${cleaned.slice(0, 30).trim()}…`;
  return cleaned;
}

export function buildSeriesMetaParts(
  tmdbData: TmdbData | null,
  language: string,
  seasonCount: number,
) {
  const parts: { text: string; accent?: boolean }[] = [];
  if (tmdbData?.match) {
    const score = String(tmdbData.match).replace(/[^0-9]/g, "");
    if (score) {
      parts.push({
        text: language === "tr" ? `%${score} Eşleşme` : `${score}% Match`,
        accent: true,
      });
    }
  }
  if (tmdbData?.year) parts.push({ text: tmdbData.year });
  if (tmdbData?.rating) {
    const rating = tmdbData.rating.replace("★ ", "").trim();
    if (rating) parts.push({ text: `★ ${rating}` });
  }
  parts.push({
    text:
      language === "tr"
        ? `${seasonCount} Sezon`
        : `${seasonCount} Season${seasonCount > 1 ? "s" : ""}`,
  });
  return parts;
}

export function getSeasonWatchStats(
  episodes: SeriesEpisode[],
  recentlyWatched: PlaylistItem[],
) {
  let watched = 0;
  let inProgress = 0;
  for (const episode of episodes) {
    const historyItem = recentlyWatched.find(
      (item) => item.id === episode.item.id,
    );
    if (!historyItem) continue;
    const progress = historyItem.progress ?? 0;
    if (progress >= 90) watched += 1;
    else if (progress > 0) inProgress += 1;
  }
  return { watched, inProgress, total: episodes.length };
}

function cleanEpisodeSubtitle(title: string, seriesCleanName: string) {
  const cleanedTitle = cleanMediaTitle(title);
  const escapedSeriesName = seriesCleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let subtitle = cleanedTitle
    ? cleanedTitle.replace(new RegExp(`^${escapedSeriesName}\\s*`, "i"), "").trim()
    : "";
  if (!subtitle) return "";
  subtitle = subtitle.replace(/^s\d+\s*e\d+\s*[:-]?\s*/i, "");
  subtitle = subtitle.replace(
    /^(?:\d+\.?\s*(?:sezon|season|s\.?)\s*)?(?:\d+\.?\s*(?:bölüm|episode|ep?\.?))\s*[:-]?\s*/i,
    "",
  );
  subtitle = subtitle.replace(
    /^(?:(?:sezon|season|s)\s*\d+\s*)?(?:(?:bölüm|episode|ep)\s*\d+)\s*[:-]?\s*/i,
    "",
  );
  return subtitle.replace(/^[:-]\s*/, "").trim();
}

export function getEpisodePresentation(
  episode: SeriesEpisode,
  seriesCleanName: string,
  meta: EpisodeMeta,
  language: string,
) {
  const cleanSubtitle = cleanEpisodeSubtitle(episode.item.name, seriesCleanName);
  let tmdbEpisodeName = meta.name || "";
  if (tmdbEpisodeName) {
    const lower = tmdbEpisodeName.toLowerCase().trim();
    const isGeneric =
      /^(?:episode|bölüm|ep\.?|s\d+e\d+)\s*\d+$/i.test(lower) ||
      /^[se]\d+$/i.test(lower) ||
      lower === `episode ${episode.episodeNumber}` ||
      lower === `bölüm ${episode.episodeNumber}` ||
      lower === `${episode.episodeNumber}. bölüm` ||
      lower === `${episode.episodeNumber}.bölüm`;
    if (isGeneric) tmdbEpisodeName = "";
  }

  return {
    displayTitle:
      tmdbEpisodeName ||
      cleanSubtitle ||
      (language === "tr"
        ? `${episode.episodeNumber}. Bölüm`
        : `Episode ${episode.episodeNumber}`),
    runtimeText: meta.runtime ? `${meta.runtime} dk` : null,
    overview: meta.overview ? meta.overview.replace(/\s+/g, " ").trim() : "",
  };
}
