import { useState, useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import type { PlaylistItem } from '../utils/m3uParser';
import { useSettings } from '../context/SettingsContext';

interface UseCinematicPlayerProps {
  selectedChannel: PlaylistItem | null;
  saveWatchProgress: (item: PlaylistItem, time: number, total: number) => void;
  showToast: (message: string) => void;
}

const PLAYER_VOLUME_KEY = 'cinema_player_volume';
const PLAYER_MUTED_KEY = 'cinema_player_muted';
const PLAYER_SPEED_KEY = 'cinema_player_speed';
const PLAYER_QUALITY_KEY = 'cinema_player_quality';
const PLAYER_AUDIO_PREF_KEY = 'cinema_player_audio_pref';
type PlaybackStatus = 'loading' | 'playing' | 'recovering' | 'transcoding' | 'error';
export type PlayerQualityLevel = { id: number; label: string; height?: number; bitrate?: number };

function translateReason(reason: string, language: 'tr' | 'en'): string {
  const dictionary: Record<string, { tr: string; en: string }> = {
    'Yerel oynatma basarisiz oldu': {
      tr: 'Yerel oynatma başarısız oldu',
      en: 'Native playback failed'
    },
    'HLS medya kurtarma basarisiz': {
      tr: 'HLS medya kurtarma başarısız',
      en: 'HLS media recovery failed'
    },
    'Ilk oynatma basarisiz oldu': {
      tr: 'İlk oynatma başarısız oldu',
      en: 'First playback failed'
    },
    'HLS yerel oynatma baslamadi': {
      tr: 'HLS yerel oynatma başlamadı',
      en: 'HLS native playback did not start'
    },
    'Yerel oynatma baslamadi': {
      tr: 'Yerel oynatma başlamadı',
      en: 'Native playback did not start'
    },
    'Uyumluluk modu baslamadi': {
      tr: 'Uyumluluk modu başlamadı',
      en: 'Compatibility mode did not start'
    },
    'Akis kurtarilamadi': {
      tr: 'Akış kurtarılamadı',
      en: 'Stream could not be recovered'
    },
    'Akis takildi': {
      tr: 'Akış takıldı',
      en: 'Stream stalled'
    },
    'Seek sonrasi akis takildi': {
      tr: 'Seek sonrası akış takıldı',
      en: 'Stream stalled after seek'
    },
    'Uyumluluk modu baslatilamadi': {
      tr: 'Uyumluluk modu başlatılamadı',
      en: 'Compatibility mode could not be started'
    },
    'Ses codec uyumluluk modu baslatilamadi': {
      tr: 'Ses codec uyumluluk modu başlatılamadı',
      en: 'Audio codec compatibility mode could not be started'
    },
    'Oynatici baslatilamadi': {
      tr: 'Oynatıcı başlatılamadı',
      en: 'Player could not be started'
    },
    'Ilk kare gecikti': {
      tr: 'İlk kare gecikti',
      en: 'First frame delayed'
    },
    'Sunucu zamaninda yanit vermedi': {
      tr: 'Sunucu zamanında yanıt vermedi',
      en: 'Server did not respond in time'
    },
    'FFmpeg uyumluluk modu kullanilamiyor': {
      tr: 'FFmpeg uyumluluk modu kullanılamıyor',
      en: 'FFmpeg compatibility mode unavailable'
    },
    'Uyumluluk modu hata verdi': {
      tr: 'Uyumluluk modu hata verdi',
      en: 'Compatibility mode failed'
    },
    'Video cozulurken hata olustu': {
      tr: 'Video çözülürken hata oluştu',
      en: 'Error decoding video'
    },
    'Oynatma hatasi': {
      tr: 'Oynatma hatası',
      en: 'Playback error'
    },
    'Video bu noktadan devam edemedi': {
      tr: 'Video bu noktadan devam edemedi',
      en: 'Video could not continue from this point'
    },
    'HLS ag hatasi': {
      tr: 'HLS ağ hatası',
      en: 'HLS network error'
    },
    'HLS medya hatasi': {
      tr: 'HLS medya hatası',
      en: 'HLS media error'
    },
    'HLS oynatma hatasi': {
      tr: 'HLS oynatma hatası',
      en: 'HLS playback error'
    },
    'Video ileri sariliyor...': {
      tr: 'Video ileri sarılıyor...',
      en: 'Seeking video forward...'
    },
    'Video ileri sarilamadi. Kaynak bu noktadan devam etmeyi desteklemiyor olabilir.': {
      tr: 'Video ileri sarılamadı. Kaynak bu noktadan devam etmeyi desteklemiyor olabilir.',
      en: 'Could not seek forward. The source might not support seeking from this point.'
    },
    'Video ileri sarilirken hata olustu.': {
      tr: 'Video ileri sarılırken hata oluştu.',
      en: 'An error occurred while seeking forward.'
    },
    'Yayin akisi kurtariliyor...': {
      tr: 'Yayın akışı kurtarılıyor...',
      en: 'Recovering stream...'
    },
    'Ses dili değiştiriliyor (Transcode)...': {
      tr: 'Ses dili değiştiriliyor (Transcode)...',
      en: 'Changing audio language (Transcode)...'
    },
    'Altyazı yüklendi.': {
      tr: 'Altyazı yüklendi.',
      en: 'Subtitle loaded.'
    },
    'Resim içinde resim bu cihazda desteklenmiyor olabilir.': {
      tr: 'Resim içinde resim bu cihazda desteklenmiyor olabilir.',
      en: 'Picture-in-picture might not be supported on this device.'
    }
  };

  return dictionary[reason]?.[language] || dictionary[reason]?.tr || reason;
}

function getPlaybackLabel(item: PlaylistItem | null, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') {
    if (item?.type === 'live') return 'Live stream';
    if (item?.type === 'movie') return 'Movie';
    return 'Series episode';
  }
  if (item?.type === 'live') return 'Canlı yayın';
  if (item?.type === 'movie') return 'Film';
  return 'Dizi bölümü';
}

