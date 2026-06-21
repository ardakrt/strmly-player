import { useState, useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import type { PlaylistItem } from '../utils/m3uParser';


interface UseCinematicPlayerProps {
  selectedChannel: PlaylistItem | null;
  saveWatchProgress: (item: PlaylistItem, time: number, total: number) => void;
  showToast: (message: string) => void;
}

const PLAYER_VOLUME_KEY = 'cinema_player_volume';
const PLAYER_MUTED_KEY = 'cinema_player_muted';

function getSavedPlayerVolume(): number {
  const saved = Number(localStorage.getItem(PLAYER_VOLUME_KEY));
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
}

function getSavedPlayerMuted(): boolean {
  return localStorage.getItem(PLAYER_MUTED_KEY) === 'true';
}

export function useCinematicPlayer({
  selectedChannel,
  saveWatchProgress,
  showToast
}: UseCinematicPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const seekOffsetRef = useRef(0);
  const isTranscodingRef = useRef(false);
  const activeAudioStreamIdRef = useRef<number | undefined>(undefined);
  const seekRequestIdRef = useRef(0);
  const subtitleObjectUrlsRef = useRef<string[]>([]);
  const subtitleRef = useRef<HTMLTrackElement>(null);

  // States/refs to reload the stream if paused for a long time (TCP/Token timeout recovery)
  const pausedTimeRef = useRef<number | null>(null);
  const resumeTimeRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerVolume, setPlayerVolume] = useState(getSavedPlayerVolume);
  const [playerMuted, setPlayerMuted] = useState(getSavedPlayerMuted);
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

  const handlePlayerSeek = async (newTime: number) => {
    if (!videoRef.current || !selectedChannel) return;
    const targetTime = Math.max(0, durationRef.current > 0
      ? Math.min(newTime, Math.max(0, durationRef.current - 0.25))
      : newTime);

    if (isTranscodingRef.current && window.electronAPI?.startFfmpegProxy) {
      const requestId = ++seekRequestIdRef.current;
      showToast("Video ileri sarılıyor...");
      try {
        const result = await window.electronAPI.startFfmpegProxy(
          selectedChannel.url,
          targetTime,
          activeAudioStreamIdRef.current
        );
        if (requestId !== seekRequestIdRef.current) return;
        if (result.success && result.url && videoRef.current) {
          seekOffsetRef.current = targetTime;
          setCurrentTime(targetTime);
          videoRef.current.src = result.url;
          videoRef.current.muted = playerMutedRef.current;
          videoRef.current.volume = playerVolumeRef.current;
          videoRef.current.play().then(forceUnmute).catch(() => { });
        }
      } catch (e) {
        console.error("Transcoded seek error:", e);
      }
    } else {
      videoRef.current.currentTime = targetTime;
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
    } else {
      const video = videoRef.current;
      const nativeTracks = video ? (video as any).audioTracks : null;
      
      // Use transcoding if we are already transcoding, or if native audio tracks are not available
      const useTranscoding = isTranscodingRef.current || (!nativeTracks || nativeTracks.length === 0);
      
      if (useTranscoding && selectedChannel && window.electronAPI?.startFfmpegProxy && video) {
        const trackInfo = audioTracks.find(t => t.id === trackId);
        const streamId = (trackInfo as any)?.streamId;
        activeAudioStreamIdRef.current = streamId;
        
        showToast("Ses dili değiştiriliyor (Transcode)...");
        const currentPos = video.currentTime;
        try {
          const result = await window.electronAPI.startFfmpegProxy(selectedChannel.url, seekOffsetRef.current + currentPos, streamId);
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

  // Main Media Source setup effect
  useEffect(() => {
    if (!selectedChannel || !videoRef.current) return;
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(selectedChannel.duration && selectedChannel.duration > 0 ? selectedChannel.duration : 0);
    setAudioTracks([]);
    setActiveAudioTrack(0);
    setVideoReady(false);

    const video = videoRef.current;
    video.playbackRate = playbackSpeedRef.current;
    setFfmpegFallbackActive(false);
    isTranscodingRef.current = false;
    activeAudioStreamIdRef.current = undefined;
    seekRequestIdRef.current = 0;
    seekOffsetRef.current = 0;

    // Restore the user's last volume and mute preference.
    video.muted = playerMutedRef.current;
    video.volume = playerVolumeRef.current;

    let active = true;

    const startFfmpegFallback = async (forceStartTime?: number) => {
      if (!active || !window.electronAPI?.startFfmpegProxy) return;
      const currentPos = forceStartTime !== undefined ? forceStartTime : video.currentTime;
      console.warn(`[AutoTranscode] Transcoding triggered. Starting from second: ${currentPos}`);
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
          video.muted = playerMutedRef.current;
          video.volume = playerVolumeRef.current;
          video.play().catch(() => { });
        } else {
          isTranscodingRef.current = false;
          setFfmpegFallbackActive(false);
        }
      } catch (err) {
        console.error('[AutoTranscode] Fallback error:', err);
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
      forceUnmute();
      setVideoReady(true);
      if (isTranscodingRef.current) {
        void probeTranscodedMetadata();
      }
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
    let lastSavedStateTime = -1;
    const timeUpdate = () => {
      const now = seekOffsetRef.current + video.currentTime;
      if (Math.floor(now) !== Math.floor(lastSavedStateTime)) {
        lastSavedStateTime = now;
        setCurrentTime(now);
      }
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
      pausedTimeRef.current = null;
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

    const loadPlayerSource = async (urlToPlay: string, transcodeActive: boolean) => {
      if (!active) return;
      if (urlToPlay.includes('.m3u8')) {
        const { default: HlsPlayer } = await import('hls.js');
        if (!active) return;

        if (!HlsPlayer.isSupported()) {
          video.src = urlToPlay;
          forceUnmute();
          await video.play().then(forceUnmute).catch(() => { });
          return;
        }

        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
        }
        const hls = new HlsPlayer({
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
          }
          forceUnmute();
        });

        hls.on(HlsPlayer.Events.MANIFEST_PARSED, () => {
          forceUnmute();
          if (hls.levels && hls.levels.length > 0) {
            hls.loadLevel = hls.levels.length - 1;
          }
          resumePlayback(video.duration || 0);
          video.play().then(forceUnmute).catch(() => { });
        });

        hls.on(HlsPlayer.Events.FRAG_LOADED, () => {
          forceUnmute();
        });

        hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
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
      const playUrl = selectedChannel.url;

      const isMkv = playUrl.toLowerCase().includes('.mkv') || playUrl.toLowerCase().split('?')[0].endsWith('.mkv');
      if (isMkv && window.electronAPI?.startFfmpegProxy) {
        console.log(`[AutoTranscode] Direct MKV stream detected, starting transcode immediately.`);
        const startTime = resumeTimeRef.current !== null ? resumeTimeRef.current : (selectedChannel.currentTime || 0);
        startFfmpegFallback(startTime);
      } else {
        // Start playing naturally and instantly first!
        await loadPlayerSource(playUrl, false);

        // Only run network codec analysis for non-HLS (.m3u8) direct VOD streams in the background
        if (selectedChannel.type !== 'live' && !playUrl.includes('.m3u8') && window.electronAPI?.probeAudioCodec && window.electronAPI?.startFfmpegProxy) {
          // ffprobe opens a second connection to the same VOD URL. Starting it
          // alongside the video competes for the first bytes and delays the
          // first frame on many IPTV servers, so wait until playback begins.
          await new Promise<void>((resolve) => {
            if (!active || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
              resolve();
              return;
            }

            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timeoutId);
              video.removeEventListener('playing', finish);
              video.removeEventListener('error', finish);
              resolve();
            };
            const timeoutId = window.setTimeout(finish, 5000);
            video.addEventListener('playing', finish, { once: true });
            video.addEventListener('error', finish, { once: true });
          });

          if (!active || isTranscodingRef.current) return;
          console.log(`[AutoTranscode] Probing audio codecs in background for: ${selectedChannel.name}`);
          try {
            transcodeMetadataProbeStarted = true;
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

              if (shouldTranscode) {
                console.log(`[AutoTranscode] Transcoding triggered in background. Switching source.`);
                
                // Find actual stream ID of the selected track
                const initialTrackId = res.audioStreams && res.audioStreams.length > 0
                  ? (res.audioStreams.findIndex((t: any) => t.name?.toLowerCase().includes('türk') || t.name?.toLowerCase().includes('turk') || t.lang === 'tr'))
                  : -1;
                const selectedTrackIndex = initialTrackId >= 0 ? initialTrackId : 0;
                const streamId = res.audioStreams && res.audioStreams.length > selectedTrackIndex
                  ? res.audioStreams[selectedTrackIndex].streamId
                  : undefined;
                activeAudioStreamIdRef.current = streamId;

                const currentPos = video.currentTime;
                const transcodeRes = await window.electronAPI.startFfmpegProxy(selectedChannel.url, currentPos, streamId);
                if (!active) return;
                if (transcodeRes.success && transcodeRes.url) {
                  if (hlsInstanceRef.current) {
                    hlsInstanceRef.current.destroy();
                    hlsInstanceRef.current = null;
                  }
                  seekOffsetRef.current = currentPos;
                  isTranscodingRef.current = true;
                  setFfmpegFallbackActive(true);
                  video.src = transcodeRes.url;
                  video.play().then(forceUnmute).catch(() => { });
                }
              }
            }
          } catch (e) {
            console.error('[AutoTranscode] Error during background codec probing:', e);
          }
        }
      }
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
