import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import type { PlaylistItem } from '../utils/m3uParser';


interface UseCinematicPlayerProps {
  selectedChannel: PlaylistItem | null;
  onClose: () => void;
  saveWatchProgress: (item: PlaylistItem, time: number, total: number) => void;
  showToast: (message: string) => void;
}

export function useCinematicPlayer({
  selectedChannel,
  onClose,
  saveWatchProgress,
  showToast
}: UseCinematicPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const seekOffsetRef = useRef(0);
  const isTranscodingRef = useRef(false);
  const subtitleObjectUrlsRef = useRef<string[]>([]);
  const subtitleRef = useRef<HTMLTrackElement>(null);

  // States/refs to reload the stream if paused for a long time (TCP/Token timeout recovery)
  const pausedTimeRef = useRef<number | null>(null);
  const resumeTimeRef = useRef<number | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerVolume, setPlayerVolume] = useState(1);
  const [playerMuted, setPlayerMuted] = useState(false);
  const [ffmpegFallbackActive, setFfmpegFallbackActive] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  useEffect(() => { playerVolumeRef.current = playerVolume; }, [playerVolume]);
  useEffect(() => { playerMutedRef.current = playerMuted; }, [playerMuted]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const handlePlayerMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handlePlayerMouseLeave = () => {
    setShowControls(false);
  };

  const forceUnmute = () => {
    if (videoRef.current) {
      if (!playerMutedRef.current && videoRef.current.muted) {
        videoRef.current.muted = false;
      }
    }
  };

  const reloadStreamAtCurrentTime = () => {
    if (videoRef.current) {
      resumeTimeRef.current = seekOffsetRef.current + videoRef.current.currentTime;
    } else {
      resumeTimeRef.current = currentTime;
    }
    setReloadCounter(prev => prev + 1);
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      pausedTimeRef.current = Date.now();
    } else {
      // If paused for more than 60 seconds, reload the stream to refresh connection/token
      if (pausedTimeRef.current && Date.now() - pausedTimeRef.current > 60 * 1000) {
        pausedTimeRef.current = null;
        reloadStreamAtCurrentTime();
        return;
      }
      pausedTimeRef.current = null;
      videoRef.current.play().then(forceUnmute).catch(() => { });
    }
  };

  const handlePlayerSeek = async (newTime: number) => {
    if (!videoRef.current || !selectedChannel) return;
    if (isTranscodingRef.current && window.electronAPI?.startFfmpegProxy) {
      showToast("Yayın yeniden yapılandırılıyor...");
      try {
        const result = await window.electronAPI.startFfmpegProxy(selectedChannel.url, newTime);
        if (result.success && result.url) {
          seekOffsetRef.current = newTime;
          videoRef.current.src = result.url;
          videoRef.current.play().then(forceUnmute).catch(() => { });
        }
      } catch (e) {
        console.error("Transcoded seek error:", e);
      }
    } else {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    handlePlayerSeek(newTime);
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
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
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
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.audioTrack = trackId;
    } else if (isTranscodingRef.current && selectedChannel && window.electronAPI?.startFfmpegProxy && videoRef.current) {
      const trackInfo = audioTracks.find(t => t.id === trackId);
      const streamId = (trackInfo as any)?.streamId;
      
      showToast("Ses dili değiştiriliyor...");
      const currentPos = videoRef.current.currentTime;
      try {
        const result = await window.electronAPI.startFfmpegProxy(selectedChannel.url, seekOffsetRef.current + currentPos, streamId);
        if (result.success && result.url) {
          seekOffsetRef.current = seekOffsetRef.current + currentPos;
          videoRef.current.src = result.url;
          videoRef.current.play().then(forceUnmute).catch(() => { });
        }
      } catch (e) {
        console.error("Transcoded audio track change error:", e);
      }
    } else {
      const video = videoRef.current;
      if (video && (video as any).audioTracks) {
        const list = (video as any).audioTracks;
        for (let i = 0; i < list.length; i++) {
          list[i].enabled = (i === trackId);
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

    showToast("Altyazı yüklendi.");
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
      showToast("Resim içinde resim bu cihazda desteklenmiyor olabilir.");
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

  // Keyboard controls effect specific to active playback
  useEffect(() => {
    if (!selectedChannel) return;

    const handlePlayerKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          handleTogglePlay();
          break;
        case 'arrowright':
          e.preventDefault();
          handleSeekForward();
          break;
        case 'arrowleft':
          e.preventDefault();
          handleSeekBackward();
          break;
        case 'arrowup':
          e.preventDefault();
          setPlayerVolume(prev => {
            const next = Math.min(1, prev + 0.1);
            if (videoRef.current) {
              videoRef.current.volume = next;
              videoRef.current.muted = false;
            }
            setPlayerMuted(false);
            return next;
          });
          break;
        case 'arrowdown':
          e.preventDefault();
          setPlayerVolume(prev => {
            const next = Math.max(0, prev - 0.1);
            if (videoRef.current) {
              videoRef.current.volume = next;
              if (next === 0) {
                videoRef.current.muted = true;
                setPlayerMuted(true);
              }
            }
            return next;
          });
          break;
        case 'f':
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          handleTogglePlayerMute();
          break;
        case 'escape':
          if (document.fullscreenElement) {
            e.preventDefault();
            document.exitFullscreen().catch(() => {});
          } else {
            e.preventDefault();
            // Call close player
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handlePlayerKeyDown);
    return () => window.removeEventListener('keydown', handlePlayerKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel, isPlaying, duration, playerMuted, playerVolume, activeSubtitle, subtitleTracks]);

  // Main Media Source setup effect
  useEffect(() => {
    if (!selectedChannel || !videoRef.current) return;
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setAudioTracks([]);
    setActiveAudioTrack(0);
    setVideoReady(false);

    const video = videoRef.current;
    video.playbackRate = playbackSpeedRef.current;
    setFfmpegFallbackActive(false);
    isTranscodingRef.current = false;
    seekOffsetRef.current = 0;

    // Ensure audio is on
    video.muted = false;
    video.volume = playerVolumeRef.current || 1;

    let active = true;

    const startFfmpegFallback = async () => {
      if (!active || !window.electronAPI?.startFfmpegProxy) return;
      const currentPos = video.currentTime;
      console.warn(`[AutoTranscode] Dynamic fallback triggered on media error. Resuming from second: ${currentPos}`);
      isTranscodingRef.current = true;
      setFfmpegFallbackActive(true);
      try {
        const result = await window.electronAPI.startFfmpegProxy(selectedChannel.url, currentPos);
        if (!active) return;
        if (result.success && result.url) {
          if (hlsInstanceRef.current) {
            hlsInstanceRef.current.destroy();
            hlsInstanceRef.current = null;
          }
          seekOffsetRef.current = currentPos;
          if (!video.isConnected || !active) return;
          video.src = result.url;
          video.muted = false;
          video.volume = playerVolumeRef.current || 1;
          video.play().catch(() => { });
        } else {
          isTranscodingRef.current = false;
          setFfmpegFallbackActive(false);
        }
      } catch (err) {
        console.error('[AutoTranscode] Dynamic fallback error:', err);
        isTranscodingRef.current = false;
        setFfmpegFallbackActive(false);
      }
    };

    const onVideoError = () => {
      if (isTranscodingRef.current) return;
      const err = video.error;
      console.warn('Video error:', err?.code, err?.message);
      if (err?.code === 4 || err?.code === 3) {
        startFfmpegFallback();
      }
    };

    const unmuteInterval = setInterval(forceUnmute, 500);

    const onInteract = () => forceUnmute();
    const onPlaying = () => { forceUnmute(); setVideoReady(true); };

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
            handlePlayerSeek(targetTime);
          } else {
            video.currentTime = targetTime;
            // Explicitly play to prevent the browser from stalling the video due to an interrupted loading/play promise
            video.play().then(forceUnmute).catch(() => { });
          }
          showToast(`Kaldığınız yerden devam ediliyor: ${formatPlayerTime(targetTime)}`);
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
    const timeUpdate = () => {
      const now = seekOffsetRef.current + video.currentTime;
      setCurrentTime(now);
      if (video.currentTime > 0.1) {
        setVideoReady(prev => prev ? prev : true);
      }
      if (Math.abs(now - lastSavedTime) >= 5) {
        lastSavedTime = now;
        const total = isTranscodingRef.current && durationRef.current > 0 ? durationRef.current : (video.duration || 0);
        if (total > 0) {
          saveWatchProgress(selectedChannel, now, total);
        }
      }
    };

    const durationChange = () => {
      if (isTranscodingRef.current) return;
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const onPlayEvent = () => {
      forceUnmute();
      setIsPlaying(true);
    };

    const onPauseEvent = () => {
      setIsPlaying(false);
      pausedTimeRef.current = Date.now();
      const total = isTranscodingRef.current && durationRef.current > 0 ? durationRef.current : (video.duration || 0);
      if (total > 0) {
        saveWatchProgress(selectedChannel, seekOffsetRef.current + video.currentTime, total);
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

    const loadPlayerSource = (urlToPlay: string, transcodeActive: boolean) => {
      if (!active) return;
      if (Hls.isSupported() && urlToPlay.includes('.m3u8')) {
        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableSoftwareAES: true,
          abrEwmaDefaultEstimate: 40000000,
          xhrSetup: (xhr) => {
            xhr.setRequestHeader('User-Agent', '9XtreamPlayer LibVLC/3.0.22-rc1');
          }
        });
        hlsInstanceRef.current = hls;

        hls.loadSource(urlToPlay);
        hls.attachMedia(video);

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
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
          }
          forceUnmute();
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          forceUnmute();
          if (hls.levels && hls.levels.length > 0) {
            hls.loadLevel = hls.levels.length - 1;
          }
          resumePlayback(video.duration || 0);
          video.play().then(forceUnmute).catch(() => { });
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          forceUnmute();
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.warn('HLS error:', data.type, data.details);
          if (data.fatal) {
            if (data.type === 'networkError') {
              hls.startLoad();
            } else if (data.type === 'mediaError') {
              try {
                hls.recoverMediaError();
              } catch {
                if (!transcodeActive) {
                  startFfmpegFallback();
                }
              }
            }
          }
        });
      } else {
        video.src = urlToPlay;
        forceUnmute();
        video.play().then(forceUnmute).catch(() => { });
      }
    };

    const init = async () => {
      let playUrl = selectedChannel.url;
      let transcodeActive = false;

      if (selectedChannel.type !== 'live' && window.electronAPI?.probeAudioCodec && window.electronAPI?.startFfmpegProxy) {
        console.log(`[AutoTranscode] Probing audio codecs for: ${selectedChannel.name}`);
        try {
          const res = await window.electronAPI.probeAudioCodec(selectedChannel.url);
          if (!active) return;

          if (res.success) {
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
            }

            let shouldTranscode = false;
            if (res.codec) {
              const codec = res.codec.toLowerCase();
              const unsupportedCodecs = ['ac3', 'eac3', 'dts', 'truehd', 'mlp'];
              if (unsupportedCodecs.includes(codec)) {
                shouldTranscode = true;
              }
            }

            // Force transcoding if there are multiple audio tracks so we can switch between them
            if (res.audioStreams && res.audioStreams.length > 1) {
              shouldTranscode = true;
            }

            if (shouldTranscode) {
              console.log(`[AutoTranscode] Transcoding triggered (codec or multiple audio tracks).`);
              
              // Find actual stream ID of the selected track
              const initialTrackId = res.audioStreams && res.audioStreams.length > 0
                ? (res.audioStreams.findIndex((t: any) => t.name?.toLowerCase().includes('türk') || t.name?.toLowerCase().includes('turk') || t.lang === 'tr'))
                : -1;
              const selectedTrackIndex = initialTrackId >= 0 ? initialTrackId : 0;
              const streamId = res.audioStreams && res.audioStreams.length > selectedTrackIndex
                ? res.audioStreams[selectedTrackIndex].streamId
                : undefined;

              const transcodeRes = await window.electronAPI.startFfmpegProxy(selectedChannel.url, undefined, streamId);
              if (transcodeRes.success && transcodeRes.url) {
                playUrl = transcodeRes.url;
                transcodeActive = true;
                isTranscodingRef.current = true;
                setFfmpegFallbackActive(true);
              }
            }
          }
        } catch (e) {
          console.error('[AutoTranscode] Error during codec probing:', e);
        }
      }

      if (!active) return;
      loadPlayerSource(playUrl, transcodeActive);
    };

    init();

    return () => {
      active = false;
      isTranscodingRef.current = false;
      clearInterval(unmuteInterval);
      video.removeEventListener('error', onVideoError);
      video.removeEventListener('play', onPlayEvent);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onPlaying);
      video.removeEventListener('volumechange', onInteract);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', timeUpdate);
      video.removeEventListener('durationchange', durationChange);
      video.removeEventListener('pause', onPauseEvent);

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
  }, [selectedChannel, reloadCounter]);



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
    playbackSpeed,
    showSpeedMenu,
    audioTracks,
    activeAudioTrack,
    subtitleTracks,
    activeSubtitle,
    showSubtitleMenu,
    isFullscreen,
    
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
    handleSeekForward,
    handleSeekBackward,
    handleToggleFullscreen,
    handleAudioTrackChange,
    handleSubtitleUpload,
    handlePlayerPiP,
    formatPlayerTime
  };
}
