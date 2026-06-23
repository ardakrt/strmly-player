import { preprocessPlaylistItems } from './searchHelpers';

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
}

export interface ParsedPlaylist {
  items: PlaylistItem[];
  groups: string[];
}

function isSeriesName(name: string): boolean {
  const nameLower = name.toLowerCase();
  // Season / Episode patterns: S01E02, 1x02, Sezon 1, Season 1, Bölüm 2, Episode 2, S01, E02, etc.
  // We allow space, dot, underscore or hyphen as separators before the pattern
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
      // Extract tvg-logo or logo or tvg-icon or icon using regex
      const logoMatch = line.match(/\b(?:tvg-logo|logo|tvg-icon|icon)\s*=\s*["']([^"']+)["']/i);
      if (logoMatch) {
        currentLogo = logoMatch[1];
      }

      // Extract group-title using regex
      const groupMatch = line.match(/\bgroup-title\s*=\s*["']([^"']+)["']/i);
      if (groupMatch) {
        currentGroup = groupMatch[1];
      }
      groupsSet.add(currentGroup);

      // Fast extraction of channel/stream name
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        currentName = line.substring(commaIdx + 1).trim();
      } else {
        const nameIdx = line.indexOf('tvg-name="');
        if (nameIdx !== -1) {
          const start = line.indexOf('"', nameIdx) + 1;
          const end = line.indexOf('"', start);
          if (start > 0 && end > start) {
            currentName = line.substring(start, end);
          }
        }
        if (!currentName) {
          currentName = 'Bilinmeyen Kanal';
        }
      }

      // Deduce type based on group name
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

      // Detect explicit VOD file extensions (which indicate this is a movie or series episode)
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
        // If it's VOD, default to series if the group is series OR name indicates series, otherwise movie
        finalType = (currentType === 'series' || isSeriesName(currentName)) ? 'series' : 'movie';
      } else if (urlLower.includes('/live/') || urlLower.includes('/live.php') || 
                 urlLower.includes('/hls/') || urlLower.includes('.m3u8')) {
        finalType = 'live';
      } else if (urlLower.includes('/play/') || urlLower.includes('/stream/')) {
        // Only classify generic play/stream endpoints as live if they do NOT have a VOD extension
        finalType = 'live';
      }

      items.push({
        id: `item-${items.length}`, // Fast unique ID
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

    try {
      worker.postMessage(content);
    } catch {
      worker.terminate();
      resolve(parseOnMainThread());
    }
  });
}
