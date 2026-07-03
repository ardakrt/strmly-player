import { useState, useEffect } from 'react';
import type { PlaylistItem } from '../types';
import { parseSeriesEpisodeInfo, getSeriesId } from '../utils/seriesGroupers';
import type { GroupedSeries, SeriesEpisode } from '../utils/seriesGroupers';
import {
  cleanMovieName,
  getResolvedTmdbResult,
  resolveTmdbImageSrc
} from '../utils/tmdb';
import { getMockDetails } from '../utils/helpers';

interface UseDetailModalProps {
  tmdbApiKey: string;
  items: PlaylistItem[];
  allGroupedSeries: GroupedSeries[];
  recentlyWatched: PlaylistItem[];
  buildXtreamSeriesGroup: (sourceItem: PlaylistItem | null, fallbackSeries?: GroupedSeries) => Promise<GroupedSeries | null>;
}

export function useDetailModal({
  tmdbApiKey,
  items,
  allGroupedSeries,
  recentlyWatched,
  buildXtreamSeriesGroup
}: UseDetailModalProps) {
  const [selectedChannelForModal, setSelectedChannelForModal] = useState<PlaylistItem | null>(null);
  const [selectedSeriesForModal, setSelectedSeriesForModal] = useState<GroupedSeries | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<string | null>(null);

  const [tmdbData, setTmdbData] = useState<{ id?: number; match: string; rating: string; year: string; desc: string; poster?: string; backdrop?: string } | null>(null);
  const [tmdbShowId, setTmdbShowId] = useState<number | null>(null);

  // Sync TMDB/Mock data cache on Detail Modal open
  useEffect(() => {
    const activeItem = selectedChannelForModal || selectedSeriesForModal;
    if (!activeItem) {
      setTmdbData(null);
      setTmdbShowId(null);
      return;
    }
    const isSeries = ('seasons' in activeItem) || activeItem.type === 'series';
    const cleanTitle = ('seasons' in activeItem)
      ? activeItem.name
      : (activeItem.type === 'series'
        ? parseSeriesEpisodeInfo(activeItem.name).cleanTitle
        : cleanMovieName(activeItem.name));
    const group = activeItem.group;

    const controller = new AbortController();
    const { signal } = controller;

    if (tmdbApiKey) {
      const endpoint = isSeries ? 'tv' : 'movie';
      getResolvedTmdbResult(endpoint, tmdbApiKey, cleanTitle, signal)
        .then(async (result) => {
          if (signal.aborted) return;
          if (result) {
            const rating = result.vote_average || 7.5;
            const posterPath = await resolveTmdbImageSrc(result.poster_path, 'w500', signal);
            const backdropPath = await resolveTmdbImageSrc(result.backdrop_path, 'original', signal);
            if (signal.aborted) return;
            setTmdbShowId(isSeries ? result.id : null);
            setTmdbData({
              id: result.id,
              match: `%${Math.floor(rating * 10) || 85} Eşleşme`,
              rating: `★ ${rating.toFixed(1)}`,
              year: isSeries
                ? (result.first_air_date?.split('-')[0] || '2026')
                : (result.release_date?.split('-')[0] || '2026'),
              desc: result.overview || getMockDetails(cleanTitle, group).desc,
              poster: posterPath || undefined,
              backdrop: backdropPath || undefined
            });
          } else {
            setTmdbShowId(null);
            setTmdbData({
              ...getMockDetails(cleanTitle, group),
              poster: undefined,
              backdrop: undefined
            });
          }
        })
        .catch((error) => {
          if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
          setTmdbShowId(null);
          setTmdbData({
            ...getMockDetails(cleanTitle, group),
            poster: undefined,
            backdrop: undefined
          });
        });
    } else {
      setTmdbData({
        ...getMockDetails(cleanTitle, group),
        poster: undefined,
        backdrop: undefined
      });
    }

    return () => {
      controller.abort();
    };
  }, [selectedChannelForModal, selectedSeriesForModal, tmdbApiKey]);

  // Open series modal with a pre-grouped series object
  const handleOpenSeriesModalDirect = async (series: GroupedSeries, targetEpisodeItem?: PlaylistItem) => {
    const firstSeason = Object.keys(series.seasons).map(Number).sort((a, b) => a - b)[0];
    const firstSeriesItem = targetEpisodeItem || (firstSeason ? series.seasons[firstSeason]?.[0]?.item : null);
    const xtreamGroup = await buildXtreamSeriesGroup(firstSeriesItem || null, series);
    if (xtreamGroup) {
      series = xtreamGroup;
      targetEpisodeItem = undefined;
    }

    setSelectedSeriesForModal(series);
    const seasons = Object.keys(series.seasons).map(Number).sort((a, b) => a - b);

    if (targetEpisodeItem) {
      const parsed = parseSeriesEpisodeInfo(targetEpisodeItem.name);
      setActiveSeason(parsed.season);
      setExpandedEpisodeId(targetEpisodeItem.id);
    } else if (seasons.length > 0) {
      setActiveSeason(seasons[0]);
      if (series.seasons[seasons[0]].length > 0) {
        setExpandedEpisodeId(series.seasons[seasons[0]][0].item.id);
      } else {
        setExpandedEpisodeId(null);
      }
    }
  };

  // Open series modal by dynamically grouping sibling episodes from the entire items list
  const handleOpenSeriesModalForFlatItem = async (item: PlaylistItem) => {
    const xtreamGroup = await buildXtreamSeriesGroup(item);
    if (xtreamGroup) {
      handleOpenSeriesModalDirect(xtreamGroup);
      return;
    }

    const parsed = parseSeriesEpisodeInfo(item.name);
    const seriesGroup = item.group || 'Genel';

    // Find all sibling series items that match clean title and category
    const siblings = items.filter(ch => {
      if (ch.type !== 'series') return false;
      const p = parseSeriesEpisodeInfo(ch.name);
      return p.cleanTitle === parsed.cleanTitle && (ch.group || 'Genel') === seriesGroup;
    });

    const seasonsMap: Record<number, SeriesEpisode[]> = {};
    let episodesCount = 0;

    for (const sib of siblings) {
      const p = parseSeriesEpisodeInfo(sib.name);
      if (!seasonsMap[p.season]) {
        seasonsMap[p.season] = [];
      }
      const exists = seasonsMap[p.season].some(ep => ep.episodeNumber === p.episode);
      if (!exists) {
        seasonsMap[p.season].push({
          episodeNumber: p.episode,
          seasonNumber: p.season,
          item: sib
        });
        episodesCount++;
      }
    }

    // Sort episodes in each season
    for (const seasonNo in seasonsMap) {
      seasonsMap[seasonNo].sort((a, b) => a.episodeNumber - b.episodeNumber);
    }

    const grouped: GroupedSeries = {
      id: getSeriesId(parsed.cleanTitle, seriesGroup),
      name: parsed.cleanTitle,
      logo: item.logo || (siblings.find(s => s.logo)?.logo || ''),
      group: seriesGroup,
      type: 'series',
      seasons: seasonsMap,
      episodesCount
    };

    handleOpenSeriesModalDirect(grouped, item);
  };

  const handleOpenDetails = async (item: PlaylistItem) => {
    const historyItem = recentlyWatched.find(x => x.id === item.id);
    const itemWithProgress = historyItem
      ? { ...item, currentTime: historyItem.currentTime, duration: historyItem.duration, progress: historyItem.progress }
      : item;

    if (item.type === 'series') {
      await handleOpenSeriesModalForFlatItem(itemWithProgress);
    } else {
      setSelectedChannelForModal(itemWithProgress);
    }
  };

  const getFavoriteIdForItem = (item: PlaylistItem | GroupedSeries): string => {
    if ('seasons' in item) return item.id;
    if (item.type !== 'series') return item.id;

    const parsed = parseSeriesEpisodeInfo(item.name);
    const grouped = allGroupedSeries.find(series =>
      series.name === parsed.cleanTitle &&
      (series.group || 'Genel') === (item.group || 'Genel')
    );
    return grouped?.id ?? item.id;
  };

  return {
    selectedChannelForModal,
    setSelectedChannelForModal,
    selectedSeriesForModal,
    setSelectedSeriesForModal,
    activeSeason,
    setActiveSeason,
    expandedEpisodeId,
    setExpandedEpisodeId,
    tmdbData,
    tmdbShowId,
    handleOpenSeriesModalDirect,
    handleOpenSeriesModalForFlatItem,
    handleOpenDetails,
    getFavoriteIdForItem
  };
}
