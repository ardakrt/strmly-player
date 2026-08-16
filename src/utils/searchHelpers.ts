import type { PlaylistItem } from './m3uParser';
import { cleanMediaTitle } from './seriesGroupers';
import { fixTurkishEncoding } from './helpers';

export interface SearchableMediaItem {
  name: string;
  group?: string;
  nameLower?: string;
  groupLower?: string;
  clNameLower?: string;
}

const excludedCatalogMarkers = ['seçizle', 'seç izle', 'secizle', 'sec izle', 'seç-izle', 'sec-izle'];
const unavailableMarkers = ['bakim', 'test', 'yedek', 'bakimda'];
const adultMarkers = ['adult', 'xxx'];

export function getItemNameLower(item: SearchableMediaItem): string {
  return item.nameLower || item.name.toLocaleLowerCase('tr-TR');
}

export function getItemGroupLower(item: SearchableMediaItem, fallback = 'Genel'): string {
  return item.groupLower || (item.group || fallback).toLocaleLowerCase('tr-TR');
}

export function getItemCleanNameLower(item: SearchableMediaItem): string {
  return item.clNameLower || cleanMediaTitle(item.name).toLocaleLowerCase('tr-TR');
}

export function itemMatchesQuery(item: SearchableMediaItem, query: string, fallbackGroup = 'Genel'): boolean {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return true;
  return getItemNameLower(item).includes(q) || getItemGroupLower(item, fallbackGroup).includes(q);
}

export function getItemSearchScore(
  item: SearchableMediaItem,
  query: string,
  fallbackGroup = 'Genel',
  itemType?: 'live' | 'movie' | 'series'
): number {
  const cleanNameLower = getItemCleanNameLower(item);
  return getSearchScore(
    item.name,
    item.group || fallbackGroup,
    query,
    cleanNameLower,
    getItemNameLower(item),
    getItemGroupLower(item, fallbackGroup),
    cleanNameLower,
    itemType
  );
}

export function isExcludedCatalogItem(item: SearchableMediaItem): boolean {
  const nameLower = getItemNameLower(item);
  const groupLower = getItemGroupLower(item, '');
  return excludedCatalogMarkers.some(marker => nameLower.includes(marker) || groupLower.includes(marker));
}

export function isUnavailableCatalogItem(item: SearchableMediaItem, includeAdult = false): boolean {
  const text = `${getItemNameLower(item)} ${getItemGroupLower(item, '')}`;
  const markers = includeAdult ? unavailableMarkers.concat(adultMarkers) : unavailableMarkers;
  return markers.some(marker => text.includes(marker));
}

// Helper to calculate search relevance score
export function getSearchScore(
  name: string,
  group: string,
  query: string,
  cleanedName?: string,
  nameLower?: string,
  groupLower?: string,
  clNameLower?: string,
  itemType?: 'live' | 'movie' | 'series'
): number {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return 0;

  const nLower = nameLower || name.toLocaleLowerCase('tr-TR');
  const gLower = groupLower || group.toLocaleLowerCase('tr-TR');
  const clLower = clNameLower || (cleanedName || cleanMediaTitle(name)).toLocaleLowerCase('tr-TR');

  let score = 0;

  // 1. Full Exact Match
  if (clLower === q && nLower === q) {
    score = 1000;
  } else if (clLower === q) {
    // Clean name matches query exactly, but raw title has slash/extra tags
    score = nLower.includes('/') || nLower.includes('-') ? 850 : 920;
  } else if (nLower === q) {
    score = 900;
  }
  // 2. Starts With Query
  else if (clLower.startsWith(q)) {
    score = 700;
    // Word boundary check: exact full word match at start (e.g. "breaking bad" for "breaking")
    if (clLower.length === q.length || clLower[q.length] === ' ' || clLower[q.length] === ':') {
      score += 150;
    }
  } else if (nLower.startsWith(q)) {
    score = 650;
    if (nLower.length === q.length || nLower[q.length] === ' ' || nLower[q.length] === ':') {
      score += 100;
    }
  }
  // 3. Contains Query
  else {
    const qWords = q.split(/\s+/).filter(Boolean);
    const clWords = clLower.split(/\s+/).filter(Boolean);

    if (qWords.length > 0 && clWords.length > 0 && clWords[0] === qWords[0]) {
      score = 550;
    } else if (clLower.includes(q)) {
      score = 400;
    } else if (nLower.includes(q)) {
      score = 350;
    } else if (gLower === q) {
      score = 150;
    } else if (gLower.includes(q)) {
      score = 100;
    }
  }

  if (score <= 0) return 0;

  // --- RELEVANCE PENALTIES & BOOSTS ---

  // Title Length Proximity Bonus:
  // Short, clean titles that closely match query length rank higher.
  const lenDiff = Math.abs(clLower.length - q.length);
  const lengthBonus = Math.max(0, 80 - lenDiff * 2);
  score += lengthBonus;

  // Series (Dizi) Relevance Boost:
  // When query starts or matches a TV Series title, give a major boost (+70)
  if (itemType === 'series' && score >= 600) {
    score += 70;
  }

  // Single-title bonus over slash-separated multi-titles (e.g. "Breaking Bad" vs "Breaking / Kopuş")
  if (!nLower.includes('/') && !nLower.includes(' - ')) {
    score += 30;
  }

  return Math.round(score);
}

