import type { PlaylistItem } from "../../utils/m3uParser";
import type { GroupedSeries } from "../../utils/seriesGroupers";
import { cleanMovieName } from "../../utils/tmdb";

export type SpotlightScope = "all" | "live" | "movie" | "series";

export interface SpotlightMatch {
  type?: string;
  item?: any;
}

export function typeLabel(type: string, language: "tr" | "en"): string {
  if (type === "series") return language === "tr" ? "Dizi" : "Series";
  if (type === "movie") return language === "tr" ? "Film" : "Movie";
  return language === "tr" ? "Canlı TV" : "Live TV";
}

export function isGroupedSeries(item: any): item is GroupedSeries {
  return Boolean(
    item &&
      typeof item === "object" &&
      item.seasons &&
      typeof item.seasons === "object" &&
      !Array.isArray(item.seasons),
  );
}

export function resultTitle(match: SpotlightMatch): string {
  if (!match?.item) return "";
  try {
    if (match.type === "series") {
      return (
        cleanMovieName(String(match.item.name || "")) ||
        String(match.item.name || "")
      );
    }
    const item = match.item as PlaylistItem;
    return item.type === "movie"
      ? cleanMovieName(item.name)
      : String(item.name || "");
  } catch {
    return String(match.item?.name || "");
  }
}

export function resultLogo(match: SpotlightMatch): string {
  return String(match?.item?.logo || "");
}

export function sanitizeRecentList(raw: unknown): SpotlightMatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const match = entry as SpotlightMatch;
      if (!match.type || !match.item?.id || !match.item?.name) return false;
      if (match.type === "series") {
        return isGroupedSeries(match.item) || Boolean(match.item._flat?.id);
      }
      return match.type === "movie" || match.type === "live";
    })
    .slice(0, 12);
}

export function toRecentEntry(match: SpotlightMatch) {
  if (!match?.item || !match?.type) return null;

  if (match.type === "series" && isGroupedSeries(match.item)) {
    const series = match.item;
    const seasonKeys = Object.keys(series.seasons || {})
      .map(Number)
      .sort((a, b) => a - b);
    const firstSeason = seasonKeys[0];
    const firstEpisode =
      firstSeason != null ? series.seasons[firstSeason]?.[0]?.item : null;
    return {
      type: "series" as const,
      item: {
        id: series.id,
        name: series.name,
        logo: series.logo,
        group: series.group,
        type: "series" as const,
        seasons: series.seasons,
        episodesCount: series.episodesCount,
        _flat: firstEpisode
          ? {
              id: firstEpisode.id,
              name: firstEpisode.name,
              logo: firstEpisode.logo,
              group: firstEpisode.group,
              type: firstEpisode.type,
              url: firstEpisode.url,
            }
          : null,
      },
    };
  }

  if (match.type === "movie" || match.type === "live") {
    const item = match.item as PlaylistItem;
    return {
      type: match.type,
      item: {
        id: item.id,
        name: item.name,
        logo: item.logo,
        group: item.group,
        type: item.type,
        url: item.url,
        isGenericLogo: item.isGenericLogo,
      },
    };
  }

  return null;
}

export function getAutocompleteSuggestions(
  query: string,
  matches: SpotlightMatch[],
) {
  if (!query || matches.length === 0) return [];
  const seen = new Set<string>();
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();
  for (const match of matches) {
    const title = resultTitle(match).trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    if (key.includes(lowerQuery)) {
      suggestions.push(title);
      if (suggestions.length >= 4) break;
    }
  }
  return suggestions;
}

export function countMatches(matches: SpotlightMatch[], query: string) {
  const counts = { all: 0, series: 0, movie: 0, live: 0 };
  if (!query) return counts;
  counts.all = matches.length;
  for (const match of matches) {
    if (match.type === "series") counts.series += 1;
    else if (match.type === "movie") counts.movie += 1;
    else if (match.type === "live") counts.live += 1;
  }
  return counts;
}
