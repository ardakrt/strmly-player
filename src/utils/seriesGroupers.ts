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
  nameLower?: string;
  groupLower?: string;
  isGenericLogo?: boolean;
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

// Quality / audio tags only — NEVER include film/dizi/movie/series as bare words
// (those wiped titles like "Film (2025)" → "" and "Movie Name 2025" → "Name").
const tagsToRemove = [
  '1080p', '720p', '4k', 'uhd', 'fhd', 'hd', 'hevc', 'x264', 'x265', 'h264', 'h265',
  'dual', 'dublaj', 'dublajlı', 'dublajli', 'altyazılı', 'altyazili', 'altyazı', 'altyazi',
  'türkçe dublaj', 'turkce dublaj', 'türkçe altyazılı', 'turkce altyazili',
  'english', 'original', 'orijinal',
  'bluray', 'web-dl', 'webrip', 'web', 'hdtv', 'dvdrip', 'dd5.1', '5.1', 'aac', 'dolby',
  '3d', 'extended', "director's cut", 'director cut', 'unrated', 'remastered', 'imax',
  'nostalji', 'raw',
];

const tagPattern = tagsToRemove.map(escapeRegExp).join('|');
const bracketTagRegex = new RegExp(`\\s*\\[(?:${tagPattern})\\]`, 'gi');
const parenTagRegex = new RegExp(`\\s*\\((?:${tagPattern})\\)`, 'gi');
const standaloneTagRegex = new RegExp(`\\s*\\b(?:${tagPattern})\\b`, 'gi');

/**
 * Robust, unified title cleaner helper function for TMDB searches.
 * Cleans typical IPTV prefix tags (SEÇ İZLE |, TR |, [TR], Film:),
 * quality tags (1080p, 4k, uhd), audio/sub tags (dublaj, altyazı), and year info.
 * Never returns an empty string — falls back to a lightly cleaned original.
 */
