import { useEffect, useState } from "react";
import type { DownloadItem } from "./downloads/downloadTypes";
import type { SeriesEpisode } from "../utils/seriesGroupers";
import {
  fetchTmdbPath,
  getTmdbApiKey,
  getTmdbLanguage,
  resolveTmdbImageSrc,
  tmdbCache,
} from "../utils/tmdb";
import type { SeriesCastMember } from "../components/series/SeriesModalParts";
import type { EpisodeMeta } from "../components/series/seriesModalHelpers";

interface UseSeriesModalDataOptions {
  episodes: SeriesEpisode[];
  downloads: DownloadItem[];
  getDownloadByStreamUrl: (url: string) => DownloadItem | undefined;
  tmdbShowId: number | null;
  tmdbDataId?: number;
  activeSeason: number;
}

export function useSeriesModalData({
  episodes,
  downloads,
  getDownloadByStreamUrl,
  tmdbShowId,
  tmdbDataId,
  activeSeason,
}: UseSeriesModalDataOptions) {
  const [savedEpisodeUrls, setSavedEpisodeUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const [episodeMeta, setEpisodeMeta] = useState<Record<number, EpisodeMeta>>({});
  const [cast, setCast] = useState<SeriesCastMember[]>([]);

  useEffect(() => {
    let active = true;

    const checkSavedEpisodes = async () => {
      const savedUrls = new Set<string>();
      const needsDiskLookup: {
        key: string;
        type: "series";
        name: string;
        streamUrl: string;
      }[] = [];

      for (const episode of episodes) {
        const knownDownload = getDownloadByStreamUrl(episode.item.url);
        if (
          knownDownload?.status === "pending" ||
          knownDownload?.status === "downloading"
        ) {
          continue;
        }
        if (knownDownload?.status === "completed") {
          savedUrls.add(episode.item.url);
          continue;
        }

        const matchingByName = downloads.find(
          (download) =>
            download.type === "series" &&
            download.name.toLowerCase() === episode.item.name.toLowerCase(),
        );
        if (matchingByName?.status === "completed") {
          savedUrls.add(episode.item.url);
          continue;
        }

        needsDiskLookup.push({
          key: episode.item.url,
          type: "series",
          name: episode.item.name,
          streamUrl: episode.item.url,
        });
      }

      if (needsDiskLookup.length > 0) {
        try {
          if (window.electronAPI?.getSavedMediaInfoBatch) {
            const batch = await window.electronAPI.getSavedMediaInfoBatch(
              needsDiskLookup,
            );
            for (const result of batch.results || []) {
              if (result.exists && result.key) savedUrls.add(result.key);
            }
          } else if (window.electronAPI?.getSavedMediaInfo) {
            for (const item of needsDiskLookup) {
              const savedMedia = await window.electronAPI.getSavedMediaInfo(item);
              if (savedMedia?.exists) savedUrls.add(item.key);
            }
          }
        } catch {
          // Older Electron builds may not expose batch/lookup handlers.
        }
      }

      if (active) setSavedEpisodeUrls(savedUrls);
    };

    void checkSavedEpisodes();
    return () => {
      active = false;
    };
  }, [downloads, episodes, getDownloadByStreamUrl]);

  useEffect(() => {
    if (!tmdbShowId) {
      setEpisodeMeta({});
      return;
    }

    let cancelled = false;
    const apiKey = getTmdbApiKey();
    const path = `/3/tv/${tmdbShowId}/season/${activeSeason}?api_key=${apiKey}&language=${getTmdbLanguage()}`;

    fetchTmdbPath<{
      error?: string;
      episodes?: {
        episode_number: number;
        still_path?: string;
        runtime?: number;
        overview?: string;
        name?: string;
      }[];
    }>(path)
      .then((data) => {
        if (cancelled) return;
        const metaMap: Record<number, EpisodeMeta> = {};
        if (Array.isArray(data?.episodes)) {
          data.episodes.forEach((episode) => {
            metaMap[episode.episode_number] = {
              stillPath: episode.still_path,
              runtime: episode.runtime,
              overview: episode.overview,
              name: episode.name,
            };
          });
        }
        if (!cancelled) setEpisodeMeta(metaMap);
      })
      .catch((error) => {
        console.error("Failed to load tmdb season details:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbShowId, activeSeason]);

  useEffect(() => {
    const tmdbId = tmdbShowId || tmdbDataId;
    if (!tmdbId) {
      setCast([]);
      return;
    }

    let cancelled = false;
    const cacheKey = `cast-tv-${tmdbId}`;

    const loadCast = async () => {
      try {
        const cached = await tmdbCache.get(cacheKey);
        if (cached && Array.isArray(cached)) {
          if (!cancelled) setCast(cached);
          return;
        }

        const apiKey = getTmdbApiKey();
        const creditsPath = `/3/tv/${tmdbId}/credits?api_key=${apiKey}&language=${getTmdbLanguage()}`;
        interface TmdbCastMember {
          name: string;
          character?: string;
          profile_path?: string | null;
        }
        let rawCast: TmdbCastMember[] = [];
        if (window.electronAPI?.fetchTmdb) {
          const response = (await window.electronAPI.fetchTmdb(creditsPath)) as {
            cast?: TmdbCastMember[];
          };
          if (Array.isArray(response?.cast)) rawCast = response.cast;
        } else {
          const response = await fetch(`https://api.themoviedb.org${creditsPath}`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data?.cast)) rawCast = data.cast;
          }
        }

        const castWithPhotos = rawCast
          .filter((item) => item.profile_path)
          .slice(0, 18);
        const resolvedCast = await Promise.all(
          castWithPhotos.map(async (item) => ({
            name: item.name,
            character: item.character || "",
            avatarUrl:
              (await resolveTmdbImageSrc(item.profile_path, "w185")) || "",
          })),
        );
        const finalCast = resolvedCast.filter((item) => item.avatarUrl);
        if (finalCast.length > 0) await tmdbCache.set(cacheKey, finalCast);
        if (!cancelled) setCast(finalCast);
      } catch (error) {
        console.error("Failed to load series cast:", error);
      }
    };

    void loadCast();
    return () => {
      cancelled = true;
    };
  }, [tmdbShowId, tmdbDataId]);

  return { savedEpisodeUrls, episodeMeta, cast };
}
