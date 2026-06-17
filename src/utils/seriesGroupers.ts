import type { PlaylistItem } from './m3uParser';

export interface SeriesEpisode {
  episodeNumber: number;
  seasonNumber: number;
  item: PlaylistItem;
}

export interface GroupedSeries {
  id: string;
  name: string;
  logo: string;
  group: string;
  type: 'series';
  seasons: Record<number, SeriesEpisode[]>;
  episodesCount: number;
  score?: number;
}

export interface ParsedEpisodeInfo {
  cleanTitle: string;
  season: number;
  episode: number;
}

const TITLE_CACHE_LIMIT = 100000;
const cleanTitleCache = new Map<string, string>();
const episodeInfoCache = new Map<string, ParsedEpisodeInfo>();

const remember = <T,>(cache: Map<string, T>, key: string, value: T): T => {
  if (cache.size >= TITLE_CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
  return value;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tagsToRemove = [
  '1080p', '720p', '4k', 'uhd', 'fhd', 'hd', 'hevc', 'x264', 'x265', 'h264', 'h265',
  'dual', 'dublaj', 'dublajlı', 'dublajli', 'altyazılı', 'altyazili', 'altyazı', 'altyazi',
  'türkçe dublaj', 'turkce dublaj', 'türkçe altyazılı', 'turkce altyazili', 'türkçe', 'turkce',
  'english', 'original', 'orijinal', 'tr', 'eng', 'de', 'fr', 'ger',
  'bluray', 'web-dl', 'webrip', 'web', 'hdtv', 'dvdrip', 'dd5.1', '5.1', 'aac', 'dolby',
  '3d', 'extended', 'director\'s cut', 'director cut', 'unrated', 'remastered', 'imax',
  'nostalji', 'dizi', 'film', 'series', 'movie', 'raw'
];

const tagPattern = tagsToRemove.map(escapeRegExp).join('|');
const bracketTagRegex = new RegExp(`\\s*\\[(?:${tagPattern})\\]`, 'gi');
const parenTagRegex = new RegExp(`\\s*\\((?:${tagPattern})\\)`, 'gi');
const standaloneTagRegex = new RegExp(`\\s*\\b(?:${tagPattern})\\b`, 'gi');

/**
 * Robust, unified title cleaner helper function for TMDB searches.
 * Cleans typical IPTV prefix tags (SEÇ İZLE |, TR |, [TR], Film:),
 * quality tags (1080p, 4k, uhd), audio/sub tags (dublaj, altyazı), and year info.
 */
export function cleanMediaTitle(title: string): string {
  const cached = cleanTitleCache.get(title);
  if (cached !== undefined) return cached;

  let clean = title.trim();

  // Remove common file extensions
  clean = clean.replace(/\.(mp4|mkv|avi|mov|ts|mpeg|mpg|wmv)$/i, '');

  // 1. Remove prefixes
  // Remove "SEÇ İZLE |", "SEC IZLE |", "SEC IZLE -", etc.
  clean = clean.replace(/^(?:SEÇ\s*İZLE|SEC\s*IZLE)\s*[:|-]?\s*/i, '');
  // Remove "7/24" or "24/7" prefixes (with optional category words like DIZI, FILM, etc.)
  clean = clean.replace(/^(?:(?:DIZI|DİZİ|FILM|FİLM|MUZIK|MÜZİK|COCUK|ÇOCUK|SEÇ\s*İZLE|SEC\s*IZLE)\s*)?(?:7\/24|24\/7)\s*[:||\-|•]?\s*/i, '');
  // Remove standalone "DIZI |", "DİZİ |", "FILM |", "FİLM |" prefixes
  clean = clean.replace(/^(?:DIZI|DİZİ|FILM|FİLM)\s*[:||\-|•]\s*/i, '');
  // Remove "Film:" or "Dizi:" or "Movie:" or "Series:" prefixes
  clean = clean.replace(/^(?:Film|Dizi|Movie|Series)\s*:\s*/i, '');
  // Remove country code prefixes at the start followed by separator or space
  // Matches "TR | ", "EN | ", "ENG - ", "TR: ", "[TR] ", "(TR) " etc.
  clean = clean.replace(/^\[(?:TR|ENG?|DE[U]?|FR[A]?|GER|ES[P]?|IT[A]?|NL[D]?|RU[S]?|AR[B]?|TR-EN|EN-TR|EXXEN|GAIN|NETFLIX|BLUTV|DISNEY\+?|TABII)\]\s*/i, '');
  clean = clean.replace(/^\((?:TR|ENG?|DE[U]?|FR[A]?|GER|ES[P]?|IT[A]?|NL[D]?|RU[S]?|AR[B]?|TR-EN|EN-TR|EXXEN|GAIN|NETFLIX|BLUTV|DISNEY\+?|TABII)\)\s*/i, '');
  clean = clean.replace(/^(?:TR|ENG?|DE[U]?|FR[A]?|GER|ES[P]?|IT[A]?|NL[D]?|RU[S]?|AR[B]?|TR-EN|EN-TR|EXXEN|GAIN|NETFLIX|BLUTV|DISNEY\+?|TABII)\s*[:||\-|•]\s*/i, '');

  // 2. Remove year inside parentheses or at the end
  clean = clean.replace(/\s*\(\d{4}\)/g, '');
  clean = clean.replace(/\s+\[\d{4}\]/g, '');
  clean = clean.replace(/\s+\d{4}$/g, '');

  // Remove general parentheses/brackets and their contents (e.g. tags, descriptions)
  clean = clean.replace(/\s*\([^)]*\)/g, ' ');
  clean = clean.replace(/\s*\[[^\]]*\]/g, ' ');

  // 3. Remove common VOD suffixes/tags (case-insensitive)
  // Pattern for bracket tags, e.g. [1080p], [dublaj]
  clean = clean.replace(bracketTagRegex, '');
  // Pattern for parentheses tags, e.g. (1080p), (dublaj)
  clean = clean.replace(parenTagRegex, '');
  // Pattern for standalone words at word boundaries or ends
  clean = clean.replace(standaloneTagRegex, '');

  // 4. Clean trailing and leading symbols
  clean = clean.replace(/^[\s.:\-|#|+/\\|•]+/, '');
  clean = clean.replace(/[\s.:\-|#|+/\\|•]+$/, '');

  return remember(cleanTitleCache, title, clean.trim());
}

export function parseSeriesEpisodeInfo(name: string): ParsedEpisodeInfo {
  const cached = episodeInfoCache.get(name);
  if (cached) return cached;

  let cleanTitle = name.trim();
  let season = 1;
  let episode = 1;

  // Let's remove typical file extensions if any
  cleanTitle = cleanTitle.replace(/\.(mp4|mkv|avi|mov)$/i, '');

  // 1. Matches "S01E02", "S1E2", "S01 E02", "S 01 E 02" (case-insensitive)
  const sXeYMatch = cleanTitle.match(/\s+s\s*(\d+)\s*e\s*(\d+)/i);
  if (sXeYMatch && sXeYMatch.index !== undefined) {
    cleanTitle = cleanTitle.substring(0, sXeYMatch.index);
    season = parseInt(sXeYMatch[1], 10);
    episode = parseInt(sXeYMatch[2], 10);
  } else {
    // 2. Matches "1x02" or "01x02" format
    const xFormatMatch = cleanTitle.match(/\s+(\d+)x(\d+)/i);
    if (xFormatMatch && xFormatMatch.index !== undefined) {
      cleanTitle = cleanTitle.substring(0, xFormatMatch.index);
      season = parseInt(xFormatMatch[1], 10);
      episode = parseInt(xFormatMatch[2], 10);
    } else {
      // 3. Matches "Sezon 1 Bölüm 2" or "Season 1 Episode 2"
      // 3. Matches "Sezon 1 Bölüm 2" or "Season 1 Episode 2" (with optional separator like hyphen, comma, dot)
      const wordFirstRegex = cleanTitle.match(/\s+se(?:zon|ason)\s*(\d+)\s*(?:[\s.,\-–—:/|]+)?\s*(?:bölüm|ep(?:isode)?)\s*(\d+)/i);
      if (wordFirstRegex && wordFirstRegex.index !== undefined) {
        cleanTitle = cleanTitle.substring(0, wordFirstRegex.index);
        season = parseInt(wordFirstRegex[1], 10);
        episode = parseInt(wordFirstRegex[2], 10);
      } else {
        // 4. Matches "1. Sezon 2. Bölüm", "1 Sezon 2 Bölüm", "1.Sezon 2.Bölüm", "1. Sezon - 2. Bölüm", etc.
        const numFirstRegex = cleanTitle.match(/\s+(\d+)\.?:?\s*se(?:zon|ason)\s*(?:[\s.,\-–—:/|]+)?\s*(\d+)\.?:?\s*(?:bölüm|ep(?:isode)?)/i);
        if (numFirstRegex && numFirstRegex.index !== undefined) {
          cleanTitle = cleanTitle.substring(0, numFirstRegex.index);
          season = parseInt(numFirstRegex[1], 10);
          episode = parseInt(numFirstRegex[2], 10);
        } else {
          // 5. Matches "S01" / "Season 1" / "1. Sezon" (no episode specified)
          const seasonOnlyMatch = cleanTitle.match(/\s+s(?:ezon|eason)?\s*(\d+)/i) ||
                                 cleanTitle.match(/\s+(\d+)\.?:?\s*se(?:zon|ason)/i);
          if (seasonOnlyMatch && seasonOnlyMatch.index !== undefined) {
            cleanTitle = cleanTitle.substring(0, seasonOnlyMatch.index);
            season = parseInt(seasonOnlyMatch[1], 10);
            const epMatch = name.match(/e(?:pisode|bölüm|b)?\s*(\d+)/i);
            if (epMatch) {
              episode = parseInt(epMatch[1], 10);
            }
          } else {
            // 6. Matches "Bölüm 2", "2. Bölüm", "2 Bölüm", etc. (assuming Season 1)
            const episodeOnlyMatch = cleanTitle.match(/\s+bölüm\s*(\d+)/i) || 
                                     cleanTitle.match(/\s+ep(?:isode)?\s*(\d+)/i) ||
                                     cleanTitle.match(/\s+(\d+)\.?:?\s*(?:bölüm|ep(?:isode)?)/i);
            if (episodeOnlyMatch && episodeOnlyMatch.index !== undefined) {
              cleanTitle = cleanTitle.substring(0, episodeOnlyMatch.index);
              episode = parseInt(episodeOnlyMatch[1], 10);
            }
          }
        }
      }
    }
  }

  // Use the robust cleaner helper
  cleanTitle = cleanMediaTitle(cleanTitle);

  return remember(episodeInfoCache, name, {
    cleanTitle,
    season,
    episode
  });
}

export function groupPlaylistItemsToSeries(items: PlaylistItem[]): GroupedSeries[] {
  const groups: Record<string, GroupedSeries> = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const parsed = parseSeriesEpisodeInfo(item.name);
    // Group key by cleanTitle + group to preserve category division
    const key = `${parsed.cleanTitle}:::${item.group || 'Genel'}`;

    if (!groups[key]) {
      groups[key] = {
        id: `series-${item.id}`,
        name: parsed.cleanTitle,
        logo: item.logo,
        group: item.group || 'Genel',
        type: 'series',
        seasons: {},
        episodesCount: 0
      };
    }

    const series = groups[key];
    if (!series.seasons[parsed.season]) {
      series.seasons[parsed.season] = [];
    }

    // Check for duplicates
    const exists = series.seasons[parsed.season].some(ep => ep.episodeNumber === parsed.episode);
    if (!exists) {
      series.seasons[parsed.season].push({
        episodeNumber: parsed.episode,
        seasonNumber: parsed.season,
        item
      });
      series.episodesCount++;
    }

    if (!series.logo && item.logo) {
      series.logo = item.logo;
    }
  }

  const result = Object.values(groups);
  for (let i = 0; i < result.length; i++) {
    const series = result[i];
    for (const seasonNo in series.seasons) {
      series.seasons[seasonNo].sort((a, b) => a.episodeNumber - b.episodeNumber);
    }
  }

  return result;
}
