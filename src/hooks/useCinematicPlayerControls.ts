import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { PlaylistItem } from '../utils/m3uParser';
import {
  getSavedPlaybackSpeed,
  getSavedPlayerMuted,
  getSavedPlayerVolume,
  getSavedQualityLevel,
  PLAYER_MUTED_KEY,
  PLAYER_QUALITY_KEY,
  PLAYER_SPEED_KEY,
  PLAYER_VOLUME_KEY,
  translateReason,
} from './cinematicPlayerHelpers';
import type { PlayerQualityLevel } from './cinematicPlayerHelpers';

interface UseCinematicPlayerControlsProps {
  selectedChannel: PlaylistItem | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
  hlsInstanceRef: React.RefObject<Hls | null>;
  language: 'tr' | 'en';
  showToast: (message: string) => void;
}

export function useCinematicPlayerControls({
  selectedChannel,
  videoRef,
  playerContainerRef,
  hlsInstanceRef,
  language,
  showToast,
}: UseCinematicPlayerControlsProps) {
  const controlsTimeoutRef = useRef<number | null>(null);
  const [playerVolume, setPlayerVolume] = useState(getSavedPlayerVolume);
  const [playerMuted, setPlayerMuted] = useState(getSavedPlayerMuted);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(getSavedPlaybackSpeed);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<PlayerQualityLevel[]>([]);
  const [activeQualityLevel, setActiveQualityLevel] = useState(getSavedQualityLevel);

  const playbackSpeedRef = useRef(playbackSpeed);
  const playerVolumeRef = useRef(playerVolume);
  const playerMutedRef = useRef(playerMuted);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    playerVolumeRef.current = playerVolume;
    localStorage.setItem(PLAYER_VOLUME_KEY, String(playerVolume));
  }, [playerVolume]);

  useEffect(() => {
    playerMutedRef.current = playerMuted;
    localStorage.setItem(PLAYER_MUTED_KEY, String(playerMuted));
  }, [playerMuted]);

  const clearControlsTimeout = () => {
    if (controlsTimeoutRef.current !== null) {
      window.clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  };

  const scheduleControlsHide = () => {
    clearControlsTimeout();
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      controlsTimeoutRef.current = null;
    }, 2500);
  };

  const handlePlayerMouseMove = () => {
    setShowControls(true);
    scheduleControlsHide();
  };

  const handlePlayerMouseLeave = () => {
    clearControlsTimeout();
    setShowControls(false);
  };

  useEffect(() => {
    if (!selectedChannel) {
      setShowControls(true);
      return;
    }

    setShowControls(true);
    scheduleControlsHide();
    return clearControlsTimeout;
    // The timer is intentionally reset only when the selected channel changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handlePlayerVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const volume = Number.parseFloat(event.target.value);
    setPlayerVolume(volume);
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    if (volume > 0) {
      video.muted = false;
      setPlayerMuted(false);
    } else {
      video.muted = true;
      setPlayerMuted(true);
    }
  };

  const handleTogglePlayerMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !playerMuted;
    setPlayerMuted(nextMuted);
    video.muted = nextMuted;
    if (!nextMuted && playerVolume === 0) {
      setPlayerVolume(0.5);
      video.volume = 0.5;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    localStorage.setItem(PLAYER_SPEED_KEY, String(speed));
    setShowSpeedMenu(false);
    if (videoRef.current) videoRef.current.playbackRate = speed;
  };

  const handleQualityChange = (levelId: number) => {
    setActiveQualityLevel(levelId);
    localStorage.setItem(PLAYER_QUALITY_KEY, String(levelId));
    if (!hlsInstanceRef.current) return;
    hlsInstanceRef.current.currentLevel = levelId;
    hlsInstanceRef.current.loadLevel = levelId;
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
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handlePlayerPiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current !== document.pictureInPictureElement) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP error:', error);
      showToast(translateReason(
        'Resim içinde resim bu cihazda desteklenmiyor olabilir.',
        language,
      ));
    }
  };

  return {
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
  };
}
