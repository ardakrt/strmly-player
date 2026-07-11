import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertCircle, ArrowLeft, LoaderCircle, Play, Pause, Volume, Volume1, Volume2, VolumeX, Maximize2, Minimize2, PictureInPicture, Plus, Settings, ChevronRight, ChevronLeft, X, Gauge, Subtitles, SkipForward, SkipBack, Scan } from 'lucide-react';
import { SPEED_OPTIONS } from '../constants';
import type { PlaylistItem } from '../utils/m3uParser';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { useSettings } from '../context/SettingsContext';
import type { PlayerQualityLevel } from '../hooks/useCinematicPlayer';

interface CinematicPlayerProps {
  channel: PlaylistItem;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playerVolume: number;
  playerMuted: boolean;
  showControls: boolean;
  videoReady: boolean;
  playbackStatus: 'loading' | 'playing' | 'recovering' | 'transcoding' | 'seeking' | 'error';
  playbackMessage: string;
  playbackSpeed: number;
  showSpeedMenu: boolean;
  qualityLevels: PlayerQualityLevel[];
  activeQualityLevel: number;
  audioTracks: { id: number; name: string; lang: string }[];
  activeAudioTrack: number;
  subtitleTracks: { label: string; srclang: string; src: string }[];
  activeSubtitle: number;
  showSubtitleMenu: boolean;
  isFullscreen: boolean;
  bufferedProgress?: number;
  accentStyles: React.CSSProperties;
  onClose: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSpeedChange: (speed: number) => void;
  onQualityChange: (levelId: number) => void;
  onAudioTrackChange: (id: number) => void;
  onSubtitleChange: (idx: number) => void;
  onSubtitleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPiP: () => void;
  onToggleFullscreen: () => void;
  onTimelineSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeek: (time: number, isRelative?: boolean) => void;
  onHideControls: () => void;
  onShowSpeedMenu: (show: boolean) => void;
  onShowSubtitleMenu: (show: boolean) => void;
  formatTime: (time: number) => string;
  onMouseMove?: () => void;
  onMouseLeave?: () => void;
  channels: PlaylistItem[];
  onChannelChange: (channel: PlaylistItem) => void;
  showIntroSkip?: boolean;
  onSkipIntro?: () => void;
}

