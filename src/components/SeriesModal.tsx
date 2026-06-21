import { useState, useRef, useEffect } from 'react';
import { Play, X, ChevronDown, Heart } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { EpisodeThumb } from './EpisodeThumb';
import { cleanMediaTitle } from '../utils/seriesGroupers';
import { fetchTmdbPath, getTmdbApiKey, resolveTmdbImageSrc, tmdbCache, getTmdbLanguage } from '../utils/tmdb';
import type { GroupedSeries, SeriesEpisode } from '../utils/seriesGroupers';
import type { PlaylistItem } from '../utils/m3uParser';
import { useSettings } from '../context/SettingsContext';

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
}

interface CastMember {
  name: string;
  character: string;
  avatarUrl: string;
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
  onToggleFavorite
}: SeriesModalProps) => {
  const { language } = useSettings();
  const seasonsList = Object.keys(series.seasons).map(Number).sort((a, b) => a - b);
  const episodes = series.seasons[activeSeason] || [];
  const seriesCleanName = series.name.toLowerCase();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [episodeStills, setEpisodeStills] = useState<Record<number, string>>({});
  
  const [cast, setCast] = useState<CastMember[]>([]);
  const [showCastModal, setShowCastModal] = useState(false);

  useEffect(() => {
    if (!tmdbShowId) {
      setEpisodeStills({});
      return;
    }

    let cancelled = false;
    const apiKey = getTmdbApiKey();
    const path = `/3/tv/${tmdbShowId}/season/${activeSeason}?api_key=${apiKey}&language=${getTmdbLanguage()}`;

    fetchTmdbPath<{ episodes?: { episode_number: number; still_path?: string }[]; error?: string }>(path)
      .then((data) => {
        if (cancelled) return;
        const stillsMap: Record<number, string> = {};
        if (data && Array.isArray(data.episodes)) {
          data.episodes.forEach((ep) => {
            if (ep.still_path) {
              stillsMap[ep.episode_number] = ep.still_path;
            }
          });
        }
        setEpisodeStills(stillsMap);
      })
      .catch((err) => {
        console.error("Failed to fetch season details:", err);
        if (!cancelled) {
          setEpisodeStills({});
        }
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
      <div className="absolute inset-0 bg-black/90" />
      <div className="relative w-full max-w-5xl h-[85vh] max-h-[820px] bg-neutral-950 border border-white/10 rounded-[32px] overflow-hidden flex flex-col md:flex-row shadow-[0_32px_80px_rgba(0,0,0,0.85)] z-10 glass-modal-enter">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-50 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white backdrop-blur-xl transition-all duration-300 hover:scale-105 shadow-lg cursor-pointer"
        >
          <X size={16} />
        </button>
        <div className="w-full md:w-[38%] flex flex-col gap-4 p-5 md:p-6 border-b md:border-b-0 md:border-r border-white/5 bg-black/20 overflow-y-auto shrink-0 select-none hide-scrollbar">
          <div className="relative w-[150px] md:w-[175px] aspect-[2/3] mx-auto rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)] group/poster border border-white/5 shrink-0">
            {tmdbData?.poster ? (
              <img
                src={tmdbData.poster}
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
              <button
                onClick={onToggleFavorite}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-all duration-300 active:scale-90 shrink-0 shadow-md cursor-pointer"
                title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
              >
                <Heart size={18} fill={isFavorite ? "currentColor" : "none"} className={isFavorite ? "text-red-500" : ""} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-[11px] font-bold shrink-0">
            {tmdbData && (
              <>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-emerald-400">{tmdbData.match}</span>
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
              <div 
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
              <div 
                onClick={() => setShowCastModal(true)}
                className="flex gap-4 overflow-x-auto pb-1.5 hide-scrollbar select-none cursor-pointer"
              >
                {cast.slice(0, 8).map((member, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 shrink-0 w-12 text-center transition-transform hover:scale-105 duration-200">
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/10 shadow-inner"
                    />
                    <span className="text-[8px] text-neutral-200 font-bold truncate w-full" title={member.name}>
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
                <button
                  onClick={() => {
                    onClose();
                    onPlay(resumeEpisode.item);
                  }}
                  className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all active:scale-[0.97] cursor-pointer"
                >
                  <Play size={13} fill="#000" /> {language === 'tr' ? 'İzlemeye Devam Et' : 'Resume Watching'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    onPlay(firstEpisode.item);
                  }}
                  className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all active:scale-[0.97] cursor-pointer"
                >
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
                <button
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
                        <button
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
                  <button
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

            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] font-extrabold text-white/40 px-1 mb-1 shrink-0">
              <span>{language === 'tr' ? 'Bölüm Listesi' : 'Episode List'}</span>
              <span>
                {language === 'tr'
                  ? `(${episodes.length} Bölüm)`
                  : `(${episodes.length} Episode${episodes.length > 1 ? 's' : ''})`}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {episodes.map((ep) => {
                const epTitle = ep.item.name;
                const cleanedTitle = cleanMediaTitle(epTitle);
                const epSubtitle = cleanedTitle
                  ? cleanedTitle.replace(new RegExp(`^${seriesCleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim()
                  : '';
                const historyItem = recentlyWatched.find(x => x.id === ep.item.id);
                const progress = historyItem?.progress;
                const isWatched = recentlyWatched.some(x => x.id === ep.item.id);
                const isTarget = expandedEpisodeId === ep.item.id;

                return (
                  <div
                    key={ep.item.id}
                    className={`rounded-2xl p-3 flex items-center justify-between gap-4 relative group border bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.07] hover:border-white/15 hover:shadow-[0_8px_25px_rgba(0,0,0,0.45)] transition-all duration-300 ${
                      isTarget ? 'border-white/20 bg-white/[0.06] shadow-md shadow-white/5' : ''
                    }`}
                  >
                    <div className="relative w-24 md:w-32 aspect-video rounded-xl overflow-hidden shrink-0 border border-white/5 shadow-inner transition-transform duration-300 group-hover:scale-[1.02]">
                      <EpisodeThumb
                        tmdbShowId={tmdbShowId}
                        seasonNumber={ep.seasonNumber}
                        episodeNumber={ep.episodeNumber}
                        fallbackPoster={tmdbData?.poster}
                        stillPath={episodeStills[ep.episodeNumber]}
                      />
                      <div
                        onClick={() => {
                          onClose();
                          onPlay(ep.item);
                        }}
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
                        {epSubtitle || (language === 'tr' ? `Bölüm ${ep.episodeNumber}` : `Episode ${ep.episodeNumber}`)}
                      </h4>
                      <span className="block text-[9px] text-neutral-500 truncate mt-1">
                        {epTitle}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onPlay(ep.item);
                      }}
                      className="w-8 h-8 rounded-lg bg-white hover:bg-neutral-200 text-black flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md cursor-pointer shrink-0"
                      title={language === 'tr' ? 'Oynat' : 'Play'}
                    >
                      <Play size={12} fill="#000" className="ml-0.5" />
                    </button>

                  </div>
                );
              })}
            </div>

          </div>
 
        </div>
 
      </div>
      {showCastModal && (
        <div 
          className="fixed inset-0 z-[4000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
          onClick={() => setShowCastModal(false)}
        >
          <div 
            className="w-full max-w-lg bg-neutral-950/90 border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-scale-in flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
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
