import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { useSettings } from '../context/SettingsContext';
import { AUTOPLAY_NEXT_KEY, getPlaybackSettings } from '../utils/playbackSettings';
import type { PlayerSettingsSubmenu, PlayerVideoScaleMode } from './player/PlayerSettingsMenu';
import { PlayerControlBar } from './player/PlayerControlBar';
import { PlayerOverlayControls, type PlayerSkipOverlay } from './player/PlayerOverlayControls';
import { PlayerMediaSurface } from './player/PlayerMediaSurface';
import { usePlayerSourceLabels } from './player/usePlayerSourceLabels';
import { SkipIntroButton } from './player/SkipIntroButton';
import type { CinematicPlayerProps } from './player/cinematicPlayerTypes';

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

  const [isSeekingVideo, setIsSeekingVideo] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isPlaybackError) setShowSnapshot(false);
  }, [isPlaybackError]);

  useEffect(() => {
    if (!isSeeking && !isSeekingVideo) setShowSnapshot(false);
  }, [isSeeking, isSeekingVideo]);

  const captureSnapshot = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    try {
      canvas.width = video.videoWidth || video.clientWidth || 1920;
      canvas.height = video.videoHeight || video.clientHeight || 1080;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setShowSnapshot(true);
      }
    } catch (e) {
      console.warn("Could not capture video frame snapshot:", e);
      setShowSnapshot(false);
    }
  }, [videoRef]);

  const [skipOverlay, setSkipOverlay] = useState<PlayerSkipOverlay | null>(null);
  const skipTimeoutRef = useRef<any>(null);

  const triggerSkipAnimation = useCallback((direction: 'forward' | 'backward') => {
    setSkipOverlay(prev => {
      if (prev && prev.direction === direction) {
        return {
          direction,
          amount: prev.amount + 10,
          key: Date.now()
        };
      }
      return {
        direction,
        amount: 10,
        key: Date.now()
      };
    });

    if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
    skipTimeoutRef.current = setTimeout(() => {
      setSkipOverlay(null);
    }, 850);
  }, []);

  useEffect(() => {
    return () => {
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
    };
  }, []);

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [currentSubmenu, setCurrentSubmenu] = useState<PlayerSettingsSubmenu>('main');
  const [videoScaleMode, setVideoScaleMode] = useState<PlayerVideoScaleMode>(() => {
    const saved = localStorage.getItem('cinema_player_scale_mode');
    return saved === 'fit' || saved === 'fill' || saved === 'zoom' || saved === '16:9' || saved === '4:3'
      ? saved
      : 'fit';
  });

  const { displayAudioTracks, sourceQualityLabel, sourceTypeLabel } = usePlayerSourceLabels({
    channelName: channel.name,
    channelUrl: channel.url,
    language,
    qualityLevels,
    activeQualityLevel,
    audioTracks,
  });

  // Timeline Dragging states
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  const [autoPlayNext, setAutoPlayNext] = useState(() => getPlaybackSettings().autoPlayNext);

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
    localStorage.setItem(AUTOPLAY_NEXT_KEY, String(autoPlayNext));
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
      captureSnapshot();
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
  }, [isDraggingTimeline, duration, onSeek, updateDragPosition, captureSnapshot]);

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
    captureSnapshot();
    triggerSkipAnimation('backward');
    onSeek(Math.max(0, currentTime - 10), true);
  }, [onSeek, currentTime, triggerSkipAnimation, captureSnapshot]);

  const handleSkipForward = useCallback(() => {
    // duration can be 0 before metadata/probe lands — Math.min(0, t+10) would
    // always clamp to 0 and make ±10s skips look "stuck".
    const next = currentTime + 10;
    const capped =
      duration > 0 && Number.isFinite(duration) ? Math.min(duration, next) : next;
    captureSnapshot();
    triggerSkipAnimation('forward');
    onSeek(Math.max(0, capped), true);
  }, [onSeek, duration, currentTime, triggerSkipAnimation, captureSnapshot]);

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
        <PlayerMediaSurface
          videoRef={videoRef}
          canvasRef={canvasRef}
          subtitleTracks={subtitleTracks}
          activeSubtitle={activeSubtitle}
          videoScaleMode={videoScaleMode}
          isSeekingVideo={isSeekingVideo}
          showSnapshot={showSnapshot}
          onSeeking={() => setIsSeekingVideo(true)}
          onSeeked={() => {
            setIsSeekingVideo(false);
            if (!isSeeking) window.setTimeout(() => setShowSnapshot(false), 60);
          }}
          onPlaybackResumed={() => {
            setIsSeekingVideo(false);
            if (!isSeeking) setShowSnapshot(false);
          }}
        />
        <PlayerOverlayControls
          language={language}
          t={t}
          channel={channel}
          skipOverlay={skipOverlay}
          nextEpisode={nextEpisode}
          duration={duration}
          currentTime={currentTime}
          autoPlayNext={autoPlayNext}
          isAutoplayCancelled={isAutoplayCancelled}
          shouldShowPlaybackOverlay={shouldShowPlaybackOverlay}
          isPlaybackError={isPlaybackError}
          playbackStatus={playbackStatus}
          playbackMessage={playbackMessage}
          contentLabel={contentLabel}
          showControls={showControls}
          isSeeking={isSeeking}
          isLive={isLive}
          isPlaying={isPlaying}
          title={currentEpisodeInfo?.cleanTitle || channel.name}
          episodeMeta={currentEpisodeInfo ? formatEpisodeMeta(channel) : undefined}
          onChannelChange={onChannelChange}
          onCancelAutoplay={() => setIsAutoplayCancelled(true)}
          onHideControls={onHideControls}
          onClose={onClose}
          onSkipBackward={handleSkipBackward}
          onSkipForward={handleSkipForward}
          onTogglePlay={onTogglePlay}
          onMouseMove={onMouseMove}
        />
        <PlayerControlBar
          language={language}
          t={t}
          showControls={showControls}
          channel={channel}
          isPlaying={isPlaying}
          isLive={isLive}
          currentTime={currentTime}
          duration={duration}
          bufferedProgress={bufferedProgress}
          playerMuted={playerMuted}
          playerVolume={playerVolume}
          isFullscreen={isFullscreen}
          isDraggingTimeline={isDraggingTimeline}
          dragTime={dragTime}
          hoverTime={hoverTime}
          hoverPosition={hoverPosition}
          timelineRef={timelineRef}
          prevEpisode={prevEpisode}
          nextEpisode={nextEpisode}
          formatTime={formatTime}
          formatEpisodeMeta={formatEpisodeMeta}
          onTogglePlay={onTogglePlay}
          onToggleMute={onToggleMute}
          onVolumeChange={onVolumeChange}
          onChannelChange={onChannelChange}
          onTimelineMouseDown={handleTimelineMouseDown}
          onTimelineMouseMove={handleTimelineMouseMove}
          onTimelineMouseLeave={() => {
            if (!isDraggingTimeline) setHoverTime(null);
          }}
          onToggleFullscreen={onToggleFullscreen}
          settingsRef={settingsRef}
          showSettingsMenu={showSettingsMenu}
          setShowSettingsMenu={setShowSettingsMenu}
          currentSubmenu={currentSubmenu}
          setCurrentSubmenu={setCurrentSubmenu}
          playbackSpeed={playbackSpeed}
          qualityLevels={qualityLevels}
          activeQualityLevel={activeQualityLevel}
          sourceQualityLabel={sourceQualityLabel}
          sourceTypeLabel={sourceTypeLabel}
          subtitleTracks={subtitleTracks}
          activeSubtitle={activeSubtitle}
          displayAudioTracks={displayAudioTracks}
          audioTracks={audioTracks}
          activeAudioTrack={activeAudioTrack}
          autoPlayNext={autoPlayNext}
          setAutoPlayNext={setAutoPlayNext}
          videoScaleMode={videoScaleMode}
          setVideoScaleMode={setVideoScaleMode}
          onSpeedChange={onSpeedChange}
          onQualityChange={onQualityChange}
          onAudioTrackChange={onAudioTrackChange}
          onSubtitleChange={onSubtitleChange}
          onSubtitleUpload={onSubtitleUpload}
          onPiP={onPiP}
        />

        {showIntroSkip && <SkipIntroButton language={language} onSkip={() => onSkipIntro?.()} />}
      </div>
    </div>
  );
};
