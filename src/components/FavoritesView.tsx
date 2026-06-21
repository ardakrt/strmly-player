import React, { useState } from 'react';
import { Heart, Tv, Film } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { LiveChannelCard } from './LiveTvView';
import { MovieCard } from './MoviesView';
import { SeriesCard } from './SeriesView';
import { useSettings } from '../context/SettingsContext';

interface FavoritesViewProps {
  selectedGroup: string;
  favChannels: PlaylistItem[];
  favMovies: PlaylistItem[];
  favSeries: GroupedSeries[];
  handlePlayStream: (item: PlaylistItem) => void;
  handleOpenDetails: (item: PlaylistItem) => void;
  handleOpenSeriesModalDirect: (series: GroupedSeries) => void;
  toggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  globalFavorites: string[];
  genericLogosSet: Set<string>;
  checkedStatusMap: Record<string, 'online' | 'offline'>;
}

export function FavoritesView({
  selectedGroup,
  favChannels,
  favMovies,
  favSeries,
  handlePlayStream,
  handleOpenDetails,
  handleOpenSeriesModalDirect,
  toggleFavorite,
  globalFavorites,
  genericLogosSet,
  checkedStatusMap
}: FavoritesViewProps) {
  const { t, language } = useSettings();
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'movie' | 'series'>('all');

  if (selectedGroup !== 'Favorilerim') return null;

  const hasChannels = favChannels.length > 0;
  const hasMovies = favMovies.length > 0;
  const hasSeries = favSeries.length > 0;

  const tabs = [
    { id: 'all', label: language === 'tr' ? 'Tümü' : 'All', count: favChannels.length + favMovies.length + favSeries.length },
    { id: 'live', label: language === 'tr' ? 'Canlı TV' : 'Live TV', count: favChannels.length },
    { id: 'movie', label: language === 'tr' ? 'Sinema' : 'Movies', count: favMovies.length },
    { id: 'series', label: language === 'tr' ? 'Diziler' : 'Series', count: favSeries.length }
  ] as const;

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12 min-h-[calc(100vh-140px)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
            <Heart size={20} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">{t('home.myFavorites')}</h1>
            <p className="text-xs text-neutral-400 mt-0.5">{language === 'tr' ? 'Favoriye eklediğiniz tüm içerikler burada listelenir.' : 'All content you add to favorites is listed here.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-neutral-950/45 p-1 border border-white/5 rounded-2xl self-start md:self-auto shadow-lg">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-[var(--accent-color)] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                  activeTab === tab.id ? 'bg-black/15 text-black' : 'bg-white/10 text-neutral-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-8">
        {(activeTab === 'all' || activeTab === 'live') && hasChannels && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Tv size={16} className="text-neutral-400" />
              <h2 className="text-sm font-extrabold tracking-wider uppercase text-neutral-300">{language === 'tr' ? 'Canlı Kanallar' : 'Live Channels'}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {favChannels.map(channel => (
                <LiveChannelCard
                   key={channel.id}
                   channel={channel}
                   onClick={handlePlayStream}
                   isOnline={checkedStatusMap[channel.id]}
                   isFavorite={globalFavorites.includes(channel.id)}
                   onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </div>
        )}
        {(activeTab === 'all' || activeTab === 'movie') && hasMovies && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Film size={16} className="text-neutral-400" />
              <h2 className="text-sm font-extrabold tracking-wider uppercase text-neutral-300">{language === 'tr' ? 'Filmler' : 'Movies'}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {favMovies.map(movie => (
                <MovieCard
                   key={movie.id}
                   channel={movie}
                   onClick={handleOpenDetails}
                   isOnline={checkedStatusMap[movie.id]}
                   isFavorite={globalFavorites.includes(movie.id)}
                   onToggleFavorite={toggleFavorite}
                   isGenericLogo={movie.logo ? genericLogosSet.has(movie.logo) : false}
                />
              ))}
            </div>
          </div>
        )}
        {(activeTab === 'all' || activeTab === 'series') && hasSeries && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Tv size={16} className="text-neutral-400" />
              <h2 className="text-sm font-extrabold tracking-wider uppercase text-neutral-300">{language === 'tr' ? 'Diziler' : 'Series'}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {favSeries.map(series => (
                <SeriesCard
                   key={series.id}
                   series={series}
                   onClick={handleOpenSeriesModalDirect}
                   isFavorite={globalFavorites.includes(series.id)}
                   onToggleFavorite={toggleFavorite}
                   isGenericLogo={series.logo ? genericLogosSet.has(series.logo) : false}
                   seasonsCount={Object.keys(series.seasons).length}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
