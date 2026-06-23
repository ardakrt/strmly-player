import type { PlaylistItem } from './m3uParser';
import { cleanMediaTitle } from './seriesGroupers';

export interface SearchableMediaItem {
  name: string;
  group?: string;
  nameLower?: string;
  groupLower?: string;
  clNameLower?: string;
}

const excludedCatalogMarkers = ['seÃ§izle', 'seÃ§ izle', 'secizle', 'sec izle', 'seÃ§-izle', 'sec-izle'];
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

export function getItemSearchScore(item: SearchableMediaItem, query: string, fallbackGroup = 'Genel'): number {
  const cleanNameLower = getItemCleanNameLower(item);
  return getSearchScore(
    item.name,
    item.group || fallbackGroup,
    query,
    cleanNameLower,
    getItemNameLower(item),
    getItemGroupLower(item, fallbackGroup),
    cleanNameLower
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
  clNameLower?: string
): number {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return 0;

  const nLower = nameLower || name.toLocaleLowerCase('tr-TR');
  const gLower = groupLower || group.toLocaleLowerCase('tr-TR');
  const clLower = clNameLower || (cleanedName || cleanMediaTitle(name)).toLocaleLowerCase('tr-TR');

  // 1. Exact match on clean name
  if (clLower === q) return 100;

  // 2. Exact match on raw name
  if (nLower === q) return 95;

  // 3. Clean name starts with query
  if (clLower.startsWith(q)) return 80;

  // 4. Raw name starts with query
  if (nLower.startsWith(q)) return 75;

  // 5. Clean name contains query
  if (clLower.includes(q)) return 60;

  // 6. Raw name contains query
  if (nLower.includes(q)) return 55;

  // 7. Group name matches exact
  if (gLower === q) return 30;

  // 8. Group name contains query
  if (gLower.includes(q)) return 20;

  return 0;
}

// Helper to determine media quality rank from its name
export function getQualityRank(name: string, nameLower?: string): number {
  const n = nameLower || name.toLocaleLowerCase('tr-TR');
  if (n.includes('4k') || n.includes('uhd') || n.includes('2160p') || n.includes('2160')) return 4;
  if (n.includes('1080') || n.includes('fhd') || n.includes('1080p')) return 3;
  if (n.includes('720') || n.includes('hd') || n.includes('720p')) return 2;
  return 1;
}

// Check if a channel name indicates HD/UHD quality (used for "Ulusal" category filtering)
export function isHdChannel(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('hd') || n.includes('fhd') || n.includes('uhd') || n.includes('4k') || n.includes('1080');
}

function isSeriesName(name: string): boolean {
  const nameLower = name.toLowerCase();
  const seriesPatterns = [
    /[\s._-]s\s*\d+\s*e\s*\d+/i, // S01E02, .S01E02, _S01E02
    /[\s._-]\d+x\d+/i, // 1x02
    /[\s._-]se(?:zon|ason)[\s._-]*\d+/i, // Sezon 1 / Season 1
    /[\s._-]\d+[\s._-]*se(?:zon|ason)/i, // 1. Sezon / 1.Season
    /[\s._-]bölüm[\s._-]*\d+/i, // Bölüm 2
    /[\s._-]ep(?:isode)?[\s._-]*\d+/i, // Episode 2
    /[\s._-]\d+[\s._-]*(?:bölüm|ep(?:isode)?)/i, // 2. Bölüm
    /[\s._-]s(?:ezon|eason)?\s*\d+/i // S01
  ];
  return seriesPatterns.some(regex => regex.test(nameLower));
}

// Pre-process playlist items for fast O(1) searches
export function preprocessPlaylistItems(rawItems: PlaylistItem[]): PlaylistItem[] {
  const vodExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.mpeg', '.mpg', '.m4v', '.webm', '.wmv'];

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
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

      const hasVodExtension = vodExtensions.some(ext => 
        urlLower.endsWith(ext) || 
        urlLower.includes(ext + '?') || 
        urlLower.includes(ext + '&') || 
        urlLower.includes('#' + ext) || 
        urlLower.includes('/' + ext)
      );

      const isVod = hasVodExtension || isSeriesName(item.name);

      if (urlLower.includes('/movie/')) {
        item.type = 'movie';
      } else if (urlLower.includes('/series/')) {
        item.type = 'series';
      } else if (isVod) {
        item.type = (deducedType === 'series' || isSeriesName(item.name)) ? 'series' : 'movie';
      } else if (urlLower.includes('/live/') || urlLower.includes('/live.php') || 
                 urlLower.includes('/hls/') || urlLower.includes('.m3u8')) {
        item.type = 'live';
      } else if (urlLower.includes('/play/') || urlLower.includes('/stream/')) {
        item.type = 'live';
      } else {
        item.type = deducedType;
      }
    }
  }
  return rawItems;
}

export function getStableMatchPercentage(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const score = 85 + (Math.abs(hash) % 15);
  return `${score}% Eşleşme`;
}