function getLoadingMessage(item: PlaylistItem | null, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') {
    return `Preparing ${getPlaybackLabel(item, language).toLowerCase()}...`;
  }
  return `${getPlaybackLabel(item, language)} hazırlanıyor...`;
}

function getTranscodingMessage(item: PlaylistItem | null, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') {
    return `Trying compatibility mode for ${getPlaybackLabel(item, language).toLowerCase()}...`;
  }
  return `${getPlaybackLabel(item, language)} için uyumluluk modu deneniyor...`;
}

function getRecoveringMessage(item: PlaylistItem | null, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') {
    return `Recovering ${getPlaybackLabel(item, language).toLowerCase()} stream...`;
  }
  return `${getPlaybackLabel(item, language)} akışı kurtarılıyor...`;
}

function getPlaybackFailureMessage(item: PlaylistItem | null, reason?: string, language: 'tr' | 'en' = 'tr'): string {
  const translatedReason = reason ? translateReason(reason, language) : '';
  const reasonText = translatedReason ? ` (${translatedReason})` : '';
  if (language === 'en') {
    return `${getPlaybackLabel(item, language)} could not be opened${reasonText}. The source might be temporarily offline, codec unsupported, or the server is not responding. Try another source or open with an external player.`;
  }
  return `${getPlaybackLabel(item, language)} açılamadı${reasonText}. Kaynak geçici olarak kapalı, codec desteklenmiyor veya sunucu yanıt vermiyor olabilir. Başka bir kaynak deneyin ya da harici oynatıcı ile açmayı deneyin.`;
}

function getSavedPlayerVolume(): number {
  const saved = Number(localStorage.getItem(PLAYER_VOLUME_KEY));
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
}

