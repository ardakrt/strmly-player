import { useState, useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import type { PlaylistItem } from '../utils/m3uParser';
import { useSettings } from '../context/SettingsContext';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { getTranslation } from '../utils/translations';
import { useCinematicPlayerControls } from './useCinematicPlayerControls';
import { useCinematicPlayerSubtitles } from './useCinematicPlayerSubtitles';
import { useCinematicPlayerSession } from './useCinematicPlayerSession';
import { useCinematicPlayerAudio } from './useCinematicPlayerAudio';

interface UseCinematicPlayerProps {
  selectedChannel: PlaylistItem | null;
  saveWatchProgress: (item: PlaylistItem, time: number, total: number) => void;
  showToast: (message: string) => void;
}

import { formatPlayerTime, translateReason } from './cinematicPlayerHelpers';
import type { PlaybackStatus } from './cinematicPlayerHelpers';
export type { PlayerQualityLevel } from './cinematicPlayerHelpers';
export function useCinematicPlayer({
  selectedChannel,
  saveWatchProgress,
  showToast
}: UseCinematicPlayerProps) {
  const { language, transcodeMode } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const seekOffsetRef = useRef(0);
  const isTranscodingRef = useRef(false);
  /**
   * Local H.264 + browser-safe audio. Prefer native app-file first; if Chromium
   * rejects it (common without faststart / Unicode paths), FFmpeg pure remux
   * is allowed — main process copies audio (no AAC re-encode / no lip-sync lag).
   */
  const localBrowserSafeRef = useRef(false);
  const probedVideoCodecRef = useRef<string>('unknown');
  const activeAudioStreamIdRef = useRef<number | undefined>(undefined);
  const seekRequestIdRef = useRef(0);
  const seekTimeoutRef = useRef<any>(null);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const startupTimeoutRef = useRef<any>(null);
  const recoveryAttemptRef = useRef(0);
  const lastRecoveryTimeRef = useRef(0);
  const hlsNetworkRecoveriesRef = useRef(0);
  const hlsMediaRecoveriesRef = useRef(0);
  const lastBufferedUpdateRef = useRef(0);
  const seekGraceUntilRef = useRef(0);
  const lastRequestedSeekRef = useRef<number | null>(null);
  const lastFfmpegRestartAtRef = useRef(0);
  const ffmpegRestartInFlightRef = useRef(false);
  // Escalate copy → full once when browser rejects the remuxed bitstream.
  const forcedTranscodeModeRef = useRef<'copy' | 'full' | null>(null);

  // States/refs to reload the stream if paused for a long time (TCP/Token timeout recovery)
  const pausedTimeRef = useRef<number | null>(null);
  const resumeTimeRef = useRef<number | null>(null);

  const learnedIntroRef = useRef<{ from: number; to: number } | null>(null);
  const [learnedIntro, setLearnedIntro] = useState<{ from: number; to: number } | null>(null);
  const [showIntroSkip, setShowIntroSkip] = useState(false);

  const getTranscodeMode = (): 'copy' | 'full' => {
    if (forcedTranscodeModeRef.current) return forcedTranscodeModeRef.current;
    if (transcodeMode === 'copy') return 'copy';
    if (transcodeMode === 'full') return 'full';
    // 'auto': only copy pure H.264. HEVC/MPEG2/unknown get full re-encode
    // (copy+AAC was a common source of lip-sync drift on IPTV series).
    const videoCodec = probedVideoCodecRef.current;
    if (videoCodec === 'h264' || videoCodec === 'avc' || videoCodec === 'avc1') {
      return 'copy';
    }
    return 'full';
  };

  const invokeFfmpegProxy = async (
    startTime?: number,
    audioStreamId?: number,
  ) => {
    if (!selectedChannel || !window.electronAPI?.startFfmpegProxy) {
      return { success: false as const, error: 'FFmpeg uyumluluk modu kullanilamiyor' };
    }
    return window.electronAPI.startFfmpegProxy(
      selectedChannel.url,
      startTime,
      audioStreamId,
      getTranscodeMode(),
      selectedChannel.type,
    );
  };

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ffmpegFallbackActive, setFfmpegFallbackActive] = useState(false);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('loading');
  const [playbackMessage, setPlaybackMessage] = useState('');

  const controls = useCinematicPlayerControls({
    selectedChannel,
    videoRef,
    playerContainerRef,
    hlsInstanceRef,
    language,
    showToast,
  });
  const {
    playerVolume,
    playerMuted,
    showControls,
    playbackSpeed,
    showSpeedMenu,
    isFullscreen,
    qualityLevels,
    activeQualityLevel,
    playbackSpeedRef,
    playerVolumeRef,
    playerMutedRef,
    setPlayerVolume,
    setPlayerMuted,
    setShowControls,
    setPlaybackSpeed,
    setShowSpeedMenu,
    setIsFullscreen,
    setQualityLevels,
    setActiveQualityLevel,
    handlePlayerMouseMove,
    handlePlayerMouseLeave,
    handlePlayerVolumeChange,
    handleTogglePlayerMute,
    handleSpeedChange,
    handleQualityChange,
    handleToggleFullscreen,
    handlePlayerPiP,
  } = controls;
  const subtitles = useCinematicPlayerSubtitles({
    videoRef,
    hlsInstanceRef,
    language,
    showToast,
  });
  const {
    subtitleRef,
    subtitleTracks,
    activeSubtitle,
    showSubtitleMenu,
    setSubtitleTracks,
    setActiveSubtitle,
    setShowSubtitleMenu,
    handleSubtitleUpload,
    handleSubtitleChange, resetSubtitles,
  } = subtitles;
  const durationRef = useRef(duration);

  useEffect(() => { durationRef.current = duration; }, [duration]);

  const forceUnmute = () => {
    if (videoRef.current) {
      if (!playerMutedRef.current && videoRef.current.muted) {
        videoRef.current.muted = false;
      }
    }
  };
  const audio = useCinematicPlayerAudio({
    selectedChannel, videoRef, hlsInstanceRef, isTranscodingRef,
    activeAudioStreamIdRef, seekOffsetRef, language, showToast,
    invokeFfmpegProxy, forceUnmute, setFfmpegFallbackActive,
  });
  const { audioTracks, activeAudioTrack, setAudioTracks, setActiveAudioTrack, handleAudioTrackChange } = audio;

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      pausedTimeRef.current = Date.now();
    } else {
      pausedTimeRef.current = null;
      videoRef.current.play().then(forceUnmute).catch(() => { });
    }
  };

  const executeSeek = async (targetTime: number) => {
    if (!videoRef.current || !selectedChannel) return;
    lastRequestedSeekRef.current = targetTime;
    const video = videoRef.current;

    // --- Native path (offline app-file / progressive URL): no full-screen "seeking" overlay.
    // Setting playbackStatus='seeking' for ~1 frame caused a black flash on every scrub.
    if (!isTranscodingRef.current) {
      seekGraceUntilRef.current = Date.now() + 4000;
      try {
        video.currentTime = targetTime;
        if (video.paused) {
          video.play().then(forceUnmute).catch(() => { });
        }
      } catch (error) {
        console.warn("Native seek failed:", error);
        setPlaybackStatus('playing');
        setPlaybackMessage('');
        showToast(translateReason("Video ileri sarilamadi. Kaynak bu noktadan devam etmeyi desteklemiyor olabilir.", language));
      }
      return;
    }

    if (!window.electronAPI?.startFfmpegProxy) return;

    // --- Transcode/remux path ---
    // Proxy streams are fragmented MP4 (often duration=Infinity). The browser can
    // only seek reliably *inside already-buffered ranges*. Setting currentTime
    // outside the buffer is silently ignored → playhead looks stuck.
    // So: buffered → native; otherwise → FFmpeg restart at absolute target.
    const relative = targetTime - seekOffsetRef.current;
    const playhead = video.currentTime || 0;

    let inBufferedRange = false;
    try {
      for (let i = 0; i < video.buffered.length; i++) {
        const start = video.buffered.start(i);
        const end = video.buffered.end(i);
        // Keep a small margin so we don't land on the trailing edge of a fragment.
        if (relative >= start && relative <= end - 0.25) {
          inBufferedRange = true;
          break;
        }
      }
    } catch {
      /* ignore */
    }

    // Tiny nudge already at/near target — no-op.
    if (Math.abs(relative - playhead) < 0.15 && inBufferedRange) {
      return;
    }

    if (relative >= 0 && inBufferedRange) {
      const requestIdAtNative = seekRequestIdRef.current;
      seekGraceUntilRef.current = Date.now() + 6000;
      try {
        video.currentTime = relative;
        if (video.paused) {
          video.play().then(forceUnmute).catch(() => { });
        }
        // fMP4 sometimes ignores currentTime without throwing — verify and escalate.
        window.setTimeout(() => {
          if (!videoRef.current || !isTranscodingRef.current) return;
          if (seekRequestIdRef.current !== requestIdAtNative) return;
          const got = videoRef.current.currentTime || 0;
          if (Math.abs(got - relative) > 1.25) {
            console.warn(
              `[Seek] Native in-buffer seek missed (want=${relative.toFixed(2)} got=${got.toFixed(2)}), restarting proxy`,
            );
            void restartFfmpegAt(targetTime);
          }
        }, 280);
        return;
      } catch {
        // fall through to proxy restart
      }
    }

    await restartFfmpegAt(targetTime);
  };

  const restartFfmpegAt = async (targetTime: number) => {
    if (!videoRef.current || !selectedChannel || !window.electronAPI?.startFfmpegProxy) return;

    setBufferedProgress(0);
    seekGraceUntilRef.current = Date.now() + 20000;
    setPlaybackStatus('seeking');
    setPlaybackMessage(
      language === 'tr'
        ? `İleri sarılıyor... (${formatPlayerTime(targetTime)})`
        : `Seeking... (${formatPlayerTime(targetTime)})`
    );

    const requestId = ++seekRequestIdRef.current;
    try {
      const result = await invokeFfmpegProxy(
        targetTime,
        activeAudioStreamIdRef.current,
      );
      if (requestId !== seekRequestIdRef.current) return;
      if (result.success && result.url && videoRef.current) {
        seekOffsetRef.current = targetTime;
        const streamUrl = `${result.url}${result.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
        videoRef.current.src = streamUrl;
        videoRef.current.muted = playerMutedRef.current;
        videoRef.current.volume = playerVolumeRef.current;
        videoRef.current.play().then(forceUnmute).catch(() => { });
      } else {
        setPlaybackStatus('playing');
        setPlaybackMessage('');
        showToast(translateReason("Video ileri sarilamadi. Kaynak bu noktadan devam etmeyi desteklemiyor olabilir.", language));
      }
    } catch (e) {
      console.error("Transcoded seek error:", e);
      setPlaybackStatus('playing');
      setPlaybackMessage('');
      showToast(translateReason("Video ileri sarilirken hata olustu.", language));
    }
  };

  const handleSkipIntro = () => {
    if (learnedIntroRef.current) {
      handlePlayerSeek(learnedIntroRef.current.to);
      setShowIntroSkip(false);
      showToast(language === 'tr' ? 'Giriş atlandı.' : 'Intro skipped.');
    }
  };

  const handlePlayerSeek = (newTime: number, isRelative = false) => {
    if (!videoRef.current || !selectedChannel) return;

    let targetTime = newTime;
    if (isRelative && pendingSeekTimeRef.current !== null) {
      const delta = newTime - currentTime;
      targetTime = pendingSeekTimeRef.current + delta;
    }

    targetTime = Math.max(0, durationRef.current > 0
      ? Math.min(targetTime, Math.max(0, durationRef.current - 0.25))
      : targetTime);

    // Learn intro boundaries on forward skip in the first 5 minutes
    if (selectedChannel.type === 'series') {
      const absoluteBefore = seekOffsetRef.current + videoRef.current.currentTime;
      if (absoluteBefore < 300 && targetTime > absoluteBefore) {
        const diff = targetTime - absoluteBefore;
        // Intros are usually between 30 and 200 seconds long
        if (diff >= 30 && diff <= 200) {
          const { cleanTitle } = parseSeriesEpisodeInfo(selectedChannel.name);
          const key = `intro_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
          const introData = { from: Math.floor(absoluteBefore), to: Math.floor(targetTime) };
          localStorage.setItem(key, JSON.stringify(introData));
          learnedIntroRef.current = introData;
          setLearnedIntro(introData);
          showToast(getTranslation('feedback.player.introPointSaved', language, {
            title: cleanTitle,
            start: formatPlayerTime(introData.from),
            end: formatPlayerTime(introData.to),
          }));
        }
      }
    }

    pendingSeekTimeRef.current = targetTime;
    lastRequestedSeekRef.current = targetTime;
    seekGraceUntilRef.current = Date.now() + 20000;
    setCurrentTime(targetTime);

    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

    // Timeline jumps (absolute): start immediately — the old 150ms debounce felt like lag.
    // Relative skips still debounce so rapid ←/→ presses coalesce into one FFmpeg restart.
    if (!isRelative) {
      pendingSeekTimeRef.current = null;
      void executeSeek(targetTime);
      return;
    }

    // Short debounce so rapid ←/→ coalesce, but a single 10s skip still feels instant.
    const debounceMs = isTranscodingRef.current ? 140 : 80;
    seekTimeoutRef.current = setTimeout(() => {
      const finalTargetTime = pendingSeekTimeRef.current;
      if (finalTargetTime === null) return;
      pendingSeekTimeRef.current = null;
      void executeSeek(finalTargetTime);
    }, debounceMs);
  };

  const handleTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    handlePlayerSeek(newTime, false);
  };

  const handleSeekForward = () => {
    if (!videoRef.current) return;
    const current = seekOffsetRef.current + videoRef.current.currentTime;
    const target = Math.min(duration, current + 10);
    handlePlayerSeek(target);
  };

  const handleSeekBackward = () => {
    if (!videoRef.current) return;
    const current = seekOffsetRef.current + videoRef.current.currentTime;
    const target = Math.max(0, current - 10);
    handlePlayerSeek(target);
  };

  const sessionContext = {
    selectedChannel, saveWatchProgress, showToast, language, videoReady,
    videoRef, hlsInstanceRef, seekOffsetRef, isTranscodingRef,
    localBrowserSafeRef, probedVideoCodecRef, activeAudioStreamIdRef,
    seekRequestIdRef, seekTimeoutRef, startupTimeoutRef,
    recoveryAttemptRef, lastRecoveryTimeRef, hlsNetworkRecoveriesRef,
    hlsMediaRecoveriesRef, lastBufferedUpdateRef, seekGraceUntilRef,
    lastRequestedSeekRef, lastFfmpegRestartAtRef, ffmpegRestartInFlightRef,
    forcedTranscodeModeRef, pausedTimeRef, resumeTimeRef, learnedIntroRef,
    playbackSpeedRef, playerVolumeRef, playerMutedRef, durationRef,
    invokeFfmpegProxy, getTranscodeMode, forceUnmute, handlePlayerSeek, resetSubtitles,
    setIsPlaying, setCurrentTime, setDuration, setFfmpegFallbackActive,
    setBufferedProgress, setVideoReady, setPlaybackStatus, setPlaybackMessage,
    setQualityLevels, setActiveQualityLevel, setAudioTracks, setActiveAudioTrack,
    setSubtitleTracks, setActiveSubtitle, setLearnedIntro, setShowIntroSkip,
  };
  useCinematicPlayerSession(sessionContext);

  return {
    videoRef,
    playerContainerRef,
    subtitleRef,
    isPlaying,
    currentTime,
    duration,
    playerVolume,
    playerMuted,
    ffmpegFallbackActive,
    showControls,
    videoReady,
    playbackStatus,
    playbackMessage,
    playbackSpeed,
    showSpeedMenu,
    qualityLevels,
    activeQualityLevel,
    audioTracks,
    activeAudioTrack,
    subtitleTracks,
    activeSubtitle,
    showSubtitleMenu,
    isFullscreen,
    bufferedProgress,
    showIntroSkip,
    learnedIntro,
    
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setPlayerVolume,
    setPlayerMuted,
    setShowControls,
    setVideoReady,
    setPlaybackSpeed,
    setShowSpeedMenu,
    setAudioTracks,
    setActiveAudioTrack,
    setSubtitleTracks,
    setActiveSubtitle,
    setShowSubtitleMenu,
    setIsFullscreen,

    handlePlayerMouseMove,
    handlePlayerMouseLeave,
    handleTogglePlay,
    handlePlayerSeek,
    handleTimelineSeek,
    handlePlayerVolumeChange,
    handleTogglePlayerMute,
    handleSpeedChange,
    handleQualityChange,
    handleSeekForward,
    handleSeekBackward,
    handleToggleFullscreen,
    handleAudioTrackChange,
    handleSubtitleUpload,
    handleSubtitleChange,
    handlePlayerPiP,
    formatPlayerTime,
    handleSkipIntro
  };
}
