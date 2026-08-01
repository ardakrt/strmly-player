import { preprocessPlaylistItems } from './searchHelpers';
import { fixTurkishEncoding } from './helpers';

export interface PlaylistItem {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  type: 'live' | 'movie' | 'series';
  xtreamStreamId?: string;
  xtreamSeriesId?: string;
  xtreamEpisodeId?: string;
  currentTime?: number;
  duration?: number;
  progress?: number;
  score?: number;
  nameLower?: string;
  groupLower?: string;
  clNameLower?: string;
  qualityRank?: number;
  isGenericLogo?: boolean;
}

export interface ParsedPlaylist {
  items: PlaylistItem[];
  groups: string[];
  revision?: string;
}

export function getPlaylistContentRevision(items: PlaylistItem[]): string {
  if (!items || items.length === 0) return '0';
  const sample = items.length > 500
    ? (items[0]?.id || '') + (items[250]?.id || '') + (items[items.length - 1]?.id || '') + items.length
    : items.map(i => i.id).join('-');
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function isSeriesName(name: string): boolean {
  const nameLower = name.toLowerCase();
  const seriesPatterns = [
    /[\s._-]s\s*\d+\s*e\s*\d+/i,
    /[\s._-]\d+x\d+/i,
    /[\s._-]se(?:zon|ason)[\s._-]*\d+/i,
    /[\s._-]\d+[\s._-]*se(?:zon|ason)/i,
    /[\s._-]bölüm[\s._-]*\d+/i,
    /[\s._-]ep(?:isode)?[\s._-]*\d+/i,
    /[\s._-]\d+[\s._-]*(?:bölüm|ep(?:isode)?)/i,
    /[\s._-]s(?:ezon|eason)?\s*\d+/i
  ];
  return seriesPatterns.some(regex => regex.test(nameLower));
}

export function parseM3U(content: string): ParsedPlaylist {
  const items: PlaylistItem[] = [];
  const groupsSet = new Set<string>();

  let pos = 0;
  let nextPos: number;
  let currentLogo = '';
  let currentGroup = 'Diğer';
  let currentName = '';
  let currentType: 'live' | 'movie' | 'series' = 'live';
  let extinfFound = false;

  const len = content.length;

  while (pos < len) {
    nextPos = content.indexOf('\n', pos);
    if (nextPos === -1) {
      nextPos = len;
    }
    
    const line = content.substring(pos, nextPos).trim();
    pos = nextPos + 1;
    
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      extinfFound = true;
      currentLogo = '';
      currentGroup = 'Diğer';
      currentName = '';

      const logoMatch = line.match(/\b(?:tvg-logo|logo|tvg-icon|icon)\s*=\s*["']([^"']+)["']/i);
      if (logoMatch) {
        currentLogo = logoMatch[1];
      }

      const groupMatch = line.match(/\bgroup-title\s*=\s*["']([^"']+)["']/i);
      if (groupMatch) {
        currentGroup = fixTurkishEncoding(groupMatch[1]);
      }
      groupsSet.add(currentGroup);

      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        currentName = fixTurkishEncoding(line.substring(commaIdx + 1).trim());
      } else {
        const nameIdx = line.indexOf('tvg-name="');
        if (nameIdx !== -1) {
          const start = line.indexOf('"', nameIdx) + 1;
          const end = line.indexOf('"', start);
          if (start > 0 && end > start) {
            currentName = fixTurkishEncoding(line.substring(start, end));
          }
        }
        if (!currentName) {
          currentName = 'Bilinmeyen Kanal';
        }
      }

      const groupLower = currentGroup.toLowerCase();
      if (groupLower.includes('movie') || groupLower.includes('sinema') || groupLower.includes('film')) {
        currentType = 'movie';
      } else if (groupLower.includes('series') || groupLower.includes('dizi')) {
        currentType = 'series';
      } else {
        currentType = 'live';
      }
    } else if (extinfFound && (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('rtmp://'))) {
      let finalType = currentType;
      const urlLower = line.toLowerCase();

      const vodExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.mpeg', '.mpg', '.m4v', '.webm', '.wmv'];
      const hasVodExtension = vodExtensions.some(ext => 
        urlLower.endsWith(ext) || 
        urlLower.includes(ext + '?') || 
        urlLower.includes(ext + '&') || 
        urlLower.includes('#' + ext) || 
        urlLower.includes('/' + ext)
      );

      const isVod = hasVodExtension || isSeriesName(currentName);

      if (urlLower.includes('/movie/')) {
        finalType = 'movie';
      } else if (urlLower.includes('/series/')) {
        finalType = 'series';
      } else if (isVod) {
        finalType = (currentType === 'series' || isSeriesName(currentName)) ? 'series' : 'movie';
      } else if (urlLower.includes('/live/') || urlLower.includes('/live.php') || 
                 urlLower.includes('/hls/') || urlLower.includes('.m3u8')) {
        finalType = 'live';
      } else if (urlLower.includes('/play/') || urlLower.includes('/stream/')) {
        finalType = 'live';
      }

      items.push({
        id: `item-${items.length}`,
        name: currentName || 'Bilinmeyen Kanal',
        logo: currentLogo,
        group: currentGroup,
        url: line,
        type: finalType
      });
      extinfFound = false;
    }
  }

  return {
    items,
    groups: Array.from(groupsSet).sort()
  };
}

export function parseM3UAsync(content: string | ArrayBuffer): Promise<ParsedPlaylist> {
  const parseOnMainThread = () => {
    const text = content instanceof ArrayBuffer
      ? new TextDecoder('utf-8').decode(content)
      : content;
    const result = parseM3U(text);
    result.items = preprocessPlaylistItems(result.items);
    return result;
  };

  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./m3uParser.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(parseOnMainThread());
      return;
    }
    
    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data.result);
      } else {
        try {
          resolve(parseOnMainThread());
        } catch {
          reject(new Error(e.data.error));
        }
      }
      worker.terminate();
    };

    worker.onerror = () => {
      try {
        resolve(parseOnMainThread());
      } catch (err) {
        reject(err);
      }
      worker.terminate();
    };

    if (content instanceof ArrayBuffer) {
      worker.postMessage(content, [content]);
    } else {
      worker.postMessage(content);
    }
  });
}
