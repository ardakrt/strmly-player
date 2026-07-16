import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock3, Play, X, Heart, Download, Info } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { EpisodeThumb } from './EpisodeThumb';
import { cleanMediaTitle } from '../utils/seriesGroupers';
import { fetchTmdbPath, getTmdbApiKey, resolveTmdbImageSrc, tmdbCache, getTmdbLanguage } from '../utils/tmdb';
import type { GroupedSeries, SeriesEpisode } from '../utils/seriesGroupers';
import type { PlaylistItem } from '../utils/m3uParser';
import { useSettings } from '../context/SettingsContext';
import { useDownloads } from '../hooks/useDownloads';

interface TmdbData {
  id?: number;
  match: string;
  rating: string;
  year: string;
  desc: string;
  poster?: string;
  backdrop?: string;
  genres?: string[];
}

interface SeriesModalProps {
  series: GroupedSeries;
  tmdbData: TmdbData | null;
  tmdbShowId: number | null;
  activeSeason: number;
  expandedEpisodeId: string | null;
  recentlyWatched: PlaylistItem[];
  onClose: () => void;
  onPlay: (item: PlaylistItem) => void;
  onSetActiveSeason: (season: number) => void;
  onSetExpandedEpisodeId: (id: string | null) => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onNavigateToDownloads?: () => void;
}

interface CastMember {
  name: string;
  character: string;
  avatarUrl: string;
}

interface EpisodeMeta {
  stillPath?: string;
  runtime?: number;
  overview?: string;
  name?: string;
}

function CircularSaveProgress({ progress }: { progress: number }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Math.max(0, Math.min(100, progress || 0));
  const offset = circumference - (safeProgress / 100) * circumference;

  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-blue-400/20"
        />
        <circle
          cx="10"
          cy="10"
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-300 transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute text-[6px] font-black leading-none text-blue-100 tabular-nums">
        {safeProgress > 0 ? Math.round(safeProgress) : ''}
      </span>
    </span>
  );
}

