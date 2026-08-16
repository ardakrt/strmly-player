import { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, Play, X, Download, Info, ChevronDown, Check } from 'lucide-react';
import { LikeBurstButton } from './LikeBurstButton';
import { ImageWithFallback } from './ImageWithFallback';
import type { GroupedSeries } from '../utils/seriesGroupers';
import type { PlaylistItem, TmdbData } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useDownloads } from '../hooks/useDownloads';
import { useSeriesModalData } from '../hooks/useSeriesModalData';
import {
  SeriesCastModal,
} from './series/SeriesModalParts';
import {
  buildSeriesMetaParts,
  cleanSeriesGroup,
  findResumeEpisode,
  getSeasonWatchStats,
} from './series/seriesModalHelpers';
import { SeriesEpisodeRow } from './series/SeriesEpisodeRow';

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
  const [descExpanded, setDescExpanded] = useState(false);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const seasonsList = Object.keys(series.seasons).map(Number).sort((a, b) => a - b);
  const episodes = useMemo(() => series.seasons[activeSeason] || [], [activeSeason, series.seasons]);
  const seriesCleanName = series.name.toLowerCase();
  const { savedEpisodeUrls, episodeMeta, cast } = useSeriesModalData({
    episodes,
    downloads,
    getDownloadByStreamUrl,
    tmdbShowId,
    tmdbDataId: tmdbData?.id,
    activeSeason,
  });

  const seasonScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seasonScrollRef.current) {
      const activeEl = seasonScrollRef.current.querySelector('.series-season-chip.is-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeSeason]);

  const handleSeasonWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!seasonScrollRef.current) return;
    if (e.deltaY !== 0 && !e.shiftKey) {
      seasonScrollRef.current.scrollLeft += e.deltaY;
    }
  };

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

  const [showCastModal, setShowCastModal] = useState(false);

  const resumeEpisode = useMemo(
    () => findResumeEpisode(series.seasons, recentlyWatched),
    [recentlyWatched, series.seasons],
  );

  const firstSeasonNum = seasonsList[0];
  const firstSeasonEpisodes = series.seasons[firstSeasonNum] || [];
  const firstEpisode = firstSeasonEpisodes[0] || null;

  // Playlist groups are noisy: "[TR] HBO MAX / PARAMOUNT+"
  const cleanedGroup = useMemo(
    () => cleanSeriesGroup(series.group),
    [series.group],
  );

  const metaParts = useMemo(
    () => buildSeriesMetaParts(tmdbData, language, seasonsList.length),
    [tmdbData, language, seasonsList.length],
  );

  const seasonWatchStats = useMemo(
    () => getSeasonWatchStats(episodes, recentlyWatched),
    [episodes, recentlyWatched],
  );

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
                <LikeBurstButton
                  isLiked={isFavorite}
                  size={16}
                  onToggle={(_, e) => onToggleFavorite(e)}
                  ariaLabel={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
                />
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

            {seasonsList.length > 6 ? (
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                  className="inline-flex h-9 items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-[12.5px] font-semibold text-white backdrop-blur-md shadow-md transition-all hover:border-white/25 hover:bg-white/[0.1] active:scale-[0.98] cursor-pointer min-w-[130px]"
                  aria-expanded={seasonDropdownOpen}
                >
                  <span>{language === 'tr' ? `${activeSeason}. Sezon` : `Season ${activeSeason}`}</span>
                  <ChevronDown size={14} className={`text-white/60 transition-transform duration-200 ${seasonDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {seasonDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setSeasonDropdownOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1.5 z-50 w-max max-w-[85vw] md:max-w-xl overflow-x-auto rounded-2xl border border-white/15 bg-[#121214]/95 p-2 shadow-[0_16px_45px_rgba(0,0,0,0.8)] backdrop-blur-2xl custom-modal-scrollbar animate-in fade-in zoom-in-95 duration-150">
                      <div
                        className="grid gap-1.5"
                        style={{
                          gridTemplateRows: `repeat(${Math.min(6, seasonsList.length)}, minmax(0, 1fr))`,
                          gridAutoFlow: 'column',
                        }}
                      >
                        {seasonsList.map(seasonNum => {
                          const isActive = activeSeason === seasonNum;
                          return (
                            <button
                              type="button"
                              key={`season-opt-${seasonNum}`}
                              onClick={() => {
                                onSetActiveSeason(seasonNum);
                                onSetExpandedEpisodeId(null);
                                setSeasonDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-1.5 text-left text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap min-w-[100px] ${
                                isActive
                                  ? 'bg-white text-black font-bold shadow-sm'
                                  : 'text-white/80 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span>{language === 'tr' ? `${seasonNum}. Sezon` : `Season ${seasonNum}`}</span>
                              {isActive && <Check size={13} strokeWidth={2.5} className="text-black shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div
                ref={seasonScrollRef}
                onWheel={handleSeasonWheel}
                className="flex w-full gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar scroll-smooth"
              >
                {seasonsList.map(seasonNum => (
                  <button
                    type="button"
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
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-2 md:px-3 py-1.5 min-h-0 custom-modal-scrollbar">
            <div className="flex flex-col">
              {episodes.map((episode) => (
                <SeriesEpisodeRow
                  key={episode.item.id}
                  episode={episode}
                  meta={episodeMeta[episode.episodeNumber] || {}}
                  seriesCleanName={seriesCleanName}
                  language={language}
                  historyItem={recentlyWatched.find(
                    (item) => item.id === episode.item.id,
                  )}
                  isTarget={expandedEpisodeId === episode.item.id}
                  tmdbShowId={tmdbShowId}
                  fallbackPoster={tmdbData?.poster}
                  saveState={getEpisodeSaveState(
                    episode.item.url,
                    episode.item.name,
                  )}
                  onPlay={playEpisode}
                  onSave={addDownload}
                  onNavigateToDownloads={onNavigateToDownloads}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      {showCastModal ? (
        <SeriesCastModal
          cast={cast}
          language={language}
          seriesName={series.name}
          onClose={() => setShowCastModal(false)}
        />
      ) : null}
    </div>
  );
};
