import { useState, useRef, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock3, Play, X, ChevronDown, Heart, Download } from 'lucide-react';
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
  const { t, language } = useSettings();
  const { downloads, addDownload, getDownloadByStreamUrl } = useDownloads();
  const [savedEpisodeUrls, setSavedEpisodeUrls] = useState<Set<string>>(() => new Set());
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

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 md:p-8 select-none animate-fade-in">
      <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }} tabIndex={0} role="button" className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-[85vh] max-h-[820px] bg-neutral-950 border border-white/10 rounded-[32px] overflow-hidden flex flex-col md:flex-row shadow-[0_32px_80px_rgba(0,0,0,0.85)] z-10 glass-modal-enter">
        <button type="button"
          onClick={onClose}
          className="absolute top-5 right-5 z-50 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white backdrop-blur-xl transition-all duration-300 hover:scale-105 shadow-lg cursor-pointer"
         aria-label="Close">
          <X size={16} />
        </button>
        <div className="w-full md:w-[38%] flex flex-col gap-4 p-5 md:p-6 border-b md:border-b-0 md:border-r border-white/5 bg-black/20 overflow-y-auto shrink-0 select-none hide-scrollbar">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)] group/poster border border-white/5 shrink-0 bg-white/[0.02]">
            {tmdbData?.backdrop || tmdbData?.poster ? (
              <img
                src={tmdbData.backdrop || tmdbData.poster}
                className="absolute inset-0 w-full h-full object-cover"
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent pointer-events-none" />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white leading-tight flex-1">
                {series.name}
              </h2>
              <button type="button"
                onClick={onToggleFavorite}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-all duration-300 active:scale-90 shrink-0 shadow-md cursor-pointer"
                title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
               aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}>
                <Heart size={18} fill={isFavorite ? "currentColor" : "none"} className={isFavorite ? "text-red-500" : ""} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-[11px] font-bold shrink-0">
            {tmdbData && (
              <>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-400/10 border border-emerald-300/20 text-emerald-300">{t('common.matchScore').replace('{{score}}', (tmdbData.match || '95').replace(/[^0-9]/g, ''))}</span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">{tmdbData.year}</span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">★ {tmdbData.rating.replace('★ ', '')}</span>
              </>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
              {language === 'tr'
                ? `${seasonsList.length} Sezon`
                : `${seasonsList.length} Season${seasonsList.length > 1 ? 's' : ''}`}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
              {language === 'tr'
                ? `${series.episodesCount} Bölüm`
                : `${series.episodesCount} Episode${series.episodesCount > 1 ? 's' : ''}`}
            </span>
            {series.group && (
              <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 text-[var(--accent-color)] uppercase tracking-wider">
                {series.group}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 bg-white/[0.02] border border-white/5 rounded-xl p-4 shrink-0">
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-neutral-500">{language === 'tr' ? 'Özet' : 'Overview'}</span>
            <p className="text-xs text-neutral-400 font-light leading-relaxed">
              {tmdbData?.desc || (language === 'tr' ? 'Bu dizi için özet bulunmuyor.' : 'No overview available for this series.')}
            </p>
          </div>
          {cast.length > 0 && (
            <div className="flex flex-col gap-2.5 bg-white/[0.02] border border-white/5 rounded-xl p-4 shrink-0">
              <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => setShowCastModal(true))(e as any); } }} tabIndex={0} role="button" 
                onClick={() => setShowCastModal(true)}
                className="flex items-center justify-between cursor-pointer group/cast-header select-none shrink-0"
              >
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-neutral-500 group-hover/cast-header:text-neutral-300 transition-colors">{language === 'tr' ? 'Oyuncular' : 'Cast'}</span>
                <span className="text-[9px] text-neutral-500 group-hover/cast-header:text-[var(--accent-color)] font-bold uppercase tracking-wider transition-colors flex items-center gap-1">
                  {language === 'tr' ? 'TÜMÜNÜ GÖR' : 'SEE ALL'}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              </div>
              <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => setShowCastModal(true))(e as any); } }} tabIndex={0} role="button" 
                onClick={() => setShowCastModal(true)}
                className="flex gap-3 overflow-x-auto pb-1.5 hide-scrollbar select-none cursor-pointer"
              >
                {cast.slice(0, 6).map((member, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0 w-14 text-center transition-transform hover:-translate-y-0.5 duration-200">
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/15 shadow-[0_6px_18px_rgba(0,0,0,0.38)]"
                    />
                    <span className="text-[8px] text-neutral-200 font-bold truncate w-full leading-tight" title={member.name}>
                      {member.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {firstEpisode && (
            <div className="flex flex-col gap-2 mt-auto shrink-0">
              {resumeEpisode ? (
                <button type="button"
                  onClick={() => playEpisode(resumeEpisode.item)}
                  className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all active:scale-[0.97] cursor-pointer"
                 aria-label="Play">
                  <Play size={13} fill="#000" /> {language === 'tr' ? 'İzlemeye Devam Et' : 'Resume Watching'}
                </button>
              ) : (
                <button type="button"
                  onClick={() => playEpisode(firstEpisode.item)}
                  className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all active:scale-[0.97] cursor-pointer"
                 aria-label="Play">
                  <Play size={13} fill="#000" /> {language === 'tr' ? 'İzlemeye Başla' : 'Start Watching'}
                </button>
              )}
              {resumeEpisode && (
                <span className="text-[10px] text-center text-neutral-500 font-medium">
                  {language === 'tr'
                    ? `Kaldığın yer: ${resumeEpisode.seasonNumber}. Sezon ${resumeEpisode.episodeNumber}. Bölüm`
                    : `Where you left off: Season ${resumeEpisode.seasonNumber} Episode ${resumeEpisode.episodeNumber}`}
                </span>
              )}
            </div>
          )}

        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-transparent select-none text-left">
          <div className="p-6 md:p-8 md:pr-20 pb-4 border-b border-white/[0.05] flex flex-col gap-3.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-white/40">{language === 'tr' ? 'Sezonlar' : 'Seasons'}</span>
              <span className="text-[10px] font-bold text-neutral-500">
                {language === 'tr'
                  ? `${seasonsList.length} Sezon Seçeneği`
                  : `${seasonsList.length} Season Option${seasonsList.length > 1 ? 's' : ''}`}
              </span>
            </div>
            {seasonsList.length >= 3 ? (
              <div className="relative" ref={dropdownRef}>
                <button type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full md:w-56 px-5 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 text-xs font-bold text-white flex items-center justify-between transition-all duration-300 shadow-md active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-glow)] animate-pulse" />
                    {language === 'tr' ? `${activeSeason}. Sezon` : `Season ${activeSeason}`}
                  </span>
                  <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-[100] left-0 mt-2 w-full md:w-64 max-h-64 overflow-y-auto bg-neutral-950/95 border border-white/15 rounded-2xl p-2.5 shadow-2xl backdrop-blur-2xl animate-scale-in hide-scrollbar">
                    <div className="grid grid-cols-2 gap-1.5 p-0.5">
                      {seasonsList.map(seasonNum => (
                        <button type="button"
                          key={`season-${seasonNum}`}
                          onClick={() => {
                            onSetActiveSeason(seasonNum);
                            onSetExpandedEpisodeId(null);
                            setIsDropdownOpen(false);
                          }}
                          className={`py-2 px-3 rounded-xl text-[11px] font-black transition-all duration-200 cursor-pointer text-center ${
                            activeSeason === seasonNum
                              ? 'bg-[var(--accent-color)] text-black font-black scale-102 shadow-md shadow-[var(--accent-glow)]'
                              : 'bg-white/[0.02] hover:bg-white/[0.06] text-neutral-400 hover:text-white border border-transparent hover:border-white/5'
                          }`}
                        >
                          {language === 'tr' ? `${seasonNum}. Sezon` : `Season ${seasonNum}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {seasonsList.map(seasonNum => (
                  <button type="button"
                    key={`season-${seasonNum}`}
                    onClick={() => {
                      onSetActiveSeason(seasonNum);
                      onSetExpandedEpisodeId(null);
                    }}
                    className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 shrink-0 border cursor-pointer ${
                      activeSeason === seasonNum
                        ? 'bg-white text-black border-white shadow-[0_4px_16px_rgba(255,255,255,0.1)] scale-102 font-black'
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/5 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {language === 'tr' ? `${seasonNum}. Sezon` : `Season ${seasonNum}`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto pr-3 pl-6 md:pr-4 md:pl-8 pt-4 pb-6 md:pb-8 min-h-0 custom-modal-scrollbar flex flex-col gap-4">

            <div className="flex items-center justify-between px-1 mb-1 shrink-0">
              <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-white/40">
                {language === 'tr' ? 'Bölüm Listesi' : 'Episode List'}
                <span className="ml-2 text-white/20">
                  {language === 'tr'
                    ? `${episodes.length} Bölüm`
                    : `${episodes.length} Episode${episodes.length > 1 ? 's' : ''}`}
                </span>
              </span>
              {(() => {
                const seasonDownloading = episodes.some(ep => getEpisodeSaveState(ep.item.url, ep.item.name).saving);
                const savedCount = episodes.filter(ep => getEpisodeSaveState(ep.item.url, ep.item.name).saved).length;
                const allSeasonSaved = episodes.length > 0 && savedCount === episodes.length;
                const missingCount = episodes.length - savedCount;
                return (
                  <button type="button"
                    onClick={async () => {
                      if (allSeasonSaved && onNavigateToDownloads) {
                        onNavigateToDownloads();
                        return;
                      }
                      // Queue only missing / failed episodes (eksikleri indir)
                      for (const ep of episodes) {
                        const saveState = getEpisodeSaveState(ep.item.url, ep.item.name);
                        if (!saveState.saved && !saveState.saving) {
                          await addDownload(ep.item);
                        }
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer active:scale-95 ${
                      allSeasonSaved
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : seasonDownloading
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                        : 'bg-white text-black hover:bg-neutral-200 shadow-lg shadow-white/10'
                    }`}
                    title={allSeasonSaved
                      ? (language === 'tr' ? 'Sezon Kaydedildi' : 'Season Saved')
                      : seasonDownloading
                      ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...')
                      : savedCount > 0
                        ? (language === 'tr' ? `Eksikleri indir (${missingCount})` : `Download missing (${missingCount})`)
                        : (language === 'tr' ? 'Sezonu Kaydet' : 'Save Season')
                    }
                    aria-label={allSeasonSaved
                      ? (language === 'tr' ? 'Sezon Kaydedildi' : 'Season Saved')
                      : seasonDownloading
                        ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...')
                        : savedCount > 0
                          ? (language === 'tr' ? `Eksikleri indir (${missingCount})` : `Download missing (${missingCount})`)
                          : (language === 'tr' ? 'Sezonu Kaydet' : 'Save Season')
                    }
                  >
                    {allSeasonSaved
                      ? <CheckCircle2 size={14} strokeWidth={2.5} />
                      : <Download size={14} strokeWidth={2.5} className={seasonDownloading ? 'animate-bounce' : ''} />}
                    <span className="text-[11px] font-black tracking-wide">
                      {allSeasonSaved
                        ? (language === 'tr' ? 'Sezon Kaydedildi' : 'Season Saved')
                        : seasonDownloading
                        ? (language === 'tr' ? `Kaydediliyor… ${savedCount}/${episodes.length}` : `Saving… ${savedCount}/${episodes.length}`)
                        : savedCount > 0
                          ? (language === 'tr' ? `Eksikleri indir (${missingCount})` : `Download missing (${missingCount})`)
                          : (language === 'tr' ? 'Sezonu Kaydet' : 'Save Season')
                      }
                    </span>
                  </button>
                );
              })()}
            </div>

            <div className="flex flex-col gap-3">
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
                const runtimeText = meta.runtime
                  ? `${meta.runtime} dk`
                  : (language === 'tr' ? 'HD Akış' : 'HD Stream');
                const progressText = progress !== undefined && progress > 0
                  ? `${Math.round(progress)}%`
                  : null;
                const saveState = getEpisodeSaveState(ep.item.url, ep.item.name);
                const episodeSaved = saveState.saved;
                const episodeSaving = saveState.saving;
                const saveProgress = saveState.progress;

                return (
                  <div
                    key={ep.item.id}
                    className={`rounded-2xl p-3 flex items-center justify-between gap-4 relative group border bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.055] hover:border-white/12 hover:shadow-[0_8px_25px_rgba(0,0,0,0.38)] transition-all duration-300 ${
                      isTarget ? 'border-white/20 bg-white/[0.06] shadow-md shadow-white/5' : ''
                    }`}
                  >
                    <div className="relative w-24 md:w-32 aspect-video rounded-xl overflow-hidden shrink-0 border border-white/5 shadow-inner transition-transform duration-300 group-hover:scale-[1.02]">
                      <EpisodeThumb
                        tmdbShowId={tmdbShowId}
                        seasonNumber={ep.seasonNumber}
                        episodeNumber={ep.episodeNumber}
                        fallbackPoster={tmdbData?.poster}
                        stillPath={meta.stillPath}
                      />
                      <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => playEpisode(ep.item))(e as any); } }} tabIndex={0} role="button"
                        onClick={() => playEpisode(ep.item)}
                        className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg">
                          <Play size={12} fill="#fff" className="text-white ml-0.5" />
                        </div>
                      </div>

                      {isWatched && (
                        <div className="absolute bottom-2 right-1 px-1.5 py-0.5 bg-white text-black font-black text-[7px] uppercase tracking-wider rounded z-20">
                          {language === 'tr' ? 'İzlendi' : 'Watched'}
                        </div>
                      )}
                      {progress !== undefined && progress > 0 && (
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-20">
                          <div 
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="block text-[10px] font-bold text-neutral-400">
                        {language === 'tr'
                          ? `${ep.seasonNumber}. Sezon • ${ep.episodeNumber}. Bölüm`
                          : `Season ${ep.seasonNumber} • Episode ${ep.episodeNumber}`}
                      </span>
                      <h4 className="text-xs font-black text-white truncate mt-0.5 group-hover:text-neutral-300 transition-colors">
                        {tmdbEpisodeName || cleanSubtitle || (language === 'tr' ? `${ep.episodeNumber}. Bölüm` : `Episode ${ep.episodeNumber}`)}
                      </h4>
                      <span className="block text-[9px] text-neutral-500 truncate mt-1 max-w-[92%]">
                        {epTitle}
                      </span>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] font-bold text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={10} />
                          {runtimeText}
                        </span>
                        {isWatched && (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle2 size={10} />
                            {language === 'tr' ? 'İzlendi' : 'Watched'}
                          </span>
                        )}
                        {progressText && !isWatched && (
                          <span className="text-white/70">{progressText}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (episodeSaved) {
                            // Offline play when already downloaded
                            playEpisode(ep.item);
                            return;
                          }
                          if (episodeSaving && onNavigateToDownloads) {
                            onNavigateToDownloads();
                            return;
                          }
                          await addDownload(ep.item);
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md cursor-pointer ${
                          episodeSaved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                            : episodeSaving
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30 animate-pulse'
                            : 'bg-white/10 hover:bg-white/20 text-neutral-400 hover:text-white border border-white/10'
                        }`}
                        title={episodeSaved
                          ? (language === 'tr' ? 'Çevrimdışı oynat' : 'Play offline')
                          : episodeSaving
                            ? (language === 'tr' ? 'Kaydedilenleri Yönet' : 'Manage Saved')
                            : (language === 'tr' ? 'Kaydet' : 'Save')}
                       aria-label={episodeSaved
                          ? (language === 'tr' ? 'Çevrimdışı oynat' : 'Play offline')
                          : episodeSaving
                            ? (language === 'tr' ? 'Kaydedilenleri Yönet' : 'Manage Saved')
                            : (language === 'tr' ? 'Kaydet' : 'Save')}>
                        {episodeSaved ? (
                          <Play size={13} fill="currentColor" className="ml-0.5" />
                        ) : episodeSaving ? (
                          <CircularSaveProgress progress={saveProgress} />
                        ) : (
                          <Download size={14} strokeWidth={2.5} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
 
        </div>
 
      </div>
      {showCastModal && (
        <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => setShowCastModal(false))(e as any); } }} tabIndex={0} role="button" 
          className="fixed inset-0 z-[4000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
          onClick={() => setShowCastModal(false)}
        >
          <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ((e) => e.stopPropagation())(e as any); } }} tabIndex={0} role="button" 
            className="w-full max-w-lg bg-neutral-950/90 border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-scale-in flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button"
              onClick={() => setShowCastModal(false)}
              className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
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
