import { fetchTmdbDetails, getTmdbLanguage, resolveTmdbImageSrc, resolveTmdbOverview } from '../utils/tmdb';
import { pickHeroSynopsis } from '../utils/helpers';
import type { FeaturedTmdbData } from './homeDataTypes';

export const createEmptyFeaturedMetadata = (): FeaturedTmdbData => ({
  match: '', rating: '', year: '', desc: '', backdrop: undefined, poster: undefined,
});

export async function buildFeaturedTmdbData({ endpoint, series, result, signal, tmdbApiKey, isTrUi }: {
  endpoint: 'tv' | 'movie';
  series: boolean;
  result: any;
  signal: AbortSignal;
  tmdbApiKey: string;
  isTrUi: boolean;
}): Promise<FeaturedTmdbData> {
  const backdropPath = await resolveTmdbImageSrc(result.backdrop_path || result.poster_path, 'original', signal);
  const posterPath = result.poster_path && result.poster_path !== result.backdrop_path ? await resolveTmdbImageSrc(result.poster_path, 'w500', signal) : undefined;
  let logoUrl: string | undefined;
  let duration: string | undefined;
  let genres: string[] = [];
  let detailsOverview: string | undefined;
  let detailsTagline: string | undefined;
  try {
    const details: any = await fetchTmdbDetails(endpoint, tmdbApiKey, result.id, signal);
    if (details && !details.error) {
      detailsOverview = details.overview;
      detailsTagline = typeof details.tagline === 'string' ? details.tagline : undefined;
      const logos = details.images?.logos;
      const bestLogo = logos?.find((logo: any) => logo.iso_639_1 === 'tr') || logos?.find((logo: any) => logo.iso_639_1 === 'en') || logos?.[0];
      if (bestLogo) logoUrl = await resolveTmdbImageSrc(bestLogo.file_path, 'w500', signal);
      if (details.genres) genres = details.genres.slice(0, 2).map((genre: any) => genre.name);
      if (series && details.number_of_seasons) duration = `${details.number_of_seasons} ${isTrUi ? 'Sezon' : 'Seasons'}`;
      else if (!series && details.runtime) {
        const hours = Math.floor(details.runtime / 60);
        const minutes = details.runtime % 60;
        duration = hours > 0 ? (minutes > 0 ? `${hours}sa ${minutes}dk` : `${hours}sa`) : `${minutes}dk`;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch TMDB featured details:', error);
  }
  const overview = await resolveTmdbOverview(endpoint, tmdbApiKey, result.id, [detailsOverview, result.overview], signal);
  let tagline = detailsTagline?.trim() || '';
  if (!tagline && getTmdbLanguage() !== 'en-US') {
    try {
      const englishDetails: any = await fetchTmdbDetails(endpoint, tmdbApiKey, result.id, signal, 'en-US');
      if (englishDetails && !englishDetails.error && typeof englishDetails.tagline === 'string') tagline = englishDetails.tagline.trim();
    } catch { /* optional */ }
  }
  return {
    match: '',
    rating: result.vote_average ? result.vote_average.toFixed(1) : '',
    year: series ? (result.first_air_date?.split('-')[0] || '') : (result.release_date?.split('-')[0] || ''),
    desc: pickHeroSynopsis({ tagline, overview, maxLen: 190 }),
    backdrop: backdropPath || posterPath || undefined,
    poster: posterPath || undefined,
    logo: logoUrl,
    duration,
    genres: genres.length > 0 ? genres : undefined,
  };
}
