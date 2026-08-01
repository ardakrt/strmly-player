/* Hallmark · macrostructure: Workbench · genre: atmospheric · theme: Midnight (runtime accent) — app-locked
 * pre-emit critique: P5 H4 E5 S5 R5 V5
 * stamp: FavoritesView from scratch — quiet header, underline filter tabs, unified responsive grids
 */
import React, { useState, useMemo } from 'react';
import { Heart, Tv, Film, Clapperboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { LiveChannelCard } from './LiveTvView';
import { MovieCard } from './MoviesView';
import { SeriesCard } from './SeriesView';
import { SegmentedControl } from './SegmentedControl';
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
  checkedStatusMap: Record<string, 'online' | 'offline'>;
}

type FavoritesTab = 'all' | 'live' | 'movie' | 'series';

function FavoritesSectionHead({
  icon: Icon,
  label,
  count
}: {
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={14} className="text-neutral-500" aria-hidden="true" />
      <h2 className="text-[13px] font-bold text-white/90">{label}</h2>
      <span className="text-[11px] font-semibold text-neutral-500 tabular-nums">{count}</span>
      <span className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
    </div>
  );
}

function FavoritesTypeEmpty({
  icon: Icon,
  title,
  hint
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.09] py-14 px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-neutral-500">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-300">{title}</p>
        <p className="text-xs text-neutral-500">{hint}</p>
      </div>
    </div>
  );
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
  checkedStatusMap
}: FavoritesViewProps) {
  const { t, language } = useSettings();
  const [activeTab, setActiveTab] = useState<FavoritesTab>('all');
  const favoritesSet = useMemo(() => new Set(globalFavorites), [globalFavorites]);

  if (selectedGroup !== 'Favorilerim') return null;

  const hasChannels = favChannels.length > 0;
  const hasMovies = favMovies.length > 0;
  const hasSeries = favSeries.length > 0;
  const total = favChannels.length + favMovies.length + favSeries.length;

  const tabs = [
    { id: 'all', label: language === 'tr' ? 'Tümü' : 'All', count: total },
    { id: 'live', label: language === 'tr' ? 'Canlı TV' : 'Live TV', count: favChannels.length },
    { id: 'movie', label: language === 'tr' ? 'Sinema' : 'Movies', count: favMovies.length },
    { id: 'series', label: language === 'tr' ? 'Diziler' : 'Series', count: favSeries.length }
  ] as const;

  const typeEmpty = {
    live: {
      title: language === 'tr' ? 'Henüz favori kanal eklemedin' : 'No favorite channels yet',
      hint: language === 'tr'
        ? 'Kartlardaki kalp simgesiyle favori kanallarınızı buraya ekleyin.'
        : 'Tap the heart on any channel card to add it here.'
    },
    movie: {
      title: language === 'tr' ? 'Henüz favori film eklemedin' : 'No favorite movies yet',
      hint: language === 'tr'
        ? 'Film kartlarındaki kalp simgesiyle favorilerinize ekleyebilirsiniz.'
        : 'Tap the heart on any movie card to add it here.'
    },
    series: {
      title: language === 'tr' ? 'Henüz favori dizi eklemedin' : 'No favorite series yet',
      hint: language === 'tr'
        ? 'Dizi kartlarındaki kalp simgesiyle favorilerinize ekleyebilirsiniz.'
        : 'Tap the heart on any series card to add it here.'
    }
  } as const;

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col gap-7 pb-12 animate-fade-in">
      <header className="flex flex-col gap-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-red-400/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <Heart size={18} fill="currentColor" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-[26px] leading-none font-bold tracking-tight text-white md:text-[30px]">
              {t('home.myFavorites')}
            </h1>
            <p className="mt-1.5 text-[13px] text-neutral-400">
              {language === 'tr'
                ? 'Favoriye eklediğiniz tüm içerikler burada listelenir.'
                : 'All content you add to favorites is listed here.'}
            </p>
          </div>
        </div>

        <div className="hide-scrollbar overflow-x-auto">
          <SegmentedControl
            ariaLabel={language === 'tr' ? 'Favori türü filtresi' : 'Favorite type filter'}
            value={activeTab}
            onChange={setActiveTab}
            items={tabs.map(tab => ({
              id: tab.id,
              label: tab.label,
              badge: tab.count > 0 ? tab.count : undefined
            }))}
          />
        </div>
      </header>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-16 text-center">
          <p className="text-sm font-semibold text-neutral-300">
            {language === 'tr' ? 'Sonuç bulunamadı' : 'No results found'}
          </p>
          <p className="text-xs text-neutral-500">
            {language === 'tr' ? 'Farklı bir arama veya filtre deneyin.' : 'Try a different search or filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-9">
          {(activeTab === 'all' || activeTab === 'live') && (
            hasChannels ? (
              <section className="flex flex-col gap-3">
                <FavoritesSectionHead
                  icon={Tv}
                  label={language === 'tr' ? 'Canlı Kanallar' : 'Live Channels'}
                  count={favChannels.length}
                />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {favChannels.map(channel => (
                    <LiveChannelCard
                      key={channel.id}
                      channel={channel}
                      onClick={handlePlayStream}
                      isOnline={checkedStatusMap[channel.id]}
                      isFavorite={favoritesSet.has(channel.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </section>
            ) : activeTab === 'live' ? (
              <FavoritesTypeEmpty icon={Tv} title={typeEmpty.live.title} hint={typeEmpty.live.hint} />
            ) : null
          )}

          {(activeTab === 'all' || activeTab === 'movie') && (
            hasMovies ? (
              <section className="flex flex-col gap-3">
                <FavoritesSectionHead
                  icon={Film}
                  label={language === 'tr' ? 'Filmler' : 'Movies'}
                  count={favMovies.length}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                  {favMovies.map(movie => (
                    <MovieCard
                      key={movie.id}
                      channel={movie}
                      onClick={handleOpenDetails}
                      isOnline={checkedStatusMap[movie.id]}
                      isFavorite={favoritesSet.has(movie.id)}
                      onToggleFavorite={toggleFavorite}
                      isGenericLogo={!!movie.isGenericLogo}
                    />
                  ))}
                </div>
              </section>
            ) : activeTab === 'movie' ? (
              <FavoritesTypeEmpty icon={Film} title={typeEmpty.movie.title} hint={typeEmpty.movie.hint} />
            ) : null
          )}

          {(activeTab === 'all' || activeTab === 'series') && (
            hasSeries ? (
              <section className="flex flex-col gap-3">
                <FavoritesSectionHead
                  icon={Clapperboard}
                  label={language === 'tr' ? 'Diziler' : 'Series'}
                  count={favSeries.length}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                  {favSeries.map(series => (
                    <SeriesCard
                      key={series.id}
                      series={series}
                      onClick={handleOpenSeriesModalDirect}
                      isFavorite={favoritesSet.has(series.id)}
                      onToggleFavorite={toggleFavorite}
                      isGenericLogo={!!series.isGenericLogo}
                      seasonsCount={Object.keys(series.seasons).length}
                    />
                  ))}
                </div>
              </section>
            ) : activeTab === 'series' ? (
              <FavoritesTypeEmpty icon={Clapperboard} title={typeEmpty.series.title} hint={typeEmpty.series.hint} />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
