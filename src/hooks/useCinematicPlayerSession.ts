import { useEffect } from 'react';
import { getPlaybackSettings } from '../utils/playbackSettings';
import {
  formatPlayerTime, getPlaybackFailureMessage, getRecoveringMessage,
  getTranscodingMessage, translateReason,
} from './cinematicPlayerHelpers';
import {
  hasUnsupportedCodecHint,
  isLocalMediaSource,
  probePlaybackCompatibility,
} from './cinematicPlayerSessionHelpers';
import {
  attachNativeTrackHandlers,
  registerHlsTrackHandlers,
} from './cinematicPlayerTrackHandlers';
import { createPlayerProgressController } from './cinematicPlayerProgressController';
import type { CinematicPlayerSessionContext } from './cinematicPlayerSessionTypes';
import { attachPlayerVideoEvents } from './cinematicPlayerVideoEvents';
import { initializePlayerSession } from './cinematicPlayerSessionInitializer';

export function useCinematicPlayerSession(context: CinematicPlayerSessionContext) {
  const {
    selectedChannel, saveWatchProgress, showToast, language, videoReady,
    videoRef, hlsInstanceRef, seekOffsetRef, isTranscodingRef,
    localBrowserSafeRef, probedVideoCodecRef, activeAudioStreamIdRef,
    seekTimeoutRef, startupTimeoutRef,
    recoveryAttemptRef, lastRecoveryTimeRef, hlsNetworkRecoveriesRef,
    hlsMediaRecoveriesRef, lastBufferedUpdateRef, seekGraceUntilRef,
    lastRequestedSeekRef, lastFfmpegRestartAtRef, ffmpegRestartInFlightRef,
    forcedTranscodeModeRef, pausedTimeRef, resumeTimeRef, learnedIntroRef,
    playerVolumeRef, playerMutedRef, durationRef,
    invokeFfmpegProxy, getTranscodeMode, forceUnmute, handlePlayerSeek, resetSubtitles,
    setIsPlaying, setCurrentTime, setDuration, setFfmpegFallbackActive,
    setBufferedProgress, setVideoReady, setPlaybackStatus, setPlaybackMessage,
    setQualityLevels, setActiveQualityLevel, setAudioTracks, setActiveAudioTrack,
    setSubtitleTracks, setActiveSubtitle, setShowIntroSkip,
  } = context;

  // Main Media Source setup effect
  useEffect(() => {
    if (!selectedChannel || !videoRef.current) return;
    const video = videoRef.current;
    initializePlayerSession(context, video);

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
        console.warn('[AutoTranscode] FFmpeg API unavailable, falling back to direct native playback');
        isTranscodingRef.current = false;
        setFfmpegFallbackActive(false);
        setPlaybackMessage('');
        await loadPlayerSource(selectedChannel.url, false);
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
          console.warn('[AutoTranscode] FFmpeg proxy returned error, falling back to direct native playback:', result.error);
          isTranscodingRef.current = false;
          setFfmpegFallbackActive(false);
          setPlaybackMessage('');
          await loadPlayerSource(selectedChannel.url, false);
        }
      } catch (err) {
        console.error('[AutoTranscode] Fallback error, falling back to direct native playback:', err);
        isTranscodingRef.current = false;
        setFfmpegFallbackActive(false);
        setPlaybackMessage('');
        await loadPlayerSource(selectedChannel.url, false);
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

    const nativeTrackHandlers = attachNativeTrackHandlers({
      isActive: () => active,
      language,
      setActiveAudioTrack,
      setAudioTracks,
      setSubtitleTracks,
      video,
    });

    const onLoadedMetadata = () => {
      resumePlayback(video.duration || 0);
      nativeTrackHandlers.syncInitialAudioTracks();
    };

    const progressController = createPlayerProgressController({
      durationRef,
      isTranscodingRef,
      lastBufferedUpdateRef,
      learnedIntroRef,
      saveWatchProgress,
      seekOffsetRef,
      selectedChannel,
      setBufferedProgress,
      setCurrentTime,
      setDuration,
      setShowIntroSkip,
      setVideoReady,
      video,
    });

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
      const total = progressController.getTotalDuration();
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

    const detachVideoEvents = attachPlayerVideoEvents(video, {
      error: onVideoError,
      play: onPlayEvent,
      playing: onPlaying,
      canplay: onPlaying,
      volumechange: onInteract,
      loadedmetadata: onLoadedMetadata,
      timeupdate: progressController.handleTimeUpdate,
      durationchange: progressController.handleDurationChange,
      pause: onPauseEvent,
      waiting: onWaiting,
      seeking: clearStall,
      seeked: onSeekedClear,
      progress: progressController.handleProgress,
    });

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
          backBufferLength: 15,
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

        registerHlsTrackHandlers({
          events: HlsPlayer.Events,
          forceUnmute,
          hls,
          language,
          onManifestReady: () => {
            resumePlayback(video.duration || 0);
            video.play().then(forceUnmute).catch(() => { });
          },
          setActiveAudioTrack,
          setActiveQualityLevel,
          setActiveSubtitle,
          setAudioTracks,
          setQualityLevels,
          setSubtitleTracks,
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

      let shouldTranscode = hasUnsupportedCodecHint(selectedChannel);
      let streamId: number | undefined = undefined;
      const isLocalFile = isLocalMediaSource(playUrl);

      // Codec analysis for all non-live VOD streams (remote + local downloads, including HLS VOD).
      // Chromium cannot decode AC3/EAC3/DTS natively even in HLS playlists.
      if (selectedChannel.type !== 'live' && window.electronAPI?.probeAudioCodec && window.electronAPI?.startFfmpegProxy) {
        setPlaybackStatus('loading');
        setPlaybackMessage(language === 'tr' ? 'Ses formatı kontrol ediliyor...' : 'Checking audio format...');
        const probeDecision = await probePlaybackCompatibility(selectedChannel, isLocalFile);
        if (!active) return;
        if (probeDecision.videoCodec) {
          probedVideoCodecRef.current = probeDecision.videoCodec;
        }
        if (probeDecision.duration) setDuration(probeDecision.duration);
        if (probeDecision.audioStreams.length > 0) {
          setAudioTracks(probeDecision.audioStreams);
          setActiveAudioTrack(probeDecision.selectedAudioTrack);
        }
        streamId = probeDecision.streamId;
        activeAudioStreamIdRef.current = streamId;
        shouldTranscode ||= probeDecision.shouldTranscode;
        localBrowserSafeRef.current = probeDecision.localBrowserSafe;
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
          console.warn('[AutoTranscode] FFmpeg transcode failed or unavailable, falling back to direct native playback:', transcodeRes.error);
          isTranscodingRef.current = false;
          setFfmpegFallbackActive(false);
          setPlaybackMessage('');
          await loadPlayerSource(playUrl, false);
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
        // Cleanup must cancel the latest debounced seek, not the timer captured at mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        clearTimeout(seekTimeoutRef.current);
      }
      clearInterval(unmuteInterval);
      clearStall();
      detachVideoEvents();

      nativeTrackHandlers.detach();
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      resetSubtitles();

      if (window.electronAPI?.stopFfmpegProxy) {
        window.electronAPI.stopFfmpegProxy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel]);



}