export const CinematicPlayer = (props: CinematicPlayerProps) => {
  const { t, language } = useSettings();
  const {
    channel,
    videoRef, playerContainerRef,
    isPlaying, currentTime, duration,
    playerVolume, playerMuted,
    showControls, videoReady, playbackStatus, playbackMessage,
    playbackSpeed,
    qualityLevels, activeQualityLevel,
    audioTracks, activeAudioTrack,
    subtitleTracks, activeSubtitle,
    isFullscreen, accentStyles,
    bufferedProgress = 0,
    onClose, onTogglePlay, onToggleMute, onVolumeChange,
    onSpeedChange, onQualityChange, onAudioTrackChange, onSubtitleChange,
    onSubtitleUpload, onPiP, onToggleFullscreen,
    onSeek,
    onHideControls,
    formatTime,
    onMouseMove, onMouseLeave,
    channels, onChannelChange,
    showIntroSkip,
    onSkipIntro
  } = props;

  const isLive = channel.type === 'live';
  const contentLabel = channel.type === 'live'
    ? (language === 'tr' ? 'Canlı yayın' : 'Live TV')
    : channel.type === 'movie'
      ? (language === 'tr' ? 'Film' : 'Movie')
      : (language === 'tr' ? 'Dizi bölümü' : 'Episode');
  const isPlaybackError = playbackStatus === 'error';
  const isSeeking = playbackStatus === 'seeking';
  // Seek uses a light overlay so the scrub position stays visible; don't blank the whole player.
  const shouldShowPlaybackOverlay = isPlaybackError || (!isSeeking && (!videoReady || !!playbackMessage));

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [currentSubmenu, setCurrentSubmenu] = useState<'main' | 'speed' | 'quality' | 'subtitles' | 'scale' | 'audio'>('main');
  const [videoScaleMode, setVideoScaleMode] = useState<'fit' | 'fill' | 'zoom' | '16:9' | '4:3'>(() => {
    const saved = localStorage.getItem('cinema_player_scale_mode');
    return saved === 'fit' || saved === 'fill' || saved === 'zoom' || saved === '16:9' || saved === '4:3'
      ? saved
      : 'fit';
  });

  const displayAudioTracks = useMemo(() => {
    if (audioTracks && audioTracks.length > 0) {
      return audioTracks;
    }
    return [{ id: 0, name: language === 'tr' ? 'Varsayılan Ses' : 'Default Audio', lang: '' }];
  }, [audioTracks, language]);

  const sourceQualityLabel = useMemo(() => {
    const hlsLevel = qualityLevels.find(level => level.id === activeQualityLevel);
    if (hlsLevel) return hlsLevel.label;
    if (qualityLevels.length > 0 && activeQualityLevel === -1) return language === 'tr' ? 'Otomatik' : 'Auto';

    const text = `${channel.name} ${channel.url}`.toLowerCase();
    if (text.includes('2160') || text.includes('4k') || text.includes('uhd')) return '4K';
    if (text.includes('1080') || text.includes('fhd')) return '1080p';
    if (text.includes('720') || text.includes('hd')) return '720p';
    return language === 'tr' ? 'Tek kaynak' : 'Single source';
  }, [activeQualityLevel, channel.name, channel.url, language, qualityLevels]);

  const sourceTypeLabel = useMemo(() => {
    if (qualityLevels.length > 0 || channel.url.toLowerCase().includes('.m3u8')) return 'HLS';
    const clean = channel.url.split('?')[0].toLowerCase();
    const ext = clean.match(/\.([a-z0-9]+)$/)?.[1];
    return ext ? ext.toUpperCase() : (language === 'tr' ? 'Doğrudan kaynak' : 'Direct source');
  }, [channel.url, language, qualityLevels.length]);

  // Timeline Dragging states
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  const [autoPlayNext, setAutoPlayNext] = useState(() => localStorage.getItem('cinema_player_autoplay_next') !== 'false');

  const [isAutoplayCancelled, setIsAutoplayCancelled] = useState(false);

  const settingsRef = useRef<HTMLDivElement>(null);

  const currentEpisodeInfo = useMemo(() => (
    channel.type === 'series' ? parseSeriesEpisodeInfo(channel.name) : null
  ), [channel]);

  const formatEpisodeMeta = useCallback((item: PlaylistItem) => {
    const info = parseSeriesEpisodeInfo(item.name);
    return language === 'tr'
      ? `Sezon ${info.season} · Bölüm ${info.episode}`
      : `Season ${info.season} · Episode ${info.episode}`;
  }, [language]);

  // Sync sidebar group with currently playing channel on mount/change
  useEffect(() => {
    setIsAutoplayCancelled(false);
  }, [channel]);

  useEffect(() => {
    localStorage.setItem('cinema_player_scale_mode', videoScaleMode);
  }, [videoScaleMode]);

  useEffect(() => {
    localStorage.setItem('cinema_player_autoplay_next', String(autoPlayNext));
  }, [autoPlayNext]);

  // Find sibling episodes sorted by season & episode
  const sortedSiblings = useMemo(() => {
    if (channel.type !== 'series') return [];

    const currentParsed = parseSeriesEpisodeInfo(channel.name);
    if (!currentParsed) return [];

    const currentClean = currentParsed.cleanTitle.toLowerCase();

    // Find sibling episodes in the same group and matching title
    const siblingEpisodes = channels.filter(ch => {
      if (ch.type !== 'series') return false;
      if (ch.group !== channel.group) return false;

      const parsed = parseSeriesEpisodeInfo(ch.name);
      return parsed.cleanTitle.toLowerCase() === currentClean;
    });

    const parsedSiblings = siblingEpisodes.map(ch => ({
      item: ch,
      info: parseSeriesEpisodeInfo(ch.name)
    }));

    // Sort: Season asc, Episode asc
    parsedSiblings.sort((a, b) => {
      if (a.info.season !== b.info.season) {
        return a.info.season - b.info.season;
      }
      return a.info.episode - b.info.episode;
    });

    return parsedSiblings;
  }, [channel, channels]);

  // Find current episode index in the sorted siblings list
  const currentEpisodeIndex = useMemo(() => {
    if (channel.type !== 'series') return -1;

    const currentParsed = parseSeriesEpisodeInfo(channel.name);
    if (!currentParsed) return -1;

    return sortedSiblings.findIndex(sib =>
      sib.info.season === currentParsed.season && sib.info.episode === currentParsed.episode
    );
  }, [channel, sortedSiblings]);

  // Find next episode sibling
  const nextEpisode = useMemo(() => {
    if (currentEpisodeIndex !== -1 && currentEpisodeIndex < sortedSiblings.length - 1) {
      return sortedSiblings[currentEpisodeIndex + 1].item;
    }
    return null;
  }, [currentEpisodeIndex, sortedSiblings]);

  // Find previous episode sibling
  const prevEpisode = useMemo(() => {
    if (currentEpisodeIndex > 0) {
      return sortedSiblings[currentEpisodeIndex - 1].item;
    }
    return null;
  }, [currentEpisodeIndex, sortedSiblings]);



  // Fallback autoplay trigger when jenerik ends naturally (essential for short videos or if seeking near end)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (
        channel.type === 'series' &&
        nextEpisode &&
        autoPlayNext &&
        !isAutoplayCancelled
      ) {
        onChannelChange(nextEpisode);
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, [channel, nextEpisode, autoPlayNext, isAutoplayCancelled, onChannelChange, videoRef]);

  const updateDragPosition = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    setDragTime(targetTime);
    setHoverPosition(pos);
    setHoverTime(targetTime);
  }, [duration]);

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    setIsDraggingTimeline(true);
    updateDragPosition(e);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(position);
    setHoverTime(position * duration);
  };

  useEffect(() => {
    if (!isDraggingTimeline) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosition(e);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!timelineRef.current || duration <= 0) {
        setIsDraggingTimeline(false);
        setDragTime(null);
        return;
      }
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = pos * duration;
      onSeek(targetTime);
      setIsDraggingTimeline(false);
      setDragTime(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTimeline, duration, onSeek, updateDragPosition]);

  useEffect(() => {
    if (!showControls) {
      setShowSettingsMenu(false);
      setCurrentSubmenu('main');
    }
  }, [showControls]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettingsMenu && settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
        setCurrentSubmenu('main');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsMenu]);

  const handleSkipBackward = useCallback(() => {
    onSeek(Math.max(0, currentTime - 10), true);
  }, [onSeek, currentTime]);

  const handleSkipForward = useCallback(() => {
    onSeek(Math.min(duration, currentTime + 10), true);
  }, [onSeek, duration, currentTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Prevent shortcut conflicts if search input is focused
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      // Escape -> Close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }



      // Space or K -> Play/Pause
      if (e.key === ' ' || key === 'k') {
        e.preventDefault();
        onTogglePlay();
        if (onMouseMove) onMouseMove();
        return;
      }

      // M -> Toggle Mute
      if (key === 'm') {
        e.preventDefault();
        onToggleMute();
        if (onMouseMove) onMouseMove();
        return;
      }

      // F -> Toggle Fullscreen
      if (key === 'f') {
        e.preventDefault();
        onToggleFullscreen();
        if (onMouseMove) onMouseMove();
        return;
      }

      // I -> Skip Intro
      if (key === 'i') {
        if (showIntroSkip) {
          e.preventDefault();
          onSkipIntro?.();
          return;
        }
      }

      // ArrowLeft -> Skip Back 10s
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSkipBackward();
        if (onMouseMove) onMouseMove();
        return;
      }

      // ArrowRight -> Skip Forward 10s
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkipForward();
        if (onMouseMove) onMouseMove();
        return;
      }

      // ArrowUp -> Increase Volume by 5%
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentVol = playerMuted ? 0 : playerVolume;
        const newVol = Math.min(1, currentVol + 0.05);
        onVolumeChange({ target: { value: newVol.toString() } } as any);
        if (onMouseMove) onMouseMove();
        return;
      }

      // ArrowDown -> Decrease Volume by 5%
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentVol = playerMuted ? 0 : playerVolume;
        const newVol = Math.max(0, currentVol - 0.05);
        onVolumeChange({ target: { value: newVol.toString() } } as any);
        if (onMouseMove) onMouseMove();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [playerMuted, playerVolume, onVolumeChange, onTogglePlay, onToggleMute, onToggleFullscreen, onClose, onMouseMove, handleSkipBackward, handleSkipForward, onSkipIntro, showIntroSkip]);

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black flex items-center justify-center select-none"
      style={accentStyles}
    >
      <div
        ref={playerContainerRef}
        className={`relative w-full h-full overflow-hidden flex items-center justify-center ${!showControls ? 'cursor-none' : ''}`}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <video
          ref={videoRef}
          className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[width,height,object-fit] duration-300 ${
            (videoScaleMode === '16:9' || videoScaleMode === '4:3')
              ? 'w-auto h-auto max-w-full max-h-full object-fill'
              : 'w-full h-full ' + (
                videoScaleMode === 'fit' ? 'object-contain' :
                videoScaleMode === 'fill' ? 'object-fill' : 'object-cover'
              )
          }`}
          style={{
            aspectRatio: videoScaleMode === '16:9' ? '16/9' : videoScaleMode === '4:3' ? '4/3' : 'auto',
            objectPosition: 'center center',
            margin: 'auto'
          }}
          autoPlay
          playsInline
          preload="auto"
        >
          {subtitleTracks.map((track, idx) => (
            <track
              key={idx}
              kind="subtitles"
              label={track.label}
              srcLang={track.srclang}
              src={track.src}
              default={idx === activeSubtitle}
            />
          ))}
        </video>
        {channel.type === 'series' && nextEpisode && duration > 35 && (duration - currentTime <= 35) && (duration - currentTime > 1) && !isAutoplayCancelled && (
          <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ((e) => e.stopPropagation())(e as any); } }} tabIndex={0} role="button"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-28 right-8 z-30 bg-neutral-950/90 border border-white/10 backdrop-blur-2xl p-5 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[280px] max-w-[90%] animate-scale-in"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold text-[var(--accent-color,white)] uppercase tracking-widest">{language === 'tr' ? 'Sonraki Bölüm' : 'Next Episode'}</span>
              <span className="text-xs font-bold text-white line-clamp-1">{nextEpisode.name}</span>
              <span className="text-[10px] text-neutral-400">
                {autoPlayNext
                  ? (language === 'tr' ? `${Math.max(0, Math.ceil(duration - currentTime))} saniye içinde başlıyor...` : `Starting in ${Math.max(0, Math.ceil(duration - currentTime))} seconds...`)
                  : (language === 'tr' ? 'Sonraki bölüm hazır' : 'Next episode is ready')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChannelChange(nextEpisode);
                }}
                className="flex-1 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
               aria-label="Play">
                <Play size={12} fill="#000" />
                {language === 'tr' ? 'Şimdi Oynat' : 'Play Now'}
              </button>
              {autoPlayNext && (
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAutoplayCancelled(true);
                  }}
                  className="px-3 py-2 bg-white/5 border border-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                >
                  {language === 'tr' ? 'İptal' : 'Cancel'}
                </button>
              )}
            </div>
          </div>
        )}


        <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => {
            onHideControls();
<<<<<<< HEAD
          })(); } }} tabIndex={0} role="button"
=======
          })(e as any); } }} tabIndex={0} role="button"
>>>>>>> e7193502944587c0e2e5b766aff7f4e46bf08d6f
          className="absolute inset-0 z-0 cursor-pointer"
          onClick={() => {
            onHideControls();
          }}
        />
        {isSeeking && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center animate-fade-in">
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/55 px-5 py-3 shadow-2xl backdrop-blur-md">
              <LoaderCircle size={22} className="animate-spin text-white/85" />
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-bold tracking-wide text-white/90">
                  {language === 'tr' ? 'İleri sarılıyor' : 'Seeking'}
                </span>
                {playbackMessage && (
                  <span className="text-[11px] text-white/50">{playbackMessage}</span>
                )}
              </div>
            </div>
          </div>
        )}
        {shouldShowPlaybackOverlay && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-2xl flex flex-col items-center justify-center gap-4 z-30 animate-fade-in px-6 text-center">
            {isPlaybackError ? (
              <AlertCircle size={38} className="text-red-300" />
            ) : (
              <LoaderCircle size={38} className="text-white/80 animate-spin" />
            )}
            <div className="flex max-w-md flex-col items-center gap-2">
              <span className={`text-sm font-bold tracking-wide ${isPlaybackError ? 'text-red-100' : 'text-white/85'}`}>
                {isPlaybackError
                  ? (language === 'tr' ? `${contentLabel} açılamadı` : `${contentLabel} could not be opened`)
                  : (playbackStatus === 'transcoding'
                    ? (language === 'tr' ? 'Uyumluluk modu deneniyor' : 'Trying compatibility mode')
                    : playbackStatus === 'recovering'
                      ? (language === 'tr' ? 'Akış kurtarılıyor' : 'Recovering stream')
                      : t('common.loading'))}
              </span>
              <span className="text-xs leading-5 text-white/55">
                {playbackMessage || (language === 'tr' ? `${contentLabel} hazırlanıyor...` : `${contentLabel} is loading...`)}
              </span>
            </div>
            {isPlaybackError && (
              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="mt-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-white/20 active:scale-95"
              >
                {language === 'tr' ? 'Geri dön' : 'Go Back'}
              </button>
            )}
          </div>
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-10 md:gap-14 z-20 pointer-events-none transform-gpu will-change-[opacity,transform] transition-all duration-100 ease-out ${
            showControls ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          {!isLive && (
            <button type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSkipBackward();
                if (onMouseMove) onMouseMove();
              }}
              className="pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/30 hover:bg-black/45 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-sm group/skip"
              title={language === 'tr' ? '10 Sn Geri' : '10 Sec Backward'}
             aria-label={language === 'tr' ? '10 Sn Geri' : '10 Sec Backward'}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <text x="12" y="13.8" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="black" textAnchor="middle" dominantBaseline="middle">10</text>
              </svg>
            </button>
          )}
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
              if (onMouseMove) onMouseMove();
            }}
            className="pointer-events-auto w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/30 hover:bg-black/45 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-90 shadow-2xl backdrop-blur-sm group/play"
            title={isPlaying ? (language === 'tr' ? 'Durdur' : 'Pause') : (language === 'tr' ? 'Başlat' : 'Play')}
           aria-label={isPlaying ? (language === 'tr' ? 'Durdur' : 'Pause') : (language === 'tr' ? 'Başlat' : 'Play')}>
            {isPlaying ? (
              <Pause size={28} fill="#fff" className="text-white transition-transform group-hover/play:scale-110" />
            ) : (
              <Play size={28} fill="#fff" className="ml-1 text-white transition-transform group-hover/play:scale-110" />
            )}
          </button>
          {!isLive && (
            <button type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSkipForward();
                if (onMouseMove) onMouseMove();
              }}
              className="pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/30 hover:bg-black/45 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-sm group/skip"
              title={language === 'tr' ? '10 Sn İleri' : '10 Sec Forward'}
             aria-label={language === 'tr' ? '10 Sn İleri' : '10 Sec Forward'}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <text x="12" y="13.8" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="black" textAnchor="middle" dominantBaseline="middle">10</text>
              </svg>
            </button>
          )}
        </div>
        <div className={`absolute top-8 left-8 right-8 flex items-center justify-between z-20 transform-gpu will-change-[opacity,transform] transition-all duration-100 ease-out ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <button type="button"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-3xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all active:scale-90"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-semibold tracking-wide text-white drop-shadow-md">
              {currentEpisodeInfo?.cleanTitle || channel.name}
            </span>
            {currentEpisodeInfo && (
              <span className="text-[10px] font-medium tracking-wide text-white/65 drop-shadow-md">
                {formatEpisodeMeta(channel)}
              </span>
            )}
          </div>
          <div className="w-10"></div>
        </div>
        <div className={`absolute bottom-10 left-0 right-0 mx-auto w-full max-w-[900px] px-6 z-20 transform-gpu will-change-[opacity,transform] transition-all duration-100 ease-out ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
          <div
            className="w-full bg-black/60 backdrop-blur-xl rounded-full px-4 py-3 flex items-center gap-3 border border-white/10 transform-gpu"
            style={{
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              backfaceVisibility: 'hidden'
            }}
          >
            {channel.type === 'series' && (
              <div className="group/episode-nav relative shrink-0">
                <button type="button"
                  disabled={!prevEpisode}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (prevEpisode) onChannelChange(prevEpisode);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                  title={language === 'tr' ? 'Önceki Bölüm' : 'Previous Episode'}
                 aria-label={language === 'tr' ? 'Önceki Bölüm' : 'Previous Episode'}>
                  <SkipBack size={12} fill="currentColor" />
                </button>
                {prevEpisode && (
                  <div className="pointer-events-none absolute bottom-full left-0 mb-3 w-max max-w-[220px] -translate-y-1 rounded-xl border border-white/10 bg-black/85 px-3 py-2 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-150 group-hover/episode-nav:translate-y-0 group-hover/episode-nav:opacity-100">
                    <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">{language === 'tr' ? 'Önceki Bölüm' : 'Previous Episode'}</div>
                    <div className="mt-1 truncate text-[11px] font-semibold text-white">{parseSeriesEpisodeInfo(prevEpisode.name).cleanTitle}</div>
                    <div className="text-[9px] font-medium text-white/50">{formatEpisodeMeta(prevEpisode)}</div>
                  </div>
                )}
              </div>
            )}
            <button type="button"
              className="w-10 h-10 shrink-0 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
              onClick={onTogglePlay}
             aria-label="Play">
              {isPlaying ? <Pause size={18} fill="#000" /> : <Play size={18} fill="#000" className="ml-0.5" />}
            </button>
            {channel.type === 'series' && (
              <div className="group/episode-nav relative shrink-0">
                <button type="button"
                  disabled={!nextEpisode}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (nextEpisode) onChannelChange(nextEpisode);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                  title={language === 'tr' ? 'Sonraki Bölüm' : 'Next Episode'}
                 aria-label={language === 'tr' ? 'Sonraki Bölüm' : 'Next Episode'}>
                  <SkipForward size={12} fill="currentColor" />
                </button>
                {nextEpisode && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-3 w-max max-w-[220px] -translate-x-1/2 -translate-y-1 rounded-xl border border-white/10 bg-black/85 px-3 py-2 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-150 group-hover/episode-nav:translate-y-0 group-hover/episode-nav:opacity-100">
                    <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">{language === 'tr' ? 'Sonraki Bölüm' : 'Next Episode'}</div>
                    <div className="mt-1 truncate text-[11px] font-semibold text-white">{parseSeriesEpisodeInfo(nextEpisode.name).cleanTitle}</div>
                    <div className="text-[9px] font-medium text-white/50">{formatEpisodeMeta(nextEpisode)}</div>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center shrink-0 group/vol">
              <button type="button"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0"
                onClick={onToggleMute}
                title={language === 'tr' ? 'Sessiz (M)' : 'Mute (M)'}
               aria-label={language === 'tr' ? 'Sessiz (M)' : 'Mute (M)'}>
                {playerMuted || playerVolume === 0 ? (
                  <VolumeX size={17} className="text-neutral-400 hover:text-red-400 transition-colors duration-300" />
                ) : playerVolume < 0.35 ? (
                  <Volume size={17} className="transition-all duration-300" />
                ) : playerVolume < 0.7 ? (
                  <Volume1 size={17} className="transition-all duration-300" />
                ) : (
                  <Volume2 size={17} className="transition-all duration-300" />
                )}
              </button>

              <div className="relative flex items-center h-6 w-0 opacity-0 pointer-events-none group-hover/vol:w-16 group-hover/vol:ml-2 group-hover/vol:opacity-100 group-hover/vol:pointer-events-auto transition-all duration-300 ease-out overflow-hidden">
                <div className="relative w-16 h-[4px] rounded-full bg-white/25 overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-75"
                    style={{ width: `${playerMuted ? 0 : playerVolume * 100}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={playerMuted ? 0 : playerVolume}
                    onChange={onVolumeChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title={language === 'tr' ? 'Ses Seviyesi (↑↓)' : 'Volume Level (↑↓)'}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-3 px-2">
              {isLive ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-white/90 tracking-wide uppercase">{language === 'tr' ? 'Canlı Yayın' : 'Live Stream'}</span>
                </div>
              ) : (
                <>
                  <span className="text-[10px] font-medium text-white/80 tabular-nums">{formatTime(isDraggingTimeline && dragTime !== null ? dragTime : currentTime)}</span>
                  <div
                    ref={timelineRef}
                    className="flex-1 h-6 flex items-center relative cursor-pointer group/timeline"
                    onMouseDown={handleTimelineMouseDown}
                    onMouseMove={handleTimelineMouseMove}
                    onMouseLeave={() => {
                      if (!isDraggingTimeline) setHoverTime(null);
                    }}
                  >
                    {hoverTime !== null && duration > 0 && (
                      <div
                        className="pointer-events-none absolute bottom-full z-40 mb-2 -translate-x-1/2 rounded-lg border border-white/10 bg-black/85 px-2.5 py-1.5 text-[10px] font-bold tabular-nums text-white shadow-xl backdrop-blur-md"
                        style={{ left: `${Math.min(92, Math.max(8, hoverPosition * 100))}%` }}
                      >
                        {formatTime(isDraggingTimeline && dragTime !== null ? dragTime : hoverTime)}
                      </div>
                    )}
                    <div className="w-full h-1.5 rounded-full bg-white/10 relative group-hover/timeline:h-2 transition-all">
                      {bufferedProgress > 0 && duration > 0 && (
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-white/20 transition-all duration-300"
                          style={{ width: `${Math.min(100, bufferedProgress)}%` }}
                        />
                      )}
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-white"
                        style={{ width: `${duration ? ((isDraggingTimeline && dragTime !== null ? dragTime : currentTime) / duration) * 100 : 0}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-xl opacity-0 group-hover/timeline:opacity-100 transition-opacity transform translate-x-1/2" />
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-white/80 tabular-nums">{formatTime(duration)}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 px-1">
              <div ref={settingsRef} className="relative">
                <button type="button"
                  className={`w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors ${
                    showSettingsMenu ? 'bg-white/20 text-white' : 'text-white'
                  }`}
                  onClick={() => {
                    setShowSettingsMenu(!showSettingsMenu);
                    setCurrentSubmenu('main');
                  }}
                  title={t('settings.title')}
                 aria-label={t('settings.title')}>
                  <Settings size={14} className={`transition-transform duration-300 ${showSettingsMenu ? 'rotate-45' : ''}`} />
                </button>

                {showSettingsMenu && (
                  <>
                    {currentSubmenu === 'main' && (
                      <div className="absolute bottom-full right-0 z-30 mb-3 w-[272px] overflow-hidden rounded-[20px] border border-white/10 bg-[#09090b]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-scale-in">
                        <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
                          <div>
                            <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">{t('settings.title')}</div>
                            <div className="mt-0.5 text-[9px] font-medium text-white/35">{language === 'tr' ? 'Oynatma tercihleri' : 'Playback preferences'}</div>
                          </div>
                          <button type="button"
                            onClick={() => setShowSettingsMenu(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                            title={language === 'tr' ? 'Kapat' : 'Close'}
                           aria-label={language === 'tr' ? 'Kapat' : 'Close'}>
                            <X size={13} />
                          </button>
                        </div>

                        <div className="h-px bg-white/[0.07]" />
                        <div className="px-2.5 pb-1 pt-2.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/30">
                          {language === 'tr' ? 'Video ve ses' : 'Video and audio'}
                        </div>

                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => setCurrentSubmenu('speed')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Gauge size={14} /></span>
                            <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{language === 'tr' ? 'Oynatma Hızı' : 'Playback Speed'}</span><span className="mt-0.5 block text-[9px] text-white/35">{language === 'tr' ? 'Video hızını değiştir' : 'Change playback rate'}</span></span>
                            <span className="flex items-center gap-1 rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{playbackSpeed}x <ChevronRight size={10} /></span>
                          </button>

                          <button type="button" onClick={() => setCurrentSubmenu('quality')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Gauge size={14} /></span>
                            <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{language === 'tr' ? 'Kalite' : 'Quality'}</span><span className="mt-0.5 block text-[9px] text-white/35">{sourceTypeLabel}</span></span>
                            <span className="flex max-w-[82px] items-center gap-1 truncate rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{sourceQualityLabel} <ChevronRight size={10} className="shrink-0" /></span>
                          </button>

                          <button type="button" onClick={() => setCurrentSubmenu('subtitles')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Subtitles size={14} /></span>
                            <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{t('player.subtitles')}</span><span className="mt-0.5 block truncate text-[9px] text-white/35">{language === 'tr' ? 'Dil veya yerel dosya seç' : 'Choose language or local file'}</span></span>
                            <span className="flex max-w-[72px] items-center gap-1 truncate rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{activeSubtitle === -1 ? (language === 'tr' ? 'Kapalı' : 'Off') : (subtitleTracks[activeSubtitle]?.label || (language === 'tr' ? 'Açık' : 'On'))} <ChevronRight size={10} className="shrink-0" /></span>
                          </button>

                          <button type="button" onClick={() => setCurrentSubmenu('scale')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Scan size={14} /></span>
                            <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{language === 'tr' ? 'Görüntü Oranı' : 'Aspect Ratio'}</span><span className="mt-0.5 block text-[9px] text-white/35">{language === 'tr' ? 'Sığdır, doldur veya kırp' : 'Fit, fill, or crop'}</span></span>
                            <span className="flex items-center gap-1 rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{videoScaleMode === 'fit' ? (language === 'tr' ? 'Orijinal' : 'Original') : videoScaleMode === 'fill' ? (language === 'tr' ? 'Sığdır' : 'Fit') : videoScaleMode === 'zoom' ? (language === 'tr' ? 'Kırp' : 'Crop') : videoScaleMode} <ChevronRight size={10} /></span>
                          </button>

                          <button type="button" onClick={() => setCurrentSubmenu('audio')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Volume2 size={14} /></span>
                            <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{t('player.audio')}</span><span className="mt-0.5 block text-[9px] text-white/35">{language === 'tr' ? 'Ses kanalını değiştir' : 'Change audio track'}</span></span>
                            <span className="flex max-w-[76px] items-center gap-1 truncate rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{displayAudioTracks[activeAudioTrack]?.name || (language === 'tr' ? `Parça ${activeAudioTrack + 1}` : `Track ${activeAudioTrack + 1}`)} <ChevronRight size={10} className="shrink-0" /></span>
                          </button>
                        </div>

                        <div className="my-2 h-px bg-white/[0.07]" />
                        {channel.type === 'series' && (
                          <button type="button"
                            onClick={() => setAutoPlayNext(prev => !prev)}
                            className="group/autoplay flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07]"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 group-hover/autoplay:bg-white/10 group-hover/autoplay:text-white"><SkipForward size={14} /></span>
                            <span className="flex-1 text-[11px] font-semibold text-white/80">{language === 'tr' ? 'Sonraki bölüm' : 'Next episode'}</span>
                            <span className={`rounded-md px-2 py-1 text-[8px] font-bold ${autoPlayNext ? 'bg-white text-black' : 'border border-white/10 text-white/35'}`}>
                              {autoPlayNext ? (language === 'tr' ? 'AÇIK' : 'ON') : (language === 'tr' ? 'KAPALI' : 'OFF')}
                            </span>
                          </button>
                        )}
                        <button type="button"
                          onClick={() => { onPiP(); setShowSettingsMenu(false); }}
                          className="group/pip flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07]"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 group-hover/pip:bg-white/10 group-hover/pip:text-white"><PictureInPicture size={14} /></span>
                          <span className="flex-1 text-[11px] font-semibold text-white/80">{language === 'tr' ? 'Resim içinde resim' : 'Picture in Picture'}</span>
                          <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[8px] font-bold text-white/35">PiP</span>
                        </button>
                      </div>
                    )}

                    {currentSubmenu === 'speed' && (
                      <div className="absolute bottom-full right-0 z-30 mb-3 w-[240px] rounded-[20px] border border-white/10 bg-[#09090b]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-scale-in">
                        <div className="mb-2 flex items-center gap-2 border-b border-white/[0.07] px-1 pb-2">
                          <button type="button"
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                           aria-label="Previous">
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{language === 'tr' ? 'Oynatma Hızı' : 'Playback Speed'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {SPEED_OPTIONS.map(optSpeed => (
                            <button type="button"
                              key={optSpeed}
                              onClick={() => { onSpeedChange(optSpeed); setShowSettingsMenu(false); }}
                              className={`rounded-xl px-2 py-2.5 text-[10px] font-bold transition-all ${playbackSpeed === optSpeed ? 'bg-white text-black shadow-lg' : 'bg-white/[0.05] text-white/65 hover:bg-white/10 hover:text-white'}`}
                            >
                              {optSpeed === 1 ? (language === 'tr' ? 'Normal' : 'Normal') : `${optSpeed}x`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentSubmenu === 'quality' && (
                      <div className="absolute bottom-full right-0 z-30 mb-3 w-[240px] rounded-[20px] border border-white/10 bg-[#09090b]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-scale-in">
                        <div className="mb-2 flex items-center gap-2 border-b border-white/[0.07] px-1 pb-2">
                          <button type="button"
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                           aria-label="Previous">
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{language === 'tr' ? 'Kalite' : 'Quality'}</span>
                        </div>
                        {qualityLevels.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <button type="button"
                              onClick={() => { onQualityChange(-1); setShowSettingsMenu(false); }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                                activeQualityLevel === -1 ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {language === 'tr' ? 'Otomatik' : 'Auto'}
                            </button>
                            {qualityLevels.toSorted((a, b) => (b.height || 0) - (a.height || 0)).map(level => (
                              <button type="button"
                                key={level.id}
                                onClick={() => { onQualityChange(level.id); setShowSettingsMenu(false); }}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                                  activeQualityLevel === level.id ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                {level.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-white/[0.05] px-3 py-3">
                            <div className="text-xs font-bold text-white">{sourceQualityLabel}</div>
                            <div className="mt-1 text-[10px] leading-4 text-white/45">{sourceTypeLabel}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {currentSubmenu === 'subtitles' && (
                      <div className="absolute bottom-full right-0 mb-3 bg-[#09090b]/95 backdrop-blur-2xl border border-white/10 rounded-[20px] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-scale-in w-[240px] z-30 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                          <button type="button"
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                           aria-label="Previous">
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{t('player.subtitles')}</span>
                        </div>
                        <button type="button"
                          onClick={() => {
                            onSubtitleChange(-1);
                            setShowSettingsMenu(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                            activeSubtitle === -1 ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10'
                          }`}
                        >
                          {language === 'tr' ? 'Altyazı Yok' : 'No Subtitles'}
                        </button>
                        {subtitleTracks.map((track, idx) => (
                          <button type="button"
                            key={idx}
                            onClick={() => {
                              onSubtitleChange(idx);
                              setShowSettingsMenu(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                              activeSubtitle === idx ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {track.label}
                          </button>
                        ))}
                        <div className="w-full h-px bg-white/5 my-1" />
                        <label className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-left text-neutral-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
                          <Plus size={12} /> {language === 'tr' ? 'Altyazı Yükle (Yerel)' : 'Load Subtitles (Local)'}
                          <input type="file" accept=".srt,.vtt,.ass" className="hidden" onChange={onSubtitleUpload} />
                        </label>
                      </div>
                    )}



                    {currentSubmenu === 'scale' && (
                      <div className="absolute bottom-full right-0 mb-3 bg-[#09090b]/95 backdrop-blur-2xl border border-white/10 rounded-[20px] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-scale-in w-[240px] z-30 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                          <button type="button"
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                           aria-label="Previous">
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{language === 'tr' ? 'Video Ölçeği' : 'Aspect Ratio'}</span>
                        </div>
                        {[
                          { mode: 'fit', label: language === 'tr' ? 'Orijinal Oran' : 'Original Ratio' },
                          { mode: 'fill', label: language === 'tr' ? 'Ekrana Sığdır' : 'Fit to Screen' },
                          { mode: 'zoom', label: language === 'tr' ? 'Yakınlaştır (Kırp)' : 'Zoom (Crop)' },
                          { mode: '16:9', label: language === 'tr' ? '16:9 Oranı' : '16:9 Ratio' },
                          { mode: '4:3', label: language === 'tr' ? '4:3 Oranı' : '4:3 Ratio' }
                        ].map(opt => (
                          <button type="button"
                            key={opt.mode}
                            onClick={() => {
                              setVideoScaleMode(opt.mode as any);
                              setShowSettingsMenu(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                              videoScaleMode === opt.mode ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {currentSubmenu === 'audio' && (
                      <div className="absolute bottom-full right-0 mb-3 bg-[#09090b]/95 backdrop-blur-2xl border border-white/10 rounded-[20px] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-scale-in w-[240px] z-30 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                          <button type="button"
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                           aria-label="Previous">
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{t('player.audio')}</span>
                        </div>
                        {displayAudioTracks.map((track) => (
                          <button type="button"
                            key={track.id}
                            disabled={audioTracks.length <= 1}
                            onClick={() => {
                              onAudioTrackChange(track.id);
                              setShowSettingsMenu(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                              activeAudioTrack === track.id ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {track.name || (language === 'tr' ? `Parça ${track.id + 1}` : `Track ${track.id + 1}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <button type="button"
                className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                onClick={onToggleFullscreen}
                title={language === 'tr' ? 'Tam Ekran (F)' : 'Fullscreen (F)'}
               aria-label={language === 'tr' ? 'Tam Ekran (F)' : 'Fullscreen (F)'}>
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>
        </div>

        {showIntroSkip && (
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSkipIntro?.();
            }}
            className="absolute bottom-28 right-8 z-30 flex items-center gap-2 rounded-lg border border-white/20 bg-black/75 px-5 py-2.5 text-sm font-bold text-white shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 hover:border-[var(--accent-color)]/50 hover:bg-black/90 group animate-scale-in"
          >
            <Play size={14} className="fill-white group-hover:scale-110 transition-transform" />
            <span>{language === 'tr' ? 'Girişi Atla' : 'Skip Intro'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
