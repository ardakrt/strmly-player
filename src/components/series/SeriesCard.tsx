import React, { useState, useEffect } from 'react';
import { Play, Download, Star, Heart } from 'lucide-react';
import type { GroupedSeries } from '../../utils/seriesGroupers';
import { ImageWithFallback } from '../ImageWithFallback';
import { useSettings } from '../../context/SettingsContext';
import { cleanMovieName, getCachedTmdbResult, getSyncTmdbResult } from '../../utils/tmdb';
import { getQualityLabel } from './seriesPlatforms';

export interface SeriesCardProps {
  series: GroupedSeries;
  onClick: (series: GroupedSeries) => void;
  isFavorite: boolean;
  isDownloading?: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  onDownload?: (series: GroupedSeries) => void;
  isGenericLogo: boolean;
  seasonsCount: number;
  onContextMenu?: (event: React.MouseEvent, series: GroupedSeries) => void;
}

export const SeriesCard = React.memo(({
  series,
  onClick,
  isFavorite,
  isDownloading = false,
  onToggleFavorite,
  onDownload,
  isGenericLogo,
  seasonsCount,
  onContextMenu,
}: SeriesCardProps) => {
  const { language } = useSettings();
  const [rating, setRating] = useState<number | null>(() => getSyncTmdbResult('tv', series.name)?.vote_average || null);

  useEffect(() => {
    let active = true;
    getCachedTmdbResult('tv', series.name).then((res) => {
      if (active && res && res.vote_average) setRating(res.vote_average);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [series.name]);

  const quality = getQualityLabel(series.name);

  return (
    <div
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(series); } }}
      role="button"
      tabIndex={0}
      onClick={() => onClick(series)}
      onContextMenu={(event) => onContextMenu?.(event, series)}
      className="group flex flex-col gap-2 cursor-pointer relative  w-full"
    >
      <div className="premium-card aspect-[2/3] flex items-center justify-center relative">
        <ImageWithFallback
          src={series.logo}
          name={series.name}
          group={series.group || 'SERIES'}
          itemType="series"
          isGenericLogo={isGenericLogo}
          aspect="portrait"
          blurUp
        />

        {/* Rating badge */}
        {rating !== null && rating > 0 && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-black/85 px-1.5 py-0.5 text-[9px] font-black text-amber-400 shadow-md">
            <Star size={8.5} fill="currentColor" />
            <span>{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Seasons + quality badge */}
        <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/85 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-white/85 shadow-md">
          <span>{seasonsCount} S • {series.episodesCount} {language === 'tr' ? 'Bölüm' : 'Ep'}</span>
          {quality && <span className="rounded bg-white/15 px-1 text-[7.5px] font-black text-white">{quality}</span>}
        </div>

        {/* Hover overlay: play + download */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 scale-90 items-center justify-center rounded-full border border-white/20 bg-white text-black shadow-2xl transition-all duration-300 group-hover:scale-100">
              <Play size={15} fill="#000" className="ml-0.5" />
            </div>
            {onDownload && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (!isDownloading) onDownload(series); }}
                className={`flex h-10 w-10 scale-90 items-center justify-center rounded-full border shadow-2xl transition-all duration-300 group-hover:scale-100 cursor-pointer ${
                  isDownloading
                    ? 'border-blue-400/30 bg-blue-500/80 text-white animate-pulse'
                    : 'border-white/20 bg-white/90 text-black hover:bg-white'
                }`}
                title={isDownloading ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}
                aria-label={isDownloading ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}
              >
                <Download size={15} className={isDownloading ? 'animate-bounce' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Favorite */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(series.id, e); }}
          className={`absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/70 text-neutral-300 transition-all hover:scale-110 hover:text-red-500 cursor-pointer ${
            isFavorite ? 'opacity-100 text-red-500 border-red-500/20' : 'opacity-0 group-hover:opacity-100'
          }`}
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
          aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
        >
          <Heart size={11} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>

      <div className="flex flex-col px-1">
        <span className="premium-card-title truncate text-xs font-bold" title={series.name}>
          {cleanMovieName(series.name)}
        </span>
      </div>
    </div>
  );
});