export function cleanMediaTitle(title: string): string {
  const cached = cleanTitleCache.get(title);
  // Ignore previously cached empty results from older cleaner bugs
  if (cached !== undefined && cached.length > 0) return cached;

  const original = String(title || '').trim();
  if (!original) return remember(cleanTitleCache, title, '');

  let clean = original;

  // Remove common file extensions
  clean = clean.replace(/\.(mp4|mkv|avi|mov|ts|mpeg|mpg|wmv)$/i, '');

  // 1. Remove prefixes
  clean = clean.replace(/^(?:SEÇ\s*İZLE|SEC\s*IZLE)\s*[:|-]?\s*/i, '');
  clean = clean.replace(/^(?:(?:DIZI|DİZİ|FILM|FİLM|MUZIK|MÜZİK|COCUK|ÇOCUK|SEÇ\s*İZLE|SEC\s*IZLE)\s*)?(?:7\/24|24\/7)\s*[:||\-|•]?\s*/i, '');
  // Type prefixes only at the start (with separator), not bare words mid-title
  clean = clean.replace(/^(?:DIZI|DİZİ|FILM|FİLM|MOVIE|SERIES|DIZI|DİZİ)\s*[:||\-|•]\s*/i, '');
  clean = clean.replace(/^(?:Film|Dizi|Movie|Series)\s*:\s*/i, '');
  clean = clean.replace(/^\[(?:TR|ENG?|DE[U]?|FR[A]?|GER|ES[P]?|IT[A]?|NL[D]?|RU[S]?|AR[B]?|TR-EN|EN-TR|EXXEN|GAIN|NETFLIX|BLUTV|DISNEY\+?|TABII)\]\s*/i, '');
  clean = clean.replace(/^\((?:TR|ENG?|DE[U]?|FR[A]?|GER|ES[P]?|IT[A]?|NL[D]?|RU[S]?|AR[B]?|TR-EN|EN-TR|EXXEN|GAIN|NETFLIX|BLUTV|DISNEY\+?|TABII)\)\s*/i, '');
  clean = clean.replace(/^(?:TR|ENG?|DE[U]?|FR[A]?|GER|ES[P]?|IT[A]?|NL[D]?|RU[S]?|AR[B]?|TR-EN|EN-TR|EXXEN|GAIN|NETFLIX|BLUTV|DISNEY\+?|TABII)\s*[:||\-|•]\s*/i, '');

  // 2. Quality tags first (so "Title 2025 1080p" can drop year next)
  clean = clean.replace(bracketTagRegex, '');
  clean = clean.replace(parenTagRegex, '');
  clean = clean.replace(standaloneTagRegex, '');

  // 3. Year: (2025) / [2025] / trailing year only — keep if the whole title is a year
  clean = clean.replace(/\s*\(\d{4}\)/g, '');
  clean = clean.replace(/\s+\[\d{4}\]/g, '');
  const withoutTrailingYear = clean.replace(/\s+(19|20)\d{2}\s*$/g, '').trim();
  if (withoutTrailingYear.length > 0) {
    clean = withoutTrailingYear;
  }

  // Remove leftover empty paren/brackets only (not all content — already handled years)
  clean = clean.replace(/\s*\(\s*\)/g, ' ');
  clean = clean.replace(/\s*\[\s*\]/g, ' ');
  // Safe generic paren/bracket strip for leftover quality notes
  clean = clean.replace(/\s*\((?:[^)]*)\)/g, (m) => {
    // Keep meaningful parenthetical titles (rare); drop short tag-like ones
    const inner = m.slice(1, -1).trim();
    if (inner.length >= 12) return ` ${inner} `;
    return ' ';
  });
  clean = clean.replace(/\s*\[(?:[^\]]*)\]/g, ' ');

  // 4. Clean trailing and leading symbols
  clean = clean.replace(/^[\s.:\-|#|+/\\|•]+/, '');
  clean = clean.replace(/[\s.:\-|#|+/\\|•]+$/, '');
  clean = clean.replace(/\s{2,}/g, ' ').trim();

  // Never wipe the title — e.g. "Film (2025)" used to become ""
  if (!clean) {
    clean = original
      .replace(/\s*\(\d{4}\)\s*/g, ' ')
      .replace(/\s+(19|20)\d{2}\s*$/g, '')
      .replace(/^[\s.:\-|#|+/\\|•]+/, '')
      .replace(/[\s.:\-|#|+/\\|•]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || original;
  }

  return remember(cleanTitleCache, title, clean);
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

  // Use the robust cleaner helper — never allow empty cleanTitle
  const beforeClean = cleanTitle;
  cleanTitle = cleanMediaTitle(cleanTitle);
  if (!cleanTitle) {
    cleanTitle = beforeClean.trim() || name.trim() || 'İsimsiz';
  }

  return remember(episodeInfoCache, name, {
    cleanTitle,
    season,
    episode
  });
}

// Stable series id derived from title + category, independent of any single
// episode item's id. Use this everywhere a GroupedSeries id needs to be
// (re)computed so favorites/watch-history keep matching the same series
// across playlist re-parses.
export function getSeriesId(cleanTitle: string, group: string): string {
  return `series-${cleanTitle}:::${group || 'Genel'}`;
}

export function groupPlaylistItemsToSeries(items: PlaylistItem[]): GroupedSeries[] {
  // Map + per-season episode Set: O(1) dedup instead of O(season length) .some()
  const groups = new Map<string, GroupedSeries>();
  const seasonEpisodeKeys = new Map<string, Set<number>>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const parsed = parseSeriesEpisodeInfo(item.name);
    const groupName = item.group || 'Genel';
    // Group key by cleanTitle + group to preserve category division
    const key = `${parsed.cleanTitle}:::${groupName}`;

    let series = groups.get(key);
    if (!series) {
      series = {
        id: getSeriesId(parsed.cleanTitle, groupName),
        name: parsed.cleanTitle,
        logo: item.logo,
        group: groupName,
        type: 'series',
        seasons: {},
        episodesCount: 0,
        isGenericLogo: item.isGenericLogo,
      };
      groups.set(key, series);
    }

    let seasonList = series.seasons[parsed.season];
    if (!seasonList) {
      seasonList = [];
      series.seasons[parsed.season] = seasonList;
    }

    const epKey = `${key}#${parsed.season}`;
    let epSet = seasonEpisodeKeys.get(epKey);
    if (!epSet) {
      epSet = new Set<number>();
      seasonEpisodeKeys.set(epKey, epSet);
    }
    if (!epSet.has(parsed.episode)) {
      epSet.add(parsed.episode);
      seasonList.push({
        episodeNumber: parsed.episode,
        seasonNumber: parsed.season,
        item,
      });
      series.episodesCount++;
    }

    if (!series.logo && item.logo) {
      series.logo = item.logo;
    }
  }

  const result = Array.from(groups.values());
  for (let i = 0; i < result.length; i++) {
    const series = result[i];
    for (const seasonNo in series.seasons) {
      series.seasons[seasonNo].sort((a, b) => a.episodeNumber - b.episodeNumber);
    }
  }

  return result;
}
