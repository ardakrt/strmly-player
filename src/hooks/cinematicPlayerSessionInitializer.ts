import { getLoadingMessage, getSavedQualityLevel } from './cinematicPlayerHelpers';
import { readLearnedIntro } from './cinematicPlayerSessionHelpers';
import type { CinematicPlayerSessionContext } from './cinematicPlayerSessionTypes';

export function initializePlayerSession(
  context: CinematicPlayerSessionContext,
  video: HTMLVideoElement,
) {
  const {
    activeAudioStreamIdRef,
    ffmpegRestartInFlightRef,
    forcedTranscodeModeRef,
    hlsMediaRecoveriesRef,
    hlsNetworkRecoveriesRef,
    isTranscodingRef,
    language,
    lastBufferedUpdateRef,
    lastFfmpegRestartAtRef,
    lastRecoveryTimeRef,
    lastRequestedSeekRef,
    learnedIntroRef,
    localBrowserSafeRef,
    playbackSpeedRef,
    playerMutedRef,
    playerVolumeRef,
    probedVideoCodecRef,
    recoveryAttemptRef,
    seekGraceUntilRef,
    seekOffsetRef,
    seekRequestIdRef,
    selectedChannel,
    setActiveAudioTrack,
    setActiveQualityLevel,
    setAudioTracks,
    setBufferedProgress,
    setCurrentTime,
    setDuration,
    setFfmpegFallbackActive,
    setIsPlaying,
    setLearnedIntro,
    setPlaybackMessage,
    setPlaybackStatus,
    setQualityLevels,
    setShowIntroSkip,
    setVideoReady,
  } = context;
  if (!selectedChannel) return;

  setIsPlaying(true);
  setCurrentTime(0);
  setBufferedProgress(0);
  setDuration(selectedChannel.duration && selectedChannel.duration > 0 ? selectedChannel.duration : 0);
  const learnedIntro = readLearnedIntro(selectedChannel);
  setLearnedIntro(learnedIntro);
  learnedIntroRef.current = learnedIntro;
  setShowIntroSkip(false);
  setAudioTracks([]);
  setActiveAudioTrack(0);
  setQualityLevels([]);
  setActiveQualityLevel(getSavedQualityLevel());
  setVideoReady(false);
  setPlaybackStatus('loading');
  setPlaybackMessage(getLoadingMessage(selectedChannel, language));
  setFfmpegFallbackActive(false);

  video.playbackRate = playbackSpeedRef.current;
  video.muted = playerMutedRef.current;
  video.volume = playerVolumeRef.current;
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
}
