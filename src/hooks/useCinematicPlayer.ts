import { useState, useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import type { PlaylistItem } from '../utils/m3uParser';
import { useSettings } from '../context/SettingsContext';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { getPlaybackSettings } from '../utils/playbackSettings';

interface UseCinematicPlayerProps {
  selectedChannel: PlaylistItem | null;
  saveWatchProgress: (item: PlaylistItem, time: number, total: number) => void;
  showToast: (message: string) => void;
}

import { getLoadingMessage, getPlaybackFailureMessage, getPreferredAudioTrackIndex, getRecoveringMessage, getSavedPlaybackSpeed, getSavedPlayerMuted, getSavedPlayerVolume, getSavedQualityLevel, getTranscodingMessage, PLAYER_AUDIO_PREF_KEY, PLAYER_MUTED_KEY, PLAYER_QUALITY_KEY, PLAYER_SPEED_KEY, PLAYER_VOLUME_KEY, translateReason } from './cinematicPlayerHelpers';
import type { PlaybackStatus, PlayerQualityLevel } from './cinematicPlayerHelpers';
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
  const controlsTimeoutRef = useRef<any>(null);
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
  const subtitleObjectUrlsRef = useRef<string[]>([]);
  const subtitleRef = useRef<HTMLTrackElement>(null);
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
  const [playerVolume, setPlayerVolume] = useState(getSavedPlayerVolume);
  const [playerMuted, setPlayerMuted] = useState(getSavedPlayerMuted);
  const [ffmpegFallbackActive, setFfmpegFallbackActive] = useState(false);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('loading');
  const [playbackMessage, setPlaybackMessage] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(getSavedPlaybackSpeed);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<PlayerQualityLevel[]>([]);
  const [activeQualityLevel, setActiveQualityLevel] = useState(getSavedQualityLevel);

  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState(0);
  const [subtitleTracks, setSubtitleTracks] = useState<{ label: string; srclang: string; src: string }[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);



  const playbackSpeedRef = useRef(playbackSpeed);
  const playerVolumeRef = useRef(playerVolume);
  const playerMutedRef = useRef(playerMuted);
  const durationRef = useRef(duration);

  useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => {
    playerVolumeRef.current = playerVolume;
    localStorage.setItem(PLAYER_VOLUME_KEY, String(playerVolume));
  }, [playerVolume]);
  useEffect(() => {
    playerMutedRef.current = playerMuted;
    localStorage.setItem(PLAYER_MUTED_KEY, String(playerMuted));
  }, [playerMuted]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const scheduleControlsHide = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 2500);
  };

  const handlePlayerMouseMove = () => {
    setShowControls(true);
    scheduleControlsHide();
  };

  const handlePlayerMouseLeave = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(false);
  };

  useEffect(() => {
    if (!selectedChannel) {
      setShowControls(true);
      return;
    }

    setShowControls(true);
    scheduleControlsHide();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [selectedChannel]);

  useEffect(() => {
    if (!selectedChannel) {
      document.documentElement.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');
      return;
    }

    const cursor = showControls ? 'default' : 'none';
    document.documentElement.style.cursor = cursor;
    document.body.style.cursor = cursor;

    return () => {
      document.documentElement.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');
    };
  }, [selectedChannel, showControls]);

  const forceUnmute = () => {
    if (videoRef.current) {
      if (!playerMutedRef.current && videoRef.current.muted) {
        videoRef.current.muted = false;
      }
    }
  };

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
          showToast(
            language === 'tr'
              ? `"${cleanTitle}" için giriş atlama noktası kaydedildi (${formatPlayerTime(introData.from)} - ${formatPlayerTime(introData.to)})`
              : `Saved intro skip point for "${cleanTitle}" (${formatPlayerTime(introData.from)} - ${formatPlayerTime(introData.to)})`
          );
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

  const handlePlayerVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setPlayerVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      if (vol > 0) {
        videoRef.current.muted = false;
        setPlayerMuted(false);
      } else {
        videoRef.current.muted = true;
        setPlayerMuted(true);
      }
    }
  };

  const handleTogglePlayerMute = () => {
    if (!videoRef.current) return;
    const nextMute = !playerMuted;
    setPlayerMuted(nextMute);
    videoRef.current.muted = nextMute;
    if (!nextMute && playerVolume === 0) {
      setPlayerVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    localStorage.setItem(PLAYER_SPEED_KEY, String(speed));
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleQualityChange = (levelId: number) => {
    setActiveQualityLevel(levelId);
    localStorage.setItem(PLAYER_QUALITY_KEY, String(levelId));
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.currentLevel = levelId;
      hlsInstanceRef.current.loadLevel = levelId;
    }
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

  const handleToggleFullscreen = async () => {
    if (!playerContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await playerContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleAudioTrackChange = async (trackId: number) => {
    setActiveAudioTrack(trackId);
    const selectedTrack = audioTracks.find(track => track.id === trackId);
    if (selectedTrack) {
      localStorage.setItem(PLAYER_AUDIO_PREF_KEY, JSON.stringify({
        name: selectedTrack.name,
        lang: selectedTrack.lang
      }));
    }
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.audioTrack = trackId;
    } else {
      const video = videoRef.current;
      const nativeTracks = video ? (video as any).audioTracks : null;
      
      // Use transcoding if we are already transcoding, or if native audio tracks are not available
      const useTranscoding = isTranscodingRef.current || (!nativeTracks || nativeTracks.length === 0);
      
      if (useTranscoding && selectedChannel && window.electronAPI?.startFfmpegProxy && video) {
        const trackInfo = audioTracks.find(t => t.id === trackId);
        const streamId = (trackInfo as any)?.streamId;
        activeAudioStreamIdRef.current = streamId;
        
        showToast(translateReason("Ses dili değiştiriliyor (Transcode)...", language));
        const currentPos = video.currentTime;
        try {
          const result = await invokeFfmpegProxy(
            seekOffsetRef.current + currentPos,
            streamId,
          );
          if (result.success && result.url) {
            seekOffsetRef.current = seekOffsetRef.current + currentPos;
            isTranscodingRef.current = true;
            setFfmpegFallbackActive(true);
            video.src = result.url;
            video.play().then(forceUnmute).catch(() => { });
          }
        } catch (e) {
          console.error("Transcoded audio track change error:", e);
        }
      } else if (video && nativeTracks) {
        for (let i = 0; i < nativeTracks.length; i++) {
          nativeTracks[i].enabled = (i === trackId);
        }
      }
    }
  };

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    subtitleObjectUrlsRef.current.push(objectUrl);

    const newTrack = {
      label: file.name.slice(0, 20) + (file.name.length > 20 ? '...' : ''),
      srclang: 'custom',
      src: objectUrl
    };

    setSubtitleTracks(prev => {
      const updated = [...prev, newTrack];
      setActiveSubtitle(updated.length - 1);
      return updated;
    });

    showToast(translateReason("Altyazı yüklendi.", language));
    setShowSubtitleMenu(false);
  };

  const handlePlayerPiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current !== document.pictureInPictureElement) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.error("PiP error:", e);
      showToast(translateReason("Resim içinde resim bu cihazda desteklenmiyor olabilir.", language));
    }
  };

  const formatPlayerTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const minsStr = mins.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${hrs}:${minsStr}:${secsStr}`;
    }
    return `${minsStr}:${secsStr}`;
  };

  // Main Media Source setup effect
  useEffect(() => {
    if (!selectedChannel || !videoRef.current) return;
    setIsPlaying(true);
    setCurrentTime(0);
    setBufferedProgress(0);
    setDuration(selectedChannel.duration && selectedChannel.duration > 0 ? selectedChannel.duration : 0);

    // Load learned intro for series
    if (selectedChannel.type === 'series') {
      const { cleanTitle } = parseSeriesEpisodeInfo(selectedChannel.name);
      const key = `intro_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setLearnedIntro(parsed);
          learnedIntroRef.current = parsed;
        } catch {
          setLearnedIntro(null);
          learnedIntroRef.current = null;
        }
      } else {
        setLearnedIntro(null);
        learnedIntroRef.current = null;
      }
    } else {
      setLearnedIntro(null);
      learnedIntroRef.current = null;
    }
    setShowIntroSkip(false);
    setAudioTracks([]);
    setActiveAudioTrack(0);
    setQualityLevels([]);
    setActiveQualityLevel(getSavedQualityLevel());
    setVideoReady(false);
    setPlaybackStatus('loading');
    setPlaybackMessage(getLoadingMessage(selectedChannel, language));

    const video = videoRef.current;
    video.playbackRate = playbackSpeedRef.current;
    setFfmpegFallbackActive(false);
    isTranscodingRef.current = false;
    localBrowserSafeRef.current = false;
    forcedTranscodeModeRef.current = null;
    ffmpegRestartInFlightRef.current = false;
    lastFfmpegRestartAtRef.current = 0;
    probedVideoCodecRef.current = 'unknown';
    activeAudioStreamIdRef.current = undefined;
    seekRequestIdRef.current = 0;
    seekOffsetRef.current = 0;
    seekGraceUntilRef.current = 0;
    lastRequestedSeekRef.current = null;
    recoveryAttemptRef.current = 0;
    lastRecoveryTimeRef.current = 0;
    hlsNetworkRecoveriesRef.current = 0;
    hlsMediaRecoveriesRef.current = 0;
    lastBufferedUpdateRef.current = 0;

    // Restore the user's last volume and mute preference.
    video.muted = playerMutedRef.current;
    video.volume = playerVolumeRef.current;

    let active = true;
    const playbackSettings = getPlaybackSettings();
    const connectionTimeoutMs = playbackSettings.connectionTimeoutSeconds * 1000;

    const clearStartupTimeout = () => {
      if (startupTimeoutRef.current) {
        clearTimeout(startupTimeoutRef.current);
        startupTimeoutRef.current = null;
      }
    };

    const failPlayback = (reason?: string) => {
      if (!active) return;
      clearStartupTimeout();
      const message = getPlaybackFailureMessage(selectedChannel, reason, language);
      setPlaybackStatus('error');
      setPlaybackMessage(message);
      setVideoReady(false);
      showToast(message);
    };

    const armStartupTimeout = () => {
      clearStartupTimeout();
      startupTimeoutRef.current = window.setTimeout(() => {
        if (!active || videoReady || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
        if (!isTranscodingRef.current && window.electronAPI?.startFfmpegProxy) {
          startFfmpegFallback(undefined, 'Ilk kare gecikti');
        } else {
          failPlayback('Sunucu zamaninda yanit vermedi');
        }
      }, connectionTimeoutMs);
    };

    const startFfmpegFallback = async (forceStartTime?: number, reason?: string) => {
      if (!active) return;
      if (selectedChannel.type === 'live') {
        forceStartTime = 0;
      }
      if (!window.electronAPI?.startFfmpegProxy) {
        failPlayback('FFmpeg uyumluluk modu kullanilamiyor');
        return;
      }

      // Prevent restart thrash when FFmpeg dies mid-episode (common IPTV series issue).
      const now = Date.now();
      if (ffmpegRestartInFlightRef.current) {
        console.warn('[AutoTranscode] Restart already in flight, skipping');
        return;
      }
      if (now - lastFfmpegRestartAtRef.current < 3500) {
        console.warn('[AutoTranscode] Restart throttled');
        return;
      }
      lastFfmpegRestartAtRef.current = now;
      ffmpegRestartInFlightRef.current = true;

      const currentPos = forceStartTime !== undefined
        ? forceStartTime
        : (seekOffsetRef.current + (video.currentTime || 0));
      console.warn(`[AutoTranscode] Transcoding triggered. Starting from second: ${currentPos}`);
      isTranscodingRef.current = true;
      setFfmpegFallbackActive(true);
      setPlaybackStatus('transcoding');
      const msg = getTranscodingMessage(selectedChannel, language);
      setPlaybackMessage(reason ? `${msg} ${translateReason(reason, language)}` : msg);
      setBufferedProgress(0);
      armStartupTimeout();
      try {
        const result = await invokeFfmpegProxy(
          currentPos,
          activeAudioStreamIdRef.current,
        );
        if (!active) return;
        if (result.success && result.url) {
          if (hlsInstanceRef.current) {
            hlsInstanceRef.current.destroy();
            hlsInstanceRef.current = null;
          }
          seekOffsetRef.current = currentPos;
          if (!video.isConnected || !active) return;
          video.src = result.url;
          video.muted = playerMutedRef.current;
          video.volume = playerVolumeRef.current;
          video.play().catch(() => { });
        } else {
          isTranscodingRef.current = false;
          setFfmpegFallbackActive(false);
          failPlayback(result.error || 'Uyumluluk modu baslatilamadi');
        }
      } catch (err) {
        console.error('[AutoTranscode] Fallback error:', err);
        isTranscodingRef.current = false;
        setFfmpegFallbackActive(false);
        failPlayback('Uyumluluk modu hata verdi');
      } finally {
        ffmpegRestartInFlightRef.current = false;
      }
    };

    const onVideoError = () => {
      const err = video.error;
      console.warn('Video error:', err?.code, err?.message);

      if (selectedChannel.type === 'live') {
        const now = Date.now();
        if (now - lastRecoveryTimeRef.current < 4000) {
          console.warn("[Player] Video error recovery throttled (already attempted recently)");
          return;
        }
        lastRecoveryTimeRef.current = now;

        recoveryAttemptRef.current += 1;
        if (recoveryAttemptRef.current <= playbackSettings.retryCount) {
          if (isTranscodingRef.current) {
            console.warn("[Player] Video error on transcoding live stream. Restarting fallback...");
            setPlaybackStatus('recovering');
            setPlaybackMessage(getRecoveringMessage(selectedChannel, language));
            showToast(translateReason("Yayin akisi kurtariliyor...", language));
            startFfmpegFallback(0, 'Yerel oynatma basarisiz oldu');
          } else {
            console.warn("[Player] Video error detected on live stream. Attempting recovery...");
            setPlaybackStatus('recovering');
            setPlaybackMessage(getRecoveringMessage(selectedChannel, language));
            showToast(translateReason("Yayin akisi kurtariliyor...", language));

            const playUrl = selectedChannel.url;
            loadPlayerSource(playUrl, false);

            const playLive = () => {
              video.play().then(forceUnmute).catch(() => {});
            };
            video.addEventListener('loadedmetadata', playLive, { once: true });
          }
          return;
        } else {
          failPlayback('Yerel oynatma basarisiz oldu');
          return;
        }
      }

      if (isTranscodingRef.current) {
        // Copy remux can produce a stream Chromium rejects — escalate to full once.
        if (getTranscodeMode() === 'copy' && forcedTranscodeModeRef.current !== 'full') {
          console.warn('[AutoTranscode] Copy mode rejected by decoder, escalating to full');
          forcedTranscodeModeRef.current = 'full';
          lastFfmpegRestartAtRef.current = 0; // allow immediate escalation restart
          startFfmpegFallback(
            seekOffsetRef.current + (video.currentTime || 0),
            'Yerel oynatma basarisiz oldu',
          );
          return;
        }
        failPlayback(err?.message || 'Video cozulurken hata olustu');
        return;
      }
      if (err?.code === 4 || err?.code === 3) {
        // Native app-file often fails (no faststart / path quirks) even when WMP
        // plays the file. Fall back to FFmpeg; local copy mode remuxes without
        // re-encoding audio so lip-sync matches the file on disk.
        startFfmpegFallback(undefined, 'Yerel oynatma basarisiz oldu');
      } else {
        failPlayback(err?.message || 'Oynatma hatasi');
      }
    };

    const unmuteInterval = setInterval(forceUnmute, 500);

    const onInteract = () => forceUnmute();
    let transcodeMetadataProbeStarted = false;

    const probeTranscodedMetadata = async () => {
      if (
        transcodeMetadataProbeStarted ||
        selectedChannel.type === 'live' ||
        !window.electronAPI?.probeAudioCodec
      ) return;

      transcodeMetadataProbeStarted = true;
      try {
        const result = await window.electronAPI.probeAudioCodec(selectedChannel.url);
        if (!active || !result.success) return;

        if (result.videoCodec) {
          probedVideoCodecRef.current = result.videoCodec.toLowerCase();
        }

        if (result.duration && result.duration > 0) {
          setDuration(result.duration);
        }

        if (result.audioStreams && result.audioStreams.length > 0) {
          setAudioTracks(result.audioStreams);
          const turkishTrackIndex = result.audioStreams.findIndex(
            track => track.name?.toLowerCase().includes('türk') || track.name?.toLowerCase().includes('turk') || track.lang === 'tr'
          );
          const selectedTrackIndex = turkishTrackIndex >= 0 ? turkishTrackIndex : 0;
          setActiveAudioTrack(selectedTrackIndex);
          activeAudioStreamIdRef.current = result.audioStreams[selectedTrackIndex]?.streamId;
        }
      } catch (error) {
        console.warn('[AutoTranscode] Metadata probe failed:', error);
      }
    };

    const onPlaying = () => {
      clearStall();
      clearStartupTimeout();
      forceUnmute();
      setVideoReady(true);
      setPlaybackStatus('playing');
      setPlaybackMessage('');
      recoveryAttemptRef.current = 0;
      hlsNetworkRecoveriesRef.current = 0;
      hlsMediaRecoveriesRef.current = 0;
      if (isTranscodingRef.current) {
        void probeTranscodedMetadata();
      }
    };

    // Native seek often stays in "playing" state and only fires seeked — clear HUD here.
    const onSeekedClear = () => {
      clearStall();
      setPlaybackStatus(prev => (prev === 'seeking' ? 'playing' : prev));
      setPlaybackMessage(prev => (prev.startsWith('İleri sarılıyor') || prev.startsWith('Seeking') ? '' : prev));
    };

    let hasResumed = false;
    const resumePlayback = (durationVal: number) => {
      if (hasResumed) return;

      const targetTime = resumeTimeRef.current !== null
        ? resumeTimeRef.current
        : (selectedChannel.currentTime || 0);

      if (targetTime > 5) {
        const isNearEnd = durationVal && (durationVal - targetTime < 10 || targetTime / durationVal > 0.97);
        if (!isNearEnd) {
          hasResumed = true;
          resumeTimeRef.current = null; // consume it
          if (isTranscodingRef.current) {
            // Already opened FFmpeg at this offset during init — avoid double restart.
            if (Math.abs(targetTime - seekOffsetRef.current) > 2) {
              handlePlayerSeek(targetTime);
            }
          } else {
            video.currentTime = targetTime;
            // Explicitly play to prevent the browser from stalling the video due to an interrupted loading/play promise
            video.play().then(forceUnmute).catch(() => { });
          }
          showToast(
            language === 'en'
              ? `Resumed playback from: ${formatPlayerTime(targetTime)}`
              : `Kaldığınız yerden devam ediliyor: ${formatPlayerTime(targetTime)}`
          );
        }
      }
    };

    const onLoadedMetadata = () => {
      resumePlayback(video.duration || 0);

      // Detect native audio tracks (for MP4, MKV, etc.)
      const nativeTracks = (video as any).audioTracks;
      if (nativeTracks && nativeTracks.length > 0) {
        const tracks = [];
        for (let i = 0; i < nativeTracks.length; i++) {
          const t = nativeTracks[i];
          tracks.push({
            id: i,
            name: t.label || t.language || `Parça ${i + 1}`,
            lang: t.language || ''
          });
        }
        setAudioTracks(tracks);
        // Find active one
        for (let i = 0; i < nativeTracks.length; i++) {
          if (nativeTracks[i].enabled) {
            setActiveAudioTrack(i);
            break;
          }
        }
      }
    };

    const handleNativeTracks = () => {
      if (!active) return;
      const nativeTracks = (video as any).audioTracks;
      if (nativeTracks) {
        const tracks = [];
        for (let i = 0; i < nativeTracks.length; i++) {
          const t = nativeTracks[i];
          tracks.push({
            id: i,
            name: t.label || t.language || `Parça ${i + 1}`,
            lang: t.language || ''
          });
        }
        setAudioTracks(tracks);
      }
    };

    if ((video as any).audioTracks) {
      (video as any).audioTracks.addEventListener('addtrack', handleNativeTracks);
      (video as any).audioTracks.addEventListener('removetrack', handleNativeTracks);
      (video as any).audioTracks.addEventListener('change', handleNativeTracks);
    }

    let lastSavedTime = selectedChannel.currentTime || 0;
    let lastSavedStateTime = -1;

    const updateBufferedProgress = (force = false) => {
      if (!video) return;
      const bufferedNow = Date.now();
      if (!force && bufferedNow - lastBufferedUpdateRef.current < 500) return;
      lastBufferedUpdateRef.current = bufferedNow;
      const total = isTranscodingRef.current && durationRef.current > 0 ? durationRef.current : (video.duration || 0);
      if (video.buffered.length > 0 && total > 0) {
        const currentPos = video.currentTime;
        let activeRangeEnd = 0;
        for (let i = 0; i < video.buffered.length; i++) {
          const start = video.buffered.start(i);
          const end = video.buffered.end(i);
          if (currentPos >= start && currentPos <= end) {
            activeRangeEnd = end;
            break;
          }
        }
        if (activeRangeEnd === 0 && video.buffered.length > 0) {
          const lastEnd = video.buffered.end(video.buffered.length - 1);
          if (lastEnd >= currentPos) {
            activeRangeEnd = lastEnd;
          }
        }
        const absoluteBufferedTime = seekOffsetRef.current + activeRangeEnd;
        const pct = (absoluteBufferedTime / total) * 100;
        setBufferedProgress(Math.min(100, Math.max(0, pct)));
      } else {
        setBufferedProgress(0);
      }
    };

    const timeUpdate = () => {
      const now = seekOffsetRef.current + video.currentTime;
      if (Math.floor(now) !== Math.floor(lastSavedStateTime)) {
        lastSavedStateTime = now;
        setCurrentTime(now);
      }
      if (video.currentTime > 0.1) {
        setVideoReady(prev => prev ? prev : true);
      }
      if (Math.abs(now - lastSavedTime) >= 10) {
        lastSavedTime = now;
        const total = isTranscodingRef.current && durationRef.current > 0 ? durationRef.current : (video.duration || 0);
        if (total > 0) {
          saveWatchProgress(selectedChannel, now, total);
        }
      }
      updateBufferedProgress();

      // Check learned intro boundaries
      const intro = learnedIntroRef.current;
      if (intro) {
        if (now >= intro.from && now < intro.to - 4) {
          setShowIntroSkip(true);
        } else {
          setShowIntroSkip(false);
        }
      } else {
        setShowIntroSkip(false);
      }
    };

    const durationChange = () => {
      if (isTranscodingRef.current) return;
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const onPlayEvent = () => {
      clearStall();
      forceUnmute();
      setIsPlaying(true);
      pausedTimeRef.current = null;
    };

    const onPauseEvent = () => {
      clearStall();
      setIsPlaying(false);
      pausedTimeRef.current = Date.now();
      const total = isTranscodingRef.current && durationRef.current > 0 ? durationRef.current : (video.duration || 0);
      if (total > 0) {
        saveWatchProgress(selectedChannel, seekOffsetRef.current + video.currentTime, total);
      }
    };

    let stallTimeout: any = null;

    const onWaiting = () => {
      if (stallTimeout) clearTimeout(stallTimeout);
      const waitStartedAt = Date.now();
      // Transcode path buffers more slowly; don't kill FFmpeg too eagerly.
      const stallDelay = isTranscodingRef.current
        ? Math.max(connectionTimeoutMs, 35000)
        : connectionTimeoutMs;
      stallTimeout = setTimeout(() => {
        if (!active || !video || !selectedChannel) return;
        if (video.seeking || Date.now() < seekGraceUntilRef.current) return;
        if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
        console.warn("[Player] Stall detected! Attempting recovery...");
        
        if (selectedChannel.type === 'live') {
          const now = Date.now();
          if (now - lastRecoveryTimeRef.current < 4000) {
            console.warn("[Player] Stall recovery throttled (already attempted recently)");
            return;
          }
          lastRecoveryTimeRef.current = now;
        }

        setPlaybackStatus('recovering');
        setPlaybackMessage(getRecoveringMessage(selectedChannel, language));

        const currentPos = lastRequestedSeekRef.current !== null && waitStartedAt < seekGraceUntilRef.current
          ? lastRequestedSeekRef.current - seekOffsetRef.current
          : video.currentTime;
        recoveryAttemptRef.current += 1;
        if (isTranscodingRef.current) {
          if (recoveryAttemptRef.current > playbackSettings.retryCount) {
            failPlayback('Akis kurtarilamadi');
            return;
          }
          startFfmpegFallback(seekOffsetRef.current + currentPos, 'Akis takildi');
        } else if (selectedChannel.type !== 'live' && window.electronAPI?.startFfmpegProxy) {
          if (recoveryAttemptRef.current > playbackSettings.retryCount) {
            failPlayback('Video bu noktadan devam edemedi');
            return;
          }
          startFfmpegFallback(Math.max(0, seekOffsetRef.current + currentPos), 'Seek sonrasi akis takildi');
        } else {
          if (selectedChannel.type === 'live' && recoveryAttemptRef.current > playbackSettings.retryCount) {
            failPlayback('Akis kurtarilamadi');
            return;
          }
          const playUrl = selectedChannel.url;
          loadPlayerSource(playUrl, false);
          
          if (selectedChannel.type === 'live') {
            const playLive = () => {
              video.play().then(forceUnmute).catch(() => {});
            };
            video.addEventListener('loadedmetadata', playLive, { once: true });
          } else {
            const restoreTime = () => {
              video.currentTime = currentPos;
              video.play().then(forceUnmute).catch(() => {});
            };
            video.addEventListener('loadedmetadata', restoreTime, { once: true });
          }
        }
        showToast(translateReason("Yayin akisi kurtariliyor...", language));
      }, stallDelay);
    };

    const clearStall = () => {
      if (stallTimeout) {
        clearTimeout(stallTimeout);
        stallTimeout = null;
      }
    };

    video.addEventListener('error', onVideoError);
    video.addEventListener('play', onPlayEvent);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onPlaying);
    video.addEventListener('volumechange', onInteract);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', timeUpdate);
    video.addEventListener('durationchange', durationChange);
    video.addEventListener('pause', onPauseEvent);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('seeking', clearStall);
    video.addEventListener('seeked', onSeekedClear);
    const onProgress = () => updateBufferedProgress(true);
    video.addEventListener('progress', onProgress);

    const loadPlayerSource = async (urlToPlay: string, transcodeActive: boolean) => {
      if (!active) return;
      if (urlToPlay.includes('.m3u8')) {
        const { default: HlsPlayer } = await import('hls.js');
        if (!active) return;

        if (!HlsPlayer.isSupported()) {
          video.src = urlToPlay;
          forceUnmute();
          await video.play().then(forceUnmute).catch(() => {
            if (!transcodeActive) startFfmpegFallback(undefined, 'HLS yerel oynatma baslamadi');
          });
          return;
        }

        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
        }
        const configuredBufferLength = playbackSettings.bufferEnabled
          ? playbackSettings.bufferSeconds
          : 30;
        const hls = new HlsPlayer({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: configuredBufferLength,
          maxMaxBufferLength: Math.max(60, configuredBufferLength * 2),
          manifestLoadingTimeOut: connectionTimeoutMs,
          fragLoadingTimeOut: connectionTimeoutMs,
          manifestLoadingMaxRetry: playbackSettings.retryCount,
          fragLoadingMaxRetry: playbackSettings.retryCount,
          enableSoftwareAES: true,
          abrEwmaDefaultEstimate: 40000000,
          xhrSetup: (xhr) => {
            xhr.setRequestHeader('User-Agent', 'VLC/3.0.20 LibVLC/3.0.20');
          }
        });
        hlsInstanceRef.current = hls;

        hls.loadSource(urlToPlay);
        hls.attachMedia(video);

        hls.on(HlsPlayer.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
          if (data.audioTracks && data.audioTracks.length > 0) {
            const tracks = data.audioTracks.map((t: any, i: number) => ({
              id: i,
              name: t.name || `Track ${i + 1}`,
              lang: t.lang || ''
            }));
            setAudioTracks(tracks);
            const trTrack = data.audioTracks.findIndex(
              (t: any) => t.name?.toLowerCase().includes('türk') || t.name?.toLowerCase().includes('turk') || t.lang === 'tr'
            );
            const selectedTrack = trTrack >= 0 ? trTrack : 0;
            hls.audioTrack = selectedTrack;
            setActiveAudioTrack(selectedTrack);
            const preferredTrack = getPreferredAudioTrackIndex(tracks);
            hls.audioTrack = preferredTrack;
            setActiveAudioTrack(preferredTrack);
          }
          forceUnmute();
        });

        hls.on(HlsPlayer.Events.MANIFEST_PARSED, () => {
          forceUnmute();
          if (hls.levels && hls.levels.length > 0) {
            hls.loadLevel = hls.levels.length - 1;
            const levels = hls.levels.map((level: any, index: number) => {
              const height = Number(level.height) || undefined;
              const bitrate = Number(level.bitrate) || undefined;
              return {
                id: index,
                height,
                bitrate,
                label: height
                  ? `${height}p`
                  : bitrate
                    ? `${Math.round(bitrate / 1000)} kbps`
                    : `Level ${index + 1}`
              };
            });
            setQualityLevels(levels);
            const savedQuality = getSavedQualityLevel();
            const selectedLevel = savedQuality >= 0 && levels.some(level => level.id === savedQuality)
              ? savedQuality
              : -1;
            hls.currentLevel = selectedLevel;
            hls.loadLevel = selectedLevel;
            setActiveQualityLevel(selectedLevel);
          }
          resumePlayback(video.duration || 0);
          video.play().then(forceUnmute).catch(() => { });
        });

        hls.on(HlsPlayer.Events.FRAG_LOADED, () => {
          forceUnmute();
        });

        const handleLiveHlsFatalError = (errorMsg: string) => {
          const now = Date.now();
          if (now - lastRecoveryTimeRef.current < 4000) {
            console.warn("[Player] Fatal HLS recovery throttled (already attempted recently)");
            return;
          }
          lastRecoveryTimeRef.current = now;

          recoveryAttemptRef.current += 1;
          if (recoveryAttemptRef.current <= playbackSettings.retryCount) {
            console.warn(`[Player] Fatal HLS error (${errorMsg}) on live stream. Reloading stream...`);
            setPlaybackStatus('recovering');
            setPlaybackMessage(getRecoveringMessage(selectedChannel, language));
            showToast(translateReason("Yayin akisi kurtariliyor...", language));

            const playUrl = selectedChannel.url;
            loadPlayerSource(playUrl, false);

            const playLive = () => {
              video.play().then(forceUnmute).catch(() => {});
            };
            video.addEventListener('loadedmetadata', playLive, { once: true });
          } else {
            failPlayback(errorMsg);
          }
        };

        hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
          console.warn('HLS error:', data.type, data.details);
          if (data.fatal) {
            if (data.type === 'networkError') {
              hlsNetworkRecoveriesRef.current += 1;
              if (hlsNetworkRecoveriesRef.current <= playbackSettings.retryCount) {
                setPlaybackStatus('recovering');
                setPlaybackMessage(getRecoveringMessage(selectedChannel));
                hls.startLoad();
              } else if (selectedChannel.type === 'live') {
                handleLiveHlsFatalError('HLS ag hatasi');
              } else if (!transcodeActive) {
                startFfmpegFallback(undefined, 'HLS ag hatasi');
              } else {
                failPlayback('HLS ag hatasi');
              }
            } else if (data.type === 'mediaError') {
              hlsMediaRecoveriesRef.current += 1;
              try {
                if (hlsMediaRecoveriesRef.current <= playbackSettings.retryCount) {
                  setPlaybackStatus('recovering');
                  setPlaybackMessage(getRecoveringMessage(selectedChannel));
                  hls.recoverMediaError();
                } else if (selectedChannel.type === 'live') {
                  handleLiveHlsFatalError('HLS medya hatasi');
                } else if (!transcodeActive) {
                  startFfmpegFallback(undefined, 'HLS medya hatasi');
                } else {
                  failPlayback('HLS medya hatasi');
                }
              } catch {
                if (selectedChannel.type === 'live') {
                  handleLiveHlsFatalError('HLS medya kurtarma basarisiz');
                } else if (!transcodeActive) {
                  startFfmpegFallback(undefined, 'HLS medya kurtarma basarisiz');
                } else {
                  failPlayback('HLS medya kurtarma basarisiz');
                }
              }
            } else if (selectedChannel.type === 'live') {
              handleLiveHlsFatalError('HLS oynatma hatasi');
            } else if (!transcodeActive) {
              startFfmpegFallback(undefined, 'HLS oynatma hatasi');
            } else {
              failPlayback('HLS oynatma hatasi');
            }
          }
        });
      } else {
        video.src = urlToPlay;
        forceUnmute();
        video.play().then(forceUnmute).catch(() => {
          if (!transcodeActive) startFfmpegFallback(undefined, 'Yerel oynatma baslamadi');
          else failPlayback('Uyumluluk modu baslamadi');
        });
      }
    };

    const init = async () => {
      const playUrl = selectedChannel.url;
      armStartupTimeout();

      let shouldTranscode = false;
      let streamId: number | undefined = undefined;
      const isLocalFile =
        playUrl.startsWith('app-file:') ||
        playUrl.startsWith('file:') ||
        /^[a-zA-Z]:[\\/]/.test(playUrl);

      // Pre-detect unsupported codecs from the file name / URL to ensure instant compatibility mapping
      const nameLower = selectedChannel.name.toLowerCase();
      const urlLower = selectedChannel.url.toLowerCase();
      const hasUnsupportedKeyword =
        nameLower.includes('ac3') || nameLower.includes('ddp') || nameLower.includes('dts') ||
        nameLower.includes('eac3') || nameLower.includes('5.1') || nameLower.includes('truehd') ||
        nameLower.includes('atmos') ||
        urlLower.includes('ac3') || urlLower.includes('ddp') || urlLower.includes('dts') ||
        urlLower.includes('eac3') || urlLower.includes('5.1') || urlLower.includes('truehd') ||
        urlLower.includes('atmos');

      if (hasUnsupportedKeyword) {
        shouldTranscode = true;
      }

      // Codec analysis for non-HLS VOD (remote + local downloads). Local app-file://
      // used to be rejected by the main process, so AC3 downloads never got a
      // working FFmpeg fallback and looked stuck/unopenable.
      if (selectedChannel.type !== 'live' && !playUrl.includes('.m3u8') && window.electronAPI?.probeAudioCodec && window.electronAPI?.startFfmpegProxy) {
        setPlaybackStatus('loading');
        setPlaybackMessage(language === 'tr' ? 'Ses formatı kontrol ediliyor...' : 'Checking audio format...');
        try {
          const res = await window.electronAPI.probeAudioCodec(selectedChannel.url);
          if (!active) return;

          if (res.success) {
            if (res.videoCodec) {
              probedVideoCodecRef.current = res.videoCodec.toLowerCase();
            }

            if (res.duration && res.duration > 0) {
              setDuration(res.duration);
            }

            if (res.audioStreams && res.audioStreams.length > 0) {
              setAudioTracks(res.audioStreams);
              // Automatically select Turkish track if present, otherwise first track
              const trTrack = res.audioStreams.findIndex(
                (t: any) => t.name?.toLowerCase().includes('türk') || t.name?.toLowerCase().includes('turk') || t.lang === 'tr'
              );
              const selectedTrack = trTrack >= 0 ? trTrack : 0;
              setActiveAudioTrack(selectedTrack);
              streamId = res.audioStreams[selectedTrack]?.streamId;
              activeAudioStreamIdRef.current = streamId;
              const preferredTrack = getPreferredAudioTrackIndex(res.audioStreams);
              setActiveAudioTrack(preferredTrack);
              streamId = res.audioStreams[preferredTrack]?.streamId;
              activeAudioStreamIdRef.current = streamId;
            }

            const unsupportedCodecs = ['ac3', 'eac3', 'dts', 'truehd', 'mlp', 'pcm_bluray', 'pcm_s16le'];
            const browserSafeAudio = ['aac', 'mp3', 'opus', 'vorbis', 'mp4a'];
            const selectedCodec = (
              (typeof streamId === 'number'
                ? res.audioStreams?.find(s => s.streamId === streamId)?.codec
                : undefined) || res.codec || ''
            ).toLowerCase();
            if (selectedCodec && unsupportedCodecs.includes(selectedCodec)) {
              shouldTranscode = true;
            }
            // Browser often cannot demux multi-audio IPTV TS cleanly even if one track is AAC.
            if (res.audioStreams && res.audioStreams.length > 1 &&
                res.audioStreams.some(s => unsupportedCodecs.includes((s.codec || '').toLowerCase()))) {
              shouldTranscode = true;
            }
            // Local remux of HEVC often fails natively in Chromium — prefer FFmpeg path.
            if (isLocalFile && res.videoCodec && /hevc|h265|av1|mpeg2video/i.test(res.videoCodec)) {
              shouldTranscode = true;
            }
            // Local H.264 + AAC: Chromium app-file often fails (error 4) even when
            // Windows Media Player is fine (moov placement / range / Unicode paths).
            // Prefer FFmpeg pure remux — main process uses -c:v/-c:a copy for local
            // so timing matches the file (no AAC re-encode lip-sync lag).
            if (
              isLocalFile &&
              !shouldTranscode &&
              res.videoCodec &&
              /h264|avc/i.test(res.videoCodec) &&
              selectedCodec &&
              browserSafeAudio.includes(selectedCodec)
            ) {
              localBrowserSafeRef.current = true;
              shouldTranscode = true;
            }
          } else if (!isLocalFile) {
            // Only force transcode on probe failure for remote streams.
            if (transcodeMode === 'full' || transcodeMode === 'copy') {
              shouldTranscode = true;
            }
          }
        } catch (e) {
          console.error('[AutoTranscode] Error during background codec probing:', e);
        }
      }

      if (shouldTranscode) {
        setPlaybackStatus('transcoding');
        setPlaybackMessage(getTranscodingMessage(selectedChannel, language));
        // Start FFmpeg already at resume position to avoid an immediate second restart.
        let startAt = 0;
        const resumeAt = selectedChannel.currentTime || 0;
        if (selectedChannel.type !== 'live' && resumeAt > 5) {
          startAt = resumeAt;
        }
        isTranscodingRef.current = true;
        armStartupTimeout();
        const transcodeRes = await invokeFfmpegProxy(startAt, streamId);
        if (!active) return;
        if (transcodeRes.success && transcodeRes.url) {
          seekOffsetRef.current = startAt;
          setFfmpegFallbackActive(true);
          await loadPlayerSource(transcodeRes.url, true);
        } else if (isLocalFile) {
          // Fall back to native local play if FFmpeg path fails.
          isTranscodingRef.current = false;
          setFfmpegFallbackActive(false);
          setPlaybackMessage('');
          await loadPlayerSource(playUrl, false);
        } else {
          isTranscodingRef.current = false;
          setFfmpegFallbackActive(false);
          failPlayback(transcodeRes.error || 'Uyumluluk modu baslatilamadi');
        }
      } else {
        setPlaybackMessage('');
        await loadPlayerSource(playUrl, false);
      }
    };

    init().catch((error) => {
      console.error('[Player] Init failed:', error);
      if (!isTranscodingRef.current) {
        startFfmpegFallback(undefined, 'Ilk oynatma basarisiz oldu');
      } else {
        failPlayback('Oynatici baslatilamadi');
      }
    });

    return () => {
      active = false;
      isTranscodingRef.current = false;
      clearStartupTimeout();
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
      clearInterval(unmuteInterval);
      clearStall();
      video.removeEventListener('error', onVideoError);
      video.removeEventListener('play', onPlayEvent);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onPlaying);
      video.removeEventListener('volumechange', onInteract);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', timeUpdate);
      video.removeEventListener('durationchange', durationChange);
      video.removeEventListener('pause', onPauseEvent);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('seeking', clearStall);
      video.removeEventListener('seeked', onSeekedClear);
      video.removeEventListener('progress', onProgress);

      if ((video as any).audioTracks) {
        (video as any).audioTracks.removeEventListener('addtrack', handleNativeTracks);
        (video as any).audioTracks.removeEventListener('removetrack', handleNativeTracks);
        (video as any).audioTracks.removeEventListener('change', handleNativeTracks);
      }
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      subtitleObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      subtitleObjectUrlsRef.current = [];
      setSubtitleTracks([]);
      setActiveSubtitle(-1);

      if (window.electronAPI?.stopFfmpegProxy) {
        window.electronAPI.stopFfmpegProxy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel]);



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
    handlePlayerPiP,
    formatPlayerTime,
    handleSkipIntro
  };
}