// Helper to determine media quality rank from its name
export function getQualityRank(name: string, nameLower?: string): number {
  const n = nameLower || name.toLocaleLowerCase('tr-TR');
  if (n.includes('4k') || n.includes('uhd') || n.includes('2160p') || n.includes('2160')) return 4;
  if (n.includes('1080') || n.includes('fhd') || n.includes('1080p')) return 3;
  if (n.includes('720') || n.includes('hd') || n.includes('720p')) return 2;
  return 1;
}

// Check if a channel name indicates HD/UHD quality (used for "Ulusal" category filtering).
// Semantic lock: must match historic includes(hd|fhd|uhd|4k|1080) on name.toLowerCase() —
// NOT getQualityRank (which also treats 720 / 2160 as HD/4K).
export function isHdChannel(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('hd') ||
    n.includes('fhd') ||
    n.includes('uhd') ||
    n.includes('4k') ||
    n.includes('1080')
  );
}

const SERIES_NAME_PATTERNS = [
  /[\s._-]s\s*\d+\s*e\s*\d+/i, // S01E02
  /[\s._-]\d+x\d+/i, // 1x02
  /[\s._-]se(?:zon|ason)[\s._-]*\d+/i,
  /[\s._-]\d+[\s._-]*se(?:zon|ason)/i,
  /[\s._-]bölüm[\s._-]*\d+/i,
  /[\s._-]ep(?:isode)?[\s._-]*\d+/i,
  /[\s._-]\d+[\s._-]*(?:bölüm|ep(?:isode)?)/i,
  /[\s._-]s(?:ezon|eason)?\s*\d+/i,
];

function isSeriesName(name: string): boolean {
  // Episode patterns always include a digit — cheap reject for most live titles
  if (!/\d/.test(name)) return false;
  const nameLower = name.toLowerCase();
  for (let i = 0; i < SERIES_NAME_PATTERNS.length; i++) {
    if (SERIES_NAME_PATTERNS[i].test(nameLower)) return true;
  }
  return false;
}

const VOD_EXTENSIONS = [
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.flv',
  '.mpeg',
  '.mpg',
  '.m4v',
  '.webm',
  '.wmv',
] as const;

/**
 * True if URL matches historic VOD-extension detection used by preprocessPlaylistItems:
 * endsWith(ext) | includes(ext+'?') | includes(ext+'&') | includes('#'+ext) | includes('/'+ext)
 * (covers path segments like /.mp4/ and .mp4& without a ?).
 */
export function urlHasVodExtension(urlLower: string): boolean {
  for (let i = 0; i < VOD_EXTENSIONS.length; i++) {
    const ext = VOD_EXTENSIONS[i];
    if (
      urlLower.endsWith(ext) ||
      urlLower.includes(ext + '?') ||
      urlLower.includes(ext + '&') ||
      urlLower.includes('#' + ext) ||
      urlLower.includes('/' + ext)
    ) {
      return true;
    }
  }
  return false;
}

// Pre-process playlist items for fast O(1) searches
export function preprocessPlaylistItems(rawItems: PlaylistItem[]): PlaylistItem[] {
  // Count non-live logos to detect generic ones
  const counts: Record<string, number> = {};
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (item.type !== 'live') {
      const logo = item.logo;
      if (logo && logo.startsWith('http')) {
        counts[logo] = (counts[logo] || 0) + 1;
      }
    }
  }

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (item.name) item.name = fixTurkishEncoding(item.name);
    if (item.group) item.group = fixTurkishEncoding(item.group);

    if (!item.nameLower) {
      item.nameLower = item.name.toLocaleLowerCase('tr-TR');
    }
    if (!item.groupLower) {
      item.groupLower = (item.group || 'Genel').toLocaleLowerCase('tr-TR');
    }
    if (!item.clNameLower) {
      item.clNameLower = cleanMediaTitle(item.name).toLocaleLowerCase('tr-TR');
    }
    if (!item.qualityRank) {
      item.qualityRank = getQualityRank(item.name, item.nameLower);
    }

    // Auto-heal classification for cached items parsed under the old parser rules
    if (item.type === 'live' || !item.type) {
      const urlLower = item.url.toLowerCase();
      const groupLower = item.groupLower;

      let deducedType: 'live' | 'movie' | 'series' = 'live';
      if (groupLower.includes('movie') || groupLower.includes('sinema') || groupLower.includes('film')) {
        deducedType = 'movie';
      } else if (groupLower.includes('series') || groupLower.includes('dizi')) {
        deducedType = 'series';
      }

      const seriesByName = isSeriesName(item.name);
      const isVod = urlHasVodExtension(urlLower) || seriesByName;

      if (urlLower.includes('/movie/')) {
        item.type = 'movie';
      } else if (urlLower.includes('/series/')) {
        item.type = 'series';
      } else if (isVod) {
        item.type = deducedType === 'series' || seriesByName ? 'series' : 'movie';
      } else if (
        urlLower.includes('/live/') ||
        urlLower.includes('/live.php') ||
        urlLower.includes('/hls/') ||
        urlLower.includes('.m3u8')
      ) {
        item.type = 'live';
      } else if (urlLower.includes('/play/') || urlLower.includes('/stream/')) {
        item.type = 'live';
      } else {
        item.type = deducedType;
      }
    }

    // Set generic logo flag based on counts
    item.isGenericLogo = !!(item.logo && counts[item.logo] > 5);
  }
  return rawItems;
}