export const SeriesModal = ({
  series,
  tmdbData,
  tmdbShowId,
  activeSeason,
  expandedEpisodeId,
  recentlyWatched,
  onClose,
  onPlay,
  onSetActiveSeason,
  onSetExpandedEpisodeId,
  isFavorite,
  onToggleFavorite,
  onNavigateToDownloads
}: SeriesModalProps) => {
  const { language } = useSettings();
  const { downloads, addDownload, getDownloadByStreamUrl } = useDownloads();
  const [savedEpisodeUrls, setSavedEpisodeUrls] = useState<Set<string>>(() => new Set());
  const [descExpanded, setDescExpanded] = useState(false);
  const seasonsList = Object.keys(series.seasons).map(Number).sort((a, b) => a - b);
  const episodes = useMemo(() => series.seasons[activeSeason] || [], [activeSeason, series.seasons]);
  const seriesCleanName = series.name.toLowerCase();

  useEffect(() => {
    let active = true;

    const checkSavedEpisodes = async () => {
      const savedUrls = new Set<string>();
      const needsDiskLookup: {
        key: string;
        type: 'series';
        name: string;
        streamUrl: string;
      }[] = [];

      for (const episode of episodes) {
        const knownDownload = getDownloadByStreamUrl(episode.item.url);
        if (knownDownload?.status === 'pending' || knownDownload?.status === 'downloading') {
          continue;
        }
        if (knownDownload?.status === 'completed') {
          savedUrls.add(episode.item.url);
          continue;
        }

        const matchingByName = downloads.find(
          d => d.type === 'series' && d.name.toLowerCase() === episode.item.name.toLowerCase()
        );
        if (matchingByName?.status === 'completed') {
          savedUrls.add(episode.item.url);
          continue;
        }

        needsDiskLookup.push({
          key: episode.item.url,
          type: 'series',
          name: episode.item.name,
          streamUrl: episode.item.url,
        });
      }

      if (needsDiskLookup.length > 0) {
        try {
          if (window.electronAPI?.getSavedMediaInfoBatch) {
            const batch = await window.electronAPI.getSavedMediaInfoBatch(needsDiskLookup);
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

      if (active) {
        setSavedEpisodeUrls(savedUrls);
      }
    };

    void checkSavedEpisodes();

    return () => {
      active = false;
    };
  }, [downloads, episodes, getDownloadByStreamUrl]);

  const playEpisode = (item: PlaylistItem) => {
    const known =
      getDownloadByStreamUrl(item.url) ||
      downloads.find(
        (d) => d.type === 'series' && d.name.toLowerCase() === item.name.toLowerCase(),
      );
    if (known?.status === 'completed' && known.playUrl) {
      onClose();
      onPlay({
        ...item,
        id: known.id,
        url: known.playUrl,
      });
      return;
    }
    onClose();
    onPlay(item);
  };

  const getEpisodeSaveState = (url: string, name?: string) => {
    let download = getDownloadByStreamUrl(url);
    if (!download && name) {
      download = downloads.find(
        d => d.type === 'series' && d.name.toLowerCase() === name.toLowerCase()
      );
    }

    if (download?.status === 'pending' || download?.status === 'downloading') {
      return {
        download,
        saved: false,
        saving: true,
        progress: download.status === 'downloading' ? download.progress : 0
      };
    }

    return {
      download,
      saved: download?.status === 'completed' || savedEpisodeUrls.has(url),
      saving: false,
      progress: 0
    };
  };

  const [episodeMeta, setEpisodeMeta] = useState<Record<number, EpisodeMeta>>({});
  
  const [cast, setCast] = useState<CastMember[]>([]);
  const [showCastModal, setShowCastModal] = useState(false);

  useEffect(() => {
    if (!tmdbShowId) {
      setEpisodeMeta({});
      return;
    }

    let cancelled = false;
    const apiKey = getTmdbApiKey();
    const path = `/3/tv/${tmdbShowId}/season/${activeSeason}?api_key=${apiKey}&language=${getTmdbLanguage()}`;

    fetchTmdbPath<{ episodes?: { episode_number: number; still_path?: string; runtime?: number; overview?: string; name?: string }[]; error?: string }>(path)
      .then((data) => {
        if (cancelled) return;
        const metaMap: Record<number, EpisodeMeta> = {};
        if (data && Array.isArray(data.episodes)) {
          data.episodes.forEach((ep) => {
            metaMap[ep.episode_number] = {
              stillPath: ep.still_path,
              runtime: ep.runtime,
              overview: ep.overview,
              name: ep.name
            };
          });
        }
        if (!cancelled) setEpisodeMeta(metaMap);
      })
      .catch((err) => {
        console.error("Failed to load tmdb season details:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbShowId, activeSeason]);

  useEffect(() => {
    const tmdbId = tmdbShowId || tmdbData?.id;
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
        
        let rawCast: any[] = [];
        if (window.electronAPI && window.electronAPI.fetchTmdb) {
          const res = await window.electronAPI.fetchTmdb(creditsPath) as any;
          if (res && Array.isArray(res.cast)) rawCast = res.cast;
        } else {
          const res = await fetch(`https://api.themoviedb.org${creditsPath}`);
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.cast)) rawCast = data.cast;
          }
        }

        const castWithPhotos = rawCast.filter(item => item.profile_path).slice(0, 18);
        const resolvedCast = await Promise.all(
          castWithPhotos.map(async (item) => {
            const avatarUrl = await resolveTmdbImageSrc(item.profile_path, 'w185');
            return {
              name: item.name,
              character: item.character,
              avatarUrl: avatarUrl || ''
            };
          })
        );

        const finalCast = resolvedCast.filter(item => item.avatarUrl);
        if (finalCast.length > 0) {
          await tmdbCache.set(cacheKey, finalCast);
        }

        if (!cancelled) setCast(finalCast);
      } catch (err) {
        console.error("Failed to load series cast:", err);
      }
    };

    loadCast();

    return () => {
      cancelled = true;
    };
  }, [tmdbShowId, tmdbData?.id]);

  // Akıllı Kaldığın Yerden Devam Et / Başla Mekanizması
  let resumeEpisode: SeriesEpisode | null = null;
  let bestHistoryIndex = -1;

  for (const sNum in series.seasons) {
    const sEps = series.seasons[sNum];
    for (const ep of sEps) {
      const idx = recentlyWatched.findIndex(x => x.id === ep.item.id);
      if (idx !== -1 && (bestHistoryIndex === -1 || idx < bestHistoryIndex)) {
        bestHistoryIndex = idx;
        resumeEpisode = ep;
      }
    }
  }

  const firstSeasonNum = seasonsList[0];
  const firstSeasonEpisodes = series.seasons[firstSeasonNum] || [];
  const firstEpisode = firstSeasonEpisodes[0] || null;

  // Playlist groups are noisy: "[TR] HBO MAX / PARAMOUNT+"
  const cleanedGroup = useMemo(() => {
    if (!series.group) return '';
    let s = String(series.group)
      .replace(/\[[^\]]*]/g, ' ')
      .replace(/\b(4k|uhd|fhd|hd|sd|1080p|720p|2160p|hdr|dv|atmos)\b/gi, ' ')
      .replace(/[|/\\]+/g, ' · ')
      .replace(/\s+/g, ' ')
      .trim();
    if (s.length > 32) s = `${s.slice(0, 30).trim()}…`;
    return s;
  }, [series.group]);

  const metaParts = useMemo(() => {
    const parts: { text: string; accent?: boolean }[] = [];
    if (tmdbData?.match) {
      const score = String(tmdbData.match).replace(/[^0-9]/g, '');
      if (score) {
        parts.push({
          text: language === 'tr' ? `%${score} Eşleşme` : `${score}% Match`,
          accent: true,
        });
      }
    }
    if (tmdbData?.year) parts.push({ text: tmdbData.year });
    if (tmdbData?.rating) {
      const rating = tmdbData.rating.replace('★ ', '').trim();
      if (rating) parts.push({ text: `★ ${rating}` });
    }
    parts.push({
      text: language === 'tr'
        ? `${seasonsList.length} Sezon`
        : `${seasonsList.length} Season${seasonsList.length > 1 ? 's' : ''}`,
    });
    return parts;
  }, [tmdbData, language, seasonsList.length]);

  const seasonWatchStats = useMemo(() => {
    let watched = 0;
    let inProgress = 0;
    for (const ep of episodes) {
      const h = recentlyWatched.find((x) => x.id === ep.item.id);
      if (!h) continue;
      const p = h.progress ?? 0;
      if (p >= 90) watched += 1;
      else if (p > 0) inProgress += 1;
    }
    return { watched, inProgress, total: episodes.length };
  }, [episodes, recentlyWatched]);

  useEffect(() => {
    setDescExpanded(false);
  }, [series.id, series.name]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 md:p-8 select-none animate-fade-in">
      <div
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
        tabIndex={0}
        role="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl"
        onClick={onClose}
      />

      <div className="series-modal-sheet relative z-10 flex h-[min(86vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] md:flex-row glass-modal-enter">
        <button
          type="button"
          onClick={onClose}
          className="series-icon-btn absolute top-3.5 right-3.5 z-50 cursor-pointer"
          aria-label={language === 'tr' ? 'Kapat' : 'Close'}
        >
          <X size={16} />
        </button>

        {/* Left — identity: hero + scrollable info + sticky play */}
        <aside className="series-modal-left series-modal-divider flex w-full shrink-0 flex-col overflow-hidden border-b md:w-[38%] md:border-b-0 md:border-r">
          <div className="relative aspect-video w-full shrink-0 bg-black/40">
            {tmdbData?.backdrop || tmdbData?.poster ? (
              <img
                src={tmdbData.backdrop || tmdbData.poster}
                className="absolute inset-0 h-full w-full object-cover"
                alt={series.name}
              />
            ) : (
              <ImageWithFallback
                src={series.logo}
                name={series.name}
                group={series.group}
                size="lg"
                itemType="series"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/15" />
            {tmdbData?.poster ? (
              <img
                src={tmdbData.poster}
                alt=""
                className="absolute bottom-3 left-3 h-[4.5rem] w-[3.15rem] rounded-lg object-cover shadow-[0_10px_28px_rgba(0,0,0,0.55)] ring-1 ring-white/15"
              />
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3 pt-4 hide-scrollbar">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-white">
                    {series.name}
                  </h2>
                  {cleanedGroup ? (
                    <p className="mt-1 truncate text-[11px] text-white/32">{cleanedGroup}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  className={`series-icon-btn shrink-0 cursor-pointer ${isFavorite ? 'text-red-400 hover:text-red-300' : ''}`}
                  title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
                  aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
                >
                  <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>

              {metaParts.length > 0 && (
                <p className="text-[11px] font-medium tracking-wide text-white/42">
                  {metaParts.map((part, i) => (
                    <span key={`${part.text}-${i}`}>
                      {i > 0 ? <span className="mx-1.5 text-white/15">·</span> : null}
                      <span className={part.accent ? 'text-emerald-400/90' : undefined}>{part.text}</span>
                    </span>
                  ))}
                </p>
              )}

              {tmdbData?.genres && tmdbData.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tmdbData.genres.slice(0, 4).map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-white/[0.07] bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-medium text-white/50"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {tmdbData?.desc ? (
                <div className="space-y-1.5">
                  <p className={`text-[12px] leading-relaxed text-white/48 ${descExpanded ? '' : 'line-clamp-3'}`}>
                    {tmdbData.desc}
                  </p>
                  {tmdbData.desc.length > 140 && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-white/40 transition-colors hover:text-white/70 cursor-pointer"
                    >
                      <Info size={12} className="opacity-70" />
                      {descExpanded
                        ? (language === 'tr' ? 'Daha az' : 'Show less')
                        : (language === 'tr' ? 'Daha fazla bilgi' : 'More info')}
                    </button>
                  )}
                </div>
              ) : null}

              {resumeEpisode && (
                <button
                  type="button"
                  onClick={() => playEpisode(resumeEpisode!.item)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07] cursor-pointer"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                    {language === 'tr' ? 'Kaldığın yer' : 'Continue watching'}
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-white/80">
                    S{resumeEpisode.seasonNumber} · B{resumeEpisode.episodeNumber}
                    {(() => {
                      const h = recentlyWatched.find((x) => x.id === resumeEpisode!.item.id);
                      const p = h?.progress;
                      return p && p > 0 && p < 95
                        ? ` · %${Math.round(p)}`
                        : '';
                    })()}
                  </p>
                </button>
              )}

              {cast.length > 0 && (
                <div className="space-y-2.5 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
                      {language === 'tr' ? 'Oyuncular' : 'Cast'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCastModal(true)}
                      className="text-[11px] font-medium text-white/30 transition-colors hover:text-white/55 cursor-pointer"
                    >
                      {language === 'tr' ? 'Tümü' : 'All'}
                    </button>
                  </div>
                  <div
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowCastModal(true); } }}
                    tabIndex={0}
                    role="button"
                    onClick={() => setShowCastModal(true)}
                    className="flex gap-3 overflow-x-auto pb-0.5 hide-scrollbar cursor-pointer select-none"
                  >
                    {cast.slice(0, 6).map((member, idx) => (
                      <div key={idx} className="flex w-[3.25rem] shrink-0 flex-col items-center gap-1.5" title={member.name}>
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="h-11 w-11 rounded-full object-cover ring-1 ring-white/12"
                        />
                        <span className="w-full truncate text-center text-[9px] font-medium leading-tight text-white/42">
                          {member.name.split(' ')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {firstEpisode && (
              <div className="series-modal-divider shrink-0 border-t border-white/[0.08] bg-black/30 px-5 py-3.5 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => playEpisode((resumeEpisode || firstEpisode).item)}
                  className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white text-[13px] font-semibold text-black transition-colors hover:bg-neutral-100 active:scale-[0.99]"
                  aria-label={language === 'tr' ? 'Oynat' : 'Play'}
                >
                  <Play size={14} fill="#000" className="ml-0.5" />
                  {resumeEpisode
                    ? (language === 'tr' ? 'İzlemeye Devam Et' : 'Resume')
                    : (language === 'tr' ? 'İzlemeye Başla' : 'Play')}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right — episodes */}
        <section className="series-modal-right flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="series-modal-divider shrink-0 space-y-3 border-b px-5 pb-3.5 pt-5 pr-14 md:px-6 md:pr-16">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white/65">
                  {language === 'tr'
                    ? `${activeSeason}. Sezon`
                    : `Season ${activeSeason}`}
                  <span className="font-normal text-white/28">
                    {' · '}
                    {language === 'tr' ? `${episodes.length} bölüm` : `${episodes.length} ep.`}
                  </span>
                </p>
                {seasonWatchStats.total > 0 && (seasonWatchStats.watched > 0 || seasonWatchStats.inProgress > 0) && (
                  <p className="mt-0.5 text-[11px] text-white/30">
                    {language === 'tr'
                      ? `${seasonWatchStats.watched}/${seasonWatchStats.total} izlendi${
                          seasonWatchStats.inProgress > 0 ? ` · ${seasonWatchStats.inProgress} devam` : ''
                        }`
                      : `${seasonWatchStats.watched}/${seasonWatchStats.total} watched${
                          seasonWatchStats.inProgress > 0 ? ` · ${seasonWatchStats.inProgress} in progress` : ''
                        }`}
                  </p>
                )}
              </div>
              {(() => {
                const seasonDownloading = episodes.some(ep => getEpisodeSaveState(ep.item.url, ep.item.name).saving);
                const savedCount = episodes.filter(ep => getEpisodeSaveState(ep.item.url, ep.item.name).saved).length;
                const allSeasonSaved = episodes.length > 0 && savedCount === episodes.length;
                const missingCount = episodes.length - savedCount;
                const label = allSeasonSaved
                  ? (language === 'tr' ? 'Sezon kaydedildi' : 'Season saved')
                  : seasonDownloading
                    ? (language === 'tr'
                      ? `Kaydediliyor ${savedCount}/${episodes.length}`
                      : `Saving ${savedCount}/${episodes.length}`)
                    : savedCount > 0
                      ? (language === 'tr'
                        ? `Kalan ${missingCount} bölümü indir`
                        : `Download ${missingCount} remaining`)
                      : (language === 'tr' ? 'Sezonu kaydet' : 'Save season');

                return (
                  <button type="button"
                    onClick={async () => {
                      if (allSeasonSaved && onNavigateToDownloads) {
                        onNavigateToDownloads();
                        return;
                      }
                      for (const ep of episodes) {
                        const saveState = getEpisodeSaveState(ep.item.url, ep.item.name);
                        if (!saveState.saved && !saveState.saving) {
                          await addDownload(ep.item);
                        }
                      }
                    }}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[12px] font-semibold transition-colors active:scale-[0.98] cursor-pointer ${
                      allSeasonSaved
                        ? 'border border-emerald-400/25 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20'
                        : seasonDownloading
                          ? 'border border-white/12 bg-white/10 text-white/80'
                          : 'border border-white bg-white text-black shadow-[0_4px_18px_rgba(255,255,255,0.12)] hover:bg-neutral-100'
                    }`}
                    aria-label={label}
                    title={label}
                  >
                    {allSeasonSaved
                      ? <CheckCircle2 size={14} strokeWidth={2.25} />
                      : <Download size={14} strokeWidth={2.25} className={seasonDownloading ? 'animate-pulse' : ''} />}
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })()}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar">
              {seasonsList.map(seasonNum => (
                <button type="button"
                  key={`season-${seasonNum}`}
                  onClick={() => {
                    onSetActiveSeason(seasonNum);
                    onSetExpandedEpisodeId(null);
                  }}
                  className={`series-season-chip cursor-pointer ${activeSeason === seasonNum ? 'is-active' : ''}`}
                >
                  {language === 'tr' ? `${seasonNum}. Sezon` : `Season ${seasonNum}`}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-2 md:px-3 py-1.5 min-h-0 custom-modal-scrollbar">
            <div className="flex flex-col">
              {episodes.map((ep) => {
                const epTitle = ep.item.name;
                const cleanedTitle = cleanMediaTitle(epTitle);
                const epSubtitle = cleanedTitle
                  ? cleanedTitle.replace(new RegExp(`^${seriesCleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim()
                  : '';
                const cleanSubtitle = (() => {
                  if (!epSubtitle) return '';
                  let clean = epSubtitle.trim();
                  clean = clean.replace(/^s\d+\s*e\d+\s*[:-]?\s*/i, '');
                  clean = clean.replace(/^(?:\d+\.?\s*(?:sezon|season|s\.?)\s*)?(?:\d+\.?\s*(?:bölüm|episode|ep?\.?))\s*[:-]?\s*/i, '');
                  clean = clean.replace(/^(?:(?:sezon|season|s)\s*\d+\s*)?(?:(?:bölüm|episode|ep)\s*\d+)\s*[:-]?\s*/i, '');
                  clean = clean.replace(/^[:-]\s*/, '');
                  return clean.trim();
                })();
                const historyItem = recentlyWatched.find(x => x.id === ep.item.id);
                const progress = historyItem?.progress;
                const isWatched = recentlyWatched.some(x => x.id === ep.item.id);
                const isTarget = expandedEpisodeId === ep.item.id;
                const meta = episodeMeta[ep.episodeNumber] || {};
                const tmdbEpisodeName = (() => {
                  if (!meta.name) return '';
                  const lower = meta.name.toLowerCase().trim();
                  const isGeneric =
                    /^(?:episode|bölüm|ep\.?|s\d+e\d+)\s*\d+$/i.test(lower) ||
                    /^[se]\d+$/i.test(lower) ||
                    lower === `episode ${ep.episodeNumber}` ||
                    lower === `bölüm ${ep.episodeNumber}` ||
                    lower === `${ep.episodeNumber}. bölüm` ||
                    lower === `${ep.episodeNumber}.bölüm`;
                  return isGeneric ? '' : meta.name;
                })();
                const displayTitle = tmdbEpisodeName || cleanSubtitle || (language === 'tr' ? `${ep.episodeNumber}. Bölüm` : `Episode ${ep.episodeNumber}`);
                const runtimeText = meta.runtime ? `${meta.runtime} dk` : null;
                const saveState = getEpisodeSaveState(ep.item.url, ep.item.name);
                const episodeSaved = saveState.saved;
                const episodeSaving = saveState.saving;
                const saveProgress = saveState.progress;
                const epOverview = meta.overview ? meta.overview.replace(/\s+/g, ' ').trim() : '';

                const fullyWatched = isWatched && (progress === undefined || progress >= 90);
                const hasProgress = progress !== undefined && progress > 0 && progress < 90;

                return (
                  <div
                    key={ep.item.id}
                    onClick={() => playEpisode(ep.item)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playEpisode(ep.item); } }}
                    tabIndex={0}
                    role="button"
                    className={`series-ep-row group flex items-center gap-3 px-2.5 py-2 cursor-pointer ${isTarget ? 'is-active' : ''}`}
                  >
                    <div className="series-ep-thumb relative w-[6.75rem] md:w-[8rem] aspect-video shrink-0">
                      <EpisodeThumb
                        tmdbShowId={tmdbShowId}
                        seasonNumber={ep.seasonNumber}
                        episodeNumber={ep.episodeNumber}
                        fallbackPoster={tmdbData?.poster}
                        stillPath={meta.stillPath}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/45 transition-colors">
                        <div className="w-7 h-7 rounded-full bg-white/90 text-black flex items-center justify-center shadow-md opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all">
                          <Play size={11} fill="#000" className="ml-0.5" />
                        </div>
                      </div>
                      {hasProgress && (
                        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/15 z-20">
                          <div className="h-full bg-white" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                      {fullyWatched && (
                        <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-black/55 border border-white/15 flex items-center justify-center">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-medium text-white/25 tabular-nums shrink-0 w-4">
                          {ep.episodeNumber}
                        </span>
                        <h4 className="text-[13px] font-medium text-white/88 truncate">
                          {displayTitle}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 pl-6 text-[11px] text-white/28">
                        {runtimeText ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={10} className="opacity-70" />
                            {runtimeText}
                          </span>
                        ) : null}
                        {fullyWatched ? (
                          <span className="text-emerald-400/70">{language === 'tr' ? 'İzlendi' : 'Watched'}</span>
                        ) : hasProgress ? (
                          <span className="text-white/45">
                            {language === 'tr' ? `Devam · %${Math.round(progress!)}` : `In progress · ${Math.round(progress!)}%`}
                          </span>
                        ) : null}
                      </div>
                      {epOverview ? (
                        <p className="mt-0.5 pl-6 text-[11px] text-white/30 line-clamp-1 leading-snug">
                          {epOverview}
                        </p>
                      ) : null}
                    </div>

                    <button type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (episodeSaved) {
                          playEpisode(ep.item);
                          return;
                        }
                        if (episodeSaving && onNavigateToDownloads) {
                          onNavigateToDownloads();
                          return;
                        }
                        await addDownload(ep.item);
                      }}
                      className={`series-icon-btn shrink-0 cursor-pointer ${
                        episodeSaved ? 'is-saved' : ''
                      }`}
                      title={episodeSaved
                        ? (language === 'tr' ? 'Çevrimdışı oynat' : 'Play offline')
                        : (language === 'tr' ? 'Kaydet' : 'Save')}
                      aria-label={episodeSaved
                        ? (language === 'tr' ? 'Çevrimdışı oynat' : 'Play offline')
                        : (language === 'tr' ? 'Kaydet' : 'Save')}
                    >
                      {episodeSaved ? (
                        <CheckCircle2 size={15} strokeWidth={2} color="#34d399" />
                      ) : episodeSaving ? (
                        <CircularSaveProgress progress={saveProgress} />
                      ) : (
                        <Download size={15} strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {showCastModal && (
        <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => setShowCastModal(false))(); } }} tabIndex={0} role="button" 
          className="fixed inset-0 z-[4000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
          onClick={() => setShowCastModal(false)}
        >
          <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ((e) => e.stopPropagation())(e as any); } }} tabIndex={0} role="button" 
            className="series-modal-sheet relative flex w-full max-w-lg flex-col gap-4 rounded-[22px] p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button"
              onClick={() => setShowCastModal(false)}
              className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              aria-label={language === 'tr' ? 'Kapat' : 'Close'}
            >
              ✕
            </button>

            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-neutral-500">{language === 'tr' ? 'Oyuncu Kadrosu' : 'Cast & Crew'}</span>
              <h3 className="text-lg font-black text-white mt-0.5 truncate max-w-[85%]">{series.name}</h3>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-2 max-h-[360px] overflow-y-auto pr-1.5 custom-modal-scrollbar">
              {cast.map((member, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-14 h-14 rounded-full object-cover border border-white/10 shadow-md"
                  />
                  <div className="flex flex-col w-full min-w-0">
                    <span className="text-[10px] text-white font-extrabold truncate w-full" title={member.name}>
                      {member.name}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-medium truncate w-full mt-0.5" title={member.character}>
                      {member.character}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
