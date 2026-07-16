import { cleanMediaTitle, parseSeriesEpisodeInfo } from './seriesGroupers';
import type { PlaylistItem } from './m3uParser';

/**
 * Bulletproof labels for continue-watching / cards.
 * Never returns empty strings — raw playlist name is the last resort.
 */
export function getMediaCardLabels(
  item: Pick<PlaylistItem, 'name' | 'type' | 'group'>,
  language: string = 'tr',
): {
  /** Short title shown on the card */
  title: string;
  /** Season/episode or group line */
  subtitle: string;
  /** Best string to search TMDB with */
  searchTitle: string;
} {
  const raw = String(item?.name || '').trim() || 'İsimsiz';
  const type = item?.type;

  if (type === 'series') {
    const parsed = parseSeriesEpisodeInfo(raw);
    const cleaned = (parsed.cleanTitle || '').trim();
    // Prefer cleaned series name; if cleaner wiped it, keep raw
    const title = cleaned || raw;
    const subtitle =
      parsed.season > 0 && parsed.episode > 0
        ? language === 'tr'
          ? `${parsed.season}. Sezon · ${parsed.episode}. Bölüm`
          : `S${parsed.season} · E${parsed.episode}`
        : '';
    return {
      title,
      subtitle,
      searchTitle: cleaned || raw,
    };
  }

  if (type === 'movie') {
    const cleaned = cleanMediaTitle(raw).trim();
    return {
      title: cleaned || raw,
      subtitle: String(item.group || '').trim(),
      searchTitle: cleaned || raw,
    };
  }

  const cleaned = cleanMediaTitle(raw).trim();
  return {
    title: cleaned || raw,
    subtitle: String(item.group || '').trim(),
    searchTitle: cleaned || raw,
  };
}
