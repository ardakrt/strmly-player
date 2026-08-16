import { useState } from 'react';
import type Hls from 'hls.js';
import type { PlaylistItem } from '../utils/m3uParser';
import { PLAYER_AUDIO_PREF_KEY, translateReason } from './cinematicPlayerHelpers';

export interface CinematicAudioTrack {
  id: number;
  name: string;
  lang: string;
  streamId?: number;
  codec?: string;
}

interface UseCinematicPlayerAudioProps {
  selectedChannel: PlaylistItem | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsInstanceRef: React.RefObject<Hls | null>;
  isTranscodingRef: React.MutableRefObject<boolean>;
  activeAudioStreamIdRef: React.MutableRefObject<number | undefined>;
  seekOffsetRef: React.MutableRefObject<number>;
  language: 'tr' | 'en';
  showToast: (message: string) => void;
  invokeFfmpegProxy: (startTime?: number, audioStreamId?: number) => Promise<any>;
  forceUnmute: () => void;
  setFfmpegFallbackActive: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCinematicPlayerAudio({
  selectedChannel, videoRef, hlsInstanceRef, isTranscodingRef,
  activeAudioStreamIdRef, seekOffsetRef, language, showToast,
  invokeFfmpegProxy, forceUnmute, setFfmpegFallbackActive,
}: UseCinematicPlayerAudioProps) {
  const [audioTracks, setAudioTracks] = useState<CinematicAudioTrack[]>([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState(0);

  const handleAudioTrackChange = async (trackId: number) => {
    setActiveAudioTrack(trackId);
    const selectedTrack = audioTracks.find((track) => track.id === trackId);
    if (selectedTrack) {
      localStorage.setItem(PLAYER_AUDIO_PREF_KEY, JSON.stringify({
        name: selectedTrack.name,
        lang: selectedTrack.lang,
      }));
    }
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.audioTrack = trackId;
      return;
    }

    const video = videoRef.current;
    const nativeTracks = video ? (video as any).audioTracks : null;
    const useTranscoding = isTranscodingRef.current || !nativeTracks?.length;
    if (useTranscoding && selectedChannel && window.electronAPI?.startFfmpegProxy && video) {
      const streamId = selectedTrack?.streamId;
      activeAudioStreamIdRef.current = streamId;
      showToast(translateReason('Ses dili değiştiriliyor (Transcode)...', language));
      const currentPosition = video.currentTime;
      try {
        const result = await invokeFfmpegProxy(seekOffsetRef.current + currentPosition, streamId);
        if (result.success && result.url) {
          seekOffsetRef.current += currentPosition;
          isTranscodingRef.current = true;
          setFfmpegFallbackActive(true);
          video.src = result.url;
          video.play().then(forceUnmute).catch(() => undefined);
        }
      } catch (error) {
        console.error('Transcoded audio track change error:', error);
      }
      return;
    }

    if (video && nativeTracks) {
      for (let index = 0; index < nativeTracks.length; index += 1) {
        nativeTracks[index].enabled = index === trackId;
      }
    }
  };

  return { audioTracks, activeAudioTrack, setAudioTracks, setActiveAudioTrack, handleAudioTrackChange };
}
