import type { PlaylistItem } from './m3uParser';

export interface TmdbMetadata {
  posterUrl: string | null;
  backdropUrl?: string | null;
  /** Official TMDB title (preferred over raw playlist names like "TheBoys") */
  title?: string | null;
  rating: string;
  year: string;
  overview: string;
  genres: string[];
  duration: string;
}

export const globalVodMetadataMap = new Map<string, TmdbMetadata>();

export const TMDB_GENRES: Record<number, string> = {
  28: 'AKSİYON',
  12: 'MACERA',
  16: 'ANİMASYON',
  35: 'KOMEDİ',
  80: 'POLİSİYE',
  99: 'BELGESEL',
  18: 'DRAM',
  10751: 'AİLE',
  14: 'FANTASTİK',
  36: 'TARİH',
  27: 'KORKU',
  10402: 'MÜZİK',
  9648: 'GİZEM',
  10749: 'ROMANTİK',
  878: 'BİLİM-KURGU',
  10770: 'TV FİLMİ',
  53: 'GERİLİM',
  10752: 'SAVAŞ',
  37: 'VAHŞİ BATI',
  10759: 'AKSİYON & MACERA',
  10762: 'ÇOCUK',
  10763: 'HABER',
  10764: 'REALITY',
  10765: 'BİLİM-KURGU & FANTASTİK',
  10766: 'PEMBE DİZİ',
  10767: 'TALK SHOW',
  10768: 'SAVAŞ & POLİTİKA'
};

export const getFlatItem = (item: any): PlaylistItem => {
  if (item && item.seasons) {
    const seasonsKeys = Object.keys(item.seasons).map(Number).sort((a, b) => a - b);
    if (seasonsKeys.length > 0) {
      const episodes = item.seasons[seasonsKeys[0]];
      if (episodes && episodes.length > 0) {
        return episodes[0].item;
      }
    }
  }
  return item as PlaylistItem;
};

export const translateDuration = (durationStr: string, language: 'tr' | 'en'): string => {
  if (!durationStr) return '';
  if (language === 'tr') return durationStr;
  return durationStr
    .replace(/DİZİ/g, 'SERIES')
    .replace(/FİLM/g, 'MOVIE')
    .replace(/SEZON/g, 'SEASON')
    .replace(/SA/g, 'H')
    .replace(/DK/g, 'M');
};

export const getQualityLabel = (name: string): string | null => {
  const lower = name.toLowerCase();
  if (lower.includes('4k') || lower.includes('uhd')) return '4K';
  if (lower.includes('1080p') || lower.includes('fhd') || lower.includes('1080')) return 'FHD';
  if (lower.includes('720p') || lower.includes('hd') || lower.includes('720')) return 'HD';
  return null;
};