function getSavedPlayerMuted(): boolean {
  return localStorage.getItem(PLAYER_MUTED_KEY) === 'true';
}

function getSavedPlaybackSpeed(): number {
  const saved = Number(localStorage.getItem(PLAYER_SPEED_KEY));
  return Number.isFinite(saved) && saved >= 0.25 && saved <= 2 ? saved : 1;
}

function getSavedQualityLevel(): number {
  const saved = Number(localStorage.getItem(PLAYER_QUALITY_KEY));
  return Number.isFinite(saved) ? saved : -1;
}

function getSavedAudioPreference(): { name?: string; lang?: string } | null {
  try {
    const saved = localStorage.getItem(PLAYER_AUDIO_PREF_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function getPreferredAudioTrackIndex(tracks: { name?: string; lang?: string }[]): number {
  const preferred = getSavedAudioPreference();
  if (preferred) {
    const preferredName = preferred.name?.toLowerCase();
    const preferredLang = preferred.lang?.toLowerCase();
    const exact = tracks.findIndex(track =>
      (preferredLang && track.lang?.toLowerCase() === preferredLang) ||
      (preferredName && track.name?.toLowerCase() === preferredName)
    );
    if (exact >= 0) return exact;
  }

  const turkish = tracks.findIndex(track =>
    track.name?.toLowerCase().includes('tÃ¼rk') ||
    track.name?.toLowerCase().includes('turk') ||
    track.lang?.toLowerCase() === 'tr'
  );
  return turkish >= 0 ? turkish : 0;
}

export function useCinematicPlayer({
  selectedChannel,
  saveWatchProgress,
  showToast
}: UseCinematicPlayerProps) {
  const { language } = useSettings();
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
  const seekTimeoutRef = useRef<any>(null);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const startupTimeoutRef = useRef<any>(null);
  const recoveryAttemptRef = useRef(0);
  const hlsNetworkRecoveriesRef = useRef(0);
  const hlsMediaRecoveriesRef = useRef(0);
  const lastBufferedUpdateRef = useRef(0);
  const seekGraceUntilRef = useRef(0);
  const lastRequestedSeekRef = useRef<number | null>(null);

  // States/refs to reload the stream if paused for a long time (TCP/Token timeout recovery)
  const pausedTimeRef = useRef<number | null>(null);
  const resumeTimeRef = useRef<number | null>(null);

  const getTranscodeMode = () => {
    return 'full';
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
    setBufferedProgress(0);
    seekGraceUntilRef.current = Date.now() + 20000;
    lastRequestedSeekRef.current = targetTime;

    if (isTranscodingRef.current && window.electronAPI?.startFfmpegProxy) {
      const requestId = ++seekRequestIdRef.current;
      showToast(translateReason("Video ileri sarılıyor...", language));
      try {
        const result = await window.electronAPI.startFfmpegProxy(
          selectedChannel.url,
          targetTime,
          activeAudioStreamIdRef.current,
          getTranscodeMode()
        );
        if (requestId !== seekRequestIdRef.current) return;
        if (result.success && result.url && videoRef.current) {
          seekOffsetRef.current = targetTime;
          videoRef.current.src = result.url;
          videoRef.current.muted = playerMutedRef.current;
          videoRef.current.volume = playerVolumeRef.current;
          videoRef.current.play().then(forceUnmute).catch(() => { });
        } else {
          showToast(translateReason("Video ileri sarilamadi. Kaynak bu noktadan devam etmeyi desteklemiyor olabilir.", language));
        }
      } catch (e) {
        console.error("Transcoded seek error:", e);
        showToast(translateReason("Video ileri sarilirken hata olustu.", language));
      }
    } else {
      try {
        videoRef.current.currentTime = targetTime;
      } catch (error) {
        console.warn("Native seek failed:", error);
        showToast(translateReason("Video ileri sarilamadi. Kaynak bu noktadan devam etmeyi desteklemiyor olabilir.", language));
      }
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

    pendingSeekTimeRef.current = targetTime;
    lastRequestedSeekRef.current = targetTime;
    seekGraceUntilRef.current = Date.now() + 20000;
    setCurrentTime(targetTime);

    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

    seekTimeoutRef.current = setTimeout(() => {
      const finalTargetTime = pendingSeekTimeRef.current;
      if (finalTargetTime === null) return;
      pendingSeekTimeRef.current = null;
      executeSeek(finalTargetTime);
    }, 150);
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
          const result = await window.electronAPI.startFfmpegProxy(selectedChannel.url, seekOffsetRef.current + currentPos, streamId, getTranscodeMode());
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
    activeAudioStreamIdRef.current = undefined;
    seekRequestIdRef.current = 0;
    seekOffsetRef.current = 0;
    seekGraceUntilRef.current = 0;
    lastRequestedSeekRef.current = null;
    recoveryAttemptRef.current = 0;
    hlsNetworkRecoveriesRef.current = 0;
    hlsMediaRecoveriesRef.current = 0;
    lastBufferedUpdateRef.current = 0;

    // Restore the user's last volume and mute preference.
    video.muted = playerMutedRef.current;
    video.volume = playerVolumeRef.current;

    let active = true;

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
      }, 12000);
    };

    const startFfmpegFallback = async (forceStartTime?: number, reason?: string) => {
      if (!active) return;
      if (!window.electronAPI?.startFfmpegProxy) {
        failPlayback('FFmpeg uyumluluk modu kullanilamiyor');
        return;
      }
      const currentPos = forceStartTime !== undefined ? forceStartTime : video.currentTime;
      console.warn(`[AutoTranscode] Transcoding triggered. Starting from second: ${currentPos}`);
      isTranscodingRef.current = true;
      setFfmpegFallbackActive(true);
      setPlaybackStatus('transcoding');
      const msg = getTranscodingMessage(selectedChannel, language);
      setPlaybackMessage(reason ? `${msg} ${translateReason(reason, language)}` : msg);
      setBufferedProgress(0);
      armStartupTimeout();
      try {
        const result = await window.electronAPI.startFfmpegProxy(selectedChannel.url, currentPos, undefined, getTranscodeMode());
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
      }
    };

    const onVideoError = () => {
      const err = video.error;
      console.warn('Video error:', err?.code, err?.message);
      if (isTranscodingRef.current) {
        failPlayback(err?.message || 'Video cozulurken hata olustu');
        return;
      }
      if (err?.code === 4 || err?.code === 3) {
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
      const stallDelay = selectedChannel.type === 'live' ? 12000 : 22000;
      stallTimeout = setTimeout(() => {
        if (!active || !video || !selectedChannel) return;
        if (video.seeking || Date.now() < seekGraceUntilRef.current) return;
        if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
        console.warn("[Player] Stall detected! Attempting recovery...");
        
        setPlaybackStatus('recovering');
        setPlaybackMessage(getRecoveringMessage(selectedChannel, language));

        const currentPos = lastRequestedSeekRef.current !== null && waitStartedAt < seekGraceUntilRef.current
          ? lastRequestedSeekRef.current - seekOffsetRef.current
          : video.currentTime;
        recoveryAttemptRef.current += 1;
        if (isTranscodingRef.current) {
          if (recoveryAttemptRef.current > 2) {
            failPlayback('Akis kurtarilamadi');
            return;
          }
          startFfmpegFallback(seekOffsetRef.current + currentPos, 'Akis takildi');
        } else if (selectedChannel.type !== 'live' && window.electronAPI?.startFfmpegProxy) {
          if (recoveryAttemptRef.current > 1) {
            failPlayback('Video bu noktadan devam edemedi');
            return;
          }
          startFfmpegFallback(Math.max(0, seekOffsetRef.current + currentPos), 'Seek sonrasi akis takildi');
        } else {
          const playUrl = selectedChannel.url;
          loadPlayerSource(playUrl, false);
          
          const restoreTime = () => {
            video.currentTime = currentPos;
            video.play().then(forceUnmute).catch(() => {});
          };
          video.addEventListener('loadedmetadata', restoreTime, { once: true });
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
    video.addEventListener('seeked', clearStall);
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
        const hls = new HlsPlayer({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
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

        hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
          console.warn('HLS error:', data.type, data.details);
          if (data.fatal) {
            if (data.type === 'networkError') {
              hlsNetworkRecoveriesRef.current += 1;
              if (hlsNetworkRecoveriesRef.current <= 2) {
                setPlaybackStatus('recovering');
                setPlaybackMessage(getRecoveringMessage(selectedChannel));
                hls.startLoad();
              } else if (!transcodeActive) {
                startFfmpegFallback(undefined, 'HLS ag hatasi');
              } else {
                failPlayback('HLS ag hatasi');
              }
            } else if (data.type === 'mediaError') {
              hlsMediaRecoveriesRef.current += 1;
              try {
                if (hlsMediaRecoveriesRef.current <= 1) {
                  setPlaybackStatus('recovering');
                  setPlaybackMessage(getRecoveringMessage(selectedChannel));
                  hls.recoverMediaError();
                } else if (!transcodeActive) {
                  startFfmpegFallback(undefined, 'HLS medya hatasi');
                } else {
                  failPlayback('HLS medya hatasi');
                }
              } catch {
                if (!transcodeActive) {
                  startFfmpegFallback(undefined, 'HLS medya kurtarma basarisiz');
                } else {
                  failPlayback('HLS medya kurtarma basarisiz');
                }
              }
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

      // Only run network codec analysis for non-HLS (.m3u8) direct VOD streams BEFORE playback starts
      if (selectedChannel.type !== 'live' && !playUrl.includes('.m3u8') && window.electronAPI?.probeAudioCodec && window.electronAPI?.startFfmpegProxy) {
        setPlaybackStatus('loading');
        setPlaybackMessage(language === 'tr' ? 'Ses formatı kontrol ediliyor...' : 'Checking audio format...');
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
              streamId = res.audioStreams[selectedTrack]?.streamId;
              activeAudioStreamIdRef.current = streamId;
              const preferredTrack = getPreferredAudioTrackIndex(res.audioStreams);
              setActiveAudioTrack(preferredTrack);
              streamId = res.audioStreams[preferredTrack]?.streamId;
              activeAudioStreamIdRef.current = streamId;
            }

            if (res.codec) {
              const codec = res.codec.toLowerCase();
              const unsupportedCodecs = ['ac3', 'eac3', 'dts', 'truehd', 'mlp'];
              if (unsupportedCodecs.includes(codec)) {
                shouldTranscode = true;
              }
            }
          }
        } catch (e) {
          console.error('[AutoTranscode] Error during background codec probing:', e);
        }
      }

      if (shouldTranscode) {
        setPlaybackStatus('transcoding');
        setPlaybackMessage(getTranscodingMessage(selectedChannel, language));
        armStartupTimeout();
        const transcodeRes = await window.electronAPI!.startFfmpegProxy!(selectedChannel.url, 0, streamId, getTranscodeMode());
        if (!active) return;
        if (transcodeRes.success && transcodeRes.url) {
          seekOffsetRef.current = 0;
          isTranscodingRef.current = true;
          setFfmpegFallbackActive(true);
          await loadPlayerSource(transcodeRes.url, true);
        } else {
          isTranscodingRef.current = false;
          setFfmpegFallbackActive(false);
          failPlayback(transcodeRes.error || 'Uyumluluk modu baslatilamadi');
        }
      } else {
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
      video.removeEventListener('seeked', clearStall);
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
    formatPlayerTime
  };
}
