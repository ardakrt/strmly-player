// Shared helpers for live TV channel cards and tiles.

// Helper to extract stream quality from channel names
export const getQualityBadge = (name: string): string | null => {
  const upper = name.toUpperCase();
  if (/\b(4K|UHD|ULTRA\s*HD)\b/.test(upper)) return '4K';
  if (/\b(1080P?|FHD|FULL\s*HD)\b/.test(upper)) return 'FHD';
  if (/\b(720P?|HD)\b/.test(upper)) return 'HD';
  if (/\b(SD|480P?|576P?)\b/.test(upper)) return 'SD';
  return null;
};

// Helper to clean resolution garbage from names for display
export const cleanChannelName = (name: string): string => {
  return name
    .replace(/\[\s*(4K|UHD|ULTRA\s*HD|FHD|FULL\s*HD|HD|SD|1080P?|720P?|576P?|480P?|50FPS|60FPS|HEVC|H265|RAW)\s*\]/gi, '')
    .replace(/\(\s*(4K|UHD|ULTRA\s*HD|FHD|FULL\s*HD|HD|SD|1080P?|720P?|576P?|480P?|50FPS|60FPS|HEVC|H265|RAW)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};
